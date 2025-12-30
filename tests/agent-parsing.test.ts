import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';

const intakeResultSchema = z.object({
  isQualified: z.boolean().default(true),
  customerName: z.string().nullish(),
  serviceType: z.string().optional(),
  address: z.string().nullish(),
  urgency: z.enum(["low", "medium", "high"]).default("medium"),
  notes: z.string().default(""),
  suggestedResponse: z.string(),
});

const quoteResultSchema = z.object({
  quoteType: z.enum(["range", "fixed"]).default("range"),
  amount: z.number().optional(),
  amountMin: z.number().optional(),
  amountMax: z.number().optional(),
  serviceType: z.string(),
  description: z.string(),
  confidence: z.number().min(0).max(1).default(0.8),
  suggestedMessage: z.string(),
});

const scheduleResultSchema = z.object({
  suggestedSlots: z.array(z.object({
    date: z.string(),
    timeWindow: z.string(),
    slotScore: z.number().min(0).max(100).default(80),
  })).default([]),
  preferredSlot: z.number().optional(),
  confidence: z.number().min(0).max(1).default(0.8),
  suggestedMessage: z.string(),
});

describe('Agent JSON Parsing', () => {
  describe('Intake Agent Response Parsing', () => {
    it('should parse a valid intake response', () => {
      const response = {
        isQualified: true,
        customerName: 'John Smith',
        serviceType: 'mowing',
        address: '123 Main St',
        urgency: 'high',
        notes: 'Customer wants weekly service',
        suggestedResponse: 'Hi John! Thanks for reaching out. We can help with lawn mowing.',
      };

      const result = intakeResultSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customerName).toBe('John Smith');
        expect(result.data.urgency).toBe('high');
      }
    });

    it('should apply defaults for missing optional fields', () => {
      const response = {
        suggestedResponse: 'Thank you for contacting us!',
      };

      const result = intakeResultSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isQualified).toBe(true);
        expect(result.data.urgency).toBe('medium');
        expect(result.data.notes).toBe('');
      }
    });

    it('should handle null values for nullable fields', () => {
      const response = {
        isQualified: false,
        customerName: null,
        address: null,
        urgency: 'low',
        suggestedResponse: 'We cannot help with this request.',
      };

      const result = intakeResultSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customerName).toBeNull();
        expect(result.data.address).toBeNull();
      }
    });

    it('should reject invalid urgency values', () => {
      const response = {
        urgency: 'super_urgent',
        suggestedResponse: 'Response text',
      };

      const result = intakeResultSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('should require suggestedResponse', () => {
      const response = {
        isQualified: true,
        customerName: 'Test',
      };

      const result = intakeResultSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });

  describe('Quote Agent Response Parsing', () => {
    it('should parse a valid range quote', () => {
      const response = {
        quoteType: 'range',
        amountMin: 250,
        amountMax: 400,
        serviceType: 'cleanup',
        description: 'Fall cleanup service',
        confidence: 0.85,
        suggestedMessage: 'Based on your yard size, cleanup would be $250-$400.',
      };

      const result = quoteResultSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quoteType).toBe('range');
        expect(result.data.amountMin).toBe(250);
        expect(result.data.amountMax).toBe(400);
      }
    });

    it('should parse a valid fixed quote', () => {
      const response = {
        quoteType: 'fixed',
        amount: 45,
        serviceType: 'mowing',
        description: 'Weekly lawn mowing',
        confidence: 0.95,
        suggestedMessage: 'Your weekly mowing will be $45 per visit.',
      };

      const result = quoteResultSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quoteType).toBe('fixed');
        expect(result.data.amount).toBe(45);
      }
    });

    it('should clamp confidence to valid range', () => {
      const response = {
        serviceType: 'mowing',
        description: 'Test',
        confidence: 1.5,
        suggestedMessage: 'Test message',
      };

      const result = quoteResultSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('should require serviceType and description', () => {
      const response = {
        quoteType: 'fixed',
        amount: 100,
        suggestedMessage: 'Message',
      };

      const result = quoteResultSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });

  describe('Schedule Agent Response Parsing', () => {
    it('should parse a valid schedule response with slots', () => {
      const response = {
        suggestedSlots: [
          { date: '2025-01-15', timeWindow: '9AM-12PM', slotScore: 90 },
          { date: '2025-01-16', timeWindow: '1PM-4PM', slotScore: 85 },
          { date: '2025-01-17', timeWindow: '9AM-12PM', slotScore: 75 },
        ],
        preferredSlot: 0,
        confidence: 0.9,
        suggestedMessage: 'We have availability on Wed, Thu, or Fri. Which works best?',
      };

      const result = scheduleResultSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.suggestedSlots.length).toBe(3);
        expect(result.data.suggestedSlots[0].slotScore).toBe(90);
      }
    });

    it('should default to empty slots array', () => {
      const response = {
        confidence: 0.5,
        suggestedMessage: 'No availability found.',
      };

      const result = scheduleResultSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.suggestedSlots).toEqual([]);
      }
    });

    it('should validate slot score range', () => {
      const response = {
        suggestedSlots: [
          { date: '2025-01-15', timeWindow: '9AM-12PM', slotScore: 150 },
        ],
        confidence: 0.8,
        suggestedMessage: 'Test',
      };

      const result = scheduleResultSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });

  describe('Response Truncation Logic', () => {
    function truncateResponse(text: string, maxLength: number): string {
      if (text.length <= maxLength) return text;
      const truncated = text.substring(0, maxLength - 3);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > maxLength * 0.7) {
        return truncated.substring(0, lastSpace) + '...';
      }
      return truncated + '...';
    }

    it('should not truncate short messages', () => {
      const message = 'Hello, this is a short message.';
      const result = truncateResponse(message, 160);
      expect(result).toBe(message);
      expect(result.length).toBeLessThanOrEqual(160);
    });

    it('should truncate long messages at word boundary', () => {
      const message = 'This is a very long message that exceeds the maximum SMS length limit and needs to be truncated appropriately at a word boundary.';
      const result = truncateResponse(message, 80);
      expect(result.length).toBeLessThanOrEqual(80);
      expect(result.endsWith('...')).toBe(true);
      expect(result.includes('appropriately')).toBe(false);
    });

    it('should handle messages exactly at limit', () => {
      const message = 'A'.repeat(160);
      const result = truncateResponse(message, 160);
      expect(result).toBe(message);
    });

    it('should handle empty string', () => {
      const result = truncateResponse('', 160);
      expect(result).toBe('');
    });

    it('should handle single word longer than limit', () => {
      const message = 'Superlongwordthatexceedsthelimit';
      const result = truncateResponse(message, 20);
      expect(result.length).toBeLessThanOrEqual(20);
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('Malformed JSON Handling', () => {
    it('should handle JSON with extra fields gracefully', () => {
      const response = {
        isQualified: true,
        suggestedResponse: 'Test',
        extraField: 'ignored',
        anotherExtra: 123,
      };

      const result = intakeResultSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should handle nested extra fields', () => {
      const response = {
        suggestedSlots: [
          { 
            date: '2025-01-15', 
            timeWindow: '9AM', 
            slotScore: 80,
            extraNested: { deep: 'value' },
          },
        ],
        confidence: 0.8,
        suggestedMessage: 'Test',
        metadata: { ignored: true },
      };

      const result = scheduleResultSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});
