import { describe, it, expect } from '@jest/globals';
import { quoteOutputSchema, getDefaultPricingRules } from '../server/agents/quoting';

describe('Quoting Agent Schema', () => {
  describe('quoteOutputSchema', () => {
    it('should validate a complete range quote', () => {
      const quote = {
        quote: {
          type: "range" as const,
          low_usd: 60,
          high_usd: 85,
          line_items: [
            { name: "Lawn Mowing (medium yard)", qty: 1, unit: "visit", unit_price_usd: 60, total_usd: 60 },
          ],
          assumptions: ["Assumed medium-sized property based on address"],
          exclusions: ["Disposal fees", "Equipment rentals"],
        },
        customer_message: {
          recommended_text: "Hi John! Based on your mowing request, we estimate $60-$85 per visit. When works best for you?",
          asks_for_photos: false,
          photo_instructions: null,
        },
        requires_human_approval: false,
        approval_reason: "",
        confidence: 0.85,
      };

      const result = quoteOutputSchema.safeParse(quote);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quote.type).toBe("range");
        expect(result.data.quote.low_usd).toBe(60);
        expect(result.data.confidence).toBe(0.85);
      }
    });

    it('should validate a fixed quote requiring approval', () => {
      const quote = {
        quote: {
          type: "fixed" as const,
          low_usd: 250,
          high_usd: 250,
          line_items: [
            { name: "Fall Cleanup", qty: 1, unit: "service", unit_price_usd: 200, total_usd: 200 },
            { name: "Leaf Disposal", qty: 1, unit: "load", unit_price_usd: 50, total_usd: 50 },
          ],
          assumptions: [],
          exclusions: ["Gutter cleaning", "Pressure washing"],
        },
        customer_message: {
          recommended_text: "Based on the photos you sent, we can do your fall cleanup for $250. This includes leaf removal and disposal.",
          asks_for_photos: false,
          photo_instructions: null,
        },
        requires_human_approval: true,
        approval_reason: "Fixed pricing requires approval for Owner/SMB tier",
        confidence: 0.92,
      };

      const result = quoteOutputSchema.safeParse(quote);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quote.type).toBe("fixed");
        expect(result.data.requires_human_approval).toBe(true);
      }
    });

    it('should validate a needs_site_visit quote', () => {
      const quote = {
        quote: {
          type: "needs_site_visit" as const,
          low_usd: 75,
          high_usd: 500,
          line_items: [
            { name: "Landscaping consultation", qty: 1, unit: "visit", unit_price_usd: 75, total_usd: 75 },
          ],
          assumptions: ["Complex landscaping project requires on-site assessment"],
          exclusions: ["Final pricing pending site visit", "Materials cost TBD"],
        },
        customer_message: {
          recommended_text: "For landscaping projects, we'd love to visit your property for a free consultation. We can then provide a detailed quote.",
          asks_for_photos: true,
          photo_instructions: "In the meantime, could you send photos of the areas you'd like to landscape?",
        },
        requires_human_approval: true,
        approval_reason: "Site visit required for accurate pricing",
        confidence: 0.5,
      };

      const result = quoteOutputSchema.safeParse(quote);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quote.type).toBe("needs_site_visit");
        expect(result.data.customer_message.asks_for_photos).toBe(true);
      }
    });

    it('should validate a mulch quote with multiple line items', () => {
      const quote = {
        quote: {
          type: "range" as const,
          low_usd: 350,
          high_usd: 455,
          line_items: [
            { name: "Mulch material", qty: 4, unit: "cubic yard", unit_price_usd: 65, total_usd: 260 },
            { name: "Installation labor", qty: 4, unit: "hour", unit_price_usd: 45, total_usd: 180 },
          ],
          assumptions: ["Medium property - estimated 4 cubic yards", "Standard brown mulch"],
          exclusions: ["Bed edging", "Weed barrier fabric"],
        },
        customer_message: {
          recommended_text: "For mulch installation, we estimate $350-$455 depending on the exact coverage area. Could you send some photos?",
          asks_for_photos: true,
          photo_instructions: "Please send photos of the beds you want mulched so we can refine our estimate.",
        },
        requires_human_approval: false,
        approval_reason: "",
        confidence: 0.75,
      };

      const result = quoteOutputSchema.safeParse(quote);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quote.line_items.length).toBe(2);
        expect(result.data.customer_message.asks_for_photos).toBe(true);
      }
    });

    it('should reject quote below zero', () => {
      const quote = {
        quote: {
          type: "range" as const,
          low_usd: -10,
          high_usd: 50,
          line_items: [],
          assumptions: [],
          exclusions: [],
        },
        customer_message: {
          recommended_text: "Test",
          asks_for_photos: false,
          photo_instructions: null,
        },
        requires_human_approval: false,
        approval_reason: "",
        confidence: 0.5,
      };

      const result = quoteOutputSchema.safeParse(quote);
      expect(result.success).toBe(false);
    });

    it('should reject confidence outside 0-1 range', () => {
      const quote = {
        quote: {
          type: "range" as const,
          low_usd: 50,
          high_usd: 100,
          line_items: [],
          assumptions: [],
          exclusions: [],
        },
        customer_message: {
          recommended_text: "Test",
          asks_for_photos: false,
          photo_instructions: null,
        },
        requires_human_approval: false,
        approval_reason: "",
        confidence: 1.5,
      };

      const result = quoteOutputSchema.safeParse(quote);
      expect(result.success).toBe(false);
    });

    it('should reject invalid quote type', () => {
      const quote = {
        quote: {
          type: "estimate",
          low_usd: 50,
          high_usd: 100,
          line_items: [],
          assumptions: [],
          exclusions: [],
        },
        customer_message: {
          recommended_text: "Test",
          asks_for_photos: false,
          photo_instructions: null,
        },
        requires_human_approval: false,
        approval_reason: "",
        confidence: 0.5,
      };

      const result = quoteOutputSchema.safeParse(quote);
      expect(result.success).toBe(false);
    });

    it('should reject negative line item quantity', () => {
      const quote = {
        quote: {
          type: "range" as const,
          low_usd: 50,
          high_usd: 100,
          line_items: [
            { name: "Bad item", qty: -1, unit: "unit", unit_price_usd: 10, total_usd: -10 },
          ],
          assumptions: [],
          exclusions: [],
        },
        customer_message: {
          recommended_text: "Test",
          asks_for_photos: false,
          photo_instructions: null,
        },
        requires_human_approval: false,
        approval_reason: "",
        confidence: 0.5,
      };

      const result = quoteOutputSchema.safeParse(quote);
      expect(result.success).toBe(false);
    });
  });

  describe('getDefaultPricingRules', () => {
    it('should return valid default pricing rules', () => {
      const rules = getDefaultPricingRules();
      
      expect(rules.minimumPrice).toBeGreaterThan(0);
      expect(rules.mowing.small).toBeGreaterThan(0);
      expect(rules.mowing.medium).toBeGreaterThan(rules.mowing.small);
      expect(rules.mowing.large).toBeGreaterThan(rules.mowing.medium);
      expect(rules.mulch.perYard).toBeGreaterThan(0);
      expect(rules.landscaping.consultFee).toBeGreaterThan(0);
    });

    it('should have valid seasonal modifiers', () => {
      const rules = getDefaultPricingRules();
      
      expect(rules.seasonalModifiers.spring).toBeGreaterThan(0);
      expect(rules.seasonalModifiers.summer).toBeGreaterThan(0);
      expect(rules.seasonalModifiers.fall).toBeGreaterThan(0);
      expect(rules.seasonalModifiers.winter).toBeGreaterThan(0);
    });
  });
});
