// test.js
// Test module that runs the game using all the same parameters from the
// original game code, but bypasses the Battery Status API entirely.
// The battery level is configurable via the CONFIG object below.
//
// Usage: Open test.html in a browser (any browser — no Battery API needed).

import { initBattery, setBatteryConfig, MIN_SPEED, MAX_SPEED, SPEED_EXPONENT } from './src/core/battery.js';
import { startEngine, setEngineConfig, setSpawnRate, JUMP_FORCE, GRAVITY, SPAWN_RATE } from './src/core/engine.js';
import { preloadAssets } from './src/systems/asset-cache.js';
import { initInput } from './src/core/input.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURABLE BATTERY SETTINGS
// Change these values to simulate different battery levels and game speeds.
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  // Simulated battery level: 0.0 (empty) → 1.0 (full)
  // Lower battery = faster game speed (the core mechanic).
  batteryLevel: 0.9, // Change this to test different levels (e.g., 0.5 for 50% battery)

  // Battery speed curve parameters (uses defaults from battery.js if not overridden)
  minSpeed: MIN_SPEED, // Speed multiplier at 100% battery
  maxSpeed: MAX_SPEED, // Speed multiplier at 0% battery
  speedExponent: SPEED_EXPONENT, // Curve exponent (1.0 = linear)

  // Engine physics overrides (uses defaults from engine.js if not overridden)
  jumpForce: JUMP_FORCE,
  gravity: GRAVITY,

  // Obstacle spawn rate (uses default from engine.js if not overridden)
  spawnRate: SPAWN_RATE,
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK BATTERY OBJECT
// Implements the minimal BatteryManager interface that the game expects.
// ─────────────────────────────────────────────────────────────────────────────
function createMockBattery(level) {
  return {
    level: level,
    charging: false,
    chargingTime: Infinity,
    dischargingTime: Infinity,

    // Event handlers (no-ops — the game doesn't use these, but we include
    // them for interface completeness)
    addEventListener: function () {},
    removeEventListener: function () {},
    dispatchEvent: function () { return true; },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOT SEQUENCE
// Identical flow to src/main.js, except we inject the mock battery.
// ─────────────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('game');

// Internal resolution (720×1280 portrait — matches production).
canvas.width = 720;
canvas.height = 1280;

async function boot() {
  // Apply battery speed curve configuration.
  setBatteryConfig({
    minSpeed: CONFIG.minSpeed,
    maxSpeed: CONFIG.maxSpeed,
    exp: CONFIG.speedExponent,
  });

  // Apply engine physics configuration.
  setEngineConfig({
    jumpForce: CONFIG.jumpForce,
    gravity: CONFIG.gravity,
  });

  // Apply spawn rate.
  setSpawnRate(CONFIG.spawnRate);

  // Create the mock battery and inject it — this bypasses the real API.
  const mockBattery = createMockBattery(CONFIG.batteryLevel);
  const battery = await initBattery(mockBattery);

  // Since we injected a mock, battery will never be null.
  // The unsupported screen is skipped entirely.
  if (!battery) {
    const screen = document.getElementById('screen-unsupported');
    if (screen) screen.style.display = 'flex';
    return;
  }

  // Hide the unsupported screen (it may be visible by default).
  const unsupportedScreen = document.getElementById('screen-unsupported');
  if (unsupportedScreen) unsupportedScreen.style.display = 'none';

  // Preload assets, initialize input, and start the engine — same as production.
  await preloadAssets();
  initInput();
  startEngine(canvas);

  console.log(
    `[test] Game running with simulated battery level: ${CONFIG.batteryLevel}`
  );
}

document.addEventListener('DOMContentLoaded', boot);
