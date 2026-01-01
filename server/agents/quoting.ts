import OpenAI from "openai";
import { z } from "zod";
import { geoService, type GeocodeResult, type ParcelResult, type CountyResult, type ParcelCoverageResult } from "../services/geo";
import { quoteCalculator, type QuoteCalculatorInput, type ServiceType, type Frequency } from "../services/quote-calculator";
import { AreaBands, type AreaBandKey } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SMS_MAX_LENGTH = 320;

const lineItemSchema = z.object({
  name: z.string(),
  qty: z.number().positive(),
  unit: z.string(),
  unit_price_usd: z.number().min(0),
  total_usd: z.number().min(0),
});

const quoteBlockSchema = z.object({
  type: z.enum(["range", "fixed", "needs_site_visit"]),
  low_usd: z.number().min(0),
  high_usd: z.number().min(0),
  line_items: z.array(lineItemSchema),
  assumptions: z.array(z.string()),
  exclusions: z.array(z.string()),
});

const customerMessageSchema = z.object({
  recommended_text: z.string().max(SMS_MAX_LENGTH),
  asks_for_photos: z.boolean(),
  photo_instructions: z.string().nullable(),
  proposes_site_visit: z.boolean().default(false),
});

export const quoteOutputSchema = z.object({
  quote: quoteBlockSchema,
  customer_message: customerMessageSchema,
  requires_human_approval: z.boolean(),
  approval_reason: z.string(),
  confidence: z.number().min(0).max(1),
  property_context: z.object({
    parcel_coverage: z.enum(["full", "partial", "none", "unknown"]),
    lot_area_sqft: z.number().nullable(),
    area_band: z.string().nullable(),
    data_source: z.enum(["parcel", "customer", "unknown"]),
  }).optional(),
});

export type QuoteOutput = z.infer<typeof quoteOutputSchema>;
export type LineItem = z.infer<typeof lineItemSchema>;

export interface LeadCaptureSummary {
  name: string | null;
  address: string | null;
  service_requested: ServiceType;
  frequency?: Frequency;
  urgency: "today" | "this_week" | "flexible" | "unknown";
  property_size_hint: "small" | "medium" | "large" | "unknown";
  notes: string;
  customerProvidedAreaBand?: AreaBandKey;
}

export interface PricingRules {
  minimumPrice: number;
  mowing: { small: number; medium: number; large: number };
  cleanup: { small: number; medium: number; large: number };
  mulch: { perYard: number; laborPerHour: number };
  landscaping: { consultFee: number; hourlyRate: number };
  seasonalModifiers: {
    spring: number;
    summer: number;
    fall: number;
    winter: number;
  };
  addOns: {
    edging: number;
    trimming: number;
    leafBlowing: number;
    weedControl: number;
  };
}

export interface PolicyThresholds {
  tier: "Owner" | "SMB" | "Commercial";
  confidence_threshold: number;
  auto_send_quotes: boolean;
  max_auto_quote_usd: number;
}

export interface QuotingContext {
  hasPhotos: boolean;
  photoNotes: string | null;
  businessName: string;
}

interface PropertyResolution {
  geocode: GeocodeResult | null;
  county: CountyResult | null;
  parcelCoverage: ParcelCoverageResult | null;
  parcel: ParcelResult | null;
  areaBand: AreaBandKey;
  lotAreaSqft: number | null;
  source: "parcel" | "customer" | "unknown";
  confidence: "high" | "medium" | "low";
}

async function resolvePropertyData(
  lead: LeadCaptureSummary
): Promise<PropertyResolution> {
  const result: PropertyResolution = {
    geocode: null,
    county: null,
    parcelCoverage: null,
    parcel: null,
    areaBand: "medium",
    lotAreaSqft: null,
    source: "unknown",
    confidence: "low",
  };

  if (lead.customerProvidedAreaBand) {
    result.areaBand = lead.customerProvidedAreaBand;
    result.source = "customer";
    result.confidence = "medium";
    console.log(`[Quoting] Using customer-provided area band: ${result.areaBand}`);
  }

  if (!lead.address) {
    console.log("[Quoting] No address provided, using defaults");
    if (lead.property_size_hint !== "unknown") {
      result.areaBand = lead.property_size_hint === "small" ? "small" 
        : lead.property_size_hint === "large" ? "large" : "medium";
    }
    return result;
  }

  const zipMatch = lead.address.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (!zipMatch) {
    console.log("[Quoting] No ZIP code found in address");
    return result;
  }

  const zip = zipMatch[1];
  console.log(`[Quoting] Resolving county for ZIP ${zip}`);
  result.county = await geoService.resolveCountyByZip(zip);

  if (!result.county) {
    console.log("[Quoting] Could not resolve county from ZIP");
    return result;
  }

  result.parcelCoverage = await geoService.checkParcelCoverage(
    result.county.state,
    result.county.countyFips
  );

  if (result.parcelCoverage.coverage === "none") {
    console.log("[Quoting] No parcel coverage in this county");
    return result;
  }

  result.geocode = await geoService.geocodeAddress(lead.address);

  if (!result.geocode) {
    console.log("[Quoting] Could not geocode address");
    return result;
  }

  if (result.parcelCoverage.coverage === "full" || result.parcelCoverage.coverage === "partial") {
    result.parcel = await geoService.fetchParcelByLatLng(
      result.geocode.lat,
      result.geocode.lng
    );

    if (result.parcel && result.parcel.confidence >= 0.7) {
      result.lotAreaSqft = result.parcel.lotAreaSqft;
      result.areaBand = geoService.sqftToAreaBand(result.parcel.lotAreaSqft);
      result.source = "parcel";
      result.confidence = result.parcel.confidence >= 0.85 ? "high" : "medium";
      console.log(`[Quoting] Parcel data: ${result.lotAreaSqft} sqft -> ${result.areaBand} band`);
    }
  }

  return result;
}

function buildCustomerMessage(
  lead: LeadCaptureSummary,
  quoteResult: ReturnType<typeof quoteCalculator.calculateQuoteRange>,
  propertyData: PropertyResolution,
  context: QuotingContext
): { text: string; asksForPhotos: boolean; photoInstructions: string | null; proposesSiteVisit: boolean } {
  const name = lead.name ? lead.name.split(" ")[0] : "";
  const greeting = name ? `Hi ${name}! ` : "Hi! ";
  
  let asksForPhotos = false;
  let proposesSiteVisit = false;
  let photoInstructions: string | null = null;

  const priceRange = quoteResult.low === quoteResult.high
    ? `$${quoteResult.low}`
    : `$${quoteResult.low}-$${quoteResult.high}`;

  let message: string;

  if (quoteResult.confidence === "high") {
    message = `${greeting}For ${lead.service_requested}, we estimate ${priceRange}. When works best for you?`;
  } else if (quoteResult.confidence === "medium") {
    message = `${greeting}Based on your ${lead.service_requested} request, our range is ${priceRange}. Can you confirm your lot size?`;
  } else {
    const highVarianceServices = ["cleanup", "mulch", "landscaping"];
    if (highVarianceServices.includes(lead.service_requested) && !context.hasPhotos) {
      asksForPhotos = true;
      photoInstructions = "Send 2-3 photos of your yard from different angles.";
      message = `${greeting}For ${lead.service_requested}, range is ${priceRange} (broad estimate). Could you send a few yard photos for accuracy?`;
    } else {
      proposesSiteVisit = true;
      message = `${greeting}For ${lead.service_requested}, we'd estimate ${priceRange}. For accuracy, want to schedule a free site visit?`;
    }
  }

  if (message.length > SMS_MAX_LENGTH) {
    message = message.substring(0, SMS_MAX_LENGTH - 3) + "...";
  }

  return { text: message, asksForPhotos, photoInstructions, proposesSiteVisit };
}

function requiresApproval(
  quoteType: "range" | "fixed" | "needs_site_visit",
  tier: "Owner" | "SMB" | "Commercial",
  highUsd: number,
  maxAutoQuote: number,
  confidence: number
): { required: boolean; reason: string } {
  if (quoteType === "fixed") {
    return { required: true, reason: "Fixed pricing requires approval" };
  }

  if (highUsd > maxAutoQuote) {
    return { required: true, reason: `Quote exceeds auto-approval threshold ($${maxAutoQuote})` };
  }

  if (tier === "Owner") {
    return { required: true, reason: "All quotes require approval for Owner tier" };
  }

  if (tier === "Commercial" && confidence < 0.9) {
    return { required: true, reason: "Confidence below Commercial tier threshold (0.9)" };
  }

  if (tier === "SMB" && confidence < 0.85) {
    return { required: true, reason: "Confidence below SMB auto-send threshold" };
  }

  return { required: false, reason: "" };
}

export async function runQuotingAgent(
  lead: LeadCaptureSummary,
  pricing: PricingRules,
  policy: PolicyThresholds,
  context: QuotingContext
): Promise<QuoteOutput> {
  console.log(`[Quoting] Starting quote for ${lead.service_requested} at ${lead.address || "unknown address"}`);

  const propertyData = await resolvePropertyData(lead);

  const calculatorInput: QuoteCalculatorInput = {
    services: [lead.service_requested],
    frequency: lead.frequency || "one_time",
    areaBand: propertyData.areaBand,
    complexityTrees: "unknown",
    complexityShrubs: "unknown",
    complexityBeds: "unknown",
    complexitySlope: "unknown",
    complexityAccess: "unknown",
  };

  const quoteResult = quoteCalculator.calculateQuoteRange(calculatorInput);

  const adjustedLow = Math.max(quoteResult.low, pricing.minimumPrice);
  const adjustedHigh = Math.max(quoteResult.high, pricing.minimumPrice);

  let quoteType: "range" | "fixed" | "needs_site_visit";
  if (lead.service_requested === "landscaping" && !context.hasPhotos) {
    quoteType = "needs_site_visit";
  } else if (quoteResult.confidence === "high" && context.hasPhotos) {
    quoteType = "fixed";
  } else {
    quoteType = "range";
  }

  const customerMessage = buildCustomerMessage(lead, quoteResult, propertyData, context);

  const confidenceNum = quoteResult.confidence === "high" ? 0.9 
    : quoteResult.confidence === "medium" ? 0.75 : 0.5;

  const approvalCheck = requiresApproval(
    quoteType,
    policy.tier,
    adjustedHigh,
    policy.max_auto_quote_usd,
    confidenceNum
  );

  const lineItems: LineItem[] = quoteResult.lineItems.map(item => ({
    name: item.name,
    qty: item.qty,
    unit: item.unit,
    unit_price_usd: item.unitPriceUsd,
    total_usd: item.totalUsd,
  }));

  const exclusions = [
    "Disposal fees for large debris",
    "Work requiring special equipment",
    "Services not explicitly listed",
  ];

  const output: QuoteOutput = {
    quote: {
      type: quoteType,
      low_usd: adjustedLow,
      high_usd: adjustedHigh,
      line_items: lineItems,
      assumptions: quoteResult.assumptions,
      exclusions,
    },
    customer_message: {
      recommended_text: customerMessage.text,
      asks_for_photos: customerMessage.asksForPhotos,
      photo_instructions: customerMessage.photoInstructions,
      proposes_site_visit: customerMessage.proposesSiteVisit,
    },
    requires_human_approval: approvalCheck.required,
    approval_reason: approvalCheck.reason,
    confidence: confidenceNum,
    property_context: {
      parcel_coverage: propertyData.parcelCoverage?.coverage || "unknown",
      lot_area_sqft: propertyData.lotAreaSqft,
      area_band: propertyData.areaBand,
      data_source: propertyData.source,
    },
  };

  console.log(`[Quoting] Quote generated: $${adjustedLow}-$${adjustedHigh}, confidence: ${quoteResult.confidence}`);

  return output;
}

export async function runQuotingAgentWithAI(
  lead: LeadCaptureSummary,
  pricing: PricingRules,
  policy: PolicyThresholds,
  context: QuotingContext
): Promise<QuoteOutput> {
  const propertyData = await resolvePropertyData(lead);
  const calculatorInput: QuoteCalculatorInput = {
    services: [lead.service_requested],
    frequency: lead.frequency || "one_time",
    areaBand: propertyData.areaBand,
    complexityTrees: "unknown",
    complexityShrubs: "unknown",
    complexityBeds: "unknown",
    complexitySlope: "unknown",
    complexityAccess: "unknown",
  };
  const baseCalc = quoteCalculator.calculateQuoteRange(calculatorInput);

  const systemPrompt = `You are LawnFlow's Quoting Agent for ${context.businessName}.

Your job is to produce a quote RANGE with clear assumptions and a next step.
Be conservative and transparent. Never overpromise precision.

PROPERTY DATA:
- Address: ${lead.address || "Not provided"}
- Parcel Coverage: ${propertyData.parcelCoverage?.coverage || "unknown"}
- Lot Size: ${propertyData.lotAreaSqft ? `${propertyData.lotAreaSqft} sqft` : "Unknown"}
- Area Band: ${propertyData.areaBand}
- Data Source: ${propertyData.source}
- Data Confidence: ${propertyData.confidence}

BASE CALCULATION:
- Service: ${lead.service_requested}
- Price Range: $${baseCalc.low} - $${baseCalc.high}
- Confidence: ${baseCalc.confidence}
- Assumptions: ${baseCalc.assumptions.join("; ")}

BUSINESS RULES:
- Minimum price: $${pricing.minimumPrice}
- Tier: ${policy.tier}
- Max auto-quote: $${policy.max_auto_quote_usd}

RULES:
1. Use the base calculation as your starting point
2. Keep SMS under ${SMS_MAX_LENGTH} characters
3. If confidence is low, widen range and request photos or site visit
4. Never mention AI, tokens, or internal systems

OUTPUT JSON:
{
  "quote": {
    "type": "range|fixed|needs_site_visit",
    "low_usd": number,
    "high_usd": number,
    "line_items": [...],
    "assumptions": [...],
    "exclusions": [...]
  },
  "customer_message": {
    "recommended_text": "SMS message under ${SMS_MAX_LENGTH} chars",
    "asks_for_photos": boolean,
    "photo_instructions": string|null,
    "proposes_site_visit": boolean
  },
  "requires_human_approval": boolean,
  "approval_reason": string,
  "confidence": 0.0-1.0
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate a quote for ${lead.service_requested}. Customer: ${lead.name || "Unknown"}` },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);

    if (parsed.quote.low_usd < pricing.minimumPrice) {
      parsed.quote.low_usd = pricing.minimumPrice;
    }
    if (parsed.quote.high_usd < parsed.quote.low_usd) {
      parsed.quote.high_usd = parsed.quote.low_usd;
    }

    if (parsed.customer_message?.recommended_text?.length > SMS_MAX_LENGTH) {
      parsed.customer_message.recommended_text = 
        parsed.customer_message.recommended_text.substring(0, SMS_MAX_LENGTH - 3) + "...";
    }

    parsed.property_context = {
      parcel_coverage: propertyData.parcelCoverage?.coverage || "unknown",
      lot_area_sqft: propertyData.lotAreaSqft,
      area_band: propertyData.areaBand,
      data_source: propertyData.source,
    };

    const validated = quoteOutputSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("[Quoting] Validation error:", validated.error.errors);
      throw new Error("Invalid AI response format");
    }

    return validated.data;
  } catch (error) {
    console.error("[Quoting] AI error, falling back to rules-based:", error);
    return runQuotingAgent(lead, pricing, policy, context);
  }
}

export function getDefaultPricingRules(): PricingRules {
  return {
    minimumPrice: 50,
    mowing: { small: 40, medium: 60, large: 100 },
    cleanup: { small: 150, medium: 250, large: 400 },
    mulch: { perYard: 65, laborPerHour: 45 },
    landscaping: { consultFee: 75, hourlyRate: 65 },
    seasonalModifiers: {
      spring: 1.0,
      summer: 1.0,
      fall: 1.1,
      winter: 0.9,
    },
    addOns: {
      edging: 15,
      trimming: 25,
      leafBlowing: 20,
      weedControl: 35,
    },
  };
}

export function getDefaultPolicyThresholds(tier: "Owner" | "SMB" | "Commercial"): PolicyThresholds {
  switch (tier) {
    case "Owner":
      return {
        tier: "Owner",
        confidence_threshold: 0.85,
        auto_send_quotes: false,
        max_auto_quote_usd: 0,
      };
    case "SMB":
      return {
        tier: "SMB",
        confidence_threshold: 0.85,
        auto_send_quotes: true,
        max_auto_quote_usd: 500,
      };
    case "Commercial":
      return {
        tier: "Commercial",
        confidence_threshold: 0.9,
        auto_send_quotes: true,
        max_auto_quote_usd: 2000,
      };
  }
}
