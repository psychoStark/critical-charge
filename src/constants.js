// src/constants.js
// Centralized constants for the entire game.
// Extract all magic numbers and hard-coded values here for maintainability.

// ── DEBUG ──
// Set to true to enable debug logging and visual indicators.
// In production, this is controlled by window.__SHOW_DEBUG or window.__TEST_MODE.
export const DEBUG =
  (typeof window !== 'undefined' && (window.__SHOW_DEBUG === true || window.__TEST_MODE === true)) || false;

// ── RENDERER ──
export const DEFAULT_SCROLL_SPEED = 3.0;
export const DEFAULT_CAMERA_X_OFFSET = 0;
export const DEFAULT_TRACK_HALF_WIDTH = 200;
export const ROAD_STEP = 3;
export const ROAD_BASE_WIDTH = 20;
export const ROAD_STRIPE_WIDTH = 8;
export const OBSTACLE_BASE_W = 50;
export const OBSTACLE_BASE_H = 50;
export const OBSTACLE_LANE_BASE = 20;
export const OBSTACLE_FRAME_SIZE = 120;
export const OBSTACLE_FRAME_INTERVAL = 150; // ms

// ── PHYSICS ──
export const DEFAULT_GRAVITY = -3500;
export const DEFAULT_JUMP_FORCE = 1200;

// ── SPAWN ──
export const DEFAULT_SPAWN_RATE = 1.5;
export const OBSTACLE_START_Z = 5.0;
export const OBSTACLE_VISIBLE_MAX = 2.0;
export const OBSTACLE_VISIBLE_MIN = 0.05;

// ── BATTERY / SPEED ──
export const MIN_SPEED_DEFAULT = 0.8;
export const MAX_SPEED_DEFAULT = 4.0;
export const SPEED_EXPONENT_DEFAULT = 1.0;
export const WIRUS_CORRUPT_THRESHOLD = 3;

// ── SCORE ──
export const SCORE_SPEED_MULTIPLIER = 6;

// ── HAPTICS ──
export const HAPTIC_TAP_MS = 15;
export const HAPTIC_JUMP_MS = 25;
export const HAPTIC_LAND_MS = 10;
export const HAPTIC_MOVE_MS = 8;
export const HAPTIC_CRASH_PATTERN = [100, 30, 200, 30, 400];
export const HAPTIC_HIJACKED_INTERVAL = 300; // ms
export const HAPTIC_HIJACKED_VIBRATE = 150; // ms
export const HAPTIC_CORRUPTED_INTERVAL = 250; // ms

// ── AUDIO ──
export const BGM_DEFAULT_VOLUME = 0.4;
export const DEBUG_TIMEOUT_SOUND = 500; // ms
export const DEBUG_TIMEOUT_HAPTIC = 300; // ms

// ── BGM TRACK CONFIG ──
export const BGM_TRACKS = [
  { id: 'music2', threshold: 2.0, pivot: 0.35, speedAt100: 0.5, speedAtPivot: 1.0, speedAt0: 1.5 },
  { id: 'music3', threshold: 0.2, pivot: 0.35, speedAt100: 0.5, speedAtPivot: 1.0, speedAt0: 1.15 },
  { id: 'music1', threshold: 0.0, pivot: 0.35, speedAt100: 0.4, speedAtPivot: 1.0, speedAt0: 1.15 },
];

// ── UI / HUD ──
export const HUD_PANEL_W = 160;
export const HUD_PANEL_H = 52;
export const HUD_PADDING = 10;
export const HUD_BAR_H = 3;
export const PAUSE_BTN_W = 80;
export const PAUSE_BTN_H = 30;

// ── SPEED TRAILS (WARP) ──
export const WARP_START_LEVEL = 0.2;
export const WARP_MAX_LEVEL = 0.0;
export const WARP_MAX_OPACITY = 0.5;
export const WARP_FLOOR_CHANCE = 0.1;
export const WARP_PARTICLE_COUNT = 60;
export const WARP_SPEED_MIN = 1;
export const WARP_SPEED_MAX = 10;
export const WARP_CRUISE_MULT = 400;
export const WARP_WARP_MULT = 1500;

// ── INPUT ──
export const DEFAULT_SWIPE_THRESHOLD = 30;
export const DEFAULT_TILT_SENSITIVITY = 0.03;
export const DEFAULT_DEADZONE = 0.05;
export const TILT_NORMALIZE_DEGREES = 45;
export const TILT_SENSITIVITY_MULT = 60;

// ── ASSET PATHS ──
// Import the assets directly so Vite knows to bundle them into the dist folder.
import chargerSpriteUrl from './assets/enemycharger_dynamicgrid.png';
import playerSpriteUrl from './assets/herosprite_dynamicgrid.png';

import clickSoundUrl from './assets/sounds/click.opus';
import jumpSoundUrl from './assets/sounds/jump.opus';
import wirusSoundUrl from './assets/sounds/wirus.opus';
import corruptedSoundUrl from './assets/sounds/corrupted.opus';
import gameoverSoundUrl from './assets/sounds/gameover.opus';

import music1Url from './assets/sounds/music/music1.opus';
import music2Url from './assets/sounds/music/music2.opus';
import music3Url from './assets/sounds/music/music3.opus';

export const ASSET_PATHS = {
  chargerSprite: chargerSpriteUrl,
  playerSprite: playerSpriteUrl,
  sounds: {
    click: clickSoundUrl,
    jump: jumpSoundUrl,
    wirus: wirusSoundUrl,
    corrupted: corruptedSoundUrl,
    gameover: gameoverSoundUrl,
    music1: music1Url,
    music2: music2Url,
    music3: music3Url,
  },
};
