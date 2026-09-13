// Region + monument data. The region -> monument relationship lives here only.
//
// Fields:
//   key         stable id, also the save-data key for progress
//   name        region name as shown in the UI
//   required    points needed to conquer THIS region (not cumulative)
//   hommage     French congratulation shown when the monument is completed
//   monument    { name, asset, placeholder }
//                 name        the intended monument for this region
//                 asset       local image key in data/assets (see src/assets/game)
//                 placeholder true when the artwork is a stand-in until the
//                             real monument illustration is added — drop the
//                             correct file into src/assets/game, point `asset`
//                             at it and remove this flag.
import { GAME_ASSETS } from "../assets";

export const REGIONS = [
  {
    key: "normandie",
    name: "Normandie",
    required: 6000,
    hommage: "Merci, brave ami ! Le Mont-Saint-Michel scintille pour toi.",
    monument: { name: "Mont-Saint-Michel", asset: "mont_saint_michel" },
  },
  {
    key: "bretagne",
    name: "Bretagne",
    required: 9000,
    hommage: "Kenavo ! La Bretagne chante ta victoire au son du biniou.",
    monument: { name: "Phare du Petit Minou", asset: "monument_bretagne" },
  },
  {
    key: "hauts_de_france",
    name: "Hauts-de-France",
    required: 5000,
    hommage: "Bravo ! Les beffrois du Nord sonnent en ton honneur.",
    monument: { name: "Beffroi d'Arras", asset: "monument_hauts_de_france" },
  },
  {
    key: "ile_de_france",
    name: "Île-de-France",
    required: 50000,
    hommage:
      "Paris s'incline devant toi, sous la Tour Eiffel. Tu as conquis le cœur de la France entière !",
    monument: { name: "Tour Eiffel", asset: "eiffeltornet" },
  },
  {
    key: "grand_est",
    name: "Grand Est",
    required: 30000,
    hommage: "La cigogne d'Alsace salue ton courage ! Le Champagne coule à flots.",
    monument: { name: "Cathédrale de Reims", asset: "basilique_saint_remi" },
  },
  {
    key: "pays_de_la_loire",
    name: "Pays de la Loire",
    required: 10000,
    hommage: "Les châteaux de la Loire ouvrent leurs portes pour toi.",
    monument: { name: "Château d'Angers", asset: "monument_pays_de_la_loire" },
  },
  {
    key: "centre_val_de_loire",
    name: "Centre-Val de Loire",
    required: 8000,
    hommage: "Chenonceau te couronne, valeureux gourmet !",
    monument: { name: "Château de Chambord", asset: "chateau_chambord" },
  },
  {
    key: "bourgogne_franche_comte",
    name: "Bourgogne-Franche-Comté",
    required: 11000,
    hommage: "Un verre de Bourgogne à ta santé, champion !",
    monument: { name: "Hospices de Beaune", asset: "monument_bourgogne" },
  },
  {
    key: "nouvelle_aquitaine",
    name: "Nouvelle-Aquitaine",
    required: 18000,
    hommage: "Bordeaux lève son verre à ta victoire !",
    monument: { name: "La Cité du Vin, Bordeaux", asset: "cite_du_vin" },
  },
  {
    key: "auvergne_rhone_alpes",
    name: "Auvergne-Rhône-Alpes",
    required: 20000,
    hommage: "Le Mont Blanc t'applaudit du sommet !",
    monument: { name: "Basilique de Fourvière, Lyon", asset: "monument_fourviere" },
  },
  {
    key: "occitanie",
    name: "Occitanie",
    required: 16000,
    hommage: "Carcassonne ouvre ses remparts en ton honneur.",
    monument: { name: "Cité de Carcassonne", asset: "monument_carcassonne" },
  },
  {
    key: "paca",
    name: "Provence-Alpes-Côte d'Azur",
    required: 35000,
    hommage: "La lavande de Provence et la Côte d'Azur embaument ta réussite !",
    monument: { name: "Aqueduc romain", asset: "pont_du_gard" },
  },
  {
    key: "corse",
    name: "Corse",
    required: 22000,
    hommage: "La Corse te dit : Bravu !",
    monument: { name: "Tour génoise", asset: "monument_corse" },
  },
  {
    key: "guadeloupe",
    name: "Guadeloupe",
    required: 24000,
    hommage: "La Soufrière fume de fierté pour toi !",
    monument: { name: "Maison créole guadeloupéenne", asset: "monument_guadeloupe" },
  },
  {
    key: "martinique",
    name: "Martinique",
    required: 24000,
    hommage: "Le Diamond Rock brille pour ta victoire !",
    monument: { name: "Bibliothèque Schœlcher", asset: "monument_martinique" },
  },
  {
    key: "guyane",
    name: "Guyane",
    required: 15000,
    hommage: "La fusée de Kourou décolle en ton honneur !",
    monument: { name: "Centre spatial guyanais — Ariane", asset: "monument_guyane" },
  },
  {
    key: "la_reunion",
    name: "La Réunion",
    required: 26000,
    hommage: "Le Piton de la Fournaise s'embrase pour toi !",
    monument: { name: "Piton de la Fournaise", asset: "monument_la_reunion" },
  },
  {
    key: "nouvelle_caledonie",
    name: "Nouvelle-Calédonie",
    required: 28000,
    hommage: "Les cases kanak s'illuminent de mille feux pour toi !",
    monument: { name: "Centre culturel Jean-Marie Tjibaou", asset: "monument_nouvelle_caledonie" },
  },
];

export function findRegion(key) {
  return REGIONS.find((r) => r.key === key) || null;
}

export function monumentImage(region) {
  return (region && region.monument && GAME_ASSETS[region.monument.asset]) || "";
}

// Illustrated reference map + measured progress-bar positions (as % of image
// width/height, so they scale responsively).
export const MAP_IMG = GAME_ASSETS["MAP_IMG"];

export const REGION_BAR_POS = {
  normandie: { left: 35.29, top: 22.07, width: 7.1, height: 1.37 },
  hauts_de_france: { left: 50.91, top: 21.29, width: 6.77, height: 1.37 },
  bretagne: { left: 31.18, top: 30.76, width: 4.43, height: 1.46 },
  grand_est: { left: 66.08, top: 30.86, width: 6.84, height: 1.46 },
  guadeloupe: { left: 3.97, top: 37.11, width: 6.12, height: 1.46 },
  ile_de_france: { left: 46.48, top: 38.67, width: 7.62, height: 1.46 },
  pays_de_la_loire: { left: 30.79, top: 49.8, width: 6.97, height: 1.46 },
  bourgogne_franche_comte: { left: 63.67, top: 50.78, width: 6.77, height: 1.46 },
  martinique: { left: 3.97, top: 53.81, width: 6.77, height: 1.46 },
  centre_val_de_loire: { left: 44.73, top: 57.52, width: 7.03, height: 1.46 },
  auvergne_rhone_alpes: { left: 64.71, top: 62.99, width: 5.01, height: 1.37 },
  guyane: { left: 3.97, top: 70.9, width: 6.77, height: 1.37 },
  nouvelle_aquitaine: { left: 29.56, top: 72.36, width: 6.64, height: 1.46 },
  paca: { left: 64.97, top: 76.66, width: 6.9, height: 1.46 },
  corse: { left: 85.35, top: 76.66, width: 6.84, height: 1.46 },
  la_reunion: { left: 3.91, top: 86.82, width: 6.38, height: 1.46 },
  occitanie: { left: 41.34, top: 86.82, width: 6.58, height: 1.46 },
  nouvelle_caledonie: { left: 79.49, top: 93.95, width: 6.84, height: 1.46 },
};
