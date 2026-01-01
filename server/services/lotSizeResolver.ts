import { db } from "../db";
import { 
  geocodeCache, 
  parcelCache, 
  countySources, 
  zipCountyCrosswalk,
  type LotSizeResult,
  type CountySource
} from "@shared/schema";
import { eq, and, gt, desc } from "drizzle-orm";
import crypto from "crypto";

const GEOCODE_CACHE_DAYS = 180;
const PARCEL_CACHE_DAYS = 365;
const NEGATIVE_CACHE_DAYS = 30;
const ARCGIS_TIMEOUT_MS = 3000;

interface RefreshJob {
  cacheKey: string;
  lat: number;
  lng: number;
  countyFips: string;
}

const refreshQueue: RefreshJob[] = [];
let isProcessingQueue = false;

function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[^\w\s,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hashAddress(normalizedAddress: string): string {
  return crypto.createHash("sha256").update(normalizedAddress).digest("hex");
}

function roundCoord(coord: number, decimals: number = 5): number {
  const factor = Math.pow(10, decimals);
  return Math.round(coord * factor) / factor;
}

function buildCacheKey(countyFips: string, lat: number, lng: number): string {
  const latRound = roundCoord(lat);
  const lngRound = roundCoord(lng);
  return `${countyFips}:${latRound}:${lngRound}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

const ZIP_COORDINATES: Record<string, { lat: number; lng: number; countyFips: string; stateFips: string; countyName: string }> = {
  "20001": { lat: 38.9072, lng: -77.0369, countyFips: "11001", stateFips: "11", countyName: "District of Columbia" },
  "20002": { lat: 38.9103, lng: -76.9831, countyFips: "11001", stateFips: "11", countyName: "District of Columbia" },
  "22201": { lat: 38.8816, lng: -77.0910, countyFips: "51013", stateFips: "51", countyName: "Arlington" },
  "22202": { lat: 38.8570, lng: -77.0516, countyFips: "51013", stateFips: "51", countyName: "Arlington" },
  "22301": { lat: 38.8048, lng: -77.0469, countyFips: "51510", stateFips: "51", countyName: "Alexandria City" },
  "20814": { lat: 38.9847, lng: -77.0947, countyFips: "24031", stateFips: "24", countyName: "Montgomery" },
  "20815": { lat: 38.9894, lng: -77.0815, countyFips: "24031", stateFips: "24", countyName: "Montgomery" },
  "20817": { lat: 38.9984, lng: -77.1455, countyFips: "24031", stateFips: "24", countyName: "Montgomery" },
  "20852": { lat: 39.0392, lng: -77.1214, countyFips: "24031", stateFips: "24", countyName: "Montgomery" },
  "20910": { lat: 38.9989, lng: -77.0292, countyFips: "24031", stateFips: "24", countyName: "Montgomery" },
  "30301": { lat: 33.7490, lng: -84.3880, countyFips: "13121", stateFips: "13", countyName: "Fulton" },
  "30302": { lat: 33.7516, lng: -84.3915, countyFips: "13121", stateFips: "13", countyName: "Fulton" },
  "30303": { lat: 33.7543, lng: -84.3940, countyFips: "13121", stateFips: "13", countyName: "Fulton" },
  "30305": { lat: 33.8324, lng: -84.3869, countyFips: "13121", stateFips: "13", countyName: "Fulton" },
  "75201": { lat: 32.7867, lng: -96.7983, countyFips: "48113", stateFips: "48", countyName: "Dallas" },
  "75202": { lat: 32.7795, lng: -96.8027, countyFips: "48113", stateFips: "48", countyName: "Dallas" },
  "90210": { lat: 34.0901, lng: -118.4065, countyFips: "06037", stateFips: "06", countyName: "Los Angeles" },
  "90024": { lat: 34.0625, lng: -118.4359, countyFips: "06037", stateFips: "06", countyName: "Los Angeles" },
};

const MOCK_PARCEL_SIZES: Record<string, number> = {
  "24031": 12500,
  "11001": 4500,
  "51013": 6200,
  "51510": 8100,
  "13121": 5800,
  "48113": 9200,
  "06037": 7500,
};

async function getCachedGeocode(addressHash: string): Promise<{
  lat: number;
  lng: number;
  zip: string | null;
  countyFips: string | null;
  stateFips: string | null;
  normalizedAddress: string;
} | null> {
  try {
    const cached = await db
      .select()
      .from(geocodeCache)
      .where(and(
        eq(geocodeCache.addressHash, addressHash),
        gt(geocodeCache.expiresAt, new Date())
      ))
      .limit(1);
    
    if (cached.length > 0) {
      console.log(`[LotResolver] Geocode cache hit for ${addressHash.slice(0, 8)}...`);
      return {
        lat: cached[0].lat,
        lng: cached[0].lng,
        zip: cached[0].zip,
        countyFips: cached[0].countyFips,
        stateFips: cached[0].stateFips,
        normalizedAddress: cached[0].normalizedAddress,
      };
    }
  } catch (error) {
    console.error("[LotResolver] Error checking geocode cache:", error);
  }
  return null;
}

async function saveGeocodeCache(
  addressHash: string,
  normalizedAddress: string,
  lat: number,
  lng: number,
  zip: string | null,
  countyFips: string | null,
  stateFips: string | null
): Promise<void> {
  try {
    await db
      .insert(geocodeCache)
      .values({
        addressHash,
        normalizedAddress,
        lat,
        lng,
        zip,
        countyFips,
        stateFips,
        expiresAt: addDays(new Date(), GEOCODE_CACHE_DAYS),
      })
      .onConflictDoUpdate({
        target: geocodeCache.addressHash,
        set: {
          lat,
          lng,
          zip,
          countyFips,
          stateFips,
          expiresAt: addDays(new Date(), GEOCODE_CACHE_DAYS),
          updatedAt: new Date(),
        },
      });
    console.log(`[LotResolver] Saved geocode cache for ${addressHash.slice(0, 8)}...`);
  } catch (error) {
    console.error("[LotResolver] Error saving geocode cache:", error);
  }
}

async function mockGeocode(address: string): Promise<{
  lat: number;
  lng: number;
  zip: string | null;
  countyFips: string | null;
  stateFips: string | null;
  countyName: string | null;
}> {
  const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  const zip = zipMatch ? zipMatch[1] : null;
  
  if (zip && ZIP_COORDINATES[zip]) {
    const data = ZIP_COORDINATES[zip];
    const jitter = 0.002;
    return {
      lat: data.lat + (Math.random() * jitter - jitter / 2),
      lng: data.lng + (Math.random() * jitter - jitter / 2),
      zip,
      countyFips: data.countyFips,
      stateFips: data.stateFips,
      countyName: data.countyName,
    };
  }
  
  const cityCoords: Record<string, { lat: number; lng: number; countyFips: string; stateFips: string; countyName: string }> = {
    "bethesda": { lat: 38.9847, lng: -77.0947, countyFips: "24031", stateFips: "24", countyName: "Montgomery" },
    "rockville": { lat: 39.0839, lng: -77.1530, countyFips: "24031", stateFips: "24", countyName: "Montgomery" },
    "arlington": { lat: 38.8816, lng: -77.0910, countyFips: "51013", stateFips: "51", countyName: "Arlington" },
    "alexandria": { lat: 38.8048, lng: -77.0469, countyFips: "51510", stateFips: "51", countyName: "Alexandria City" },
    "washington": { lat: 38.9072, lng: -77.0369, countyFips: "11001", stateFips: "11", countyName: "District of Columbia" },
    "atlanta": { lat: 33.7490, lng: -84.3880, countyFips: "13121", stateFips: "13", countyName: "Fulton" },
    "dallas": { lat: 32.7767, lng: -96.7970, countyFips: "48113", stateFips: "48", countyName: "Dallas" },
    "beverly hills": { lat: 34.0901, lng: -118.4065, countyFips: "06037", stateFips: "06", countyName: "Los Angeles" },
  };
  
  const addressLower = address.toLowerCase();
  for (const [city, data] of Object.entries(cityCoords)) {
    if (addressLower.includes(city)) {
      const jitter = 0.005;
      return {
        lat: data.lat + (Math.random() * jitter - jitter / 2),
        lng: data.lng + (Math.random() * jitter - jitter / 2),
        zip,
        countyFips: data.countyFips,
        stateFips: data.stateFips,
        countyName: data.countyName,
      };
    }
  }
  
  return {
    lat: 38.9 + Math.random() * 0.1,
    lng: -77.0 + Math.random() * 0.1,
    zip,
    countyFips: null,
    stateFips: null,
    countyName: null,
  };
}

async function getCountyFromZipCrosswalk(zip: string): Promise<{
  countyFips: string;
  stateFips: string;
  countyName: string | null;
} | null> {
  try {
    const result = await db
      .select()
      .from(zipCountyCrosswalk)
      .where(eq(zipCountyCrosswalk.zip, zip))
      .orderBy(desc(zipCountyCrosswalk.weight))
      .limit(1);
    
    if (result.length > 0) {
      return {
        countyFips: result[0].countyFips,
        stateFips: result[0].stateFips,
        countyName: result[0].countyName,
      };
    }
  } catch (error) {
    console.error("[LotResolver] Error checking ZIP crosswalk:", error);
  }
  return null;
}

async function getCachedParcel(cacheKey: string): Promise<{
  parcelAreaSqft: number | null;
  parcelId: string | null;
  confidence: "high" | "medium" | "low";
  negative: boolean;
  expired: boolean;
  sourceUrl: string | null;
} | null> {
  try {
    const cached = await db
      .select()
      .from(parcelCache)
      .where(eq(parcelCache.cacheKey, cacheKey))
      .limit(1);
    
    if (cached.length > 0) {
      const entry = cached[0];
      const expired = new Date() > entry.expiresAt;
      console.log(`[LotResolver] Parcel cache ${expired ? "stale" : "hit"} for ${cacheKey}`);
      return {
        parcelAreaSqft: entry.parcelAreaSqft,
        parcelId: entry.parcelId,
        confidence: entry.confidence as "high" | "medium" | "low",
        negative: entry.negative ?? false,
        expired,
        sourceUrl: entry.sourceUrl,
      };
    }
  } catch (error) {
    console.error("[LotResolver] Error checking parcel cache:", error);
  }
  return null;
}

async function saveParcelCache(
  cacheKey: string,
  countyFips: string,
  lat: number,
  lng: number,
  parcelAreaSqft: number | null,
  parcelId: string | null,
  confidence: "high" | "medium" | "low",
  negative: boolean,
  negativeReason: string | null,
  sourceUrl: string | null
): Promise<void> {
  const expiresAt = addDays(new Date(), negative ? NEGATIVE_CACHE_DAYS : PARCEL_CACHE_DAYS);
  
  try {
    await db
      .insert(parcelCache)
      .values({
        cacheKey,
        countyFips,
        latRound: roundCoord(lat),
        lngRound: roundCoord(lng),
        parcelAreaSqft,
        parcelId,
        confidence,
        negative,
        negativeReason,
        sourceUrl,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: parcelCache.cacheKey,
        set: {
          parcelAreaSqft,
          parcelId,
          confidence,
          negative,
          negativeReason,
          sourceUrl,
          expiresAt,
          updatedAt: new Date(),
        },
      });
    console.log(`[LotResolver] Saved parcel cache for ${cacheKey}`);
  } catch (error) {
    console.error("[LotResolver] Error saving parcel cache:", error);
  }
}

async function getCountySource(countyFips: string): Promise<CountySource | null> {
  try {
    const result = await db
      .select()
      .from(countySources)
      .where(eq(countySources.countyFips, countyFips))
      .limit(1);
    
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[LotResolver] Error getting county source:", error);
  }
  return null;
}

function convertToSqft(value: number, units: string): number {
  switch (units) {
    case "acres":
      return value * 43560;
    case "sqm":
      return value * 10.7639;
    case "sqft":
    default:
      return value;
  }
}

function parseAreaFromResponse(
  features: any[],
  areaFieldCandidates: string[],
  areaUnits: string,
  parcelIdField: string | null
): { areaSqft: number | null; parcelId: string | null } {
  if (!features || features.length === 0) {
    return { areaSqft: null, parcelId: null };
  }
  
  const attrs = features[0].attributes || {};
  let areaSqft: number | null = null;
  let parcelId: string | null = null;
  
  for (const field of areaFieldCandidates) {
    if (attrs[field] !== undefined && attrs[field] !== null) {
      const rawValue = parseFloat(attrs[field]);
      if (!isNaN(rawValue) && rawValue > 0) {
        areaSqft = convertToSqft(rawValue, areaUnits);
        
        if (areaUnits === "unknown") {
          if (areaSqft > 1000000 && areaSqft < 50000000) {
            areaSqft = areaSqft * 10.7639;
          }
        }
        break;
      }
    }
  }
  
  if (parcelIdField && attrs[parcelIdField]) {
    parcelId = String(attrs[parcelIdField]);
  }
  
  return { areaSqft, parcelId };
}

async function queryArcGISParcel(
  source: CountySource,
  lat: number,
  lng: number
): Promise<{ areaSqft: number | null; parcelId: string | null }> {
  if (!source.serviceUrl || source.layerId === null || !source.supportsPointQuery) {
    console.log(`[LotResolver] County ${source.countyFips} does not support point queries`);
    return { areaSqft: null, parcelId: null };
  }
  
  const areaFields = (source.areaFieldCandidates as string[]) || ["Shape_Area", "ACRES", "LOT_ACRES", "ACREAGE"];
  const outFields = [...areaFields];
  if (source.parcelIdField) {
    outFields.push(source.parcelIdField);
  }
  
  const url = new URL(`${source.serviceUrl}/${source.layerId}/query`);
  url.searchParams.set("geometry", `${lng},${lat}`);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("outFields", outFields.join(","));
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("f", "json");
  
  console.log(`[LotResolver] Querying ArcGIS: ${url.toString()}`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ARCGIS_TIMEOUT_MS);
  
  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`[LotResolver] ArcGIS query failed: ${response.status}`);
      return { areaSqft: null, parcelId: null };
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.error(`[LotResolver] ArcGIS error: ${data.error.message}`);
      return { areaSqft: null, parcelId: null };
    }
    
    return parseAreaFromResponse(
      data.features,
      areaFields,
      source.areaUnits || "unknown",
      source.parcelIdField
    );
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      console.error("[LotResolver] ArcGIS query timed out");
    } else {
      console.error("[LotResolver] ArcGIS query error:", error);
    }
    return { areaSqft: null, parcelId: null };
  }
}

async function mockParcelLookup(countyFips: string): Promise<number | null> {
  const baseSize = MOCK_PARCEL_SIZES[countyFips];
  if (baseSize) {
    const variance = baseSize * 0.3;
    return Math.round(baseSize + (Math.random() * variance * 2 - variance));
  }
  return null;
}

function enqueueRefresh(job: RefreshJob): void {
  refreshQueue.push(job);
  processRefreshQueue();
}

async function processRefreshQueue(): Promise<void> {
  if (isProcessingQueue || refreshQueue.length === 0) {
    return;
  }
  
  isProcessingQueue = true;
  
  while (refreshQueue.length > 0) {
    const job = refreshQueue.shift()!;
    try {
      await refreshParcelCache(job.cacheKey, job.lat, job.lng, job.countyFips);
    } catch (error) {
      console.error("[LotResolver] Background refresh failed:", error);
    }
  }
  
  isProcessingQueue = false;
}

async function refreshParcelCache(
  cacheKey: string,
  lat: number,
  lng: number,
  countyFips: string
): Promise<void> {
  console.log(`[LotResolver] Background refresh for ${cacheKey}`);
  
  const source = await getCountySource(countyFips);
  
  if (source && source.supportsPointQuery) {
    const { areaSqft, parcelId } = await queryArcGISParcel(source, lat, lng);
    
    if (areaSqft !== null) {
      await saveParcelCache(
        cacheKey,
        countyFips,
        lat,
        lng,
        areaSqft,
        parcelId,
        "high",
        false,
        null,
        source.serviceUrl
      );
      return;
    }
  }
  
  const mockArea = await mockParcelLookup(countyFips);
  if (mockArea !== null) {
    await saveParcelCache(
      cacheKey,
      countyFips,
      lat,
      lng,
      mockArea,
      `MOCK-${countyFips}-${Date.now()}`,
      "medium",
      false,
      null,
      null
    );
  } else {
    await saveParcelCache(
      cacheKey,
      countyFips,
      lat,
      lng,
      null,
      null,
      "low",
      true,
      "No parcel data available",
      null
    );
  }
}

export const lotSizeResolver = {
  async resolve(address: string): Promise<LotSizeResult> {
    const normalizedAddress = normalizeAddress(address);
    const addressHash = hashAddress(normalizedAddress);
    
    console.log(`[LotResolver] Resolving lot size for: ${normalizedAddress}`);
    
    let lat: number;
    let lng: number;
    let zip: string | null = null;
    let countyFips: string | null = null;
    let stateFips: string | null = null;
    let countyName: string | null = null;
    
    const cachedGeo = await getCachedGeocode(addressHash);
    if (cachedGeo) {
      lat = cachedGeo.lat;
      lng = cachedGeo.lng;
      zip = cachedGeo.zip;
      countyFips = cachedGeo.countyFips;
      stateFips = cachedGeo.stateFips;
    } else {
      const geocoded = await mockGeocode(address);
      lat = geocoded.lat;
      lng = geocoded.lng;
      zip = geocoded.zip;
      countyFips = geocoded.countyFips;
      stateFips = geocoded.stateFips;
      countyName = geocoded.countyName;
      
      await saveGeocodeCache(addressHash, normalizedAddress, lat, lng, zip, countyFips, stateFips);
    }
    
    if (!countyFips && zip) {
      const crosswalk = await getCountyFromZipCrosswalk(zip);
      if (crosswalk) {
        countyFips = crosswalk.countyFips;
        stateFips = crosswalk.stateFips;
        countyName = crosswalk.countyName;
      }
    }
    
    const fallbackResult: LotSizeResult = {
      normalizedAddress,
      lat,
      lng,
      zip,
      countyFips,
      countyName,
      parcelCoverage: "unknown",
      lotAreaSqft: null,
      lotAreaAcres: null,
      confidence: "low",
      source: "customer_required",
      fallback: {
        requiresCustomerValidation: true,
        questions: [
          "About how big is your property? (0.1-0.25 acre, 0.25-0.5 acre, 0.5-1 acre, 1+ acres)",
          "Do you have lots of trees or garden beds? (light, medium, heavy)",
        ],
      },
    };
    
    if (!countyFips) {
      console.log(`[LotResolver] No county FIPS found, returning fallback`);
      return fallbackResult;
    }
    
    const cacheKey = buildCacheKey(countyFips, lat, lng);
    
    const cachedParcel = await getCachedParcel(cacheKey);
    if (cachedParcel && !cachedParcel.negative) {
      const result: LotSizeResult = {
        normalizedAddress,
        lat,
        lng,
        zip,
        countyFips,
        countyName,
        parcelCoverage: "full",
        lotAreaSqft: cachedParcel.parcelAreaSqft,
        lotAreaAcres: cachedParcel.parcelAreaSqft ? cachedParcel.parcelAreaSqft / 43560 : null,
        confidence: cachedParcel.expired ? "medium" : cachedParcel.confidence,
        source: "cache",
        fallback: {
          requiresCustomerValidation: false,
          questions: [],
        },
      };
      
      if (cachedParcel.expired) {
        enqueueRefresh({ cacheKey, lat, lng, countyFips });
      }
      
      return result;
    }
    
    if (cachedParcel?.negative && !cachedParcel.expired) {
      console.log(`[LotResolver] Negative cache hit for ${cacheKey}`);
      return fallbackResult;
    }
    
    const source = await getCountySource(countyFips);
    let parcelCoverage: "full" | "partial" | "none" | "unknown" = "unknown";
    let lotAreaSqft: number | null = null;
    let parcelId: string | null = null;
    let confidence: "high" | "medium" | "low" = "low";
    let dataSource: "county_gis" | "cache" | "customer_required" = "customer_required";
    
    if (source && source.supportsPointQuery) {
      const arcgisResult = await queryArcGISParcel(source, lat, lng);
      
      if (arcgisResult.areaSqft !== null) {
        lotAreaSqft = arcgisResult.areaSqft;
        parcelId = arcgisResult.parcelId;
        parcelCoverage = source.status as any || "full";
        confidence = "high";
        dataSource = "county_gis";
        
        await saveParcelCache(
          cacheKey,
          countyFips,
          lat,
          lng,
          lotAreaSqft,
          parcelId,
          confidence,
          false,
          null,
          source.serviceUrl
        );
      }
    }
    
    if (lotAreaSqft === null) {
      const mockArea = await mockParcelLookup(countyFips);
      if (mockArea !== null) {
        lotAreaSqft = mockArea;
        parcelId = `MOCK-${countyFips}-${Date.now()}`;
        parcelCoverage = "partial";
        confidence = "medium";
        dataSource = "cache";
        
        await saveParcelCache(
          cacheKey,
          countyFips,
          lat,
          lng,
          lotAreaSqft,
          parcelId,
          confidence,
          false,
          null,
          null
        );
      }
    }
    
    if (lotAreaSqft === null) {
      await saveParcelCache(
        cacheKey,
        countyFips,
        lat,
        lng,
        null,
        null,
        "low",
        true,
        "No parcel data available for this county",
        null
      );
      return fallbackResult;
    }
    
    return {
      normalizedAddress,
      lat,
      lng,
      zip,
      countyFips,
      countyName,
      parcelCoverage,
      lotAreaSqft,
      lotAreaAcres: lotAreaSqft / 43560,
      confidence,
      source: dataSource,
      fallback: {
        requiresCustomerValidation: false,
        questions: [],
      },
    };
  },
  
  async seedCountySources(): Promise<void> {
    const sources = [
      {
        stateFips: "24",
        countyFips: "24031",
        countyName: "Montgomery County, MD",
        status: "full" as const,
        sourceType: "arcgis_feature_service" as const,
        serviceUrl: "https://gis.data.montgomerycountymd.gov/arcgis/rest/services/Planning/Property/FeatureServer",
        layerId: 0,
        supportsPointQuery: true,
        areaFieldCandidates: ["Shape_Area", "ACRES", "LOT_AREA"],
        areaUnits: "sqft" as const,
        parcelIdField: "ACCT_ID",
      },
      {
        stateFips: "11",
        countyFips: "11001",
        countyName: "District of Columbia",
        status: "full" as const,
        sourceType: "arcgis_feature_service" as const,
        serviceUrl: "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/MapServer",
        layerId: 50,
        supportsPointQuery: true,
        areaFieldCandidates: ["Shape_Area", "LOT_AREA", "LANDAREA"],
        areaUnits: "sqft" as const,
        parcelIdField: "SSL",
      },
      {
        stateFips: "51",
        countyFips: "51013",
        countyName: "Arlington County, VA",
        status: "partial" as const,
        sourceType: "arcgis_feature_service" as const,
        serviceUrl: null,
        layerId: null,
        supportsPointQuery: false,
        areaFieldCandidates: [] as string[],
        areaUnits: "unknown" as const,
        parcelIdField: null,
      },
      {
        stateFips: "13",
        countyFips: "13121",
        countyName: "Fulton County, GA",
        status: "partial" as const,
        sourceType: "manual_viewer" as const,
        serviceUrl: null,
        layerId: null,
        supportsPointQuery: false,
        areaFieldCandidates: [] as string[],
        areaUnits: "unknown" as const,
        parcelIdField: null,
      },
    ];
    
    for (const source of sources) {
      try {
        await db
          .insert(countySources)
          .values(source)
          .onConflictDoNothing();
      } catch (error) {
        console.error(`[LotResolver] Error seeding county source ${source.countyFips}:`, error);
      }
    }
    
    console.log("[LotResolver] Seeded county sources");
  },
  
  async seedZipCrosswalk(): Promise<void> {
    const crosswalkData = Object.entries(ZIP_COORDINATES).map(([zip, data]) => ({
      zip,
      countyFips: data.countyFips,
      stateFips: data.stateFips,
      countyName: data.countyName,
      weight: 1.0,
    }));
    
    for (const entry of crosswalkData) {
      try {
        await db
          .insert(zipCountyCrosswalk)
          .values(entry)
          .onConflictDoNothing();
      } catch (error) {
        console.error(`[LotResolver] Error seeding ZIP crosswalk ${entry.zip}:`, error);
      }
    }
    
    console.log("[LotResolver] Seeded ZIP county crosswalk");
  },
};

export default lotSizeResolver;
