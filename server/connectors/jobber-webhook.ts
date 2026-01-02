import { db } from "../db";
import { jobberWebhookEvents, jobberAccounts, jobberEnrichments } from "@shared/schema";
import { eq, and, lt, or } from "drizzle-orm";
import { getJobberClient } from "./jobber-client";
import { lotSizeResolver } from "../services/lotSizeResolver";
import crypto from "crypto";

interface WebhookPayload {
  webhookEventId: string;
  accountId: string;
  topic: string;
  appId: string;
  data: {
    webUri?: string;
    [key: string]: any;
  };
}

type WebhookStatus = "pending" | "processing" | "completed" | "failed" | "skipped";

const SUPPORTED_TOPICS = [
  "CLIENT_CREATE",
  "CLIENT_UPDATE",
  "PROPERTY_CREATE",
  "PROPERTY_UPDATE",
  "QUOTE_CREATE",
  "QUOTE_UPDATE",
];

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_BASE_MS = 5000;

class JobberWebhookProcessor {
  private processing = false;
  private queue: WebhookPayload[] = [];

  async receiveWebhook(payload: WebhookPayload): Promise<{ acknowledged: boolean; eventId: string }> {
    const { webhookEventId, accountId, topic, data } = payload;
    
    const objectId = this.extractObjectId(topic, data);
    
    const existing = await db
      .select()
      .from(jobberWebhookEvents)
      .where(eq(jobberWebhookEvents.webhookEventId, webhookEventId))
      .limit(1);

    if (existing.length > 0) {
      console.log(`[Jobber Webhook] Duplicate event ${webhookEventId}, skipping`);
      return { acknowledged: true, eventId: webhookEventId };
    }

    await db.insert(jobberWebhookEvents).values({
      webhookEventId,
      jobberAccountId: accountId,
      topic,
      objectId,
      payload: payload,
      status: SUPPORTED_TOPICS.includes(topic) ? "pending" : "skipped",
      receivedAt: new Date(),
    });

    if (SUPPORTED_TOPICS.includes(topic)) {
      this.queue.push(payload);
      this.processQueueAsync();
    } else {
      console.log(`[Jobber Webhook] Unsupported topic ${topic}, skipped`);
    }

    return { acknowledged: true, eventId: webhookEventId };
  }

  private extractObjectId(topic: string, data: any): string {
    if (data.webUri) {
      const match = data.webUri.match(/\/(clients?|properties|quotes)\/(\d+)/i);
      if (match) return match[2];
    }
    return data.id || "unknown";
  }

  private async processQueueAsync(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const payload = this.queue.shift();
        if (payload) {
          await this.processWebhookEvent(payload);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async processWebhookEvent(payload: WebhookPayload): Promise<void> {
    const { webhookEventId, accountId, topic, data } = payload;
    const objectId = this.extractObjectId(topic, data);

    console.log(`[Jobber Webhook] Processing ${topic} for object ${objectId}`);

    try {
      await db
        .update(jobberWebhookEvents)
        .set({ status: "processing" as WebhookStatus })
        .where(eq(jobberWebhookEvents.webhookEventId, webhookEventId));

      const client = await getJobberClient(accountId);
      let enrichmentData: any = null;

      if (topic.startsWith("CLIENT_")) {
        const result = await client.getClient(objectId);
        if (!result?.client) {
          console.log(`[Jobber Webhook] Client ${objectId} not found or deleted, skipping enrichment`);
          await db
            .update(jobberWebhookEvents)
            .set({
              status: "skipped" as WebhookStatus,
              error: "Object not found (possibly deleted)",
              processedAt: new Date(),
            })
            .where(eq(jobberWebhookEvents.webhookEventId, webhookEventId));
          return;
        }
        enrichmentData = await this.enrichClient(accountId, objectId, result.client);
      } else if (topic.startsWith("PROPERTY_")) {
        const result = await client.getProperty(objectId);
        if (!result?.property) {
          console.log(`[Jobber Webhook] Property ${objectId} not found or deleted, skipping enrichment`);
          await db
            .update(jobberWebhookEvents)
            .set({
              status: "skipped" as WebhookStatus,
              error: "Object not found (possibly deleted)",
              processedAt: new Date(),
            })
            .where(eq(jobberWebhookEvents.webhookEventId, webhookEventId));
          return;
        }
        enrichmentData = await this.enrichProperty(accountId, objectId, result.property);
      } else if (topic.startsWith("QUOTE_")) {
        const result = await client.getQuote(objectId);
        if (!result?.quote) {
          console.log(`[Jobber Webhook] Quote ${objectId} not found or deleted, skipping enrichment`);
          await db
            .update(jobberWebhookEvents)
            .set({
              status: "skipped" as WebhookStatus,
              error: "Object not found (possibly deleted)",
              processedAt: new Date(),
            })
            .where(eq(jobberWebhookEvents.webhookEventId, webhookEventId));
          return;
        }
        enrichmentData = await this.enrichQuote(accountId, objectId, result.quote);
      }

      await db
        .update(jobberWebhookEvents)
        .set({
          status: "completed" as WebhookStatus,
          processedAt: new Date(),
        })
        .where(eq(jobberWebhookEvents.webhookEventId, webhookEventId));

      console.log(`[Jobber Webhook] Completed processing ${topic} for object ${objectId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Jobber Webhook] Error processing ${topic}: ${errorMessage}`);

      const [event] = await db
        .select()
        .from(jobberWebhookEvents)
        .where(eq(jobberWebhookEvents.webhookEventId, webhookEventId))
        .limit(1);

      const attempts = (event?.attempts || 0) + 1;
      
      if (attempts >= MAX_RETRY_ATTEMPTS) {
        await db
          .update(jobberWebhookEvents)
          .set({
            status: "failed" as WebhookStatus,
            error: errorMessage,
            attempts,
          })
          .where(eq(jobberWebhookEvents.webhookEventId, webhookEventId));
      } else {
        const nextRetry = new Date(Date.now() + RETRY_BACKOFF_BASE_MS * Math.pow(2, attempts));
        await db
          .update(jobberWebhookEvents)
          .set({
            status: "pending" as WebhookStatus,
            error: errorMessage,
            attempts,
            nextRetryAt: nextRetry,
          })
          .where(eq(jobberWebhookEvents.webhookEventId, webhookEventId));
        
        setTimeout(() => {
          this.queue.push(payload);
          this.processQueueAsync();
        }, RETRY_BACKOFF_BASE_MS * Math.pow(2, attempts));
      }
    }
  }

  private async enrichClient(accountId: string, clientId: string, clientData: any): Promise<any> {
    const enrichment = {
      serviceClass: this.determineServiceClass(clientData),
    };

    await this.saveEnrichment(accountId, "client", clientId, enrichment);
    return enrichment;
  }

  private async enrichProperty(accountId: string, propertyId: string, propertyData: any): Promise<any> {
    const address = [
      propertyData.street,
      propertyData.city,
      propertyData.province,
      propertyData.postalCode,
    ].filter(Boolean).join(", ");

    let lotSizeEstimate: number | null = null;
    let confidence = "low";

    if (address) {
      try {
        const lotResult = await lotSizeResolver.resolve(address);
        if (lotResult.lotAreaSqft) {
          lotSizeEstimate = lotResult.lotAreaSqft;
          confidence = lotResult.confidence;
        }
      } catch (error) {
        console.log(`[Jobber Enrichment] Could not resolve lot size for ${address}`);
      }
    }

    const enrichment = {
      lotSizeEstimate,
      serviceClass: this.classifyByLotSize(lotSizeEstimate),
      accessConstraints: [],
      slopeRisk: "low",
      confidence,
    };

    await this.saveEnrichment(accountId, "property", propertyId, enrichment);
    return enrichment;
  }

  private async enrichQuote(accountId: string, quoteId: string, quoteData: any): Promise<any> {
    const enrichment = {
      propertyId: quoteData.property?.id,
      clientId: quoteData.client?.id,
      quoteStatus: quoteData.quoteStatus,
    };

    await this.saveEnrichment(accountId, "quote", quoteId, enrichment);
    return enrichment;
  }

  private determineServiceClass(clientData: any): string {
    if (clientData.companyName) {
      return "commercial";
    }
    return "residential_medium";
  }

  private classifyByLotSize(sqft: number | null): string {
    if (!sqft) return "residential_medium";
    if (sqft < 5000) return "residential_small";
    if (sqft < 15000) return "residential_medium";
    if (sqft < 43560) return "residential_large";
    return "commercial";
  }

  private async saveEnrichment(
    accountId: string,
    objectType: string,
    objectId: string,
    data: any
  ): Promise<void> {
    const existing = await db
      .select()
      .from(jobberEnrichments)
      .where(
        and(
          eq(jobberEnrichments.jobberAccountId, accountId),
          eq(jobberEnrichments.objectType, objectType),
          eq(jobberEnrichments.objectId, objectId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(jobberEnrichments)
        .set({
          lotSizeEstimate: data.lotSizeEstimate,
          serviceClass: data.serviceClass,
          accessConstraints: data.accessConstraints,
          slopeRisk: data.slopeRisk,
          enrichmentData: data,
          updatedAt: new Date(),
        })
        .where(eq(jobberEnrichments.id, existing[0].id));
    } else {
      await db.insert(jobberEnrichments).values({
        jobberAccountId: accountId,
        objectType,
        objectId,
        lotSizeEstimate: data.lotSizeEstimate,
        serviceClass: data.serviceClass,
        accessConstraints: data.accessConstraints,
        slopeRisk: data.slopeRisk,
        enrichmentData: data,
      });
    }
  }
}

export const jobberWebhookProcessor = new JobberWebhookProcessor();

export function verifyJobberWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
