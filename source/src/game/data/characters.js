// Character data. Adding a character means appending an entry here; the
// runtime reads name, image, phrase, tile and ability straight from this file.
//
// Fields:
//   key         stable id, also the save-data value for "chosen character"
//   name        always French flavour, never translated
//   img         local image reference
//   description one-line French-flavoured introduction
//   foundPhrase what they say when discovered in a level
//   tile        tile id they hide behind (see data/tiles.js)
//   ability     { type, value } — 'bonusMoves' grants moves when you find
//               the character you play as. Extra ability types can be added
//               without touching existing characters.
//   unlock      { type: 'always' } or { type: 'level', level: n }
import { GAME_ASSETS } from "../assets";
import { tileIndex } from "./tiles";

export const CHARACTERS = [
  {
    key: "knight_girl",
    name: "Jeanne d'Arc",
    img: GAME_ASSETS["knight_girl"],
    description: "L'héroïne d'Orléans, une bannière dans une main, un croissant dans l'autre.",
    foundPhrase: "Félicitations, tu m'as trouvée ! Jeanne d'Arc te salue, brave âme.",
    tile: "tricolor",
    ability: { type: "bonusMoves", value: 3 },
    unlock: { type: "always" },
  },
  {
    key: "musketeer",
    name: "Cyrano de Bergerac",
    img: GAME_ASSETS["musketeer"],
    description: "Le nez fier, la rime prête, l'épée plus rapide que le service.",
    foundPhrase: "Félicitations, tu m'as trouvé ! Quel panache !",
    tile: "vin",
    ability: { type: "bonusMoves", value: 3 },
    unlock: { type: "always" },
  },
  {
    key: "admiral",
    name: "Napoléon",
    img: GAME_ASSETS["admiral"],
    description: "Petit de taille, immense d'appétit — surtout pour le champagne.",
    foundPhrase: "Félicitations, tu m'as trouvé ! Napoléon est impressionné.",
    tile: "champagne",
    ability: { type: "bonusMoves", value: 3 },
    unlock: { type: "always" },
  },
  {
    key: "marie_antoinette",
    name: "Marie-Antoinette",
    img: GAME_ASSETS["marie_antoinette"],
    description: "Elle n'a jamais dit « qu'ils mangent de la brioche ». Des croissants, peut-être.",
    foundPhrase: "Félicitations, tu m'as trouvée ! Qu'ils mangent des croissants !",
    tile: "croissant",
    ability: { type: "bonusMoves", value: 3 },
    unlock: { type: "always" },
  },
  {
    key: "coco_lady",
    name: "Mademoiselle Coco",
    img: GAME_ASSETS["coco_lady"],
    description: "Le béret parfaitement incliné, jamais par hasard.",
    foundPhrase: "Félicitations, tu m'as trouvée ! Très chic, très Coco.",
    tile: "beret",
    ability: { type: "bonusMoves", value: 3 },
    unlock: { type: "always" },
  },
  {
    key: "chef_boar",
    name: "Le Chef",
    img: GAME_ASSETS["chef_boar"],
    description: "Sanglier de métier, cuisinier de vocation, généreux sur l'ail.",
    foundPhrase: "Félicitations, tu m'as trouvé ! Le chef lève son verre à toi.",
    tile: "ail",
    ability: { type: "bonusMoves", value: 3 },
    unlock: { type: "always" },
  },
  // Charles de Gaulle is ready to join as soon as his portrait exists in
  // src/assets/game/. Entries without an image are skipped automatically, so
  // this line is safe to keep — just add the asset and he appears.
  {
    key: "de_gaulle",
    name: "Charles de Gaulle",
    img: GAME_ASSETS["de_gaulle"],
    description: "Deux mètres de conviction et une baguette sous le bras.",
    foundPhrase: "Félicitations, vous m'avez trouvé ! La France vous remercie.",
    tile: "baguette",
    ability: { type: "bonusMoves", value: 3 },
    unlock: { type: "level", level: 10 },
  },
].filter((c) => !!c.img);

// tile id -> tile type index, resolved once so the runtime keeps working with
// numeric types.
export const CHARACTER_ICON_MAP = CHARACTERS.reduce((map, c) => {
  map[c.key] = tileIndex(c.tile);
  return map;
}, {});

export function findCharacter(key) {
  return CHARACTERS.find((c) => c.key === key) || CHARACTERS[0];
}

// Characters that may show up / be selected given the player's progress.
export function availableCharacters(highestUnlocked) {
  return CHARACTERS.filter(
    (c) => !c.unlock || c.unlock.type === "always" || (highestUnlocked || 1) >= c.unlock.level,
  );
}
