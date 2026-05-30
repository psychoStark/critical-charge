// src/ui/screens.js
// ─────────────────────────────────────────────────────────────────────────────
// Owns every full-screen overlay: Pause, Game Over, Unsupported.
// Uses a BUTTON REGISTRY — buttons register their bounding box when drawn,
// and a single pointer/touch listener tests against that registry.
// This means touch always hits the button that was visually rendered,
// with no coordinate math duplicated across files.
//
// Theme: Purple Cyberpunk
// ─────────────────────────────────────────────────────────────────────────────

import { playSound } from '../systems/audio.js';
import { hapticTap } from '../systems/haptics.js';
import { DEBUG } from '../constants.js';
import { THEME as T } from '../theme.js';
import { getSetting } from '../config.js';
import { getScanlinePattern } from '../utils/graphics.js';

// ── Button registry ───────────────────────────────────────────────────────────
// Every draw call that renders a button pushes to this array.
// It is cleared at the start of each screen render and rebuilt fresh.
// Each entry: { x, y, w, h, action: fn }
let _buttons = [];

function _clearButtons() {
  _buttons = [];
}

function _registerButton(x, y, w, h, action) {
  _buttons.push({ x, y, w, h, action });
}

// ── Canvas references (set by initScreens) ────────────────────────────────────
let _canvas = null;
let _ctx = null;
let _W = 640;
let _H = 360;

// ── External callbacks — wired in initScreens ─────────────────────────────────
let _onResume = () => {};
let _onRestart = () => {};
let _onSave = () => {};
let _onLoad = () => {};
let _onToggleControls = () => {};
let _onNextSong = () => {};
let _onToggleMute = () => {};
let _overlayMessageTimer = 0;
let _overlayMessageText = '';
let _overlayColor = '#fff';
let _onTestLab = () => {};

// ── Public init ───────────────────────────────────────────────────────────────
export function initScreens(canvas, callbacks = {}) {
  _canvas = canvas;
  _ctx = canvas.getContext('2d');
  _W = canvas.width;
  _H = canvas.height;

  _onResume = callbacks.onResume ?? (() => {});
  _onRestart = callbacks.onRestart ?? (() => {});
  _onSave = callbacks.onSave ?? (() => {});
  _onLoad = callbacks.onLoad ?? (() => {});
  _onToggleControls = callbacks.onToggleControls ?? (() => {});
  _onNextSong = callbacks.onNextSong ?? (() => {});
  _onToggleMute = callbacks.onToggleMute ?? (() => {});
  _onTestLab = callbacks.onTestLab ?? (() => {});

  // Single pointer listener on the canvas — handles both mouse and touch
  canvas.addEventListener('pointerdown', _handlePointer);
}

// Clear any lingering button registrations (e.g., after a game‑over restart)
export function clearScreenButtons() {
  _clearButtons();
}

// ── Pointer handler — tests registry, fires action ───────────────────────────
function _handlePointer(e) {
  const rect = _canvas.getBoundingClientRect();
  // Compute uniform scale and offsets due to object-fit: contain
  const scale = Math.min(rect.width / _canvas.width, rect.height / _canvas.height);
  const offsetX = (rect.width - _canvas.width * scale) / 2;
  const offsetY = (rect.height - _canvas.height * scale) / 2;
  const x = (e.clientX - rect.left - offsetX) / scale;
  const y = (e.clientY - rect.top - offsetY) / scale;

  if (DEBUG)
    console.log('[Screens] _handlePointer', {
      clientX: e.clientX,
      clientY: e.clientY,
      mappedX: x,
      mappedY: y,
      buttonCount: _buttons.length,
      pointerType: e.pointerType,
    });

  let hit = false;
  for (const btn of _buttons) {
    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
      if (DEBUG) console.log('[Screens] button HIT — firing action');
      e.preventDefault(); // only prevent default if a button is actually hit
      playSound('click');
      hapticTap();
      btn.action();
      // Diagnostic: log if restart action was triggered via tap
      if (btn.action === _onRestart) {
        console.warn('[Screens] RESTART action triggered via tap at', { x, y });
      }
      hit = true;
      break;
    }
  }
  if (!hit) {
    if (DEBUG) console.log('[Screens] no button hit');
    // If pause overlay is active, any tap should resume the game
    if (typeof _onResume === 'function') {
      _onResume();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED DRAW HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Scanline pass — uses pre-rendered pattern for performance
function _drawScanlines() {
  _ctx.drawImage(getScanlinePattern(_W, _H), 0, 0);
}

// Glowing panel box
function _drawPanel(x, y, w, h, glowColor = T.panelGlow) {
  const ctx = _ctx;
  // Glow
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 24;
  ctx.fillStyle = T.panelBg;
  ctx.fillRect(x, y, w, h);
  ctx.shadowBlur = 0;
  // Border — double line cyberpunk style
  ctx.strokeStyle = T.panelBorder;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(124,58,237,0.3)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
}

// Corner accents on a panel
function _drawCorners(x, y, w, h, size = 10) {
  const ctx = _ctx;
  ctx.strokeStyle = T.accentCyan;
  ctx.lineWidth = 1.5;
  const corners = [
    [x, y, size, 0, 0, size],
    [x + w, y, -size, 0, 0, size],
    [x, y + h, size, 0, 0, -size],
    [x + w, y + h, -size, 0, 0, -size],
  ];
  corners.forEach(([ox, oy, dx1, dy1, dx2, dy2]) => {
    ctx.beginPath();
    ctx.moveTo(ox + dx1, oy + dy1);
    ctx.lineTo(ox, oy);
    ctx.lineTo(ox + dx2, oy + dy2);
    ctx.stroke();
  });
}

// Cyberpunk button — registers itself in _buttons
function _drawButton(label, x, y, w, h, action, variant = 'default') {
  const ctx = _ctx;
  const isHot = variant === 'hot'; // pink accent
  const isDim = variant === 'dim'; // muted

  const bg = isHot ? T.btnDangerBg : T.btnBg;
  const border = isHot ? T.btnDanger : isDim ? T.textDim : T.btnBorder;
  const text = isHot ? '#f9a8d4' : T.btnText;
  const glow = isHot ? 'rgba(190,24,93,0.4)' : T.panelGlow;

  // Panel
  ctx.shadowColor = glow;
  ctx.shadowBlur = 12;
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.shadowBlur = 0;

  ctx.strokeStyle = border;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);

  // Diagonal slash accent top-right corner
  ctx.strokeStyle = isHot ? '#f472b6' : T.accentCyan;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x + w - 14, y);
  ctx.lineTo(x + w, y + 14);
  ctx.stroke();

  // Label
  ctx.fillStyle = text;
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
  ctx.textBaseline = 'alphabetic';

  // Register hit area
  _registerButton(x, y, w, h, action);
}

// Pre-generated static noise pattern for border stripes
const _noisePattern = Array.from({ length: 200 }, () => Math.random() > 0.5);

// Pixel-noise border stripe (top and bottom of overlays)
function _drawNoiseBorder(y, w) {
  const ctx = _ctx;
  ctx.fillStyle = T.accentCyan;
  for (let i = 0; i < w; i += 4) {
    const idx = Math.floor(i / 4) % _noisePattern.length;
    if (_noisePattern[idx]) ctx.fillRect(i, y, 2, 1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAUSE SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export function renderPauseScreen(score, highScore, isMuted = false) {
  const ctx = _ctx;
  _clearButtons();

  // Dim overlay
  ctx.fillStyle = T.overlay;
  ctx.fillRect(0, 0, _W, _H);
  _drawScanlines();
  _drawNoiseBorder(0, _W);
  _drawNoiseBorder(_H - 1, _W);

  const hasTilt = getSetting('hasTiltSensor') ?? false;
  const method = getSetting('controlMethod') ?? 'swipe';

  // How many buttons?
  const btnCount = hasTilt ? 8 : 7;
  const BW = 220,
    BH = 48,
    GAP = 14;
  const totalBtnH = btnCount * BH + (btnCount - 1) * GAP;

  // Panel sizing
  const PW = 300,
    PH = totalBtnH + 160; // Adjusted padding slightly to fit the tall menu
  const PX = _W / 2 - PW / 2;
  const PY = _H / 2 - PH / 2;

  _drawPanel(PX, PY, PW, PH);
  _drawCorners(PX, PY, PW, PH);

  // ── Title ──
  ctx.fillStyle = T.accent;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('// SYSTEM INTERRUPT //', _W / 2, PY + 22);

  ctx.shadowColor = T.accentCyan;
  ctx.shadowBlur = 14;
  ctx.fillStyle = T.textPrimary;
  ctx.font = 'bold 26px monospace';
  ctx.fillText('CRITICAL BREAK', _W / 2, PY + 52);
  ctx.shadowBlur = 0;

  // Score strip
  ctx.fillStyle = T.textDim;
  ctx.fillRect(PX + 1, PY + 64, PW - 2, 1);
  ctx.fillStyle = T.accentYellow;
  ctx.font = '13px monospace';
  ctx.fillText(`SCORE  ${Math.floor(score)}   HI  ${Math.floor(highScore)}`, _W / 2, PY + 82);

  ctx.fillStyle = T.textDim;
  ctx.fillRect(PX + 1, PY + 92, PW - 2, 1);

  // ── Buttons ──
  let BY = PY + 108;
  const BX = _W / 2 - BW / 2;

  _drawButton('▶  RESUME', BX, BY, BW, BH, _onResume);
  BY += BH + GAP;
  _drawButton('🔄  RESTART', BX, BY, BW, BH, _onRestart, 'hot');
  BY += BH + GAP;
  _drawButton('💾  SAVE GAME', BX, BY, BW, BH, _onSave, 'dim');
  BY += BH + GAP;
  _drawButton('📂  LOAD GAME', BX, BY, BW, BH, _onLoad, 'dim');
  BY += BH + GAP;
  _drawButton('▶▶  NEXT TRACK', BX, BY, BW, BH, _onNextSong, 'dim');
  BY += BH + GAP;

  const muteText = isMuted ? '🔊  UNMUTE AUDIO' : '🔇  MUTE AUDIO';
  _drawButton(muteText, BX, BY, BW, BH, _onToggleMute, 'dim');

  if (hasTilt) {
    BY += BH + GAP;
    _drawButton(`🎮  ${method.toUpperCase()} MODE`, BX, BY, BW, BH, _onToggleControls, 'dim');
  }

  BY += BH + GAP;
  const testBtnText = window.__TEST_MODE ? '❌  EXIT TEST' : '🧪  TEST MODE';
  _drawButton(testBtnText, BX, BY, BW, BH, _onTestLab, 'dim');

  // Swipe-down hint
  ctx.fillStyle = T.textDim;
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Tap anywhere to resume', _W / 2, PY + PH - 10);

}

// ─────────────────────────────────────────────────────────────────────────────
// GAME OVER SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export function renderGameOverScreen(score, highScore, isNewHighScore = false) {
  const ctx = _ctx;
  _clearButtons();

  ctx.fillStyle = 'rgba(11,0,20,0.88)';
  ctx.fillRect(0, 0, _W, _H);
  _drawScanlines();
  _drawNoiseBorder(0, _W);
  _drawNoiseBorder(_H - 1, _W);

  const BW = 220,
    BH = 48,
    GAP = 14;
  const PW = 300,
    PH = 260;
  const PX = _W / 2 - PW / 2;
  const PY = _H / 2 - PH / 2 + 10;

  _drawPanel(PX, PY, PW, PH, 'rgba(190,24,93,0.3)');
  _drawCorners(PX, PY, PW, PH);

  // ── Title ──
  ctx.fillStyle = T.accentHot;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('// POWER DEPLETED //', _W / 2, PY + 22);

  ctx.shadowColor = T.accentHot;
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#fda4af';
  ctx.font = 'bold 28px monospace';
  ctx.fillText('CRITICAL FAILURE', _W / 2, PY + 54);
  ctx.shadowBlur = 0;

  // Score strip
  ctx.fillStyle = T.textDim;
  ctx.fillRect(PX + 1, PY + 68, PW - 2, 1);

  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`SCORE  ${Math.floor(score)}`, _W / 2, PY + 86);

  if (isNewHighScore) {
    ctx.shadowColor = T.accentYellow;
    ctx.shadowBlur = 10;
    ctx.fillStyle = T.accentYellow;
    ctx.font = 'bold 13px monospace';
    ctx.fillText('★  NEW RECORD  ★', _W / 2, PY + 106);
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = T.textSecond;
    ctx.font = '12px monospace';
    ctx.fillText(`BEST  ${Math.floor(highScore)}`, _W / 2, PY + 106);
  }

  ctx.fillStyle = T.textDim;
  ctx.fillRect(PX + 1, PY + 116, PW - 2, 1);

  // ── Buttons ──
  const BX = _W / 2 - BW / 2;
  let BY = PY + 132;

  _drawButton('🔄  RESTART', BX, BY, BW, BH, _onRestart, 'hot');
  BY += BH + GAP;
  _drawButton('📂  LOAD GAME', BX, BY, BW, BH, _onLoad, 'dim');
}

// ─────────────────────────────────────────────────────────────────────────────
// UNSUPPORTED HARDWARE SCREEN (Battery API unavailable)
// ─────────────────────────────────────────────────────────────────────────────
export function renderUnsupportedScreen() {
  const ctx = _ctx;
  _clearButtons();

  ctx.fillStyle = T.bg;
  ctx.fillRect(0, 0, _W, _H);
  _drawScanlines();

  const PW = 420,
    PH = 200;
  const PX = _W / 2 - PW / 2;
  const PY = _H / 2 - PH / 2;

  _drawPanel(PX, PY, PW, PH, 'rgba(239,68,68,0.25)');
  _drawCorners(PX, PY, PW, PH);

  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#fca5a5';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('HARDWARE UNSUPPORTED', _W / 2, PY + 56);
  ctx.shadowBlur = 0;

  ctx.fillStyle = T.textSecond;
  ctx.font = '12px monospace';
  ctx.fillText('Battery Status API not available', _W / 2, PY + 86);
  ctx.fillText('Use Chrome or Edge on Android / macOS / Windows', _W / 2, PY + 106);

  ctx.fillStyle = T.textDim;
  ctx.fillRect(PX + 1, PY + 118, PW - 2, 1);

  ctx.fillStyle = T.accentCyan;
  ctx.font = '11px monospace';
  ctx.fillText('Critical Charge requires a real battery sensor to play.', _W / 2, PY + 138);
  ctx.fillText('iOS Safari and Firefox do not support this API.', _W / 2, PY + 156);
}

// ANTI HACK

export function renderHijackedScreen() {
  const ctx = _canvas.getContext('2d');
  const _W = _canvas.width;
  const _H = _canvas.height;

  // ── Blinking Red/Black Background ──
  // Math.floor(Date.now() / 300) toggles true/false every 300 milliseconds
  const isRed = Math.floor(Date.now() / 300) % 2 === 0;
  ctx.fillStyle = isRed ? 'rgba(255, 0, 0, 0.4)' : '#050000';
  ctx.fillRect(0, 0, _W, _H);

  // Warning Box
  const boxW = 340,
    boxH = 200;
  const boxX = _W / 2 - boxW / 2;
  const boxY = _H / 2 - boxH / 2 - 50;

  ctx.fillStyle = '#1a0000';
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 3;
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff0000';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('SYSTEM HIJACKED', _W / 2, boxY + 50);

  ctx.fillStyle = '#ff6666';
  ctx.font = '14px monospace';
  ctx.fillText('Enemy W.I.R.U.S. detected', _W / 2, boxY + 90);
  ctx.fillText('via power grid.', _W / 2, boxY + 110);

  ctx.fillStyle = '#ffffff';
  ctx.fillText('Save data purged.', _W / 2, boxY + 140);
  ctx.fillText('Unplug to reboot from zero.', _W / 2, boxY + 160);
}

export function renderCorruptedScreen() {
  const ctx = _canvas.getContext('2d');
  const _W = _canvas.width;
  const _H = _canvas.height;

  // Complete blackout with red text
  ctx.fillStyle = '#050000';
  ctx.fillRect(0, 0, _W, _H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff0000';
  ctx.font = 'bold 28px monospace';
  ctx.fillText('CATASTROPHIC FAILURE', _W / 2, _H / 2 - 40);

  ctx.fillStyle = '#ff4444';
  ctx.font = '14px monospace';
  ctx.fillText('System fully corrupted by', _W / 2, _H / 2 + 10);
  ctx.fillText('W.I.R.U.S. payload.', _W / 2, _H / 2 + 30);

  ctx.fillStyle = '#555555';
  ctx.fillText('All memory banks wiped.', _W / 2, _H / 2 + 70);
  ctx.fillText('Awaiting disinfection...', _W / 2, _H / 2 + 90);
}

// ── UNIFIED MESSAGE OVERLAYS ──
export function triggerSaveMessage() {
  _overlayMessageText = 'SAVE SUCCESSFUL';
  _overlayColor = '#22c55e'; // Neon Green
  _overlayMessageTimer = 120;
}

export function triggerLoadErrorMessage() {
  _overlayMessageText = 'NO SAVE FOUND';
  _overlayColor = '#ef4444'; // Neon Red
  _overlayMessageTimer = 120;
}

export function triggerLoadSuccessMessage() {
  _overlayMessageText = 'LOAD SUCCESSFUL';
  _overlayColor = '#22d3ee'; // Neon Cyan
  _overlayMessageTimer = 120;
}

export function renderSaveOverlay() {
  if (_overlayMessageTimer <= 0) return;
  const ctx = _ctx;

  const msgW = 200, msgH = 40;
  const msgX = _W / 2 - msgW / 2;
  const msgY = 20;

  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillRect(msgX, msgY, msgW, msgH);

  ctx.strokeStyle = _overlayColor;
  ctx.strokeRect(msgX, msgY, msgW, msgH);

  ctx.fillStyle = _overlayColor;
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(_overlayMessageText, _W / 2, msgY + msgH / 2);
  ctx.textBaseline = 'alphabetic';

  _overlayMessageTimer--;
}
