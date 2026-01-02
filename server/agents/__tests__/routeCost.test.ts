import {
  createCacheKey,
  haversineDistanceKm,
  haversineToTravelMinutes,
  getHaversineTravelEstimate,
} from "../routeCost";

describe("routeCost", () => {
  describe("createCacheKey", () => {
    it("rounds coordinates to 4 decimal places", () => {
      expect(createCacheKey(40.123456, -74.987654)).toBe("40.1235,-74.9877");
    });

    it("handles negative coordinates", () => {
      expect(createCacheKey(-33.8688, 151.2093)).toBe("-33.8688,151.2093");
    });

    it("handles zero coordinates", () => {
      expect(createCacheKey(0, 0)).toBe("0,0");
    });

    it("produces consistent keys for nearby locations", () => {
      const key1 = createCacheKey(40.12341, -74.98761);
      const key2 = createCacheKey(40.12349, -74.98769);
      expect(key1).toBe(key2);
    });

    it("produces different keys for distant locations", () => {
      const key1 = createCacheKey(40.1234, -74.9876);
      const key2 = createCacheKey(40.1244, -74.9876);
      expect(key1).not.toBe(key2);
    });
  });

  describe("haversineDistanceKm", () => {
    it("calculates distance between NYC and LA (~3940 km)", () => {
      const nyc = { lat: 40.7128, lng: -74.006 };
      const la = { lat: 34.0522, lng: -118.2437 };
      const distance = haversineDistanceKm(nyc, la);
      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4000);
    });

    it("returns 0 for same location", () => {
      const point = { lat: 40.7128, lng: -74.006 };
      expect(haversineDistanceKm(point, point)).toBe(0);
    });

    it("calculates short distance correctly (~11 km)", () => {
      const point1 = { lat: 40.7128, lng: -74.006 };
      const point2 = { lat: 40.8128, lng: -74.006 };
      const distance = haversineDistanceKm(point1, point2);
      expect(distance).toBeGreaterThan(10);
      expect(distance).toBeLessThan(12);
    });
  });

  describe("haversineToTravelMinutes", () => {
    it("converts distance to travel time at 30 mph average", () => {
      const distanceKm = 48.28; // ~30 miles
      const minutes = haversineToTravelMinutes(distanceKm);
      expect(minutes).toBe(60); // 30 miles at 30 mph = 1 hour
    });

    it("returns 0 for 0 distance", () => {
      expect(haversineToTravelMinutes(0)).toBe(0);
    });

    it("handles short distances", () => {
      const distanceKm = 8.05; // ~5 miles
      const minutes = haversineToTravelMinutes(distanceKm);
      expect(minutes).toBe(10); // 5 miles at 30 mph = 10 min
    });
  });

  describe("getHaversineTravelEstimate", () => {
    it("returns complete estimate with source marked as haversine", () => {
      const origin = { lat: 40.7128, lng: -74.006 };
      const dest = { lat: 40.8128, lng: -74.006 };
      const estimate = getHaversineTravelEstimate(origin, dest);
      
      expect(estimate.source).toBe("haversine");
      expect(estimate.minutes).toBeGreaterThan(0);
      expect(estimate.distanceMeters).toBeGreaterThan(0);
    });

    it("provides consistent results for same inputs", () => {
      const origin = { lat: 40.7128, lng: -74.006 };
      const dest = { lat: 40.8128, lng: -74.106 };
      
      const estimate1 = getHaversineTravelEstimate(origin, dest);
      const estimate2 = getHaversineTravelEstimate(origin, dest);
      
      expect(estimate1.minutes).toBe(estimate2.minutes);
      expect(estimate1.distanceMeters).toBe(estimate2.distanceMeters);
    });
  });

  describe("cache behavior", () => {
    it("cache keys are deterministic", () => {
      const lat = 40.123456789;
      const lng = -74.987654321;
      
      const key1 = createCacheKey(lat, lng);
      const key2 = createCacheKey(lat, lng);
      
      expect(key1).toBe(key2);
    });

    it("different routes have different keys", () => {
      const origin1 = createCacheKey(40.1234, -74.0060);
      const dest1 = createCacheKey(40.8128, -74.1060);
      
      const origin2 = createCacheKey(40.9000, -74.2000);
      const dest2 = createCacheKey(40.8128, -74.1060);
      
      expect(origin1).not.toBe(origin2);
      expect(`${origin1}-${dest1}`).not.toBe(`${origin2}-${dest2}`);
    });
  });

  describe("zero coordinate handling", () => {
    it("handles coordinates at equator/prime meridian (lat=0, lng=0)", () => {
      const origin = { lat: 0, lng: 0 };
      const dest = { lat: 1, lng: 1 };
      const estimate = getHaversineTravelEstimate(origin, dest);
      
      expect(estimate.source).toBe("haversine");
      expect(estimate.minutes).toBeGreaterThan(0);
      expect(estimate.distanceMeters).toBeGreaterThan(0);
    });

    it("creates valid cache key for zero coordinates", () => {
      const key = createCacheKey(0, 0);
      expect(key).toBe("0,0");
    });

    it("calculates distance from equator correctly", () => {
      const equator = { lat: 0, lng: 0 };
      const northOfEquator = { lat: 1, lng: 0 };
      const distance = haversineDistanceKm(equator, northOfEquator);
      expect(distance).toBeGreaterThan(100);
      expect(distance).toBeLessThan(120);
    });
  });
});
