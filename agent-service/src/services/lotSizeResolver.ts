// MOCK LOT SIZE RESOLVER
// In a real microservice, this would call a dedicated GeoService.

import { AreaBands, type AreaBandKey, type LotSizeResult } from "@shared/schema";

export const lotSizeResolver = {
  async resolve(address: string): Promise<LotSizeResult> {
    console.log(`MOCK: lotSizeResolver.resolve(${address})`);
    
    // Simulate some basic parsing
    const normalizedAddress = address.trim();
    const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
    const zip = zipMatch ? zipMatch[1] : null;

    // Return static mock data for now
    return {
      normalizedAddress: normalizedAddress,
      lat: 34.0522, // Mock LA coordinates
      lng: -118.2437,
      zip: zip || "90210",
      countyFips: "06037",
      countyName: "Los Angeles",
      parcelCoverage: "partial",
      lotAreaSqft: 7500, // Medium size lot
      lotAreaAcres: 7500 / 43560,
      confidence: "medium",
      source: "mock_data",
      fallback: {
        requiresCustomerValidation: false,
        questions: [],
      },
    };
  },
  
  async seedCountySources(): Promise<void> {
    console.log("MOCK: seedCountySources() - No action, as there's no real DB here.");
  },
  
  async seedZipCrosswalk(): Promise<void> {
    console.log("MOCK: seedZipCrosswalk() - No action, as there's no real DB here.");
  },
};

export default lotSizeResolver;