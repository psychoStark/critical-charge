// src/core/input.js
import { startEngine, togglePause, loadSavedGame } from './engine.js';

export const inputState = {
  lane: 0,
  jumpTriggered: false,
  tiltX: 0,
  rawTilt: 0
};

// Input constants - module-level so they can be modified by test pages
export let SWIPE_THRESHOLD = 30; // Reduced threshold for more responsive swipe detection.
export let TILT_SENSITIVITY = 0.03; // How strongly device tilt affects player movement. Higher values make tilt more responsive.
export let DEADZONE = 0.05; // The range around the center where device tilt is ignored, preventing accidental small movements.

export function setInputConfig(config) {
  if (config.swipeThreshold !== undefined) SWIPE_THRESHOLD = config.swipeThreshold;
  if (config.tiltSensitivity !== undefined) TILT_SENSITIVITY = config.tiltSensitivity;
  if (config.deadzone !== undefined) DEADZONE = config.deadzone;
}

export function initInput() {
  // 1. KEYBOARD
  window.addEventListener('keydown', (e) => {
    console.log('Keydown event:', e.key, e.code);
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      inputState.lane = Math.max(-1, inputState.lane - 1);
      console.log('Lane left ->', inputState.lane);
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      inputState.lane = Math.min(1, inputState.lane + 1);
      console.log('Lane right ->', inputState.lane);
    }
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

    if (Math.abs(dy) > Math.abs(dx) && dy < -SWIPE_THRESHOLD) {
      inputState.jumpTriggered = true;
    } else if (dx > SWIPE_THRESHOLD) {
      inputState.lane = Math.min(1, inputState.lane + 1);
    } else if (dx < -SWIPE_THRESHOLD) {
      inputState.lane = Math.max(-1, inputState.lane - 1);
    }
    // ── MOBILE TAP BEHAVIORS ──
    else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {

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
    let dx = e.clientX - mouseStartX;
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      inputState.lane = Math.max(-1, Math.min(1, inputState.lane + (dx > 0 ? 1 : -1)));
    }
  });
}
