import { calculateTotalScore } from '../simulationRanking';

describe('Simulation & Ranking Agent', () => {
  describe('calculateTotalScore', () => {
    it('applies the correct formula: (100 - travel*2) + margin - risk*10', () => {
      const result = calculateTotalScore(10, 80, 2);
      
      expect(result.components.travel).toBe(80); // 100 - 10*2
      expect(result.components.margin).toBe(80);
      expect(result.components.risk).toBe(20); // 2*10
      expect(result.rawScore).toBe(140); // 80 + 80 - 20
      expect(result.clampedScore).toBe(140);
    });

    it('clamps score to minimum of 0', () => {
      const result = calculateTotalScore(60, 10, 5);
      
      expect(result.components.travel).toBe(-20); // 100 - 60*2
      expect(result.rawScore).toBe(-60); // -20 + 10 - 50
      expect(result.clampedScore).toBe(0);
    });

    it('clamps score to maximum of 200', () => {
      const result = calculateTotalScore(0, 100, 0);
      
      expect(result.rawScore).toBe(200); // 100 + 100 - 0
      expect(result.clampedScore).toBe(200);
    });

    it('handles negative travel component gracefully', () => {
      const result = calculateTotalScore(100, 50, 0);
      
      expect(result.components.travel).toBe(-100); // 100 - 100*2
      expect(result.rawScore).toBe(-50);
      expect(result.clampedScore).toBe(0);
    });

    it('penalizes high risk heavily', () => {
      const lowRisk = calculateTotalScore(15, 80, 1);
      const highRisk = calculateTotalScore(15, 80, 5);
      
      expect(lowRisk.clampedScore).toBeGreaterThan(highRisk.clampedScore);
      expect(lowRisk.clampedScore - highRisk.clampedScore).toBe(40); // 4 risk points * 10
    });

    it('prefers low travel time', () => {
      const shortTravel = calculateTotalScore(10, 70, 2);
      const longTravel = calculateTotalScore(30, 70, 2);
      
      expect(shortTravel.clampedScore).toBeGreaterThan(longTravel.clampedScore);
      expect(shortTravel.clampedScore - longTravel.clampedScore).toBe(40); // 20 min * 2
    });

    it('rewards high margin', () => {
      const highMargin = calculateTotalScore(20, 90, 2);
      const lowMargin = calculateTotalScore(20, 50, 2);
      
      expect(highMargin.clampedScore).toBeGreaterThan(lowMargin.clampedScore);
      expect(highMargin.clampedScore - lowMargin.clampedScore).toBe(40); // 90 - 50
    });
  });

  describe('scoring order determinism', () => {
    it('consistently ranks candidates by total score', () => {
      const candidates = [
        { travel: 25, margin: 70, risk: 3 },
        { travel: 10, margin: 85, risk: 1 },
        { travel: 35, margin: 60, risk: 4 },
        { travel: 15, margin: 90, risk: 2 },
      ];

      const scored = candidates.map(c => ({
        ...c,
        score: calculateTotalScore(c.travel, c.margin, c.risk).clampedScore,
      }));

      scored.sort((a, b) => b.score - a.score);

      for (let i = 0; i < scored.length - 1; i++) {
        expect(scored[i].score).toBeGreaterThanOrEqual(scored[i + 1].score);
      }

      expect(scored[0].travel).toBe(10);
      expect(scored[0].margin).toBe(85);
    });

    it('produces same result on multiple runs', () => {
      const results: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const result = calculateTotalScore(20, 75, 2);
        results.push(result.clampedScore);
      }
      
      expect(new Set(results).size).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('handles zero values', () => {
      const result = calculateTotalScore(0, 0, 0);
      
      expect(result.rawScore).toBe(100); // 100 + 0 - 0
      expect(result.clampedScore).toBe(100);
    });

    it('handles maximum reasonable values', () => {
      const result = calculateTotalScore(120, 100, 10);
      
      expect(result.components.travel).toBe(-140);
      expect(result.components.risk).toBe(100);
      expect(result.rawScore).toBe(-140); // -140 + 100 - 100
      expect(result.clampedScore).toBe(0);
    });
  });
});
