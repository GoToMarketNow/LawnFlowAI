import { storage } from "../storage";

const CACHE_TTL_DAYS = 30;
const AVERAGE_SPEED_MPH = 30;
const METERS_PER_MILE = 1609.34;
const EARTH_RADIUS_KM = 6371;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TravelEstimate {
  minutes: number;
  distanceMeters: number;
  source: "api" | "cache" | "haversine";
}

let apiKeyWarningShown = false;

function warnIfNoApiKey(): void {
  if (!apiKeyWarningShown && !process.env.GOOGLE_MAPS_API_KEY) {
    console.warn("[RouteCost] GOOGLE_MAPS_API_KEY not set - using Haversine fallback");
    apiKeyWarningShown = true;
  }
}

function roundToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function createCacheKey(lat: number, lng: number): string {
  return `${roundToDecimals(lat, 4)},${roundToDecimals(lng, 4)}`;
}

export function haversineDistanceKm(origin: LatLng, dest: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  
  const dLat = toRad(dest.lat - origin.lat);
  const dLng = toRad(dest.lng - origin.lng);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(origin.lat)) * Math.cos(toRad(dest.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return EARTH_RADIUS_KM * c;
}

export function haversineToTravelMinutes(distanceKm: number): number {
  const distanceMiles = distanceKm / 1.60934;
  const hours = distanceMiles / AVERAGE_SPEED_MPH;
  return Math.round(hours * 60);
}

export function getHaversineTravelEstimate(origin: LatLng, dest: LatLng): TravelEstimate {
  const distanceKm = haversineDistanceKm(origin, dest);
  const distanceMeters = Math.round(distanceKm * 1000);
  const minutes = haversineToTravelMinutes(distanceKm);
  
  return {
    minutes,
    distanceMeters,
    source: "haversine",
  };
}

async function fetchGoogleDistanceMatrix(
  origin: LatLng, 
  dest: LatLng
): Promise<TravelEstimate | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.set("origins", `${origin.lat},${origin.lng}`);
    url.searchParams.set("destinations", `${dest.lat},${dest.lng}`);
    url.searchParams.set("mode", "driving");
    url.searchParams.set("units", "imperial");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error("[RouteCost] Google API HTTP error:", response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.status !== "OK") {
      console.error("[RouteCost] Google API status:", data.status);
      return null;
    }

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK") {
      console.error("[RouteCost] No valid route found:", element?.status);
      return null;
    }

    const durationSeconds = element.duration?.value || 0;
    const distanceMeters = element.distance?.value || 0;

    return {
      minutes: Math.round(durationSeconds / 60),
      distanceMeters,
      source: "api",
    };
  } catch (error) {
    console.error("[RouteCost] Error fetching from Google API:", error);
    return null;
  }
}

export async function getTravelMinutes(
  origin: LatLng, 
  dest: LatLng
): Promise<TravelEstimate | null> {
  if (origin.lat == null || origin.lng == null || dest.lat == null || dest.lng == null) {
    return null;
  }

  warnIfNoApiKey();

  const apiResult = await fetchGoogleDistanceMatrix(origin, dest);
  if (apiResult) {
    return apiResult;
  }

  return getHaversineTravelEstimate(origin, dest);
}

export async function getTravelMinutesCached(
  businessId: number,
  origin: LatLng,
  dest: LatLng
): Promise<TravelEstimate | null> {
  if (origin.lat == null || origin.lng == null || dest.lat == null || dest.lng == null) {
    return null;
  }

  const originKey = createCacheKey(origin.lat, origin.lng);
  const destKey = createCacheKey(dest.lat, dest.lng);

  const cached = await storage.getDistanceCache(originKey, destKey);
  if (cached) {
    return {
      minutes: cached.travelMinutes,
      distanceMeters: cached.distanceMeters,
      source: "cache",
    };
  }

  const estimate = await getTravelMinutes(origin, dest);
  if (!estimate) {
    return null;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

  try {
    await storage.upsertDistanceCache({
      originKey,
      destKey,
      travelMinutes: estimate.minutes,
      distanceMeters: estimate.distanceMeters,
      expiresAt,
    });
  } catch (error) {
    console.error("[RouteCost] Error caching distance:", error);
  }

  return estimate;
}

export async function getCrewToJobTravelMinutes(
  businessId: number,
  crewHomeBase: { lat: number | null; lng: number | null },
  jobLocation: { lat: number | null; lng: number | null }
): Promise<TravelEstimate | null> {
  if (crewHomeBase.lat == null || crewHomeBase.lng == null || 
      jobLocation.lat == null || jobLocation.lng == null) {
    return null;
  }

  return getTravelMinutesCached(
    businessId,
    { lat: crewHomeBase.lat, lng: crewHomeBase.lng },
    { lat: jobLocation.lat, lng: jobLocation.lng }
  );
}
