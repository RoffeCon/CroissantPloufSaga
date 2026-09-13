import { describe, it, expect } from "vitest";
import {
  ROWS,
  COLS,
  makeTile,
  cloneGrid,
  findMatches,
  wouldMatch,
  computeSpecials,
  expandSpecials,
  applyGravity,
  refill,
  hasAnyMove,
  repositionMove,
  specialSwapEffect,
} from "./engine";

// Small helper: build a grid from a compact string map, one row per line.
// Each character is a tile type (digit) — handy for readable fixtures.
function gridFrom(rows) {
  return rows.map((row) => row.split("").map((ch) => makeTile(Number(ch))));
}
function emptyGrid(type = 0) {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => makeTile(type)));
}
// A board with no three-in-a-row anywhere (checkerboard of 4 types).
function calmGrid() {
  return Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => makeTile((r % 2) * 2 + (c % 2))),
  );
}

describe("findMatches", () => {
  it("finds a horizontal run of three", () => {
    const g = calmGrid();
    g[0][0].type = 5;
    g[0][1].type = 5;
    g[0][2].type = 5;
    const { matched, runs } = findMatches(g);
    expect(matched.has("0,0")).toBe(true);
    expect(matched.has("0,2")).toBe(true);
    expect(runs.some((r) => r.dir === "h" && r.cells.length === 3)).toBe(true);
  });

  it("finds a vertical run of four", () => {
    const g = calmGrid();
    for (let r = 0; r < 4; r++) g[r][3].type = 7;
    const { runs } = findMatches(g);
    const run = runs.find((r) => r.dir === "v");
    expect(run.cells.length).toBe(4);
  });

  it("leaves a calm board alone", () => {
    expect(findMatches(calmGrid()).matched.size).toBe(0);
  });
});

describe("wouldMatch", () => {
  it("accepts a swap that creates a line and rejects one that does not", () => {
    const g = calmGrid();
    g[0][0].type = 5;
    g[0][1].type = 5;
    g[1][2].type = 5;
    expect(wouldMatch(g, { r: 1, c: 2 }, { r: 0, c: 2 })).toBe(true);
    expect(wouldMatch(g, { r: 5, c: 5 }, { r: 5, c: 6 })).toBe(false);
  });
});

describe("specials", () => {
  it("makes a row/column clearer from four in a row", () => {
    const g = calmGrid();
    for (let c = 0; c < 4; c++) g[2][c].type = 6;
    const { runs } = findMatches(g);
    const specials = computeSpecials(runs, { r: 2, c: 1 });
    expect(specials).toHaveLength(1);
    expect(specials[0].special).toBe("col");
    expect(specials[0]).toMatchObject({ r: 2, c: 1 });
  });

  it("makes a colour bomb from five in a row", () => {
    const g = calmGrid();
    for (let c = 0; c < 5; c++) g[2][c].type = 6;
    const specials = computeSpecials(findMatches(g).runs, { r: 2, c: 2 });
    expect(specials[0].special).toBe("bomb");
  });

  it("makes an area clearer from a T or L intersection", () => {
    const g = calmGrid();
    [
      [2, 1],
      [2, 2],
      [2, 3],
      [1, 2],
      [3, 2],
    ].forEach(([r, c]) => {
      g[r][c].type = 8;
    });
    const specials = computeSpecials(findMatches(g).runs, { r: 2, c: 2 });
    expect(specials).toContainEqual({ r: 2, c: 2, type: 8, special: "area" });
  });

  it("an area clearer clears a clipped 3 by 3 area at an edge", () => {
    const g = calmGrid();
    g[0][0] = makeTile(1, "area");
    const cleared = expandSpecials(g, new Set(["0,0"]));
    expect(Array.from(cleared).sort()).toEqual(["0,0", "0,1", "1,0", "1,1"]);
  });

  it("a colour bomb clears every tile of its kind", () => {
    const g = calmGrid();
    g[4][4] = makeTile(9, "bomb");
    g[0][0].type = 9;
    g[7][7].type = 9;
    const cleared = expandSpecials(g, new Set(["4,4"]));
    expect(cleared.has("0,0")).toBe(true);
    expect(cleared.has("7,7")).toBe(true);
  });

  it("a row clearer takes the whole row, a column clearer the whole column", () => {
    const g = calmGrid();
    g[3][3] = makeTile(1, "row");
    const row = expandSpecials(g, new Set(["3,3"]));
    for (let c = 0; c < COLS; c++) expect(row.has("3," + c)).toBe(true);

    const g2 = calmGrid();
    g2[3][3] = makeTile(1, "col");
    const col = expandSpecials(g2, new Set(["3,3"]));
    for (let r = 0; r < ROWS; r++) expect(col.has(r + ",3")).toBe(true);
  });

  it("chains special into special", () => {
    const g = calmGrid();
    g[0][0] = makeTile(1, "row");
    g[0][5] = makeTile(2, "col");
    const cleared = expandSpecials(g, new Set(["0,0"]));
    for (let r = 0; r < ROWS; r++) expect(cleared.has(r + ",5")).toBe(true);
  });

  it("combines line specials into a row and column cross", () => {
    const g = calmGrid();
    g[3][3] = makeTile(1, "row");
    g[3][4] = makeTile(2, "col");
    const cells = specialSwapEffect(g, { r: 3, c: 3 }, { r: 3, c: 4 });
    for (let c = 0; c < COLS; c++) expect(cells.has("3," + c)).toBe(true);
    for (let r = 0; r < ROWS; r++) expect(cells.has(r + ",4")).toBe(true);
  });

  it("combines area specials into a five by five blast", () => {
    const g = calmGrid();
    g[3][3] = makeTile(1, "area");
    g[3][4] = makeTile(2, "area");
    expect(specialSwapEffect(g, { r: 3, c: 3 }, { r: 3, c: 4 }).size).toBe(25);
  });

  it("combines a line and area special into three parallel lines", () => {
    const g = calmGrid();
    g[3][3] = makeTile(1, "row");
    g[3][4] = makeTile(2, "area");
    const cells = specialSwapEffect(g, { r: 3, c: 3 }, { r: 3, c: 4 });
    for (let r = 2; r <= 4; r++)
      for (let c = 0; c < COLS; c++) expect(cells.has(r + "," + c)).toBe(true);
  });

  it("combines two colour bombs into a full-board clear", () => {
    const g = calmGrid();
    g[0][0] = makeTile(1, "bomb");
    g[0][1] = makeTile(2, "bomb");
    expect(specialSwapEffect(g, { r: 0, c: 0 }, { r: 0, c: 1 }).size).toBe(ROWS * COLS);
  });

  it("combines a colour bomb with a normal tile by type", () => {
    const g = calmGrid();
    g[0][0] = makeTile(9, "bomb");
    g[0][1] = makeTile(7);
    g[4][4].type = 7;
    const cells = specialSwapEffect(g, { r: 0, c: 0 }, { r: 0, c: 1 });
    expect(cells.has("4,4")).toBe(true);
  });

  it("combines a colour bomb with a special across every matching type", () => {
    const g = calmGrid();
    g[0][0] = makeTile(9, "bomb");
    g[0][1] = makeTile(7, "row");
    g[4][4].type = 7;
    const cells = specialSwapEffect(g, { r: 0, c: 0 }, { r: 0, c: 1 });
    for (let c = 0; c < COLS; c++) expect(cells.has("4," + c)).toBe(true);
  });
});

describe("gravity and refill", () => {
  it("drops tiles into holes and keeps column order", () => {
    const g = emptyGrid();
    g[7][0] = null;
    g[6][0] = null;
    const top = g[0][0].id;
    const moves = applyGravity(g);
    expect(moves.length).toBeGreaterThan(0);
    expect(g[7][0].id).toBe(g[7][0].id);
    expect(g[0][0]).toBe(null);
    expect(g[2][0].id).toBe(top);
  });

  it("refills every empty cell from the pool only", () => {
    const g = emptyGrid();
    g[0][0] = null;
    g[1][4] = null;
    const spawned = refill(g, [3, 4], () => 0.1);
    expect(spawned).toHaveLength(2);
    expect(g[0][0].type).toBe(3);
    expect(g.flat().every((t) => t !== null)).toBe(true);
  });
});

describe("hasAnyMove", () => {
  it("is false on a board where no swap matches", () => {
    // 4-colour repeating pattern with no possible three-in-a-row swap
    const g = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => makeTile((r * 2 + c) % 4)),
    );
    expect(hasAnyMove(g)).toBe(false);
  });

  it("is true when a swap would line three up", () => {
    const g = calmGrid();
    g[0][0].type = 5;
    g[0][1].type = 5;
    g[1][2].type = 5;
    expect(hasAnyMove(g)).toBe(true);
  });
});

describe("repositionMove", () => {
  it("slides a tile along its row and shifts the rest", () => {
    const g = emptyGrid();
    g[0].forEach((t, c) => {
      t.type = c;
    });
    const moved = g[0][0].id;
    const moves = repositionMove(g, { r: 0, c: 0 }, { r: 0, c: 3 });
    expect(moves).not.toBe(null);
    expect(g[0][3].id).toBe(moved);
    expect(g[0][0].type).toBe(1);
    expect(g[0][2].type).toBe(3);
  });

  it("refuses diagonal or zero-length moves", () => {
    const g = emptyGrid();
    expect(repositionMove(g, { r: 0, c: 0 }, { r: 1, c: 1 })).toBe(null);
    expect(repositionMove(g, { r: 2, c: 2 }, { r: 2, c: 2 })).toBe(null);
  });
});

describe("data modules stay consistent with the engine", () => {
  it("every level goal and pool entry points at a real tile", async () => {
    const { LEVELS } = await import("./data/levels");
    const { TILE_DEFS } = await import("./data/tiles");
    for (const lvl of LEVELS) {
      expect(lvl.pool.length).toBeGreaterThan(2);
      lvl.pool.forEach((t) => expect(TILE_DEFS[t]).toBeTruthy());
      lvl.goals.forEach((g) => {
        expect(TILE_DEFS[g.typeIdx]).toBeTruthy();
        expect(lvl.pool).toContain(g.typeIdx);
      });
    }
  });

  it("every character hides behind a real tile", async () => {
    const { CHARACTERS, CHARACTER_ICON_MAP } = await import("./data/characters");
    const { TILE_DEFS } = await import("./data/tiles");
    CHARACTERS.forEach((c) => {
      expect(TILE_DEFS[CHARACTER_ICON_MAP[c.key]]).toBeTruthy();
    });
  });

  it("every region has a monument image and a bar position", async () => {
    const { REGIONS, REGION_BAR_POS, monumentImage } = await import("./data/regions");
    REGIONS.forEach((r) => {
      expect(monumentImage(r)).toBeTruthy();
      expect(REGION_BAR_POS[r.key]).toBeTruthy();
    });
  });

  it("Swedish, English and French cover the same keys", async () => {
    const { STRINGS } = await import("./data/strings");
    const sv = Object.keys(STRINGS.sv).sort();
    expect(Object.keys(STRINGS.en).sort()).toEqual(sv);
    expect(Object.keys(STRINGS.fr).sort()).toEqual(sv);
  });
});

describe("cloneGrid", () => {
  it("copies tiles without sharing references", () => {
    const g = calmGrid();
    const c = cloneGrid(g);
    c[0][0].type = 99;
    expect(g[0][0].type).not.toBe(99);
  });
});
