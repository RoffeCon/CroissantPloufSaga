// Pure match-3 logic. No DOM access - safe to unit test.
const ROWS = 8,
  COLS = 8;

let __tileIdCounter = 1;
function makeTile(type, special) {
  return { type, special: special || null, id: __tileIdCounter++ };
}

function createGrid(numTypesOrPool, rng) {
  rng = rng || Math.random;
  const pool = Array.isArray(numTypesOrPool)
    ? numTypesOrPool
    : Array.from({ length: numTypesOrPool }, (_, i) => i);
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid.push([]);
    for (let c = 0; c < COLS; c++) {
      let t;
      let guard = 0;
      do {
        t = pool[Math.floor(rng() * pool.length)];
        guard++;
      } while (
        guard < 200 &&
        ((c >= 2 && grid[r][c - 1].type === t && grid[r][c - 2].type === t) ||
          (r >= 2 && grid[r - 1][c].type === t && grid[r - 2][c].type === t))
      );
      grid[r].push(makeTile(t));
    }
  }
  return grid;
}

function isAdjacent(a, b) {
  const dr = Math.abs(a.r - b.r),
    dc = Math.abs(a.c - b.c);
  return dr + dc === 1;
}
function inBounds(r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}
function cloneGrid(grid) {
  return grid.map((row) => row.map((t) => (t ? Object.assign({}, t) : null)));
}
function swapCells(grid, a, b) {
  const tmp = grid[a.r][a.c];
  grid[a.r][a.c] = grid[b.r][b.c];
  grid[b.r][b.c] = tmp;
}

function findMatches(grid) {
  const matched = new Set();
  const runs = [];
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      const tile = grid[r][c];
      if (!tile || tile.locked) {
        c++;
        continue;
      }
      let end = c;
      while (
        end + 1 < COLS &&
        grid[r][end + 1] &&
        !grid[r][end + 1].locked &&
        grid[r][end + 1].type === tile.type
      )
        end++;
      const len = end - c + 1;
      if (len >= 3) {
        const cells = [];
        for (let cc = c; cc <= end; cc++) {
          matched.add(r + "," + cc);
          cells.push({ r, c: cc });
        }
        runs.push({ cells, dir: "h", type: tile.type });
      }
      c = end + 1;
    }
  }
  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < ROWS) {
      const tile = grid[r][c];
      if (!tile || tile.locked) {
        r++;
        continue;
      }
      let end = r;
      while (
        end + 1 < ROWS &&
        grid[end + 1][c] &&
        !grid[end + 1][c].locked &&
        grid[end + 1][c].type === tile.type
      )
        end++;
      const len = end - r + 1;
      if (len >= 3) {
        const cells = [];
        for (let rr = r; rr <= end; rr++) {
          matched.add(rr + "," + c);
          cells.push({ r: rr, c });
        }
        runs.push({ cells, dir: "v", type: tile.type });
      }
      r = end + 1;
    }
  }
  return { matched, runs };
}

function wouldMatch(grid, a, b) {
  const g2 = cloneGrid(grid);
  swapCells(g2, a, b);
  return findMatches(g2).matched.size > 0;
}

function computeSpecials(runs, triggerCell) {
  const specials = [];
  const horizontal = runs.filter((run) => run.dir === "h");
  const vertical = runs.filter((run) => run.dir === "v");
  const intersections = [];
  horizontal.forEach((h) =>
    vertical.forEach((v) => {
      const shared = h.cells.find((hc) => v.cells.some((vc) => vc.r === hc.r && vc.c === hc.c));
      if (shared && h.type === v.type)
        intersections.push({ r: shared.r, c: shared.c, type: h.type });
    }),
  );
  const areaKeys = new Set(intersections.map((cell) => cell.r + "," + cell.c));
  intersections.forEach((cell) => specials.push({ ...cell, special: "area" }));
  for (const run of runs) {
    if (run.cells.some((cell) => areaKeys.has(cell.r + "," + cell.c))) continue;
    if (run.cells.length >= 4) {
      let pos = triggerCell
        ? run.cells.find((cell) => cell.r === triggerCell.r && cell.c === triggerCell.c)
        : null;
      if (!pos) pos = run.cells[Math.floor(run.cells.length / 2)];
      // 5 or more in a row makes a colour bomb: clears every tile of that kind.
      const special = run.cells.length >= 5 ? "bomb" : run.dir === "h" ? "col" : "row";
      specials.push({ r: pos.r, c: pos.c, type: run.type, special });
    }
  }
  return specials;
}

function expandSpecials(grid, matched) {
  const toClear = new Set(matched);
  const queue = Array.from(matched);
  const seen = new Set(matched);
  while (queue.length) {
    const key = queue.shift();
    const parts = key.split(",");
    const r = +parts[0],
      c = +parts[1];
    const tile = grid[r] && grid[r][c];
    if (!tile || !tile.special) continue;
    if (tile.special === "row") {
      for (let cc = 0; cc < COLS; cc++) {
        const k = r + "," + cc;
        if (!seen.has(k)) {
          seen.add(k);
          toClear.add(k);
          queue.push(k);
        }
      }
    } else if (tile.special === "col") {
      for (let rr = 0; rr < ROWS; rr++) {
        const k = rr + "," + c;
        if (!seen.has(k)) {
          seen.add(k);
          toClear.add(k);
          queue.push(k);
        }
      }
    } else if (tile.special === "bomb") {
      for (let rr = 0; rr < ROWS; rr++)
        for (let cc = 0; cc < COLS; cc++) {
          const other = grid[rr][cc];
          if (!other || other.type !== tile.type) continue;
          const k = rr + "," + cc;
          if (!seen.has(k)) {
            seen.add(k);
            toClear.add(k);
            queue.push(k);
          }
        }
    } else if (tile.special === "area") {
      for (let rr = Math.max(0, r - 1); rr <= Math.min(ROWS - 1, r + 1); rr++) {
        for (let cc = Math.max(0, c - 1); cc <= Math.min(COLS - 1, c + 1); cc++) {
          const k = rr + "," + cc;
          if (!seen.has(k)) {
            seen.add(k);
            toClear.add(k);
            queue.push(k);
          }
        }
      }
    }
  }
  return toClear;
}

function specialSwapEffect(grid, a, b) {
  const first = grid[a.r] && grid[a.r][a.c];
  const second = grid[b.r] && grid[b.r][b.c];
  if (!first || !second) return null;
  const firstSpecial = first.special;
  const secondSpecial = second.special;
  if (!firstSpecial && !secondSpecial) return null;
  if (firstSpecial !== "bomb" && secondSpecial !== "bomb" && (!firstSpecial || !secondSpecial))
    return null;

  const cells = new Set();
  const add = (r, c) => {
    if (inBounds(r, c)) cells.add(r + "," + c);
  };
  const addRow = (r) => {
    for (let c = 0; c < COLS; c++) add(r, c);
  };
  const addCol = (c) => {
    for (let r = 0; r < ROWS; r++) add(r, c);
  };
  const addArea = (r, c, radius) => {
    for (let rr = r - radius; rr <= r + radius; rr++)
      for (let cc = c - radius; cc <= c + radius; cc++) add(rr, cc);
  };
  const applyAt = (special, r, c) => {
    if (special === "row") addRow(r);
    else if (special === "col") addCol(c);
    else if (special === "area") addArea(r, c, 1);
  };

  add(a.r, a.c);
  add(b.r, b.c);
  if (firstSpecial === "bomb" && secondSpecial === "bomb") {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) add(r, c);
    return cells;
  }
  if (firstSpecial === "bomb" || secondSpecial === "bomb") {
    const bombIsFirst = firstSpecial === "bomb";
    const target = bombIsFirst ? second : first;
    const targetSpecial = target.special;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const tile = grid[r][c];
        if (tile && tile.type === target.type) {
          add(r, c);
          if (targetSpecial && targetSpecial !== "bomb") applyAt(targetSpecial, r, c);
        }
      }
    return cells;
  }

  const pair = [firstSpecial, secondSpecial];
  if (pair.every((s) => s === "area")) {
    addArea(b.r, b.c, 2);
  } else if (pair.includes("area")) {
    const line = firstSpecial === "area" ? secondSpecial : firstSpecial;
    for (let offset = -1; offset <= 1; offset++) {
      if (line === "row") addRow(b.r + offset);
      else addCol(b.c + offset);
    }
  } else if (firstSpecial === secondSpecial) {
    if (firstSpecial === "row") {
      addRow(a.r);
      addRow(b.r);
    } else {
      addCol(a.c);
      addCol(b.c);
    }
  } else {
    addRow(b.r);
    addCol(b.c);
  }
  return cells;
}

function applyGravity(grid) {
  const moves = [];
  for (let c = 0; c < COLS; c++) {
    let writeR = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r][c]) {
        if (writeR !== r) {
          grid[writeR][c] = grid[r][c];
          grid[r][c] = null;
          moves.push({ from: { r, c }, to: { r: writeR, c } });
        }
        writeR--;
      }
    }
  }
  return moves;
}

function refill(grid, numTypesOrPool, rng) {
  rng = rng || Math.random;
  const pool = Array.isArray(numTypesOrPool)
    ? numTypesOrPool
    : Array.from({ length: numTypesOrPool }, (_, i) => i);
  const spawned = [];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (!grid[r][c]) {
        grid[r][c] = makeTile(pool[Math.floor(rng() * pool.length)]);
        spawned.push({ r, c });
      }
    }
  }
  return spawned;
}

function hasAnyMove(grid) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c + 1 < COLS && wouldMatch(grid, { r, c }, { r, c: c + 1 })) return true;
      if (r + 1 < ROWS && wouldMatch(grid, { r, c }, { r: r + 1, c })) return true;
    }
  }
  return false;
}

// Same scan as hasAnyMove, but returns the actual pair (for the hint button)
// instead of just true/false. Picks a random one among all valid moves so the
// hint doesn't always point at the same top-left corner of the board.
function findAnyMove(grid) {
  const candidates = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c + 1 < COLS && wouldMatch(grid, { r, c }, { r, c: c + 1 }))
        candidates.push({ a: { r, c }, b: { r, c: c + 1 } });
      if (r + 1 < ROWS && wouldMatch(grid, { r, c }, { r: r + 1, c }))
        candidates.push({ a: { r, c }, b: { r: r + 1, c } });
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Reposition move: slide the tile at `from` along its row or column to `to`,
// shifting everything strictly between them by one step. NOT a swap — no
// match is required. Returns the list of {from,to} moves for the view layer
// to mirror (same shape as applyGravity's moves), or null if invalid.
function repositionMove(grid, from, to) {
  if (from.r === to.r && from.c === to.c) return null;
  if (from.r !== to.r && from.c !== to.c) return null;
  if (!inBounds(from.r, from.c) || !inBounds(to.r, to.c)) return null;

  const moves = [];
  const movingTile = grid[from.r][from.c];

  if (from.r === to.r) {
    const r = from.r;
    if (from.c < to.c) {
      for (let c = from.c; c < to.c; c++) {
        grid[r][c] = grid[r][c + 1];
        moves.push({ from: { r, c: c + 1 }, to: { r, c } });
      }
    } else {
      for (let c = from.c; c > to.c; c--) {
        grid[r][c] = grid[r][c - 1];
        moves.push({ from: { r, c: c - 1 }, to: { r, c } });
      }
    }
    grid[r][to.c] = movingTile;
  } else {
    const c = from.c;
    if (from.r < to.r) {
      for (let r = from.r; r < to.r; r++) {
        grid[r][c] = grid[r + 1][c];
        moves.push({ from: { r: r + 1, c }, to: { r, c } });
      }
    } else {
      for (let r = from.r; r > to.r; r--) {
        grid[r][c] = grid[r - 1][c];
        moves.push({ from: { r: r - 1, c }, to: { r, c } });
      }
    }
    grid[to.r][c] = movingTile;
  }
  moves.push({ from: { r: from.r, c: from.c }, to: { r: to.r, c: to.c } });
  return moves;
}

export {
  ROWS,
  COLS,
  makeTile,
  createGrid,
  isAdjacent,
  inBounds,
  cloneGrid,
  swapCells,
  findMatches,
  wouldMatch,
  computeSpecials,
  expandSpecials,
  specialSwapEffect,
  applyGravity,
  refill,
  hasAnyMove,
  findAnyMove,
  repositionMove,
};
