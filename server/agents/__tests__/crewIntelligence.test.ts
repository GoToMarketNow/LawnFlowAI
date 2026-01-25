import {
  calculateSkillMatchPct,
  calculateEquipmentMatchPct,
  isCrewFullyEligible,
  isCrewEligibleWithThresholds,
  filterFullyEligibleCrews,
  filterEligibleCrewsWithThresholds,
  EligibleCrew,
  EligibilityThresholds,
} from "../crewIntelligence";

describe("crewIntelligence", () => {
  describe("calculateSkillMatchPct", () => {
    it("returns 100% when no skills are required", () => {
      expect(calculateSkillMatchPct([], ["mowing", "landscaping"])).toBe(100);
    });

    it("returns 100% when all required skills are present", () => {
      expect(
        calculateSkillMatchPct(
          ["mowing", "landscaping"],
          ["mowing", "landscaping", "irrigation"]
        )
      ).toBe(100);
    });

    it("returns 50% when half of required skills are present", () => {
      expect(
        calculateSkillMatchPct(["mowing", "landscaping"], ["mowing", "cleanup"])
      ).toBe(50);
    });

    it("returns 0% when no required skills are present", () => {
      expect(
        calculateSkillMatchPct(["mowing", "landscaping"], ["irrigation", "hardscape"])
      ).toBe(0);
    });

    it("handles case-insensitive matching", () => {
      expect(
        calculateSkillMatchPct(["MOWING", "Landscaping"], ["mowing", "landscaping"])
      ).toBe(100);
    });

    it("returns 100% when required skills is null/undefined", () => {
      expect(calculateSkillMatchPct(null as any, ["mowing"])).toBe(100);
      expect(calculateSkillMatchPct(undefined as any, ["mowing"])).toBe(100);
    });
  });

  describe("calculateEquipmentMatchPct", () => {
    it("returns 100% when no equipment is required", () => {
      expect(calculateEquipmentMatchPct([], ["zero_turn", "trailer"])).toBe(100);
    });

    it("returns 100% when all required equipment is present", () => {
      expect(
        calculateEquipmentMatchPct(
          ["zero_turn", "trailer"],
          ["zero_turn", "trailer", "dump_trailer"]
        )
      ).toBe(100);
    });

    it("returns 33% when 1 of 3 required equipment is present", () => {
      expect(
        calculateEquipmentMatchPct(
          ["zero_turn", "trailer", "skid_steer"],
          ["zero_turn"]
        )
      ).toBe(33);
    });

    it("returns 0% when no required equipment is present", () => {
      expect(
        calculateEquipmentMatchPct(["zero_turn"], ["push_mower", "rake"])
      ).toBe(0);
    });

    it("handles case-insensitive matching", () => {
      expect(
        calculateEquipmentMatchPct(["ZERO_TURN"], ["zero_turn"])
      ).toBe(100);
    });
  });

  describe("isCrewFullyEligible", () => {
    const createCrew = (flags: string[]): EligibleCrew => ({
      crewId: 1,
      name: "Test Crew",
      skillsMatchPct: 100,
      equipmentMatchPct: 100,
      capacityRemainingByDay: [{ date: "2026-01-05", minutes: 300 }],
      distanceFromHomeEstimate: 5,
      memberCount: 2,
      flags,
    });

    it("returns true when crew has no flags", () => {
      expect(isCrewFullyEligible(createCrew([]))).toBe(true);
    });

    it("returns true when crew only has missing_coordinates flag", () => {
      expect(isCrewFullyEligible(createCrew(["missing_coordinates"]))).toBe(true);
    });

    it("returns false when crew has outside_service_radius flag", () => {
      expect(isCrewFullyEligible(createCrew(["outside_service_radius"]))).toBe(false);
    });

    it("returns false when crew has no_available_capacity flag", () => {
      expect(isCrewFullyEligible(createCrew(["no_available_capacity"]))).toBe(false);
    });

    it("returns false when crew has insufficient_crew_size flag", () => {
      expect(isCrewFullyEligible(createCrew(["insufficient_crew_size"]))).toBe(false);
    });

    it("returns false when crew has partial_skill_match flag", () => {
      expect(isCrewFullyEligible(createCrew(["partial_skill_match"]))).toBe(false);
    });

    it("returns false when crew has partial_equipment_match flag", () => {
      expect(isCrewFullyEligible(createCrew(["partial_equipment_match"]))).toBe(false);
    });
  });

  describe("filterFullyEligibleCrews", () => {
    const crews: EligibleCrew[] = [
      {
        crewId: 1,
        name: "Alpha Crew",
        skillsMatchPct: 100,
        equipmentMatchPct: 100,
        capacityRemainingByDay: [{ date: "2026-01-05", minutes: 300 }],
        distanceFromHomeEstimate: 5,
        memberCount: 2,
        flags: [],
      },
      {
        crewId: 2,
        name: "Bravo Crew",
        skillsMatchPct: 50,
        equipmentMatchPct: 100,
        capacityRemainingByDay: [{ date: "2026-01-05", minutes: 300 }],
        distanceFromHomeEstimate: 10,
        memberCount: 2,
        flags: ["partial_skill_match"],
      },
      {
        crewId: 3,
        name: "Charlie Crew",
        skillsMatchPct: 100,
        equipmentMatchPct: 100,
        capacityRemainingByDay: [{ date: "2026-01-05", minutes: 300 }],
        distanceFromHomeEstimate: null,
        memberCount: 2,
        flags: ["missing_coordinates"],
      },
      {
        crewId: 4,
        name: "Delta Crew",
        skillsMatchPct: 100,
        equipmentMatchPct: 100,
        capacityRemainingByDay: [{ date: "2026-01-05", minutes: 0 }],
        distanceFromHomeEstimate: 8,
        memberCount: 2,
        flags: ["no_available_capacity"],
      },
    ];

    it("filters to only fully eligible crews", () => {
      const eligible = filterFullyEligibleCrews(crews);
      expect(eligible.length).toBe(2);
      expect(eligible.map(c => c.crewId)).toEqual([1, 3]);
    });

    it("returns empty array when no crews are eligible", () => {
      const ineligibleCrews = crews.filter(c => 
        c.flags.includes("partial_skill_match") || 
        c.flags.includes("no_available_capacity")
      );
      const eligible = filterFullyEligibleCrews(ineligibleCrews);
      expect(eligible.length).toBe(0);
    });
  });

  describe("isCrewEligibleWithThresholds", () => {
    const createCrew = (skillsMatchPct: number, equipmentMatchPct: number, flags: string[]): EligibleCrew => ({
      crewId: 1,
      name: "Test Crew",
      skillsMatchPct,
      equipmentMatchPct,
      capacityRemainingByDay: [{ date: "2026-01-05", minutes: 300 }],
      distanceFromHomeEstimate: 5,
      memberCount: 2,
      flags,
    });

    it("returns true when crew meets 100% thresholds", () => {
      const thresholds: EligibilityThresholds = { skillMatchMinPct: 100, equipmentMatchMinPct: 100 };
      expect(isCrewEligibleWithThresholds(createCrew(100, 100, []), thresholds)).toBe(true);
    });

    it("returns true when crew meets lower thresholds", () => {
      const thresholds: EligibilityThresholds = { skillMatchMinPct: 50, equipmentMatchMinPct: 50 };
      expect(isCrewEligibleWithThresholds(createCrew(75, 60, ["partial_skill_match"]), thresholds)).toBe(true);
    });

    it("returns false when crew doesn't meet skill threshold", () => {
      const thresholds: EligibilityThresholds = { skillMatchMinPct: 80, equipmentMatchMinPct: 50 };
      expect(isCrewEligibleWithThresholds(createCrew(70, 100, ["partial_skill_match"]), thresholds)).toBe(false);
    });

    it("returns false when crew doesn't meet equipment threshold", () => {
      const thresholds: EligibilityThresholds = { skillMatchMinPct: 50, equipmentMatchMinPct: 80 };
      expect(isCrewEligibleWithThresholds(createCrew(100, 60, ["partial_equipment_match"]), thresholds)).toBe(false);
    });

    it("returns false for critical flags regardless of thresholds", () => {
      const thresholds: EligibilityThresholds = { skillMatchMinPct: 0, equipmentMatchMinPct: 0 };
      expect(isCrewEligibleWithThresholds(createCrew(100, 100, ["outside_service_radius"]), thresholds)).toBe(false);
      expect(isCrewEligibleWithThresholds(createCrew(100, 100, ["no_available_capacity"]), thresholds)).toBe(false);
      expect(isCrewEligibleWithThresholds(createCrew(100, 100, ["insufficient_crew_size"]), thresholds)).toBe(false);
    });

    it("allows crews with missing_coordinates flag", () => {
      const thresholds: EligibilityThresholds = { skillMatchMinPct: 100, equipmentMatchMinPct: 100 };
      expect(isCrewEligibleWithThresholds(createCrew(100, 100, ["missing_coordinates"]), thresholds)).toBe(true);
    });
  });

  describe("filterEligibleCrewsWithThresholds", () => {
    const crews: EligibleCrew[] = [
      {
        crewId: 1,
        name: "Alpha Crew",
        skillsMatchPct: 100,
        equipmentMatchPct: 100,
        capacityRemainingByDay: [{ date: "2026-01-05", minutes: 300 }],
        distanceFromHomeEstimate: 5,
        memberCount: 2,
        flags: [],
      },
      {
        crewId: 2,
        name: "Bravo Crew",
        skillsMatchPct: 75,
        equipmentMatchPct: 80,
        capacityRemainingByDay: [{ date: "2026-01-05", minutes: 300 }],
        distanceFromHomeEstimate: 10,
        memberCount: 2,
        flags: ["partial_skill_match", "partial_equipment_match"],
      },
      {
        crewId: 3,
        name: "Charlie Crew",
        skillsMatchPct: 50,
        equipmentMatchPct: 50,
        capacityRemainingByDay: [{ date: "2026-01-05", minutes: 300 }],
        distanceFromHomeEstimate: 8,
        memberCount: 2,
        flags: ["partial_skill_match", "partial_equipment_match"],
      },
    ];

    it("filters with 100% threshold (strict)", () => {
      const thresholds: EligibilityThresholds = { skillMatchMinPct: 100, equipmentMatchMinPct: 100 };
      const eligible = filterEligibleCrewsWithThresholds(crews, thresholds);
      expect(eligible.length).toBe(1);
      expect(eligible[0].crewId).toBe(1);
    });

    it("filters with 70% threshold (relaxed)", () => {
      const thresholds: EligibilityThresholds = { skillMatchMinPct: 70, equipmentMatchMinPct: 70 };
      const eligible = filterEligibleCrewsWithThresholds(crews, thresholds);
      expect(eligible.length).toBe(2);
      expect(eligible.map(c => c.crewId)).toEqual([1, 2]);
    });

    it("filters with 50% threshold (very relaxed)", () => {
      const thresholds: EligibilityThresholds = { skillMatchMinPct: 50, equipmentMatchMinPct: 50 };
      const eligible = filterEligibleCrewsWithThresholds(crews, thresholds);
      expect(eligible.length).toBe(3);
    });
  });
});
