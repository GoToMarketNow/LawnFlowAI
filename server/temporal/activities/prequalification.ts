/**
 * Pre-Qualification Activities for Marketing Agent
 * 
 * These activities validate prospect serviceability before engagement:
 * 1. Extract and normalize requested services
 * 2. Infer property type from context
 * 3. Resolve and geocode location
 * 4. Check serviceability (location + property + services)
 * 5. Generate clarifying questions when needed
 * 
 * @module server/temporal/activities/prequalification
 */

import { Context } from '@temporalio/activity';
import { z } from 'zod';
import { db } from '../../db';
import { 
  providerServiceAreas, 
  providerCapabilities, 
  marketingProspects,
  canonicalServices 
} from '../../../shared/schema-marketing';
import { eq, and } from 'drizzle-orm';

// Import OpenAI (assuming it's set up similarly to existing agents)
let openai: any;
try {
  const { default: OpenAI } = require('openai');
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} catch (error) {
  console.warn('OpenAI not available for pre-qualification');
}

// =====================================
// Type Definitions
// =====================================

export interface ExtractServicesInput {
  text: string;
  detectedServices?: string[];
}

export interface ExtractServicesResult {
  services: string[];
  confidence: number;
}

export interface InferPropertyTypeInput {
  text: string;
  context?: Record<string, any>;
}

export interface InferPropertyTypeResult {
  propertyType: 'residential' | 'commercial' | 'unknown';
  confidence: number;
  reasoning: string;
}

export interface ResolveLocationInput {
  rawInput?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface ResolveLocationResult {
  normalized: {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    lat?: number;
    lng?: number;
  };
  confidence: number;
}

export interface CheckServiceabilityInput {
  businessId: number;
  location?: { lat?: number; lng?: number; zip?: string };
  propertyType?: string;
  requestedServices: string[];
}

export interface CheckServiceabilityResult {
  status: 'serviceable' | 'maybe_serviceable' | 'not_serviceable';
  reasons: string[];
  matchedServiceAreaId?: string;
  distanceMiles?: number;
}

export interface GenerateQuestionInput {
  missingFields: string[];
  prospectContext: Record<string, any>;
}

export interface GenerateQuestionResult {
  message: string;
  quickReplies?: string[];
}

// =====================================
// Activity 1: Extract Requested Services
// =====================================

const ServiceExtractionSchema = z.object({
  services: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export async function extractRequestedServicesActivity(
  input: ExtractServicesInput
): Promise<ExtractServicesResult> {
  if (!openai) {
    // Fallback: return detected services or empty
    return {
      services: input.detectedServices || [],
      confidence: input.detectedServices && input.detectedServices.length > 0 ? 0.5 : 0,
    };
  }

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Extract lawn care and landscaping services from text. Map to canonical services:
          
Lawn Care: mowing, edging, trimming, blowing, aeration, fertilization, weed_control, pest_control
Landscaping: mulching, landscaping, hardscaping, irrigation
Seasonal: leaf_cleanup
Winter: snow_removal, ice_management

Return only the service keys from the list above. Be specific but inclusive.`,
        },
        {
          role: 'user',
          content: input.text,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'service_extraction',
          schema: ServiceExtractionSchema,
        },
      },
    });

    const result = completion.choices[0].message.parsed;
    if (!result) {
      throw new Error('Failed to parse service extraction response');
    }

    // Merge with any previously detected services
    const allServices = [
      ...(input.detectedServices || []),
      ...result.services,
    ];

    // Dedupe and normalize
    const uniqueServices = [...new Set(allServices)];

    return {
      services: uniqueServices,
      confidence: result.confidence,
    };
  } catch (error) {
    console.error('Service extraction error:', error);
    return {
      services: input.detectedServices || [],
      confidence: 0.3,
    };
  }
}

// =====================================
// Activity 2: Infer Property Type
// =====================================

const PropertyTypeSchema = z.object({
  propertyType: z.enum(['residential', 'commercial', 'unknown']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export async function inferPropertyTypeActivity(
  input: InferPropertyTypeInput
): Promise<InferPropertyTypeResult> {
  if (!openai) {
    return {
      propertyType: 'unknown',
      confidence: 0,
      reasoning: 'OpenAI not available',
    };
  }

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Determine if this is a residential or commercial property request.

**Residential indicators:** "my house", "my yard", "my lawn", "home", "neighbor", "HOA", single family context, "homeowner"

**Commercial indicators:** "my business", "office", "shop", "warehouse", "retail", "storefront", "commercial property", "parking lot", "office park", "business property"

Return "unknown" if insufficient information or ambiguous. Confidence should be high (>0.8) only if clear indicators present.`,
        },
        {
          role: 'user',
          content: input.text,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'property_type_inference',
          schema: PropertyTypeSchema,
        },
      },
    });

    const result = completion.choices[0].message.parsed;
    if (!result) {
      throw new Error('Failed to parse property type inference');
    }

    return result;
  } catch (error) {
    console.error('Property type inference error:', error);
    return {
      propertyType: 'unknown',
      confidence: 0,
      reasoning: 'Error inferring property type',
    };
  }
}

// =====================================
// Activity 3: Resolve Location
// =====================================

export async function resolveLocationActivity(
  input: ResolveLocationInput
): Promise<ResolveLocationResult> {
  // Priority: full address > zip > city+state > rawInput
  let searchQuery = '';

  if (input.address) {
    searchQuery = input.address;
  } else if (input.zip) {
    searchQuery = input.zip;
  } else if (input.city && input.state) {
    searchQuery = `${input.city}, ${input.state}`;
  } else if (input.rawInput) {
    searchQuery = input.rawInput;
  }

  if (!searchQuery) {
    return { normalized: {}, confidence: 0 };
  }

  // For now, return parsed input with low confidence
  // TODO: Integrate with Google Geocoding API or Mapbox
  const normalized: ResolveLocationResult['normalized'] = {
    address: input.address,
    city: input.city,
    state: input.state,
    zip: input.zip,
  };

  // Simple zip extraction if not provided
  if (!normalized.zip && searchQuery) {
    const zipMatch = searchQuery.match(/\b\d{5}(?:-\d{4})?\b/);
    if (zipMatch) {
      normalized.zip = zipMatch[0];
    }
  }

  return {
    normalized,
    confidence: normalized.zip ? 0.5 : 0.3, // Higher confidence if we have zip
  };
}

// =====================================
// Activity 4: Check Serviceability (CORE)
// =====================================

export async function checkServiceabilityActivity(
  input: CheckServiceabilityInput
): Promise<CheckServiceabilityResult> {
  const reasons: string[] = [];

  // Load provider configuration
  const [serviceAreas, capabilitiesRows] = await Promise.all([
    db.select().from(providerServiceAreas).where(
      and(
        eq(providerServiceAreas.businessId, input.businessId),
        eq(providerServiceAreas.isActive, true)
      )
    ),
    db.select().from(providerCapabilities).where(
      eq(providerCapabilities.businessId, input.businessId)
    ),
  ]);

  const capabilities = capabilitiesRows[0];

  if (!capabilities) {
    console.warn(`No capabilities configured for business ${input.businessId}`);
    return {
      status: 'maybe_serviceable',
      reasons: ['capabilities_not_configured'],
    };
  }

  // Check 1: Location serviceability
  let inServiceArea = false;
  let matchedAreaId: string | undefined;
  let distance: number | undefined;

  if (!input.location?.lat || !input.location?.lng) {
    // No geocoded location - try zip-only match
    if (!input.location?.zip) {
      reasons.push('location_missing');
    } else {
      // Check zip list areas
      for (const area of serviceAreas) {
        if (area.areaType === 'zip_list' && area.zipCodes?.includes(input.location.zip)) {
          inServiceArea = true;
          matchedAreaId = area.id.toString();
          break;
        }
      }
      if (!inServiceArea) {
        reasons.push('out_of_area');
      }
    }
  } else {
    // Full geocoded location
    for (const area of serviceAreas) {
      const match = checkPointInServiceArea(
        input.location.lat,
        input.location.lng,
        area
      );
      if (match.inArea) {
        inServiceArea = true;
        matchedAreaId = area.id.toString();
        distance = match.distance;
        break;
      }
    }
    if (!inServiceArea) {
      reasons.push('out_of_area');
    }
  }

  // Check 2: Services offered
  const unsupportedServices = input.requestedServices.filter(
    (service) => !capabilities.servicesOffered.includes(service)
  );

  if (unsupportedServices.length > 0) {
    reasons.push('service_not_offered');
  }

  // Check 3: Property type supported
  if (input.propertyType === 'commercial' && !capabilities.supportsCommercial) {
    reasons.push('commercial_not_supported');
  }
  if (input.propertyType === 'residential' && !capabilities.supportsResidential) {
    reasons.push('residential_not_supported');
  }

  // Determine final status
  if (reasons.length === 0) {
    return {
      status: 'serviceable',
      reasons: [],
      matchedServiceAreaId: matchedAreaId,
      distanceMiles: distance,
    };
  } else if (reasons.includes('location_missing')) {
    return {
      status: 'maybe_serviceable',
      reasons,
      matchedServiceAreaId: matchedAreaId,
      distanceMiles: distance,
    };
  } else {
    return {
      status: 'not_serviceable',
      reasons,
      distanceMiles: distance,
    };
  }
}

// =====================================
// Activity 5: Generate Next Question
// =====================================

export async function generateNextQuestionActivity(
  input: GenerateQuestionInput
): Promise<GenerateQuestionResult> {
  // Ask for ONE field at a time (UX best practice)
  const field = input.missingFields[0];

  if (field === 'location') {
    return {
      message: `What's your property address or zip code so I can confirm we service your area?`,
      quickReplies: undefined, // Open text response
    };
  }

  if (field === 'propertyType') {
    return {
      message: `Is this for a home or business property?`,
      quickReplies: ['Home', 'Business'],
    };
  }

  if (field === 'services') {
    return {
      message: `What service do you need?`,
      quickReplies: ['Mowing', 'Landscaping', 'Cleanup', 'Other'],
    };
  }

  return {
    message: `Could you share a bit more about what you need?`,
  };
}

// =====================================
// Helper Functions
// =====================================

interface ServiceAreaCheckResult {
  inArea: boolean;
  distance?: number;
}

function checkPointInServiceArea(
  lat: number,
  lng: number,
  area: any
): ServiceAreaCheckResult {
  if (area.areaType === 'radius') {
    if (!area.radiusCenter || !area.radiusMiles) {
      return { inArea: false };
    }
    const distance = calculateDistance(
      lat,
      lng,
      area.radiusCenter.lat,
      area.radiusCenter.lng
    );
    return {
      inArea: distance <= area.radiusMiles,
      distance,
    };
  }

  if (area.areaType === 'polygon') {
    if (!area.polygonCoords || !Array.isArray(area.polygonCoords)) {
      return { inArea: false };
    }
    const inArea = isPointInPolygon({ lat, lng }, area.polygonCoords);
    return { inArea };
  }

  return { inArea: false };
}

// Haversine formula for distance calculation
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Point-in-polygon algorithm (ray casting)
function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: Array<[number, number]>
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect =
      yi > point.lng !== yj > point.lng &&
      point.lat < ((xj - xi) * (point.lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
