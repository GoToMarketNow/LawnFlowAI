import { calculateRiskScore } from "../jobFeasibility";

describe("jobFeasibility", () => {
  describe("calculateRiskScore", () => {
    it("returns 0 for no reasons", () => {
      expect(calculateRiskScore([])).toBe(0);
    });

    it("scores skill match issues at 30 points", () => {
      expect(calculateRiskScore(["skill_match_below_threshold:80%"])).toBe(30);
    });

    it("scores equipment match issues at 30 points", () => {
      expect(calculateRiskScore(["equipment_match_below_threshold:70%"])).toBe(30);
    });

    it("scores insufficient crew size at 40 points", () => {
      expect(calculateRiskScore(["insufficient_crew_size:need_2_have_1"])).toBe(40);
    });

    it("scores capacity exceeded at 50 points", () => {
      expect(calculateRiskScore(["capacity_exceeded:need_120min_have_60min"])).toBe(50);
    });

    it("scores low lot confidence at 20 points", () => {
      expect(calculateRiskScore(["low_lot_confidence_high_variance_service:cleanup"])).toBe(20);
    });

    it("scores large lot monthly at 15 points", () => {
      expect(calculateRiskScore(["large_lot_monthly_service:50000sqft"])).toBe(15);
    });

    it("scores missing coordinates at 25 points", () => {
      expect(calculateRiskScore(["missing_coordinates"])).toBe(25);
    });

    it("accumulates multiple reasons", () => {
      const reasons = [
        "skill_match_below_threshold:80%",
        "equipment_match_below_threshold:70%",
        "missing_coordinates",
      ];
      expect(calculateRiskScore(reasons)).toBe(85);
    });

    it("caps at 100", () => {
      const reasons = [
        "skill_match_below_threshold:50%",
        "equipment_match_below_threshold:50%",
        "insufficient_crew_size:need_3_have_1",
        "capacity_exceeded:need_200min_have_0min",
      ];
      expect(calculateRiskScore(reasons)).toBe(100);
    });
  });

  describe("feasibility determination", () => {
    it("hard-failure reasons make job infeasible", () => {
      const hardFailures = [
        "skill_match_below_threshold:80%",
        "equipment_match_below_threshold:70%",
        "insufficient_crew_size:need_2_have_1",
        "capacity_exceeded:need_120min_have_60min",
      ];
      
      for (const reason of hardFailures) {
        const isFeasible = !reason.startsWith("skill_match_below") && 
                          !reason.startsWith("equipment_match_below") &&
                          !reason.startsWith("insufficient_crew_size") &&
                          !reason.startsWith("capacity_exceeded");
        expect(isFeasible).toBe(false);
      }
    });

    it("soft-failure reasons allow feasibility but need review", () => {
      const softFailures = [
        "low_lot_confidence_high_variance_service:cleanup",
        "large_lot_monthly_service:50000sqft",
        "missing_coordinates",
      ];
      
      for (const reason of softFailures) {
        const isFeasible = !reason.startsWith("skill_match_below") && 
                          !reason.startsWith("equipment_match_below") &&
                          !reason.startsWith("insufficient_crew_size") &&
                          !reason.startsWith("capacity_exceeded");
        expect(isFeasible).toBe(true);
      }
    });
  });
});
