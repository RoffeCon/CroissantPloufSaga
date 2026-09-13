export const SAVE_VERSION = 3;

export const DEFAULT_BOOSTERS = Object.freeze({ extraMoves: 0, shuffle: 0, remove: 0 });

export function emptySave() {
  return {
    version: SAVE_VERSION,
    best: 0,
    stars: {},
    highestUnlocked: 1,
    activeRegionKey: null,
    regionOptOut: false,
    regionProgress: {},
    regionWon: {},
    chosenCharacter: null,
    language: "sv",
    boosters: { ...DEFAULT_BOOSTERS },
    settings: { haptics: true, sound: true, music: true, sfxVolume: 70, musicVolume: 45 },
  };
}

export function migrateSave(raw, legacy = {}, regions = []) {
  const base = emptySave();
  const source = raw && typeof raw === "object" ? raw : {};
  const save = {
    ...base,
    ...source,
    version: SAVE_VERSION,
    best: Number(source.best ?? legacy.best) || 0,
    stars: source.stars || legacy.stars || {},
    highestUnlocked: Math.max(1, Number(source.highestUnlocked ?? legacy.highestUnlocked) || 1),
    activeRegionKey: source.activeRegionKey ?? legacy.activeRegionKey ?? null,
    regionOptOut: Boolean(source.regionOptOut ?? legacy.regionOptOut),
    regionProgress: { ...(source.regionProgress || legacy.regionProgress || {}) },
    regionWon: { ...(source.regionWon || legacy.regionWon || {}) },
    chosenCharacter: source.chosenCharacter || legacy.chosenCharacter || null,
    language: source.language || legacy.language || "sv",
    boosters: { ...DEFAULT_BOOSTERS, ...(source.boosters || legacy.boosters || {}) },
    settings: { ...base.settings, ...(source.settings || legacy.settings || {}) },
  };
  regions.forEach((region) => {
    if (!save.regionWon[region.key] && (save.regionProgress[region.key] || 0) >= region.required) {
      save.regionWon[region.key] = true;
      save.regionProgress[region.key] = 0;
    }
  });
  if (
    !regions.some((region) => region.key === save.activeRegionKey) ||
    save.regionWon[save.activeRegionKey]
  ) {
    save.activeRegionKey = null;
  }
  return save;
}

export function applyRegionPoints(state, amount, regions) {
  const next = {
    ...state,
    regionProgress: { ...state.regionProgress },
    regionWon: { ...state.regionWon },
  };
  const key = next.activeRegionKey;
  const region = regions.find((entry) => entry.key === key);
  if (!region || next.regionWon[key])
    return { state: next, conquered: null, completedFrance: false };
  next.regionProgress[key] = (next.regionProgress[key] || 0) + Math.max(0, amount || 0);
  let conquered = null;
  if (next.regionProgress[key] >= region.required) {
    next.regionWon[key] = true;
    next.regionProgress[key] = 0;
    next.activeRegionKey = null;
    conquered = key;
  }
  return {
    state: next,
    conquered,
    completedFrance: regions.length > 0 && regions.every((entry) => !!next.regionWon[entry.key]),
  };
}

export function addBoosters(inventory, reward) {
  const next = { ...DEFAULT_BOOSTERS, ...(inventory || {}) };
  Object.keys(DEFAULT_BOOSTERS).forEach((key) => {
    next[key] = Math.max(0, next[key] + Number(reward?.[key] || 0));
  });
  return next;
}

export function spendBooster(inventory, key) {
  const next = { ...DEFAULT_BOOSTERS, ...(inventory || {}) };
  if (!(key in next) || next[key] <= 0) return null;
  next[key]--;
  return next;
}
