// Level data. Adding level 101 means appending an entry here — the runtime
// reads every field from this file and needs no changes.
//
// Fields:
//   id           unique number, also the ordering on the level map
//   region       which region the level belongs to (see data/regions.js)
//   title        French flavour title, shown as-is in every language
//   moves        moves the player starts with
//   pool         tile type indices available on the board (see data/tiles.js)
//   goals        [{ typeIdx, need }] — collect `need` tiles of that type
//   difficulty   1..5, informational (shown on the level card)
//   bonus        true for score-chase bonus levels
//   scoreTarget  required score on bonus levels
//   character    optional character key guaranteed to hide in this level
//   rewards      optional { boosters: { shuffle: 1, ... } }
import { tileIndex } from "./tiles";

const T = {
  croissant: tileIndex("croissant"),
  fromage: tileIndex("fromage"),
  camembert: tileIndex("camembert"),
  kaffe: tileIndex("kaffe"),
  snigel: tileIndex("snigel"),
  vin: tileIndex("vin"),
  ail: tileIndex("ail"),
  onion_trio: tileIndex("onion_trio"),
  onion_bunch: tileIndex("onion_bunch"),
  beret: tileIndex("beret"),
  tricolor: tileIndex("tricolor"),
  champagne: tileIndex("champagne"),
  baguette: tileIndex("baguette"),
};

// Balance is deliberately identical to the previous hard-coded table.
export const LEVELS = [
  {
    id: 1,
    region: "normandie",
    title: "Café du Matin",
    difficulty: 1,
    moves: 22,
    pool: [T.croissant, T.kaffe, T.snigel, T.vin],
    goals: [
      { typeIdx: T.croissant, need: 12 },
      { typeIdx: T.vin, need: 8 },
      { typeIdx: T.kaffe, need: 6 },
    ],
  },
  {
    id: 2,
    region: "normandie",
    title: "Fromagerie",
    difficulty: 1,
    moves: 20,
    pool: [T.croissant, T.kaffe, T.snigel, T.vin, T.fromage],
    goals: [
      { typeIdx: T.fromage, need: 10 },
      { typeIdx: T.croissant, need: 12 },
      { typeIdx: T.snigel, need: 6 },
    ],
  },
  {
    id: 3,
    region: "bretagne",
    title: "Pause Café",
    difficulty: 2,
    moves: 16,
    bonus: true,
    scoreTarget: 900,
    pool: [T.croissant, T.kaffe, T.vin],
    goals: [
      { typeIdx: T.croissant, need: 14 },
      { typeIdx: T.vin, need: 10 },
    ],
  },
  {
    id: 4,
    region: "bretagne",
    title: "Marché aux Herbes",
    difficulty: 2,
    moves: 20,
    pool: [T.croissant, T.kaffe, T.snigel, T.vin, T.fromage, T.ail],
    goals: [
      { typeIdx: T.ail, need: 10 },
      { typeIdx: T.croissant, need: 12 },
      { typeIdx: T.vin, need: 8 },
    ],
  },
  {
    id: 5,
    region: "hauts_de_france",
    title: "Sous le Béret",
    difficulty: 2,
    moves: 18,
    pool: [T.croissant, T.kaffe, T.snigel, T.vin, T.fromage, T.ail, T.beret],
    goals: [
      { typeIdx: T.beret, need: 8 },
      { typeIdx: T.ail, need: 10 },
      { typeIdx: T.fromage, need: 8 },
    ],
  },
  {
    id: 6,
    region: "hauts_de_france",
    title: "Petits Oignons",
    difficulty: 3,
    moves: 18,
    pool: [T.croissant, T.kaffe, T.snigel, T.ail, T.beret, T.camembert, T.champagne, T.onion_trio],
    goals: [
      { typeIdx: T.onion_trio, need: 10 },
      { typeIdx: T.camembert, need: 8 },
      { typeIdx: T.champagne, need: 8 },
    ],
  },
  {
    id: 7,
    region: "grand_est",
    title: "Second Souffle",
    difficulty: 3,
    moves: 16,
    bonus: true,
    scoreTarget: 1400,
    pool: [T.croissant, T.ail, T.beret],
    goals: [
      { typeIdx: T.beret, need: 12 },
      { typeIdx: T.ail, need: 12 },
    ],
  },
  {
    id: 8,
    region: "grand_est",
    title: "Le Retour de Napoléon",
    difficulty: 4,
    moves: 16,
    character: "admiral",
    pool: [
      T.croissant,
      T.kaffe,
      T.snigel,
      T.ail,
      T.beret,
      T.camembert,
      T.champagne,
      T.onion_bunch,
      T.tricolor,
    ],
    goals: [
      { typeIdx: T.tricolor, need: 8 },
      { typeIdx: T.onion_bunch, need: 10 },
      { typeIdx: T.beret, need: 8 },
    ],
  },
  {
    id: 9,
    region: "ile_de_france",
    title: "Jeanne au Combat",
    difficulty: 4,
    moves: 16,
    character: "knight_girl",
    pool: [
      T.croissant,
      T.kaffe,
      T.snigel,
      T.ail,
      T.beret,
      T.tricolor,
      T.fromage,
      T.onion_trio,
      T.champagne,
    ],
    goals: [
      { typeIdx: T.champagne, need: 8 },
      { typeIdx: T.onion_trio, need: 10 },
      { typeIdx: T.fromage, need: 8 },
    ],
  },
  {
    id: 10,
    region: "ile_de_france",
    title: "Sous la Tour Eiffel",
    difficulty: 5,
    moves: 17,
    pool: [
      T.croissant,
      T.kaffe,
      T.snigel,
      T.ail,
      T.beret,
      T.tricolor,
      T.baguette,
      T.camembert,
      T.onion_bunch,
      T.vin,
    ],
    goals: [
      { typeIdx: T.baguette, need: 10 },
      { typeIdx: T.camembert, need: 8 },
      { typeIdx: T.onion_bunch, need: 8 },
    ],
  },
];

export function findLevel(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}
