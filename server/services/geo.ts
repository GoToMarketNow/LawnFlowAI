import { db } from "../db";
import { parcelCoverageRegistry, zipGeoCache, AreaBands, type AreaBandKey } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface CountyResult {
  state: string;
  countyFips: string;
  countyName: string;
  confidence: number;
}

export interface ParcelCoverageResult {
  coverage: "full" | "partial" | "none" | "unknown";
  provider: string | null;
  notes: string | null;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  normalizedAddress: string;
  zip: string;
}

export interface ParcelResult {
  lotAreaSqft: number;
  parcelId: string;
  confidence: number;
  source: string;
}

const ZIP_TO_COUNTY: Record<string, { state: string; countyFips: string; countyName: string }> = {
  "20001": { state: "DC", countyFips: "11001", countyName: "District of Columbia" },
  "20002": { state: "DC", countyFips: "11001", countyName: "District of Columbia" },
  "22201": { state: "VA", countyFips: "51013", countyName: "Arlington" },
  "22202": { state: "VA", countyFips: "51013", countyName: "Arlington" },
  "22301": { state: "VA", countyFips: "51510", countyName: "Alexandria City" },
  "20814": { state: "MD", countyFips: "24031", countyName: "Montgomery" },
  "20815": { state: "MD", countyFips: "24031", countyName: "Montgomery" },
  "20817": { state: "MD", countyFips: "24031", countyName: "Montgomery" },
  "20852": { state: "MD", countyFips: "24031", countyName: "Montgomery" },
  "20910": { state: "MD", countyFips: "24031", countyName: "Montgomery" },
  "30301": { state: "GA", countyFips: "13121", countyName: "Fulton" },
  "30302": { state: "GA", countyFips: "13121", countyName: "Fulton" },
  "30303": { state: "GA", countyFips: "13121", countyName: "Fulton" },
  "30305": { state: "GA", countyFips: "13121", countyName: "Fulton" },
  "30306": { state: "GA", countyFips: "13089", countyName: "DeKalb" },
  "30307": { state: "GA", countyFips: "13089", countyName: "DeKalb" },
  "75201": { state: "TX", countyFips: "48113", countyName: "Dallas" },
  "75202": { state: "TX", countyFips: "48113", countyName: "Dallas" },
  "75204": { state: "TX", countyFips: "48113", countyName: "Dallas" },
  "90210": { state: "CA", countyFips: "06037", countyName: "Los Angeles" },
  "90024": { state: "CA", countyFips: "06037", countyName: "Los Angeles" },
  "90025": { state: "CA", countyFips: "06037", countyName: "Los Angeles" },
};

const MOCK_PARCEL_DATA: Record<string, { lotAreaSqft: number; parcelId: string }> = {
  "38.9072,-77.0369": { lotAreaSqft: 4500, parcelId: "DC-001-234" },
  "38.8816,-77.0910": { lotAreaSqft: 6200, parcelId: "VA-ARL-5678" },
  "38.8048,-77.0469": { lotAreaSqft: 8100, parcelId: "VA-ALX-9012" },
  "39.0839,-77.1530": { lotAreaSqft: 12500, parcelId: "MD-MONT-3456" },
  "33.7490,-84.3880": { lotAreaSqft: 5800, parcelId: "GA-FUL-7890" },
  "32.7767,-96.7970": { lotAreaSqft: 9200, parcelId: "TX-DAL-1234" },
  "34.0901,-118.4065": { lotAreaSqft: 7500, parcelId: "CA-LA-5678" },
};

export async function resolveCountyByZip(zip: string): Promise<CountyResult | null> {
  const normalizedZip = zip.replace(/\D/g, "").slice(0, 5);
  
  if (normalizedZip.length !== 5) {
    console.log(`[Geo] Invalid ZIP format: ${zip}`);
    return null;
  }
  
  const cached = ZIP_TO_COUNTY[normalizedZip];
  if (cached) {
    console.log(`[Geo] Resolved ZIP ${normalizedZip} to ${cached.countyName}, ${cached.state}`);
    return {
      ...cached,
      confidence: 0.95,
    };
  }
  
  const firstThree = normalizedZip.slice(0, 3);
  for (const [z, data] of Object.entries(ZIP_TO_COUNTY)) {
    if (z.startsWith(firstThree)) {
      console.log(`[Geo] Fuzzy match ZIP ${normalizedZip} to ${data.countyName}, ${data.state}`);
      return {
        ...data,
        confidence: 0.7,
      };
    }
  }
  
  console.log(`[Geo] No county found for ZIP ${normalizedZip}`);
  return null;
}

export async function checkParcelCoverage(state: string, countyFips: string): Promise<ParcelCoverageResult> {
  try {
    const registry = await db
      .select()
      .from(parcelCoverageRegistry)
      .where(and(
        eq(parcelCoverageRegistry.state, state),
        eq(parcelCoverageRegistry.countyFips, countyFips)
      ))
      .limit(1);
    
    if (registry.length > 0) {
      const entry = registry[0];
      console.log(`[Geo] Parcel coverage for ${state}/${countyFips}: ${entry.coverageStatus}`);
      return {
        coverage: entry.coverageStatus as ParcelCoverageResult["coverage"],
        provider: entry.provider,
        notes: entry.notes,
      };
    }
  } catch (error) {
    console.error("[Geo] Error checking parcel coverage:", error);
  }
  
  const fullCoverageCounties = ["11001", "51013", "24031", "13121"];
  const partialCoverageCounties = ["48113", "06037"];
  
  if (fullCoverageCounties.includes(countyFips)) {
    console.log(`[Geo] Mock full coverage for ${state}/${countyFips}`);
    return { coverage: "full", provider: "Mock Provider", notes: null };
  }
  
  if (partialCoverageCounties.includes(countyFips)) {
    console.log(`[Geo] Mock partial coverage for ${state}/${countyFips}`);
    return { coverage: "partial", provider: "Mock Provider", notes: "Limited to major cities" };
  }
  
  console.log(`[Geo] No coverage data for ${state}/${countyFips}`);
  return { coverage: "unknown", provider: null, notes: null };
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const addressLower = address.toLowerCase();
  
  const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  const zip = zipMatch ? zipMatch[1] : "20001";
  
  const mockCoordinates: Record<string, { lat: number; lng: number }> = {
    "washington": { lat: 38.9072, lng: -77.0369 },
    "arlington": { lat: 38.8816, lng: -77.0910 },
    "alexandria": { lat: 38.8048, lng: -77.0469 },
    "bethesda": { lat: 39.0839, lng: -77.1530 },
    "atlanta": { lat: 33.7490, lng: -84.3880 },
    "dallas": { lat: 32.7767, lng: -96.7970 },
    "beverly hills": { lat: 34.0901, lng: -118.4065 },
    "los angeles": { lat: 34.0522, lng: -118.2437 },
  };
  
  for (const [city, coords] of Object.entries(mockCoordinates)) {
    if (addressLower.includes(city)) {
      console.log(`[Geo] Geocoded "${address}" to ${coords.lat}, ${coords.lng}`);
      return {
        lat: coords.lat + (Math.random() * 0.01 - 0.005),
        lng: coords.lng + (Math.random() * 0.01 - 0.005),
        normalizedAddress: address.trim(),
        zip,
      };
    }
  }
  
  const countyData = await resolveCountyByZip(zip);
  if (countyData) {
    const baseLat = 38.9 + (Math.random() * 0.2 - 0.1);
    const baseLng = -77.0 + (Math.random() * 0.2 - 0.1);
    console.log(`[Geo] Geocoded "${address}" via ZIP ${zip}`);
    return {
      lat: baseLat,
      lng: baseLng,
      normalizedAddress: address.trim(),
      zip,
    };
  }
  
  console.log(`[Geo] Could not geocode address: ${address}`);
  return null;
}

export async function fetchParcelByLatLng(lat: number, lng: number): Promise<ParcelResult | null> {
  const roundedLat = Math.round(lat * 10000) / 10000;
  const roundedLng = Math.round(lng * 10000) / 10000;
  
  for (const [key, data] of Object.entries(MOCK_PARCEL_DATA)) {
    const [pLat, pLng] = key.split(",").map(Number);
    const distance = Math.sqrt(Math.pow(pLat - lat, 2) + Math.pow(pLng - lng, 2));
    
    if (distance < 0.05) {
      const sizeVariance = Math.floor(data.lotAreaSqft * (Math.random() * 0.2 - 0.1));
      console.log(`[Geo] Found parcel near ${lat}, ${lng}: ${data.parcelId}`);
      return {
        lotAreaSqft: data.lotAreaSqft + sizeVariance,
        parcelId: data.parcelId,
        confidence: 0.85,
        source: "mock_parcel_api",
      };
    }
  }
  
  const baseSqft = 5000 + Math.floor(Math.random() * 10000);
  console.log(`[Geo] No exact parcel match, generating estimate for ${lat}, ${lng}`);
  return {
    lotAreaSqft: baseSqft,
    parcelId: `GEN-${Date.now().toString(36)}`,
    confidence: 0.5,
    source: "estimated",
  };
}

export function sqftToAreaBand(sqft: number): AreaBandKey {
  if (sqft < AreaBands.xs.max) return "xs";
  if (sqft < AreaBands.small.max) return "small";
  if (sqft < AreaBands.medium.max) return "medium";
  if (sqft < AreaBands.large.max) return "large";
  if (sqft < AreaBands.xl.max) return "xl";
  return "xxl";
}

export function areaBandToSqftEstimate(band: AreaBandKey): { low: number; high: number; mid: number } {
  const bandDef = AreaBands[band];
  const high = bandDef.max === Infinity ? 100000 : bandDef.max;
  return {
    low: bandDef.min,
    high,
    mid: Math.floor((bandDef.min + high) / 2),
  };
}

export async function seedParcelCoverageRegistry(): Promise<void> {
  const sampleCounties = [
    { state: "DC", countyFips: "11001", countyName: "District of Columbia", coverageStatus: "full", provider: "DC Open Data" },
    { state: "VA", countyFips: "51013", countyName: "Arlington", coverageStatus: "full", provider: "Arlington GIS" },
    { state: "VA", countyFips: "51510", countyName: "Alexandria City", coverageStatus: "full", provider: "Alexandria Open Data" },
    { state: "MD", countyFips: "24031", countyName: "Montgomery", coverageStatus: "full", provider: "MC Atlas" },
    { state: "GA", countyFips: "13121", countyName: "Fulton", coverageStatus: "full", provider: "Fulton County GIS" },
    { state: "GA", countyFips: "13089", countyName: "DeKalb", coverageStatus: "partial", provider: "DeKalb GIS" },
    { state: "TX", countyFips: "48113", countyName: "Dallas", coverageStatus: "partial", provider: "DCAD" },
    { state: "CA", countyFips: "06037", countyName: "Los Angeles", coverageStatus: "partial", provider: "LA County Assessor" },
  ];
  
  for (const county of sampleCounties) {
    try {
      await db
        .insert(parcelCoverageRegistry)
        .values(county)
        .onConflictDoNothing();
    } catch (error) {
      console.error(`[Geo] Error seeding ${county.countyName}:`, error);
    }
  }
  
  console.log("[Geo] Parcel coverage registry seeded");
}

export const geoService = {
  resolveCountyByZip,
  checkParcelCoverage,
  geocodeAddress,
  fetchParcelByLatLng,
  sqftToAreaBand,
  areaBandToSqftEstimate,
  seedParcelCoverageRegistry,
};
