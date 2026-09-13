import { describe, expect, it } from "vitest";
import { addBoosters, applyRegionPoints, migrateSave, spendBooster } from "./progress";

const regions = [
  { key: "a", required: 100 },
  { key: "b", required: 200 },
];

describe("save data v3", () => {
  it("migrates old progress and resets a conquered region", () => {
    const save = migrateSave(null, { activeRegionKey: "a", regionProgress: { a: 120 } }, regions);
    expect(save.version).toBe(3);
    expect(save.regionWon.a).toBe(true);
    expect(save.regionProgress.a).toBe(0);
    expect(save.activeRegionKey).toBe(null);
    expect(save.regionOptOut).toBe(false);
  });

  it("keeps a region's favour but starts the next target at zero", () => {
    const first = applyRegionPoints(
      { activeRegionKey: "a", regionProgress: { a: 90 }, regionWon: {} },
      20,
      regions,
    );
    expect(first.conquered).toBe("a");
    expect(first.state.regionWon.a).toBe(true);
    expect(first.state.regionProgress.a).toBe(0);
    expect(first.state.activeRegionKey).toBe(null);
  });

  it("only completes France after the final heart", () => {
    const result = applyRegionPoints(
      { activeRegionKey: "b", regionProgress: { b: 199 }, regionWon: { a: true } },
      1,
      regions,
    );
    expect(result.completedFrance).toBe(true);
  });
});

describe("boosters", () => {
  it("adds rewards and cannot overspend", () => {
    const inventory = addBoosters({}, { shuffle: 2, remove: 1 });
    expect(spendBooster(inventory, "shuffle")).toMatchObject({ shuffle: 1 });
    expect(spendBooster({}, "extraMoves")).toBe(null);
  });
});
