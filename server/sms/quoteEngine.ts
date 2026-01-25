import type { SmsTemplate } from "./templateLoader";

export interface QuoteInput {
  frequency: string;
  lot_size_bucket: string;
  services_requested: string[];
  fence?: string;
  slope?: string;
}

export interface QuoteResult {
  range_low: number;
  range_high: number;
  exact_amount?: number;
  display: string;
  assumptions: string[];
  requires_site_visit: boolean;
  site_visit_reasons: string[];
}

export function computeLotBucket(
  arcgisAcres: number | undefined,
  userBucket: string | undefined
): string {
  if (userBucket && userBucket !== "unknown") {
    return userBucket;
  }
  
  if (arcgisAcres !== undefined) {
    if (arcgisAcres < 0.25) return "small";
    if (arcgisAcres < 0.5) return "medium";
    return "large";
  }
  
  return "unknown";
}

export function computeQuoteRange(
  template: SmsTemplate,
  input: QuoteInput
): QuoteResult {
  const { frequency, lot_size_bucket, services_requested, fence, slope } = input;
  const quotePolicy = template.quote_policy;
  
  const frequencyPricing = quotePolicy.range_per_visit_usd[frequency] || 
    quotePolicy.range_per_visit_usd["one_time"];
  
  const bucket = lot_size_bucket || "unknown";
  const [baseLow, baseHigh] = frequencyPricing[bucket] || frequencyPricing["unknown"];
  
  let low = baseLow;
  let high = baseHigh;
  const assumptions: string[] = [];
  
  assumptions.push(`Base pricing for ${bucket} lot, ${frequency} service`);
  
  const siteVisitReasons: string[] = [];
  let requiresSiteVisit = false;
  
  const siteVisitServices = template.service_catalog.site_visit_required_services || [];
  for (const service of services_requested) {
    if (siteVisitServices.includes(service)) {
      requiresSiteVisit = true;
      siteVisitReasons.push(`Service "${service}" typically requires site assessment`);
    }
  }
  
  let exactAmount: number | undefined;
  
  if (quotePolicy.exact_pricing.enabled && fence && slope) {
    const midpoint = (low + high) / 2;
    let adjusted = midpoint;
    
    if (fence === "yes" && quotePolicy.exact_pricing.adjustments.fence_yes) {
      adjusted *= quotePolicy.exact_pricing.adjustments.fence_yes;
      assumptions.push("Adjusted for fenced areas (+10%)");
    }
    
    if (slope === "sloped" && quotePolicy.exact_pricing.adjustments.slope_sloped) {
      adjusted *= quotePolicy.exact_pricing.adjustments.slope_sloped;
      assumptions.push("Adjusted for sloped terrain (+15%)");
    }
    
    exactAmount = Math.round(adjusted);
  }
  
  const formatFreq = {
    weekly: "weekly",
    biweekly: "bi-weekly",
    monthly: "monthly",
    one_time: "one-time"
  }[frequency] || frequency;
  
  const display = exactAmount 
    ? `$${exactAmount} per visit (${formatFreq})`
    : `$${low}-$${high} per visit (${formatFreq})`;
  
  return {
    range_low: low,
    range_high: high,
    exact_amount: exactAmount,
    display,
    assumptions,
    requires_site_visit: requiresSiteVisit,
    site_visit_reasons: siteVisitReasons,
  };
}

export function shouldRequireSiteVisit(
  template: SmsTemplate,
  collected: Record<string, any>,
  derived: Record<string, any>
): { required: boolean; reasons: string[] } {
  const rules = template.quote_policy.site_visit_rules;
  const reasons: string[] = [];
  
  if (derived.address_confidence !== undefined && 
      derived.address_confidence < rules.if_address_confidence_below) {
    reasons.push("Address confidence too low for remote quoting");
  }
  
  const services = collected.services_requested || [];
  for (const service of services) {
    if (rules.if_services_include_any_of.includes(service)) {
      reasons.push(`Service "${service}" requires site assessment`);
    }
  }
  
  const propertyType = derived.property_type || collected.property_type;
  if (propertyType && rules.if_property_type_is.includes(propertyType)) {
    reasons.push(`Property type "${propertyType}" requires site assessment`);
  }
  
  return {
    required: reasons.length > 0,
    reasons,
  };
}
