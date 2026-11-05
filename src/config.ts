// Toutes les constantes du jeu. Les durées biologiques sont réelles (jours),
// divisées par BIO_SPEED pour rendre la colonie regardable.

export const BIO_SPEED = 5;                     // 1 = biologie réelle
export const TICKS_PER_SEC = 10;                // ticks de simu par seconde réelle à ×1
export const TICKS_PER_DAY = 3600 * TICKS_PER_SEC; // 1 jour de jeu = 1 h réelle à ×1
export const days = (realDays: number) => Math.max(1, Math.round((realDays / BIO_SPEED) * TICKS_PER_DAY));

export const CELL = 8;                          // px par case
export const SURF_W = 160, SURF_H = 60;         // surface (vue de dessus), cases
export const UND_W = 160, UND_H = 40;           // sous-sol (coupe), cases
export const MAX_ANTS = 20000, MAX_BROOD = 20000, MAX_COLONIES = 8;

export const YEAR = days(365);
export const START_YEAR_FRAC = 0.5;             // début juillet : juste après le vol nuptial

export const BIO = {
  egg: days(14), larva: days(13), pupa: days(17),
  workerLife: days(400), queenLife: days(365 * 15), alateLife: days(60),
  // Réserve claustrale de la reine (muscles alaires), en "unités de nourriture"
  queenReserve: 10, queenDrainTicks: days(120),  // la réserve de base s'épuise en ~120 j réels
  claustralEggInterval: days(0.6), claustralMaxBrood: 20,
  eggIntervalMin: days(0.03), eggIntervalMax: days(0.5),
  workerSugarPerDay: 0.05,                      // unités par ouvrière et jour de jeu (1 unité = 1 voyage de fourrageuse)
  larvaFoodPerDay: 0.06,                        // protéines ET sucre, par larve et jour de jeu
  starve: 3 * TICKS_PER_DAY,                    // jours de jeu sans sucre avant les premières morts
  digTicks: days(0.04),
  foragerOutTicks: 1500,
  alateMinWorkers: 150,
  honeydewPerDay: 10,                           // miellat produit par plante et jour de jeu
  preySpawnTicks: 0.8 * TICKS_PER_DAY,          // une proie morte apparaît naturellement
};

export const ANT_SPEED = 1.2;                   // px par tick
export const PHERO_DEPOSIT = 0.25, PHERO_MAX = 10, PHERO_EVAP = 0.985; // évaporation tous les 10 ticks

export const SPECIES = [
  { name: 'Lasius niger', hp: 8, dmg: 1, speed: 1 },
  { name: 'Myrmica rubra', hp: 10, dmg: 2, speed: 0.9 },
];

// Couleurs par espèce × rôle : reine, nourrice, ouvrière du nid, fourrageuse, gyne, mâle
export const ROLE_COLORS = [
  ['#9a7a2e', '#cdb892', '#7b5436', '#1e1a17', '#4f6b9e', '#5a5660'],
  ['#c27c2a', '#e8b49a', '#b65e3c', '#8e2a1d', '#8a4f7a', '#7a4a48'],
];
