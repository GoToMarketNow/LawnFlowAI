// ============================================
// Geohash Utilities for Weather Location Deduplication
// ============================================

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode latitude/longitude to geohash string
 * @param lat Latitude (-90 to 90)
 * @param lon Longitude (-180 to 180)
 * @param precision Number of characters (1-12, default 6)
 * @returns Geohash string
 */
export function encodeGeohash(lat: number, lon: number, precision: number = 6): string {
  let latMin = -90, latMax = 90;
  let lonMin = -180, lonMax = 180;
  let hash = '';
  let bit = 0;
  let ch = 0;
  let even = true;

  while (hash.length < precision) {
    if (even) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) {
        ch |= 1 << (4 - bit);
        lonMin = mid;
      } else {
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch |= 1 << (4 - bit);
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    even = !even;
    bit++;

    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

/**
 * Decode geohash to latitude/longitude bounds
 * @param hash Geohash string
 * @returns Object with lat, lon (center) and error bounds
 */
export function decodeGeohash(hash: string): {
  lat: number;
  lon: number;
  latError: number;
  lonError: number;
} {
  let latMin = -90, latMax = 90;
  let lonMin = -180, lonMax = 180;
  let even = true;

  for (const c of hash.toLowerCase()) {
    const idx = BASE32.indexOf(c);
    if (idx === -1) throw new Error(`Invalid geohash character: ${c}`);

    for (let bit = 4; bit >= 0; bit--) {
      const mask = 1 << bit;
      if (even) {
        const mid = (lonMin + lonMax) / 2;
        if (idx & mask) {
          lonMin = mid;
        } else {
          lonMax = mid;
        }
      } else {
        const mid = (latMin + latMax) / 2;
        if (idx & mask) {
          latMin = mid;
        } else {
          latMax = mid;
        }
      }
      even = !even;
    }
  }

  return {
    lat: (latMin + latMax) / 2,
    lon: (lonMin + lonMax) / 2,
    latError: (latMax - latMin) / 2,
    lonError: (lonMax - lonMin) / 2
  };
}

/**
 * Get the 8 neighboring geohashes
 * @param hash Center geohash
 * @returns Array of neighboring geohashes
 */
export function getGeohashNeighbors(hash: string): string[] {
  const { lat, lon, latError, lonError } = decodeGeohash(hash);
  const precision = hash.length;
  
  const neighbors: string[] = [];
  const deltas = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];

  for (const [dLat, dLon] of deltas) {
    const newLat = lat + (dLat * latError * 2);
    const newLon = lon + (dLon * lonError * 2);
    
    // Handle wraparound for longitude
    let adjustedLon = newLon;
    if (adjustedLon > 180) adjustedLon -= 360;
    if (adjustedLon < -180) adjustedLon += 360;
    
    // Skip if latitude is out of bounds
    if (newLat > 90 || newLat < -90) continue;
    
    neighbors.push(encodeGeohash(newLat, adjustedLon, precision));
  }

  return neighbors;
}

/**
 * Get approximate distance in meters for a geohash precision level
 * @param precision Geohash precision (1-12)
 * @returns Approximate cell size in meters
 */
export function getGeohashCellSize(precision: number): { width: number; height: number } {
  // Approximate sizes at equator
  const sizes: Record<number, { width: number; height: number }> = {
    1: { width: 5000000, height: 5000000 },      // ~5000km
    2: { width: 1250000, height: 625000 },       // ~1250km x 625km
    3: { width: 156000, height: 156000 },        // ~156km
    4: { width: 39000, height: 19500 },          // ~39km x 19.5km
    5: { width: 4900, height: 4900 },            // ~4.9km
    6: { width: 1200, height: 609 },             // ~1.2km x 609m (DEFAULT)
    7: { width: 153, height: 153 },              // ~153m
    8: { width: 38, height: 19 },                // ~38m x 19m
    9: { width: 4.8, height: 4.8 },              // ~4.8m
    10: { width: 1.2, height: 0.6 },             // ~1.2m x 0.6m
    11: { width: 0.15, height: 0.15 },           // ~15cm
    12: { width: 0.037, height: 0.019 }          // ~3.7cm x 1.9cm
  };

  return sizes[precision] || sizes[6];
}

/**
 * Cluster locations by geohash for deduplication
 * @param locations Array of {lat, lon} objects
 * @param precision Geohash precision
 * @returns Map of geohash -> array of location indices
 */
export function clusterByGeohash(
  locations: Array<{ lat: number; lon: number; [key: string]: any }>,
  precision: number = 6
): Map<string, number[]> {
  const clusters = new Map<string, number[]>();

  locations.forEach((loc, index) => {
    const hash = encodeGeohash(loc.lat, loc.lon, precision);
    const existing = clusters.get(hash) || [];
    existing.push(index);
    clusters.set(hash, existing);
  });

  return clusters;
}

/**
 * Deduplicate forecast requests by clustering nearby locations
 * @param requests Array of forecast requests with lat/lon
 * @param precision Geohash precision for clustering
 * @returns Deduplicated requests with representative locations
 */
export function deduplicateForecastRequests<T extends { lat: number; lon: number }>(
  requests: T[],
  precision: number = 6
): Array<{ geohash: string; lat: number; lon: number; originalIndices: number[] }> {
  const clusters = clusterByGeohash(requests, precision);
  const deduplicated: Array<{ geohash: string; lat: number; lon: number; originalIndices: number[] }> = [];

  for (const [geohash, indices] of clusters.entries()) {
    // Use the center of the geohash as representative location
    const { lat, lon } = decodeGeohash(geohash);
    deduplicated.push({
      geohash,
      lat,
      lon,
      originalIndices: indices
    });
  }

  return deduplicated;
}
