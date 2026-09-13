import { describe, expect, it } from "vitest";
import { buildLevelResult, starsForScore } from "./results";

const level = {
  id: 1,
  moves: 20,
  goals: [
    { typeIdx: 0, need: 10 },
    { typeIdx: 1, need: 5 },
  ],
};

describe("level results", () => {
  it("separates saved-move bonus and calculates used moves", () => {
    const result = buildLevelResult({
      level,
      goalDefs: level.goals,
      goals: [
        { typeIdx: 0, remaining: 0 },
        { typeIdx: 1, remaining: 0 },
      ],
      won: true,
      scoreBeforeBonus: 700,
      movesLeft: 4,
      region: null,
    });
    expect(result.moveBonus).toBe(200);
    expect(result.finalScore).toBe(900);
    expect(result.movesUsed).toBe(16);
  });

  it("reports goal collection and region before/after progress", () => {
    const result = buildLevelResult({
      level,
      goalDefs: level.goals,
      goals: [
        { typeIdx: 0, remaining: 2 },
        { typeIdx: 1, remaining: 0 },
      ],
      won: false,
      scoreBeforeBonus: 300,
      movesLeft: 0,
      region: { key: "x", name: "X", required: 1000, before: 200 },
    });
    expect(result.goals[0]).toMatchObject({ collected: 8, need: 10, complete: false });
    expect(result.region).toMatchObject({ awarded: 300, after: 500, beforePct: 20, afterPct: 50 });
  });

  it("awards one to three stars at stable thresholds", () => {
    expect(starsForScore(level, level.goals, 330)).toBe(1);
    expect(starsForScore(level, level.goals, 480)).toBe(2);
    expect(starsForScore(level, level.goals, 644)).toBe(3);
  });
});
