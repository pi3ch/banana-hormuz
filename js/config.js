/* ===== Banana Hormuz — global config & constants ===== */
/* Shared via a single global namespace so plain (non-module) scripts can talk. */
window.GAME = window.GAME || {};

GAME.CFG = {
  // Logical canvas resolution (CSS scales it up; physics works in these units).
  W: 800,
  H: 500,

  // Physics (pixels / frame, tuned for ~60fps).
  GRAVITY: 0.12,
  WIND_MAX: 0.06,        // max horizontal accel from wind
  POWER_SCALE: 0.22,     // power(0-100) -> initial speed multiplier
  PIXEL: 4,              // sprite scale factor (1 sprite cell -> 4 screen px)

  WIN_ROUNDS: 3,         // first to N round wins takes the match

  STORE_KEY: "bananaHormuz.highscores.v1",

  // Sky / scene palette (desert sunset over the gulf).
  SKY_TOP: "#3a2d6b",
  SKY_MID: "#b85c6b",
  SKY_LOW: "#ffb866",
  SUN: "#fff0c0",
  WATER_TOP: "#1f4e7a",
  WATER_LOW: "#0d2a4a",
  WATER_SHIMMER: "#5aa0d0",

  // Cliff palette (Iranian side / Oman side tinted slightly differently).
  CLIFF_L: ["#7a5a3a", "#8a6a44", "#5e4630"],
  CLIFF_R: ["#6a5240", "#7d6149", "#54402f"],

  DIFFICULTY: {
    easy:   { error: 14, learn: 0.45, jitter: 0.30 },
    normal: { error: 7,  learn: 0.65, jitter: 0.18 },
    hard:   { error: 3,  learn: 0.85, jitter: 0.08 },
  },
};

// Character roster. Palettes are referenced by index in sprite maps (see sprites.js).
GAME.CHARACTERS = {
  donald: {
    id: "donald",
    name: "Donald",
    full: "Donald (Trump)",
    weapon: "Truth Social tweet",
    projectile: "tweet",
    victory: "dance",                          // Trump does a little dance
    taunts: ["TREMENDOUS!", "BIGLY!", "FAKE NEWS!"],
  },
  bibi: {
    id: "bibi",
    name: "Bibi",
    full: "Bibi (Netanyahu)",
    weapon: "Missile",
    projectile: "missile",
    victory: "handsup",                        // Bibi waves his hands up and down
    taunts: ["SIX FINGERS!"],
  },
  mojtaba: {
    id: "mojtaba",
    name: "Khamenei",
    full: "Khamenei",
    weapon: "Shahed drone",
    projectile: "drone",
    victory: "turban",                         // Khamenei throws his turban up
    taunts: ["RESISTANCE!", "STEADFAST!"],
  },
};

GAME.CHAR_ORDER = ["donald", "bibi", "mojtaba"];
