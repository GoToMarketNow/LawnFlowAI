import {
  haversineDistanceMi,
  checkServiceArea,
  validateServiceAreaConfig,
  milesToMeters,
  metersToMiles,
  VALID_MAX_DISTANCES,
  buildServiceAreaEval,
  mockGeocodeAddress,
  type ServiceAreaConfig,
} from "../server/utils/service-area";

describe("Service Area Utilities", () => {
  describe("haversineDistanceMi", () => {
    it("should return 0 for same point", () => {
      const distance = haversineDistanceMi(33.749, -84.388, 33.749, -84.388);
      expect(distance).toBeCloseTo(0, 5);
    });

    it("should calculate correct distance between Atlanta and New York", () => {
      const atlanta = { lat: 33.749, lng: -84.388 };
      const newYork = { lat: 40.7128, lng: -74.006 };
      const distance = haversineDistanceMi(
        atlanta.lat,
        atlanta.lng,
        newYork.lat,
        newYork.lng
      );
      expect(distance).toBeGreaterThan(700);
      expect(distance).toBeLessThan(800);
    });

    it("should calculate short distances accurately", () => {
      const point1 = { lat: 33.749, lng: -84.388 };
      const point2 = { lat: 33.76, lng: -84.388 };
      const distance = haversineDistanceMi(
        point1.lat,
        point1.lng,
        point2.lat,
        point2.lng
      );
      expect(distance).toBeGreaterThan(0.7);
      expect(distance).toBeLessThan(0.8);
    });
  });

  describe("checkServiceArea", () => {
    const defaultConfig: ServiceAreaConfig = {
      centerLat: 33.749,
      centerLng: -84.388,
      radiusMi: 10,
      maxMi: 20,
      allowExtended: true,
    };

    it("should return core tier when inside radius", () => {
      const result = checkServiceArea(33.75, -84.39, defaultConfig);
      expect(result.eligible).toBe(true);
      expect(result.tier).toBe("core");
      expect(result.distanceMi).toBeLessThan(10);
    });

    it("should return extended tier when outside radius but inside max with allowExtended true", () => {
      const config: ServiceAreaConfig = {
        ...defaultConfig,
        radiusMi: 5,
        maxMi: 20,
        allowExtended: true,
      };
      const result = checkServiceArea(33.85, -84.388, config);
      expect(result.eligible).toBe(true);
      expect(result.tier).toBe("extended");
      expect(result.distanceMi).toBeGreaterThan(5);
      expect(result.distanceMi).toBeLessThan(20);
    });

    it("should return out_of_area when outside max", () => {
      const config: ServiceAreaConfig = {
        ...defaultConfig,
        radiusMi: 5,
        maxMi: 10,
      };
      const result = checkServiceArea(34.5, -84.388, config);
      expect(result.eligible).toBe(false);
      expect(result.tier).toBe("out_of_area");
      expect(result.distanceMi).toBeGreaterThan(10);
    });

    it("should return out_of_area when outside radius and allowExtended is false", () => {
      const config: ServiceAreaConfig = {
        ...defaultConfig,
        radiusMi: 5,
        maxMi: 40,
        allowExtended: false,
      };
      const result = checkServiceArea(33.85, -84.388, config);
      expect(result.eligible).toBe(false);
      expect(result.tier).toBe("out_of_area");
    });

    it("should handle edge case at exact radius boundary", () => {
      const config: ServiceAreaConfig = {
        centerLat: 0,
        centerLng: 0,
        radiusMi: 10,
        maxMi: 20,
        allowExtended: true,
      };
      const result = checkServiceArea(0.145, 0, config);
      expect(result.tier).toBe("core");
    });
  });

  describe("buildServiceAreaEval", () => {
    it("should build complete eval object for core tier", () => {
      const config: ServiceAreaConfig = {
        centerLat: 33.749,
        centerLng: -84.388,
        radiusMi: 10,
        maxMi: 20,
        allowExtended: true,
      };
      const eval_result = buildServiceAreaEval(33.75, -84.39, config);
      expect(eval_result.eligible).toBe(true);
      expect(eval_result.tier).toBe("core");
      expect(eval_result.radius_mi).toBe(10);
      expect(eval_result.max_mi).toBe(20);
      expect(eval_result.allow_extended).toBe(true);
    });
  });

  describe("validateServiceAreaConfig", () => {
    it("should accept valid max distances", () => {
      for (const maxMi of VALID_MAX_DISTANCES) {
        const result = validateServiceAreaConfig({
          radiusMi: 5,
          maxMi,
          centerLat: 33.749,
          centerLng: -84.388,
        });
        expect(result.valid).toBe(true);
      }
    });

    it("should reject invalid max distance", () => {
      const result = validateServiceAreaConfig({
        radiusMi: 5,
        maxMi: 15,
        centerLat: 33.749,
        centerLng: -84.388,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("5, 10, 20, 40");
    });

    it("should clamp radius when greater than max", () => {
      const result = validateServiceAreaConfig({
        radiusMi: 25,
        maxMi: 20,
        centerLat: 33.749,
        centerLng: -84.388,
      });
      expect(result.valid).toBe(true);
      expect(result.clampedRadiusMi).toBe(20);
    });

    it("should require center when radius is set", () => {
      const result = validateServiceAreaConfig({
        radiusMi: 10,
        maxMi: 20,
        centerLat: null,
        centerLng: null,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("center coordinates");
    });

    it("should require max when radius is set", () => {
      const result = validateServiceAreaConfig({
        radiusMi: 10,
        maxMi: null,
        centerLat: 33.749,
        centerLng: -84.388,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Max travel limit");
    });

    it("should accept empty config", () => {
      const result = validateServiceAreaConfig({});
      expect(result.valid).toBe(true);
    });
  });

  describe("Unit conversions", () => {
    it("should convert miles to meters correctly", () => {
      expect(milesToMeters(1)).toBeCloseTo(1609.344, 2);
      expect(milesToMeters(10)).toBeCloseTo(16093.44, 1);
    });

    it("should convert meters to miles correctly", () => {
      expect(metersToMiles(1609.344)).toBeCloseTo(1, 3);
      expect(metersToMiles(16093.44)).toBeCloseTo(10, 2);
    });

    it("should be reversible", () => {
      const miles = 5;
      expect(metersToMiles(milesToMeters(miles))).toBeCloseTo(miles, 5);
    });
  });

  describe("mockGeocodeAddress", () => {
    it("should return coordinates for valid address", async () => {
      const result = await mockGeocodeAddress("123 Main St, Atlanta, GA");
      expect(result).not.toBeNull();
      expect(result?.lat).toBeGreaterThan(33);
      expect(result?.lng).toBeLessThan(-84);
    });

    it("should return null for empty address", async () => {
      const result = await mockGeocodeAddress("");
      expect(result).toBeNull();
    });

    it("should return consistent results for same address", async () => {
      const result1 = await mockGeocodeAddress("123 Main St");
      const result2 = await mockGeocodeAddress("123 Main St");
      expect(result1?.lat).toBe(result2?.lat);
      expect(result1?.lng).toBe(result2?.lng);
    });
  });
});
