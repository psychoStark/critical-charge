// src/systems/haptics.js

import {
  HAPTIC_TAP_MS,
  HAPTIC_JUMP_MS,
  HAPTIC_LAND_MS,
  HAPTIC_MOVE_MS,
  HAPTIC_CRASH_PATTERN,
  HAPTIC_HIJACKED_INTERVAL,
  HAPTIC_HIJACKED_VIBRATE,
  HAPTIC_CORRUPTED_INTERVAL,
  DEBUG_TIMEOUT_HAPTIC,
  DEBUG,
} from '../constants.js';

let effectTimer = null;

export let debugLastHaptic = 'None';
let debugHapticTimer = null;

export function vibrate(pattern) {
  if (pattern !== 0 && DEBUG) {
    debugLastHaptic = Array.isArray(pattern) ? `[${pattern.join(',')}]` : `${pattern}ms`;
    if (debugHapticTimer) clearTimeout(debugHapticTimer);
    debugHapticTimer = setTimeout(() => {
      debugLastHaptic = 'None';
    }, DEBUG_TIMEOUT_HAPTIC);
  }
  // Safely trigger hardware vibration if supported
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* vibration not supported */
    }
  }
}

// ── UI & GAMEPLAY ──
export function hapticTap() {
  vibrate(HAPTIC_TAP_MS);
} // Subtle, sharp UI click
export function hapticCrash() {
  vibrate(HAPTIC_CRASH_PATTERN);
} // Heavy impact rumble
export function hapticJump() {
  vibrate(HAPTIC_JUMP_MS);
} // Sharp pop for launch
export function hapticLand() {
  vibrate(HAPTIC_LAND_MS);
} // Very subtle thud for landing
export function hapticMove() {
  vibrate(HAPTIC_MOVE_MS);
} // Barely noticeable tick for lane change

// ── W.I.R.U.S. EFFECTS ──
export function startHijackedHaptics() {
  stopHaptics();
  let lastBlinkState = false;

  effectTimer = setInterval(() => {
    const isRed = Math.floor(Date.now() / HAPTIC_HIJACKED_INTERVAL) % 2 === 0;
    if (isRed && !lastBlinkState) vibrate(HAPTIC_HIJACKED_VIBRATE);
    lastBlinkState = isRed;
  }, 50);
}

export function startCorruptedHaptics() {
  stopHaptics();
  effectTimer = setInterval(() => {
    vibrate([Math.random() * 50 + 20, 20, Math.random() * 100 + 40, 20, Math.random() * 60 + 20]);
  }, HAPTIC_CORRUPTED_INTERVAL);
}

export function stopHaptics() {
  // FIX: Only force-stop the hardware if an earthquake effect was actively running!
  if (effectTimer) {
    clearInterval(effectTimer);
    effectTimer = null;
    vibrate(0);
  }
}
