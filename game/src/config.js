// Every tuning number, layout constant and colour in one place. The city is a
// grid: roads run along both axes, blocks sit between them, the beach and the
// ocean lie to the south (+Z). One unit is one metre; Y is up.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'solmar-heat.save.v1';

export const CITY = {
  /** Blocks per side; intersections are GRID + 1 per side. */
  grid: 8,
  /** Centre-to-centre distance between parallel roads. */
  pitch: 54,
  /** Road surface width; the rest of the pitch is block. */
  road: 14,
  /** Sidewalk width around each block. */
  walk: 4,
  /** Half the ground plane's size. */
  half: 280,
  /** Z of the shoreline; sand runs from the last road to here, ocean beyond. */
  shore: 252,
};

/** Block indices run 0..7 on each axis; this maps one to its centre in world units. */
export function blockCentre(index) {
  return (index - (CITY.grid - 1) / 2) * CITY.pitch;
}

/** Intersection indices run 0..8 on each axis; this maps one to its world coordinate. */
export function roadCoord(index) {
  return (index - CITY.grid / 2) * CITY.pitch;
}

export const PLAYER = {
  walkSpeed: 5.2,
  runSpeed: 8.6,
  turnSpeed: 9,
  radius: 0.55,
  maxHealth: 100,
  punchRange: 2.1,
  punchDamage: 34,
  punchCooldown: 0.45,
};

export const DRIVING = {
  /** Base top speeds (m/s) per vehicle class, multiplied by the class factor. */
  topSpeed: 34,
  accel: 16,
  brake: 30,
  reverseTop: 9,
  steerRate: 2.4,
  grip: 6.5,
  handbrakeGrip: 1.6,
  offroadDrag: 2.2,
  enterRange: 3.4,
};

export const POLICE = {
  maxStars: 5,
  chaseSpeed: 36,
  spawnDistance: 90,
  despawnDistance: 220,
  bustRange: 7,
  bustTime: 3,
  loseSightTime: 9,
  sightRange: 70,
};

export const COMBAT = {
  pistolDamage: 26,
  pistolRange: 60,
  fireCooldown: 0.28,
  magSize: 12,
  reloadTime: 1.1,
  thugHealth: 100,
  thugDamage: 9,
  thugSpeed: 4.6,
  thugRange: 2.0,
};

export const ECONOMY = {
  startCash: 120,
  bustFine: 150,
  wastedFine: 120,
  sprayCost: 200,
  coinValue: 50,
  coinCount: 20,
};

export const PALETTE = {
  sky: 0x8ec9e8,
  horizon: 0xf6cf9a,
  fog: 0xd9e4dd,
  sun: 0xfff2d8,
  ocean: 0x2e7fa8,
  sand: 0xe8d29a,
  asphalt: 0x3a3f46,
  sidewalk: 0xb9b3a6,
  grass: 0x7fae5a,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
