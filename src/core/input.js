// src/core/input.js
// ─────────────────────────────────────────────────────────────────────────────
// PURE GAME INPUT ONLY.
// This file writes to inputState. That is all it does.
// No UI logic, no pause handling, no screen taps, no engine calls live here.
// UI touch routing is handled by screens.js via its own event listeners.
// ─────────────────────────────────────────────────────────────────────────────

import { loadSettings, saveSettings } from '../systems/settings.js';

// ── Shared input state — read every frame by engine.js ───────────────────────
export const inputState = {
  lane:           0,      // -1 | 0 | 1
  jumpTriggered:  false,  // consumed by engine each frame, then reset to false
  tiltX:          0,      // -1.0 → 1.0 (only used in tilt control mode)
  rawTilt:        0,      // raw gamma degrees, for debug display
};

// ── Constants — overridable by test harness via setInputConfig() ─────────────
let SWIPE_THRESHOLD  = 30;
let TILT_SENSITIVITY = 0.03;
let DEADZONE         = 0.05;
let currentControlMethod = 'swipe'; // 'swipe' | 'tilt'

// ── Config API (used by test pages and settings screen) ──────────────────────
export function setInputConfig(config) {
  if (config.swipeThreshold  !== undefined) SWIPE_THRESHOLD    = config.swipeThreshold;
  if (config.tiltSensitivity !== undefined) TILT_SENSITIVITY   = config.tiltSensitivity;
  if (config.deadzone        !== undefined) DEADZONE           = config.deadzone;
  if (config.controlMethod   !== undefined) currentControlMethod = config.controlMethod;
}

export function getControlMethod()  { return currentControlMethod; }

export function setControlMethod(method) {
  if (method !== 'swipe' && method !== 'tilt') return;
  currentControlMethod = method;
  const s = loadSettings();
  s.controlMethod = method;
  saveSettings(s);
}

// ── Tilt sensor detection ────────────────────────────────────────────────────
export async function checkTiltSensor() {
  if (!window.DeviceOrientationEvent) return false;
  return new Promise(resolve => {
    const handler = e => {
      if (e.gamma !== null) { window.removeEventListener('deviceorientation', handler); resolve(true); }
    };
    window.addEventListener('deviceorientation', handler, { once: true });
    setTimeout(() => { window.removeEventListener('deviceorientation', handler); resolve(false); }, 1000);
  });
}

// ── Init — call once from main.js after engine boots ────────────────────────
export function initInput() {
  const settings         = loadSettings();
  currentControlMethod   = settings.controlMethod   ?? 'swipe';
  SWIPE_THRESHOLD        = settings.swipeThreshold  ?? 30;
  TILT_SENSITIVITY       = settings.tiltSensitivity ?? 0.03;
  DEADZONE               = settings.deadzone        ?? 0.05;

  _initKeyboard();
  _initTouch();
  _initTilt();
  _initMouseFallback();
}

// ── 1. Keyboard ──────────────────────────────────────────────────────────────
// Only writes game-movement state. Pause / restart keys are in screens.js.
function _initKeyboard() {
  window.addEventListener('keydown', e => {
    if (currentControlMethod === 'swipe') {
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A')
        inputState.lane = Math.max(-1, inputState.lane - 1);
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')
        inputState.lane = Math.min(1,  inputState.lane + 1);
    }
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W')
      inputState.jumpTriggered = true;
  });
}

// ── 2. Touch — GAME gestures only ────────────────────────────────────────────
// Swipe left/right = lane change. Swipe up = jump.
// TAP events are NOT handled here — screens.js owns tap routing via its
// button registry so taps always land on the button that was visually drawn.
function _initTouch() {
  let startX = 0, startY = 0;

  window.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    // Debug: show start coordinates if debug enabled
    if (typeof window !== 'undefined' && window.__SHOW_DEBUG) {
      const dbgTouch = document.getElementById('debug-touch');
      if (dbgTouch) dbgTouch.innerHTML = `Start: ${startX.toFixed(0)}, ${startY.toFixed(0)}`;
    }
  }, { passive: true });

  window.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);

    // Must be a clear gesture (not a tap) to avoid eating button taps
    const isGesture = absDx > SWIPE_THRESHOLD || absDy > SWIPE_THRESHOLD;
    if (!isGesture) {
      // Debug: show tap info if debug enabled
      if (typeof window !== 'undefined' && window.__SHOW_DEBUG) {
        const dbgTouch = document.getElementById('debug-touch');
        if (dbgTouch) dbgTouch.innerHTML = `Tap: ${dx.toFixed(0)}, ${dy.toFixed(0)}`;
      }
      return; // taps fall through to screens.js
    }

    // Swipe up — jump
    if (absDy > absDx && dy < -SWIPE_THRESHOLD) {
      inputState.jumpTriggered = true;
      // Debug: show swipe up
      if (typeof window !== 'undefined' && window.__SHOW_DEBUG) {
        const dbgTouch = document.getElementById('debug-touch');
        if (dbgTouch) dbgTouch.innerHTML = `Swipe Up`;
      }
      return;
    }

    // Swipe left / right — lane (swipe mode only)
    if (currentControlMethod === 'swipe' && absDx > absDy) {
      inputState.lane = Math.max(-1, Math.min(1, inputState.lane + (dx > 0 ? 1 : -1)));
      // Debug: show swipe direction
      if (typeof window !== 'undefined' && window.__SHOW_DEBUG) {
        const dbgTouch = document.getElementById('debug-touch');
        if (dbgTouch) dbgTouch.innerHTML = `Swipe ${dx > 0 ? 'Right' : 'Left'}`;
      }
    }
  }, { passive: true });
}

// ── 3. Gyroscope tilt ────────────────────────────────────────────────────────
function _initTilt() {
  window.addEventListener('deviceorientation', e => {
    if (e.gamma === null) return;
    inputState.rawTilt   = e.gamma;
    const norm           = Math.max(-1, Math.min(1, e.gamma / 45));
    inputState.tiltX     = Math.abs(norm) < DEADZONE ? 0 : norm * TILT_SENSITIVITY * 60;

    // Debug overlay — only rendered if the element exists (test harness)
    const dbg = document.getElementById('debug-tilt');
    if (dbg) dbg.innerHTML = `γ: ${inputState.rawTilt.toFixed(1)}° &nbsp; tiltX: ${inputState.tiltX.toFixed(3)}`;
    // Also expose tilt value for canvas overlay
    if (typeof window !== 'undefined') {
      window.__debugTilt = inputState.tiltX.toFixed(2);
    }
  });
}

// ── 4. Mouse swipe fallback (desktop dev) ────────────────────────────────────
function _initMouseFallback() {
  let down = false, startX = 0;
  window.addEventListener('mousedown',  e => { startX = e.clientX; down = true; });
  window.addEventListener('mouseup', e => {
    if (!down) return; down = false;
    if (currentControlMethod !== 'swipe') return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > SWIPE_THRESHOLD)
      inputState.lane = Math.max(-1, Math.min(1, inputState.lane + (dx > 0 ? 1 : -1)));
  });
}