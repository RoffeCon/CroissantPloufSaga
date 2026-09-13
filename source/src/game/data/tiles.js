// Tile catalogue. Pure data + the small helpers that only depend on it.
import { GAME_ASSETS } from "../assets";

export const TILE_IMG = {
  croissant: GAME_ASSETS["croissant"],
  fromage: GAME_ASSETS["fromage"],
  camembert: GAME_ASSETS["camembert"],
  kaffe: GAME_ASSETS["kaffe"],
  snigel: GAME_ASSETS["snigel"],
  vin: GAME_ASSETS["vin"],
  ail: GAME_ASSETS["ail"],
  onion_trio: GAME_ASSETS["onion_trio"],
  onion_bunch: GAME_ASSETS["onion_bunch"],
  beret: GAME_ASSETS["beret"],
  tricolor: GAME_ASSETS["tricolor"],
  champagne: GAME_ASSETS["champagne"],
  baguette: GAME_ASSETS["baguette"],
};

// Order matters: a tile's index in this array IS its type id, and level data
// plus save data refer to those indices. Append new tiles at the end only.
export const TILE_DEFS = [
  { id: "croissant", emoji: "🥐", name: "Croissant", img: TILE_IMG.croissant },
  { id: "fromage", emoji: "🧀", name: "Fromage", img: TILE_IMG.fromage },
  { id: "camembert", emoji: "🧀", name: "Camembert", img: TILE_IMG.camembert },
  { id: "kaffe", emoji: "☕", name: "Café", img: TILE_IMG.kaffe },
  { id: "snigel", emoji: "🐌", name: "Escargot", img: TILE_IMG.snigel },
  { id: "vin", emoji: "🍷", name: "Vin Rouge", img: TILE_IMG.vin },
  { id: "ail", emoji: "🧄", name: "Ail", img: TILE_IMG.ail },
  { id: "onion_trio", emoji: "🧅", name: "Onion trio", img: TILE_IMG.onion_trio },
  { id: "onion_bunch", emoji: "🧅", name: "Onion bunch", img: TILE_IMG.onion_bunch },
  { id: "beret", emoji: "🎩", name: "Béret", img: TILE_IMG.beret },
  { id: "tricolor", emoji: "🇫🇷", name: "Tricolore", img: TILE_IMG.tricolor },
  { id: "champagne", emoji: "🍾", name: "Champagne", img: TILE_IMG.champagne },
  { id: "baguette", emoji: "🥖", name: "Baguette", img: TILE_IMG.baguette },
];

// Look up a tile type index by its stable string id, so level/character data
// can name tiles instead of hard-coding array positions.
export function tileIndex(id) {
  const i = TILE_DEFS.findIndex((d) => d.id === id);
  return i < 0 ? 0 : i;
}

// Some icon pairs are hard to tell apart at tile size (two cheeses, two
// onions, two bottles). In normal play we only ever activate ONE member of
// each group at a time.
export const SIMILARITY_GROUPS = [
  [tileIndex("fromage"), tileIndex("camembert")],
  [tileIndex("onion_trio"), tileIndex("onion_bunch")],
  [tileIndex("vin"), tileIndex("champagne")],
];

// "Mode Merde Alors !" lifts the similarity restriction on purpose — for
// every group that has at least one member in the level's pool, every member
// of that group gets added.
export function expandPoolForHardMode(pool) {
  const expanded = new Set(pool);
  SIMILARITY_GROUPS.forEach((group) => {
    if (group.some((t) => expanded.has(t))) group.forEach((t) => expanded.add(t));
  });
  return Array.from(expanded);
}
