import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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
  recommended_text: z.string().max(500),
  asks_for_photos: z.boolean(),
  photo_instructions: z.string().nullable(),
});

export const quoteOutputSchema = z.object({
  quote: quoteBlockSchema,
  customer_message: customerMessageSchema,
  requires_human_approval: z.boolean(),
  approval_reason: z.string(),
  confidence: z.number().min(0).max(1),
});

export type QuoteOutput = z.infer<typeof quoteOutputSchema>;
export type LineItem = z.infer<typeof lineItemSchema>;

export interface LeadCaptureSummary {
  name: string | null;
  address: string | null;
  service_requested: "mowing" | "cleanup" | "mulch" | "landscaping" | "other";
  urgency: "today" | "this_week" | "flexible" | "unknown";
  property_size_hint: "small" | "medium" | "large" | "unknown";
  notes: string;
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

function getCurrentSeason(): "spring" | "summer" | "fall" | "winter" {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

function needsPhotos(serviceType: string, hasPhotos: boolean): boolean {
  const photoRequiredServices = ["cleanup", "landscaping", "mulch"];
  return photoRequiredServices.includes(serviceType) && !hasPhotos;
}

function calculateBasePrice(
  lead: LeadCaptureSummary,
  pricing: PricingRules,
  season: "spring" | "summer" | "fall" | "winter"
): { low: number; high: number; lineItems: LineItem[] } {
  const sizeKey = lead.property_size_hint === "unknown" ? "medium" : lead.property_size_hint;
  const seasonalMod = pricing.seasonalModifiers[season];
  const lineItems: LineItem[] = [];
  
  let low = pricing.minimumPrice;
  let high = pricing.minimumPrice;
  
  switch (lead.service_requested) {
    case "mowing":
      const mowPrice = pricing.mowing[sizeKey];
      low = Math.max(pricing.minimumPrice, mowPrice * seasonalMod);
      high = low * 1.2;
      lineItems.push({
        name: `Lawn Mowing (${sizeKey} yard)`,
        qty: 1,
        unit: "visit",
        unit_price_usd: low,
        total_usd: low,
      });
      break;
      
    case "cleanup":
      const cleanupBase = pricing.cleanup[sizeKey];
      low = Math.max(pricing.minimumPrice, cleanupBase * seasonalMod);
      high = low * 1.5;
      lineItems.push({
        name: `Yard Cleanup (${sizeKey} yard)`,
        qty: 1,
        unit: "service",
        unit_price_usd: low,
        total_usd: low,
      });
      break;
      
    case "mulch":
      const yardsEstimate = sizeKey === "small" ? 2 : sizeKey === "medium" ? 4 : 8;
      const mulchCost = yardsEstimate * pricing.mulch.perYard;
      const laborHours = sizeKey === "small" ? 2 : sizeKey === "medium" ? 4 : 6;
      const laborCost = laborHours * pricing.mulch.laborPerHour;
      low = Math.max(pricing.minimumPrice, (mulchCost + laborCost) * seasonalMod);
      high = low * 1.3;
      lineItems.push(
        {
          name: "Mulch material",
          qty: yardsEstimate,
          unit: "cubic yard",
          unit_price_usd: pricing.mulch.perYard,
          total_usd: mulchCost,
        },
        {
          name: "Installation labor",
          qty: laborHours,
          unit: "hour",
          unit_price_usd: pricing.mulch.laborPerHour,
          total_usd: laborCost,
        }
      );
      break;
      
    case "landscaping":
      low = pricing.landscaping.consultFee;
      high = pricing.landscaping.consultFee + (pricing.landscaping.hourlyRate * 4);
      lineItems.push({
        name: "Landscaping consultation",
        qty: 1,
        unit: "visit",
        unit_price_usd: pricing.landscaping.consultFee,
        total_usd: pricing.landscaping.consultFee,
      });
      break;
      
    default:
      low = pricing.minimumPrice;
      high = pricing.minimumPrice * 2;
      lineItems.push({
        name: "General service estimate",
        qty: 1,
        unit: "service",
        unit_price_usd: low,
        total_usd: low,
      });
  }
  
  return { low: Math.round(low * 100) / 100, high: Math.round(high * 100) / 100, lineItems };
}

function determineQuoteType(
  lead: LeadCaptureSummary,
  hasPhotos: boolean,
  confidence: number
): "range" | "fixed" | "needs_site_visit" {
  if (lead.service_requested === "landscaping" && !hasPhotos) {
    return "needs_site_visit";
  }
  
  if (lead.property_size_hint === "unknown" || !lead.address) {
    return "range";
  }
  
  if (confidence >= 0.85 && hasPhotos) {
    return "fixed";
  }
  
  return "range";
}

function requiresApproval(
  quoteType: "range" | "fixed" | "needs_site_visit",
  tier: "Owner" | "SMB" | "Commercial",
  highUsd: number,
  maxAutoQuote: number,
  confidence: number
): { required: boolean; reason: string } {
  if (quoteType === "fixed" && (tier === "Owner" || tier === "SMB")) {
    return { required: true, reason: "Fixed pricing requires approval for Owner/SMB tier" };
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
  
  return { required: false, reason: "" };
}

export async function runQuotingAgent(
  lead: LeadCaptureSummary,
  pricing: PricingRules,
  policy: PolicyThresholds,
  context: QuotingContext
): Promise<QuoteOutput> {
  const season = getCurrentSeason();
  const shouldRequestPhotos = needsPhotos(lead.service_requested, context.hasPhotos);
  const baseCalc = calculateBasePrice(lead, pricing, season);
  
  const systemPrompt = `You are the Quoting & Estimate Agent for ${context.businessName}, a landscaping/lawn care company.

INPUTS:
Lead Summary:
- Name: ${lead.name || "Unknown"}
- Address: ${lead.address || "Not provided"}
- Service: ${lead.service_requested}
- Property Size: ${lead.property_size_hint}
- Urgency: ${lead.urgency}
- Notes: ${lead.notes}

Photos Provided: ${context.hasPhotos}
${context.photoNotes ? `Photo Notes: ${context.photoNotes}` : ""}

PRICING RULES:
- Minimum price: $${pricing.minimumPrice}
- Current season: ${season} (modifier: ${pricing.seasonalModifiers[season]}x)
- Base calculation: $${baseCalc.low} - $${baseCalc.high}

POLICY:
- Tier: ${policy.tier}
- Auto-send quotes: ${policy.auto_send_quotes}
- Max auto-quote: $${policy.max_auto_quote_usd}
- Confidence threshold: ${policy.confidence_threshold}

RULES:
1. Never quote below minimum pricing ($${pricing.minimumPrice})
2. If data incomplete, produce a range with assumptions, or mark needs_site_visit
3. ${shouldRequestPhotos ? "Request photos - this service type requires them and none were provided" : "Photos not required or already provided"}
4. ${policy.tier === "Owner" || policy.tier === "SMB" ? "Set requires_human_approval=true for fixed pricing" : "Commercial tier allows auto-quotes for high confidence"}

OUTPUT JSON SCHEMA:
{
  "quote": {
    "type": "range|fixed|needs_site_visit",
    "low_usd": number (minimum $${pricing.minimumPrice}),
    "high_usd": number,
    "line_items": [{"name": "string", "qty": number, "unit": "string", "unit_price_usd": number, "total_usd": number}],
    "assumptions": ["list of assumptions made"],
    "exclusions": ["what's not included"]
  },
  "customer_message": {
    "recommended_text": "friendly message to customer (max 500 chars)",
    "asks_for_photos": boolean,
    "photo_instructions": "instructions if asking for photos, null otherwise"
  },
  "requires_human_approval": boolean,
  "approval_reason": "reason for approval requirement",
  "confidence": 0.0-1.0
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate a quote for ${lead.service_requested} service at ${lead.address || "address TBD"}` },
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
    
    const quoteType = determineQuoteType(lead, context.hasPhotos, parsed.confidence || 0.7);
    parsed.quote.type = quoteType;
    
    if (shouldRequestPhotos) {
      parsed.customer_message.asks_for_photos = true;
      if (!parsed.customer_message.photo_instructions) {
        parsed.customer_message.photo_instructions = "Please send a few photos of your yard from different angles so we can provide an accurate estimate.";
      }
    }
    
    const approvalCheck = requiresApproval(
      parsed.quote.type,
      policy.tier,
      parsed.quote.high_usd,
      policy.max_auto_quote_usd,
      parsed.confidence || 0.7
    );
    parsed.requires_human_approval = approvalCheck.required;
    parsed.approval_reason = approvalCheck.reason;
    
    if (parsed.customer_message?.recommended_text) {
      parsed.customer_message.recommended_text = parsed.customer_message.recommended_text.slice(0, 500);
    }

    const validated = quoteOutputSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("[Quoting] Validation error:", validated.error.errors);
      throw new Error("Invalid AI response format");
    }

    return validated.data;
  } catch (error) {
    console.error("[Quoting] Error:", error);
    return createFallbackQuote(lead, pricing, policy, context, baseCalc, shouldRequestPhotos);
  }
}

function createFallbackQuote(
  lead: LeadCaptureSummary,
  pricing: PricingRules,
  policy: PolicyThresholds,
  context: QuotingContext,
  baseCalc: { low: number; high: number; lineItems: LineItem[] },
  shouldRequestPhotos: boolean
): QuoteOutput {
  const quoteType = determineQuoteType(lead, context.hasPhotos, 0.6);
  const approvalCheck = requiresApproval(quoteType, policy.tier, baseCalc.high, policy.max_auto_quote_usd, 0.6);
  
  const assumptions: string[] = [];
  if (lead.property_size_hint === "unknown") {
    assumptions.push("Assumed medium-sized property");
  }
  if (!lead.address) {
    assumptions.push("Final pricing depends on actual location");
  }
  
  const exclusions = [
    "Disposal fees for large debris",
    "Work requiring special equipment",
    "Services not explicitly listed",
  ];

  let recommendedText = `Hi${lead.name ? ` ${lead.name}` : ""}! Based on your ${lead.service_requested} request, we estimate $${baseCalc.low}`;
  if (quoteType === "range") {
    recommendedText += `-$${baseCalc.high}`;
  }
  recommendedText += `. ${shouldRequestPhotos ? "Could you send some photos of your yard?" : "When works best for you?"}`;

  return {
    quote: {
      type: quoteType,
      low_usd: baseCalc.low,
      high_usd: baseCalc.high,
      line_items: baseCalc.lineItems,
      assumptions,
      exclusions,
    },
    customer_message: {
      recommended_text: recommendedText.slice(0, 500),
      asks_for_photos: shouldRequestPhotos,
      photo_instructions: shouldRequestPhotos 
        ? "Please send a few photos of your yard from different angles so we can provide an accurate estimate."
        : null,
    },
    requires_human_approval: approvalCheck.required,
    approval_reason: approvalCheck.reason || "Fallback quote - manual review recommended",
    confidence: 0.6,
  };
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
