import { z } from "zod";

export const VALID_MAX_DISTANCES = [5, 10, 20, 40] as const;
export type ValidMaxDistance = typeof VALID_MAX_DISTANCES[number];

export const serviceAreaResultSchema = z.discriminatedUnion("eligible", [
  z.object({
    eligible: z.literal(true),
    tier: z.enum(["core", "extended"]),
    distanceMi: z.number(),
  }),
  z.object({
    eligible: z.literal(false),
    tier: z.literal("out_of_area"),
    distanceMi: z.number(),
  }),
]);

export type ServiceAreaResult = z.infer<typeof serviceAreaResultSchema>;

export interface ServiceAreaConfig {
  centerLat: number;
  centerLng: number;
  radiusMi: number;
  maxMi: number;
  allowExtended: boolean;
}

export interface ServiceAreaEval {
  eligible: boolean;
  tier: "core" | "extended" | "out_of_area";
  distance_mi: number;
  radius_mi: number;
  max_mi: number;
  allow_extended: boolean;
}

const EARTH_RADIUS_MI = 3958.8;

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function haversineDistanceMi(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_MI * c;
}

export function checkServiceArea(
  leadLat: number,
  leadLng: number,
  config: ServiceAreaConfig
): ServiceAreaResult {
  const distanceMi = haversineDistanceMi(
    config.centerLat,
    config.centerLng,
    leadLat,
    leadLng
  );

  if (distanceMi <= config.radiusMi) {
    return {
      eligible: true,
      tier: "core",
      distanceMi,
    };
  }

  if (config.allowExtended && distanceMi <= config.maxMi) {
    return {
      eligible: true,
      tier: "extended",
      distanceMi,
    };
  }

  return {
    eligible: false,
    tier: "out_of_area",
    distanceMi,
  };
}

export function buildServiceAreaEval(
  leadLat: number,
  leadLng: number,
  config: ServiceAreaConfig
): ServiceAreaEval {
  const result = checkServiceArea(leadLat, leadLng, config);

  return {
    eligible: result.eligible,
    tier: result.tier,
    distance_mi: result.distanceMi,
    radius_mi: config.radiusMi,
    max_mi: config.maxMi,
    allow_extended: config.allowExtended,
  };
}

export function validateServiceAreaConfig(config: {
  radiusMi?: number | null;
  maxMi?: number | null;
  centerLat?: number | null;
  centerLng?: number | null;
}): { valid: boolean; error?: string; clampedRadiusMi?: number } {
  const { radiusMi, maxMi, centerLat, centerLng } = config;

  if (radiusMi === undefined || radiusMi === null) {
    return { valid: true };
  }

  if (maxMi !== undefined && maxMi !== null) {
    if (!VALID_MAX_DISTANCES.includes(maxMi as ValidMaxDistance)) {
      return {
        valid: false,
        error: `Max travel limit must be one of: ${VALID_MAX_DISTANCES.join(", ")} miles`,
      };
    }

    if (radiusMi > maxMi) {
      return {
        valid: true,
        clampedRadiusMi: maxMi,
      };
    }
  }

  if (
    (centerLat !== undefined && centerLat !== null) ||
    (centerLng !== undefined && centerLng !== null) ||
    (radiusMi !== undefined && radiusMi !== null)
  ) {
    if (
      centerLat === undefined ||
      centerLat === null ||
      centerLng === undefined ||
      centerLng === null
    ) {
      return {
        valid: false,
        error: "Service area center coordinates are required when radius is set",
      };
    }

    if (radiusMi === undefined || radiusMi === null) {
      return {
        valid: false,
        error: "Service area radius is required when center is set",
      };
    }

    if (maxMi === undefined || maxMi === null) {
      return {
        valid: false,
        error: "Max travel limit is required when service area is configured",
      };
    }
  }

  return { valid: true };
}

export function milesToMeters(miles: number): number {
  return miles * 1609.344;
}

export function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

export interface MockGeocoderResult {
  lat: number;
  lng: number;
  formatted_address: string;
}

const ZIP_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "20001": { lat: 38.9072, lng: -77.0369 },
  "20002": { lat: 38.9103, lng: -76.9831 },
  "22201": { lat: 38.8816, lng: -77.0910 },
  "22202": { lat: 38.8570, lng: -77.0516 },
  "22301": { lat: 38.8048, lng: -77.0469 },
  "20814": { lat: 38.9847, lng: -77.0947 },
  "20815": { lat: 38.9894, lng: -77.0815 },
  "20817": { lat: 38.9984, lng: -77.1455 },
  "20852": { lat: 39.0392, lng: -77.1214 },
  "20910": { lat: 38.9989, lng: -77.0292 },
  "30301": { lat: 33.7490, lng: -84.3880 },
  "30302": { lat: 33.7516, lng: -84.3915 },
  "30303": { lat: 33.7543, lng: -84.3940 },
  "30305": { lat: 33.8324, lng: -84.3869 },
  "75201": { lat: 32.7867, lng: -96.7983 },
  "75202": { lat: 32.7795, lng: -96.8027 },
  "90210": { lat: 34.0901, lng: -118.4065 },
  "90024": { lat: 34.0625, lng: -118.4359 },
};

const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "bethesda": { lat: 38.9847, lng: -77.0947 },
  "arlington": { lat: 38.8816, lng: -77.0910 },
  "alexandria": { lat: 38.8048, lng: -77.0469 },
  "washington": { lat: 38.9072, lng: -77.0369 },
  "atlanta": { lat: 33.7490, lng: -84.3880 },
  "dallas": { lat: 32.7767, lng: -96.7970 },
  "beverly hills": { lat: 34.0901, lng: -118.4065 },
  "rockville": { lat: 39.0839, lng: -77.1530 },
  "silver spring": { lat: 38.9989, lng: -77.0292 },
};

export async function mockGeocodeAddress(address: string): Promise<MockGeocoderResult | null> {
  if (!address || address.trim().length === 0) {
    return null;
  }

  const addressLower = address.toLowerCase();

  const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zipMatch && ZIP_COORDINATES[zipMatch[1]]) {
    const coords = ZIP_COORDINATES[zipMatch[1]];
    const jitter = 0.002;
    return {
      lat: coords.lat + (Math.random() * jitter - jitter / 2),
      lng: coords.lng + (Math.random() * jitter - jitter / 2),
      formatted_address: address,
    };
  }

  for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
    if (addressLower.includes(city)) {
      const jitter = 0.005;
      return {
        lat: coords.lat + (Math.random() * jitter - jitter / 2),
        lng: coords.lng + (Math.random() * jitter - jitter / 2),
        formatted_address: address,
      };
    }
  }

  const hash = address.split("").reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
  }, 0);
  const baseLat = 38.9;
  const baseLng = -77.0;
  const latOffset = (hash % 100) / 1000;
  const lngOffset = ((hash >> 8) % 100) / 1000;

  return {
    lat: baseLat + latOffset,
    lng: baseLng + lngOffset,
    formatted_address: address,
  };
}
