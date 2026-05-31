// src/main.js
// Entry point — boot sequence runs top to bottom, hard-stops on any failure.
// Order: Battery gate → Asset preload → Input init → Tilt detect → Control select → Engine start

import { initBattery } from './core/battery.js';
import { startEngine, initEngineKeyBindings } from './core/engine.js';
import { preloadAssets } from './systems/asset-cache.js';
import { initInput, checkTiltSensor, setControlMethod } from './core/input.js';
import { loadSettings, saveSettings } from './systems/settings.js';
import { DEBUG } from './constants.js';
import { initScreens, renderUnsupportedScreen } from './ui/screens.js';
import { initScore } from './systems/score.js';
import { playSound } from './systems/audio.js';
import { hapticTap } from './systems/haptics.js';

// ── Canvas setup — fixed internal resolution ─────────────────────────────────
const canvas = document.getElementById('game');
canvas.width = 720;
canvas.height = 1280;
// Make canvas focusable to capture keyboard events on mobile
canvas.setAttribute('tabindex', '0');
canvas.focus();
// Ensure canvas regains focus on user interaction (tap/click)
canvas.addEventListener('click', () => canvas.focus());
canvas.addEventListener('touchstart', () => canvas.focus());

// ── Global Test Lab Shortcut (Works instantly on all screens) ──
window.addEventListener('keydown', (e) => {
  if (e.key === '`') window.location.href = './test.html';
});

// ── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  // ── 1. HARDWARE GATE ──────────────────────────────────────────────────────
  const battery = await initBattery();

  if (!battery) {
    // 1. Initialize the screens system with your canvas dimensions and context
    initScreens(canvas);

    // 2. Clear the canvas and render the unsupported panel
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderUnsupportedScreen();

    return; // hard stop — nothing else runs
  }

  // ── 2. ASSET PRELOAD ──────────────────────────────────────────────────────
  await preloadAssets();

  // ── 3. INPUT INIT ─────────────────────────────────────────────────────────
  // Sets up keyboard, touch-swipe, tilt, and mouse-fallback listeners.
  // Registers once here — never re-registered on restart.
  initInput();

  // ── 4. ENGINE KEY BINDINGS ────────────────────────────────────────────────
  // Escape/P = pause, Space = restart (when dead), L = load save.
  // Also registered once here — not inside startEngine.
  initEngineKeyBindings();

  // Add a global keydown logger for debugging
  if (DEBUG) window.addEventListener('keydown', (e) => console.log('[Global] keydown test', e.key));

  // ── 5. TILT SENSOR DETECTION ──────────────────────────────────────────────
  const hasTiltSensor = await checkTiltSensor();
  const settings = loadSettings();
  settings.hasTiltSensor = hasTiltSensor;
  saveSettings(settings);

  // ── 6. CONTROL SELECTION or DIRECT LAUNCH ────────────────────────────────
  initScore();
  if (hasTiltSensor) {
    showControlSelectScreen(canvas);
  } else {
    setControlMethod('swipe');
    startEngine(canvas);
  }
}

// ── Control selection screen ──────────────────────────────────────────────────
// Pure DOM — sits above the canvas, removed when a choice is made.
// Themed to match the purple cyberpunk palette in screens.js / hud.js.
function showControlSelectScreen(canvas) {
  const el = document.createElement('div');
  el.id = 'screen-control-select';

  el.innerHTML = `
    <div class="cs-panel">
      <div class="cs-tag">// BOOT SEQUENCE //</div>
      <h1 class="cs-title">SELECT INPUT</h1>
      <p class="cs-sub">Tilt sensor detected on this device</p>

      <div class="cs-divider"></div>

      <button class="cs-btn cs-btn--primary" id="btnSwipe">
        <span class="cs-btn-icon">👆</span>
        <span class="cs-btn-label">SWIPE MODE</span>
        <span class="cs-btn-desc">Swipe left / right to change lanes</span>
      </button>

      <button class="cs-btn cs-btn--secondary" id="btnTilt">
        <span class="cs-btn-icon">📱</span>
        <span class="cs-btn-label">TILT MODE</span>
        <span class="cs-btn-desc">Tilt device left / right to steer</span>
      </button>

      <p class="cs-note">⬆  Swipe up to jump — always enabled in both modes</p>
      <p class="cs-note cs-note--dim">You can change this in the pause menu</p>
    </div>
  `;

  // ── Inline styles — self-contained, no external CSS needed ───────────────
  const style = document.createElement('style');
  style.textContent = `
    #screen-control-select {
      position: fixed;
      inset: 0;
      background: #0b0014;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      font-family: 'Courier New', monospace;
      /* CRT scanline overlay */
      background-image: repeating-linear-gradient(
        to bottom,
        transparent 0px,
        transparent 2px,
        rgba(167,139,250,0.03) 2px,
        rgba(167,139,250,0.03) 3px
      );
    }

    .cs-panel {
      background: #120026;
      border: 1.5px solid #7c3aed;
      border-radius: 4px;
      padding: 2.5rem 2rem;
      width: min(420px, 90vw);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
      position: relative;
      /* Corner glow */
      box-shadow:
        0 0 40px rgba(124,58,237,0.3),
        inset 0 0 60px rgba(124,58,237,0.05);
    }

    /* Corner accent lines */
    .cs-panel::before,
    .cs-panel::after {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      border-color: #22d3ee;
      border-style: solid;
    }
    .cs-panel::before { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
    .cs-panel::after  { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }

    .cs-tag {
      font-size: 11px;
      color: #7c3aed;
      letter-spacing: 0.1em;
      margin-bottom: 0.75rem;
    }

    .cs-title {
      font-size: clamp(26px, 6vw, 36px);
      color: #f3e8ff;
      letter-spacing: 0.12em;
      margin: 0 0 0.5rem;
      text-shadow: 0 0 20px rgba(168,85,247,0.6);
    }

    .cs-sub {
      font-size: 13px;
      color: #a78bfa;
      margin-bottom: 1.25rem;
    }

    .cs-divider {
      width: 100%;
      height: 1px;
      background: linear-gradient(to right, transparent, #4c1d95, transparent);
      margin-bottom: 1.5rem;
    }

    .cs-btn {
      width: 100%;
      background: #1e0038;
      border: 1.5px solid #7c3aed;
      border-radius: 3px;
      padding: 1rem 1.25rem;
      cursor: pointer;
      display: grid;
      grid-template-columns: 2rem 1fr;
      grid-template-rows: auto auto;
      gap: 0 0.75rem;
      align-items: center;
      margin-bottom: 0.75rem;
      text-align: left;
      transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
      position: relative;
      overflow: hidden;
    }

    .cs-btn::after {
      content: '';
      position: absolute;
      top: 0; right: 0;
      width: 0; height: 0;
      border-style: solid;
      border-width: 0 14px 14px 0;
      border-color: transparent #7c3aed transparent transparent;
    }

    .cs-btn--primary {
      border-color: #a855f7;
    }
    .cs-btn--primary::after {
      border-color: transparent #a855f7 transparent transparent;
    }

    .cs-btn:hover,
    .cs-btn:focus {
      background: #2d005a;
      border-color: #d946ef;
      box-shadow: 0 0 16px rgba(217,70,239,0.3);
      outline: none;
    }
    .cs-btn:hover::after,
    .cs-btn:focus::after {
      border-color: transparent #d946ef transparent transparent;
    }

    .cs-btn:active {
      background: #3b0764;
    }

    .cs-btn-icon {
      grid-row: 1 / 3;
      font-size: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cs-btn-label {
      font-family: 'Courier New', monospace;
      font-size: 15px;
      font-weight: bold;
      color: #e9d5ff;
      letter-spacing: 0.08em;
    }

    .cs-btn-desc {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      color: #6d28d9;
    }

    .cs-note {
      font-size: 11px;
      color: #4c1d95;
      margin-top: 0.75rem;
      text-align: center;
    }

    .cs-note--dim {
      color: #2e1065;
      font-size: 10px;
      margin-top: 0.25rem;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(el);

  // ── Button handlers ───────────────────────────────────────────────────────
  document.getElementById('btnSwipe').addEventListener('click', () => {
    playSound('click');
    hapticTap();
    setControlMethod('swipe');
    _dismissControlScreen(el, style);
    startEngine(canvas);
  });

  document.getElementById('btnTilt').addEventListener('click', () => {
    playSound('click');
    hapticTap();
    setControlMethod('tilt');
    _dismissControlScreen(el, style);
    startEngine(canvas);
  });
}

function _dismissControlScreen(el, style) {
  // Fade out before removing for a clean transition
  el.style.transition = 'opacity 0.25s';
  el.style.opacity = '0';
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
    if (style.parentNode) style.parentNode.removeChild(style);
  }, 260);
}

// ── Run ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', boot);
