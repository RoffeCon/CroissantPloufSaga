export function starTargets(level, goalDefs) {
  const need = (goalDefs || level.goals).reduce((sum, goal) => sum + goal.need, 0);
  const base = level.bonus ? level.scoreTarget : need * 22;
  return [base, Math.round(base * 1.45), Math.round(base * 1.95)];
}

export function starsForScore(level, goalDefs, score) {
  const targets = starTargets(level, goalDefs);
  if (score >= targets[2]) return 3;
  if (score >= targets[1]) return 2;
  return 1;
}

export function buildLevelResult({
  level,
  goalDefs,
  goals,
  won,
  scoreBeforeBonus,
  movesLeft,
  region,
}) {
  const safeMoves = Math.max(0, movesLeft);
  const moveBonus = won ? safeMoves * 50 : 0;
  const finalScore = scoreBeforeBonus + moveBonus;
  const goalResults = goalDefs.map((def) => {
    const live = goals.find((goal) => goal.typeIdx === def.typeIdx);
    const remaining = Math.max(0, live ? live.remaining : def.need);
    return {
      typeIdx: def.typeIdx,
      need: def.need,
      collected: Math.min(def.need, def.need - remaining),
      complete: remaining === 0,
    };
  });
  const before = region ? region.before : 0;
  const required = region ? region.required : 0;
  const awarded = region ? finalScore : 0;
  const after = region ? before + awarded : 0;
  return {
    won,
    finalScore,
    moveBonus,
    movesLeft: safeMoves,
    movesUsed: Math.max(0, level.moves - safeMoves),
    stars: won ? starsForScore(level, goalDefs, finalScore) : 0,
    goals: goalResults,
    region: region
      ? {
          ...region,
          before,
          awarded,
          after,
          beforePct: Math.min(100, Math.round((before / required) * 100)),
          afterPct: Math.min(100, Math.round((after / required) * 100)),
        }
      : null,
  };
}
