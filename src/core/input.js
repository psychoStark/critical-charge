// src/core/input.js
import { startEngine, togglePause, loadSavedGame } from './engine.js';
import { loadSettings, saveSettings } from '../systems/settings.js';

export const inputState = {
  lane: 0,
  jumpTriggered: false,
  tiltX: 0,
  rawTilt: 0
};

// Input constants - module-level so they can be modified by test pages
let SWIPE_THRESHOLD = 30; // Reduced threshold for more responsive swipe detection.
let TILT_SENSITIVITY = 0.03; // How strongly device tilt affects player movement. Higher values make tilt more responsive.
let DEADZONE = 0.05; // The range around the center where device tilt is ignored, preventing accidental small movements.

// Current control method
let currentControlMethod = 'swipe';

export function setInputConfig(config) {
  if (config.swipeThreshold !== undefined) SWIPE_THRESHOLD = config.swipeThreshold;
  if (config.tiltSensitivity !== undefined) TILT_SENSITIVITY = config.tiltSensitivity;
  if (config.deadzone !== undefined) DEADZONE = config.deadzone;
  if (config.controlMethod !== undefined) currentControlMethod = config.controlMethod;
}

/**
 * Check if device has tilt sensor capability
 * @returns {Promise<boolean>} True if device has tilt sensor
 */
export async function checkTiltSensor() {
  if (window.DeviceOrientationEvent) {
    // Test if device actually provides tilt data
    return new Promise((resolve) => {
      const testListener = (e) => {
        if (e.gamma !== null) {
          window.removeEventListener('deviceorientation', testListener);
          resolve(true);
        }
      };
      
      window.addEventListener('deviceorientation', testListener, { once: true });
      
      // Timeout in case no events are received
      setTimeout(() => {
        window.removeEventListener('deviceorientation', testListener);
        resolve(false);
      }, 1000);
    });
  }
  return false;
}

/**
 * Get the current control method
 * @returns {string} Current control method ('swipe' or 'tilt')
 */
export function getControlMethod() {
  return currentControlMethod;
}

/**
 * Set the control method
 * @param {string} method - 'swipe' or 'tilt'
 */
export function setControlMethod(method) {
  if (method === 'swipe' || method === 'tilt') {
    currentControlMethod = method;
    const settings = loadSettings();
    settings.controlMethod = method;
    saveSettings(settings);
  }
}

export function initInput() {
  // Load settings
  const settings = loadSettings();
  currentControlMethod = settings.controlMethod;
  SWIPE_THRESHOLD = settings.swipeThreshold;
  TILT_SENSITIVITY = settings.tiltSensitivity;
  DEADZONE = settings.deadzone;

  // 1. KEYBOARD
  window.addEventListener('keydown', (e) => {
    console.log('Keydown event:', e.key, e.code);
    // Keyboard lane controls only work in swipe mode
    if (currentControlMethod === 'swipe') {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        inputState.lane = Math.max(-1, inputState.lane - 1);
        console.log('Lane left ->', inputState.lane);
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        inputState.lane = Math.min(1, inputState.lane + 1);
        console.log('Lane right ->', inputState.lane);
      }
    }
    // Jump always works
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      inputState.jumpTriggered = true;
      console.log('Jump triggered');
    }

    // RESTART BINDING
    if (e.code === 'Space') {
      const canvas = document.getElementById('game');
      startEngine(canvas);
      console.log('Restart via Space');
    }

    // PAUSE/UNPAUSE BINDING (Escape or P)
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      togglePause();
      console.log('Toggle pause');
    }

    // LOAD GAME BINDING (L Key)
    if (e.key === 'l' || e.key === 'L') {
      loadSavedGame();
      console.log('Load saved game');
      console.log('InputState after keydown:', inputState);
    }
  });

  // 2. MOBILE TOUCH SWIPE
  let touchStartX = 0;
  let touchStartY = 0;

  window.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchend', e => {
    let dx = e.changedTouches[0].clientX - touchStartX;
    let dy = e.changedTouches[0].clientY - touchStartY;

    // ── SWIPE UP TO JUMP: Always enabled regardless of control mode ──
    if (Math.abs(dy) > Math.abs(dx) && dy < -SWIPE_THRESHOLD) {
      inputState.jumpTriggered = true;
    }
    
    // ── SWIPE LEFT/RIGHT FOR LANE CHANGE: Only in swipe mode ──
    if (currentControlMethod === 'swipe') {
      if (dx > SWIPE_THRESHOLD) {
        inputState.lane = Math.min(1, inputState.lane + 1);
      } else if (dx < -SWIPE_THRESHOLD) {
        inputState.lane = Math.max(-1, inputState.lane - 1);
      }
    }
    
    // ── MOBILE TAP BEHAVIORS ──
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {

      // Define the Pause Button Zone: The top 15% of the screen
      const isPauseZone = touchStartY < window.innerHeight * 0.15;

      if (isPauseZone) {
        togglePause(); // Tap Top = Pause
      } else {
        // Tap Anywhere Else = Restart (Make sure you only do this when dead!)
        const canvas = document.getElementById('game');
        startEngine(canvas);
      }
    }
  }, { passive: true });

  // 3. GYROSCOPE TILT
  window.addEventListener('deviceorientation', e => {
    if (e.gamma === null) return;
    const gamma = e.gamma || 0;
    inputState.rawTilt = gamma;
    const normalised = Math.max(-1, Math.min(1, gamma / 45));
    inputState.tiltX = Math.abs(normalised) < DEADZONE ? 0 : normalised * TILT_SENSITIVITY * 60;

    const debugDiv = document.getElementById('debug-tilt');
    if (debugDiv) {
      debugDiv.innerHTML = `Raw Tilt: ${inputState.rawTilt.toFixed(2)}<br>Tilt X: ${inputState.tiltX.toFixed(2)}`;
    }
  });

  // 4. MOUSE SWIPE FALLBACK (for desktop testing)
  let mouseDown = false;
  let mouseStartX = 0;
  window.addEventListener('mousedown', e => { mouseStartX = e.clientX; mouseDown = true });
  window.addEventListener('mouseup', e => {
    if (!mouseDown) return;
    mouseDown = false;
    // Only process mouse swipe lane changes in swipe mode
    if (currentControlMethod === 'swipe') {
      let dx = e.clientX - mouseStartX;
      if (Math.abs(dx) > SWIPE_THRESHOLD) {
        inputState.lane = Math.max(-1, Math.min(1, inputState.lane + (dx > 0 ? 1 : -1)));
      }
    }
  });
}
