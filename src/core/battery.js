// src/core/battery.js

import {
  MIN_SPEED_DEFAULT,
  MAX_SPEED_DEFAULT,
  SPEED_EXPONENT_DEFAULT,
  WIRUS_CORRUPT_THRESHOLD,
} from '../constants.js';

let batteryRef = null;

// ── W.I.R.U.S. TRACKING VARIABLES ──
let plugCount = 0;
let isCurrentlyCharging = false;
export let wirusState = 'clean'; // 'clean', 'hijacked', or 'corrupted'

export function resetWirusCount() {
  if (isCurrentlyCharging) {
    plugCount = 1;
    wirusState = 'hijacked';
  } else {
    plugCount = 0;
    wirusState = 'clean';
  }
}

export let MIN_SPEED = MIN_SPEED_DEFAULT;
export let MAX_SPEED = MAX_SPEED_DEFAULT;
export let SPEED_EXPONENT = SPEED_EXPONENT_DEFAULT;

export function setBatteryConfig(config) {
  if (config.minSpeed !== undefined) MIN_SPEED = config.minSpeed;
  if (config.maxSpeed !== undefined) MAX_SPEED = config.maxSpeed;
  if (config.exp !== undefined) SPEED_EXPONENT = config.exp;
}

export async function initBattery(simulatedBattery = null) {
  if (simulatedBattery) {
    batteryRef = simulatedBattery;
    _attachWirusListener(batteryRef);
    return batteryRef;
  }

  if (!navigator.getBattery) {
    return null;
  }

  try {
    // ── Force a fresh fetch ──
    batteryRef = await navigator.getBattery();
    _attachWirusListener(batteryRef);
    return batteryRef;
  } catch (err) {
    console.warn('Battery API failed:', err);
    return null;
  }
}

// ── W.I.R.U.S. LOGIC ──
function _attachWirusListener(battery) {
  isCurrentlyCharging = battery.charging;

  // Listen for charger plug/unplug
  battery.addEventListener('chargingchange', () => {
    if (battery.charging && !isCurrentlyCharging) {
      plugCount++;
      isCurrentlyCharging = true;
      if (plugCount >= WIRUS_CORRUPT_THRESHOLD) wirusState = 'corrupted';
      else wirusState = 'hijacked';
    } else if (!battery.charging && isCurrentlyCharging) {
      isCurrentlyCharging = false;
      if (wirusState === 'corrupted') plugCount = 0;
      wirusState = 'clean';
    }
  });
}

export function getBatteryLevel() {
  if (!batteryRef) return 1.0;
  return batteryRef.level;
}

export function getBatterySpeed(level) {
  const t = Math.pow(1.0 - level, SPEED_EXPONENT);
  return MIN_SPEED + (MAX_SPEED - MIN_SPEED) * t;
}
