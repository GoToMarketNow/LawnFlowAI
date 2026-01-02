import { 
  computeMarginScore, 
  calculateBurnMinutes,
  getDefaultCostModel,
  type MarginBurnInput 
} from '../marginBurn';

describe('Margin & Burn Agent', () => {
  describe('computeMarginScore', () => {
    it('calculates burn minutes from labor high + travel delta', () => {
      const result = computeMarginScore({
        laborLowMinutes: 60,
        laborHighMinutes: 90,
        travelMinutesDelta: 30,
        crewSizeMin: 2,
        lotAreaSqft: null,
      });
      
      expect(result.burnMinutes).toBe(120); // 90 + 30
    });

    it('uses labor low when labor high is null', () => {
      const result = computeMarginScore({
        laborLowMinutes: 45,
        laborHighMinutes: null,
        travelMinutesDelta: 15,
        crewSizeMin: 1,
        lotAreaSqft: null,
      });
      
      expect(result.burnMinutes).toBe(60); // 45 + 15
    });

    it('uses default 60 min labor when both are null', () => {
      const result = computeMarginScore({
        laborLowMinutes: null,
        laborHighMinutes: null,
        travelMinutesDelta: 20,
        crewSizeMin: 1,
        lotAreaSqft: null,
      });
      
      expect(result.burnMinutes).toBe(80); // 60 + 20
      expect(result.notes).toContain('Using default labor estimate: 60 min');
    });

    it('calculates labor cost with crew size', () => {
      const result = computeMarginScore({
        laborLowMinutes: 60,
        laborHighMinutes: 60,
        travelMinutesDelta: 0,
        crewSizeMin: 2,
        lotAreaSqft: null,
      });
      
      // 60 min = 1 hour, $30/hr * 2 crew = $60
      expect(result.estLaborCost).toBe(60);
    });

    it('includes equipment cost in total', () => {
      const result = computeMarginScore({
        laborLowMinutes: 60,
        laborHighMinutes: 60,
        travelMinutesDelta: 0,
        crewSizeMin: 1,
        lotAreaSqft: null,
        requiredEquipment: ['mower_ztr', 'trimmer', 'blower'],
      });
      
      // mower_ztr=$5, trimmer=$1, blower=$1 = $7
      expect(result.estEquipmentCost).toBe(7);
      expect(result.estTotalCost).toBe(30 + 7); // $30 labor + $7 equipment
    });

    it('uses price high when only priceHighCents provided', () => {
      const result = computeMarginScore({
        laborLowMinutes: 60,
        laborHighMinutes: 60,
        travelMinutesDelta: 0,
        crewSizeMin: 1,
        lotAreaSqft: null,
        priceHighCents: 10000, // $100
      });
      
      expect(result.revenueEstimate).toBe(100);
      expect(result.notes.some(n => n.includes('Using price high'))).toBe(true);
    });

    it('uses price low when only priceLowCents provided', () => {
      const result = computeMarginScore({
        laborLowMinutes: 60,
        laborHighMinutes: 60,
        travelMinutesDelta: 0,
        crewSizeMin: 1,
        lotAreaSqft: null,
        priceLowCents: 8000, // $80
      });
      
      expect(result.revenueEstimate).toBe(80);
      expect(result.notes.some(n => n.includes('Using price low'))).toBe(true);
    });

    it('uses price midpoint when both bounds provided', () => {
      const result = computeMarginScore({
        laborLowMinutes: 60,
        laborHighMinutes: 60,
        travelMinutesDelta: 0,
        crewSizeMin: 1,
        lotAreaSqft: null,
        priceLowCents: 8000, // $80
        priceHighCents: 12000, // $120
      });
      
      expect(result.revenueEstimate).toBe(100); // midpoint of 80 and 120
      expect(result.notes.some(n => n.includes('Using price midpoint'))).toBe(true);
    });

    it('uses lot area proxy when no price range', () => {
      const result = computeMarginScore({
        laborLowMinutes: 60,
        laborHighMinutes: 60,
        travelMinutesDelta: 0,
        crewSizeMin: 1,
        lotAreaSqft: 10000, // 10k sqft
      });
      
      // 10k sqft = 10 * $45/1000sqft = $450
      expect(result.revenueEstimate).toBe(450);
      expect(result.notes.some(n => n.includes('Using lot area proxy'))).toBe(true);
    });

    it('falls back to inverse burn heuristic when no revenue signal', () => {
      const result = computeMarginScore({
        laborLowMinutes: 120,
        laborHighMinutes: 120,
        travelMinutesDelta: 60,
        crewSizeMin: 1,
        lotAreaSqft: null,
      });
      
      // burnMinutes = 180, max = 480
      // score = (1 - 180/480) * 100 = 62.5
      expect(result.marginScore).toBe(63);
      expect(result.revenueEstimate).toBeNull();
      expect(result.notes.some(n => n.includes('inverse burn heuristic'))).toBe(true);
    });

    it('clamps margin score to 0-100', () => {
      // Very high burn should result in 0
      const highBurn = computeMarginScore({
        laborLowMinutes: 480,
        laborHighMinutes: 480,
        travelMinutesDelta: 100,
        crewSizeMin: 1,
        lotAreaSqft: null,
      });
      expect(highBurn.marginScore).toBeGreaterThanOrEqual(0);

      // Very low burn with good revenue should cap at 100
      const lowBurn = computeMarginScore({
        laborLowMinutes: 30,
        laborHighMinutes: 30,
        travelMinutesDelta: 5,
        crewSizeMin: 1,
        lotAreaSqft: null,
        priceHighCents: 50000, // $500 for 35 min job
      });
      expect(lowBurn.marginScore).toBeLessThanOrEqual(100);
    });

    it('handles unknown equipment gracefully', () => {
      const result = computeMarginScore({
        laborLowMinutes: 60,
        laborHighMinutes: 60,
        travelMinutesDelta: 0,
        crewSizeMin: 1,
        lotAreaSqft: null,
        requiredEquipment: ['unknown_tool', 'mower_ztr'],
      });
      
      // unknown_tool = $0, mower_ztr = $5
      expect(result.estEquipmentCost).toBe(5);
    });
  });

  describe('calculateBurnMinutes', () => {
    it('adds labor high and travel delta', () => {
      expect(calculateBurnMinutes(90, 30)).toBe(120);
    });

    it('uses default 60 min when labor is null', () => {
      expect(calculateBurnMinutes(null, 20)).toBe(80);
    });
  });

  describe('getDefaultCostModel', () => {
    it('returns cost model with expected values', () => {
      const model = getDefaultCostModel();
      
      expect(model.laborCostPerHour).toBe(30);
      expect(model.baseRatePerThousandSqft).toBe(45);
      expect(model.equipmentCostPerJob.mower_ztr).toBe(5);
    });
  });
});
