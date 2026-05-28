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

import { loadSettings } from '../systems/settings.js';

// ── Theme tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:           '#0b0014',
  overlay:      'rgba(11,0,20,0.82)',
  panelBg:      '#120026',
  panelBorder:  '#7c3aed',
  panelGlow:    'rgba(124,58,237,0.35)',
  accent:       '#a855f7',       // primary purple
  accentHot:    '#d946ef',       // pink-purple for danger / game over
  accentCyan:   '#22d3ee',       // cyan highlight
  accentYellow: '#fbbf24',       // score / hi-score
  textPrimary:  '#f3e8ff',
  textSecond:   '#a78bfa',
  textDim:      '#4c1d95',
  btnBg:        '#1e0038',
  btnHover:     '#3b0764',
  btnBorder:    '#7c3aed',
  btnText:      '#e9d5ff',
  btnDanger:    '#be185d',
  btnDangerBg:  '#1a0020',
  scanline:     'rgba(167,139,250,0.04)',
};

// ── Button registry ───────────────────────────────────────────────────────────
// Every draw call that renders a button pushes to this array.
// It is cleared at the start of each screen render and rebuilt fresh.
// Each entry: { x, y, w, h, action: fn }
let _buttons = [];

function _clearButtons() { _buttons = []; }

function _registerButton(x, y, w, h, action) {
  _buttons.push({ x, y, w, h, action });
}

// ── Canvas references (set by initScreens) ────────────────────────────────────
let _canvas = null;
let _ctx    = null;
let _W      = 640;
let _H      = 360;

// ── External callbacks — wired in initScreens ─────────────────────────────────
let _onResume  = () => {};
let _onRestart = () => {};
let _onSave    = () => {};
let _onLoad    = () => {};
let _onToggleControls = () => {};
let _saveMessageTimer = 0; // frames remaining for save success overlay

// ── Public init ───────────────────────────────────────────────────────────────
export function initScreens(canvas, callbacks = {}) {
  _canvas = canvas;
  _ctx    = canvas.getContext('2d');
  _W      = canvas.width;
  _H      = canvas.height;

  _onResume         = callbacks.onResume         ?? (() => {});
  _onRestart        = callbacks.onRestart        ?? (() => {});
  _onSave           = callbacks.onSave           ?? (() => {});
  _onLoad           = callbacks.onLoad           ?? (() => {});
  _onToggleControls = callbacks.onToggleControls ?? (() => {});

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

  console.log('[Screens] _handlePointer', { clientX: e.clientX, clientY: e.clientY, mappedX: x, mappedY: y, buttonCount: _buttons.length, pointerType: e.pointerType });

  let hit = false;
  for (const btn of _buttons) {
    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
      console.log('[Screens] button HIT — firing action');
      e.preventDefault(); // only prevent default if a button is actually hit
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
    console.log('[Screens] no button hit');
    // If pause overlay is active, any tap should resume the game
    if (typeof _onResume === 'function') {
      _onResume();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED DRAW HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Scanline pass — call over any overlay for the CRT feel
function _drawScanlines() {
  const ctx = _ctx;
  for (let y = 0; y < _H; y += 3) {
    ctx.fillStyle = T.scanline;
    ctx.fillRect(0, y, _W, 1);
  }
}

// Glowing panel box
function _drawPanel(x, y, w, h, glowColor = T.panelGlow) {
  const ctx = _ctx;
  // Glow
  ctx.shadowColor = glowColor;
  ctx.shadowBlur  = 24;
  ctx.fillStyle   = T.panelBg;
  ctx.fillRect(x, y, w, h);
  ctx.shadowBlur  = 0;
  // Border — double line cyberpunk style
  ctx.strokeStyle = T.panelBorder;
  ctx.lineWidth   = 1.5;
  ctx.strokeRect(x,     y,     w,     h);
  ctx.strokeStyle = 'rgba(124,58,237,0.3)';
  ctx.lineWidth   = 0.5;
  ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
}

// Corner accents on a panel
function _drawCorners(x, y, w, h, size = 10) {
  const ctx = _ctx;
  ctx.strokeStyle = T.accentCyan;
  ctx.lineWidth   = 1.5;
  const corners = [
    [x,     y,     size, 0,    0,    size],
    [x+w,   y,    -size, 0,    0,    size],
    [x,     y+h,   size, 0,    0,   -size],
    [x+w,   y+h,  -size, 0,    0,   -size],
  ];
  corners.forEach(([ox, oy, dx1, dy1, dx2, dy2]) => {
    ctx.beginPath();
    ctx.moveTo(ox + dx1, oy + dy1);
    ctx.lineTo(ox,       oy);
    ctx.lineTo(ox + dx2, oy + dy2);
    ctx.stroke();
  });
}

// Cyberpunk button — registers itself in _buttons
function _drawButton(label, x, y, w, h, action, variant = 'default') {
  const ctx = _ctx;
  const isHot = variant === 'hot';   // pink accent
  const isDim = variant === 'dim';   // muted

  const bg     = isHot ? T.btnDangerBg : T.btnBg;
  const border = isHot ? T.btnDanger   : isDim ? T.textDim : T.btnBorder;
  const text   = isHot ? '#f9a8d4'     : T.btnText;
  const glow   = isHot ? 'rgba(190,24,93,0.4)' : T.panelGlow;

  // Panel
  ctx.shadowColor = glow;
  ctx.shadowBlur  = 12;
  ctx.fillStyle   = bg;
  ctx.fillRect(x, y, w, h);
  ctx.shadowBlur  = 0;

  ctx.strokeStyle = border;
  ctx.lineWidth   = 1.5;
  ctx.strokeRect(x, y, w, h);

  // Diagonal slash accent top-right corner
  ctx.strokeStyle = isHot ? '#f472b6' : T.accentCyan;
  ctx.lineWidth   = 0.5;
  ctx.beginPath();
  ctx.moveTo(x + w - 14, y);
  ctx.lineTo(x + w,      y + 14);
  ctx.stroke();

  // Label
  ctx.fillStyle   = text;
  ctx.font        = 'bold 15px monospace';
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
  ctx.textBaseline = 'alphabetic';

  // Register hit area
  _registerButton(x, y, w, h, action);
}

// Pixel-noise border stripe (top and bottom of overlays)
function _drawNoiseBorder(y, w) {
  const ctx = _ctx;
  ctx.fillStyle = T.accentCyan;
  for (let i = 0; i < w; i += 4) {
    if (Math.random() > 0.5) ctx.fillRect(i, y, 2, 1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAUSE SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export function renderPauseScreen(score, highScore) {
  const ctx  = _ctx;
  _clearButtons();

  // Dim overlay
  ctx.fillStyle = T.overlay;
  ctx.fillRect(0, 0, _W, _H);
  _drawScanlines();
  _drawNoiseBorder(0,  _W);
  _drawNoiseBorder(_H - 1, _W);

  const settings = loadSettings();
  const hasTilt  = settings.hasTiltSensor;
  const method   = settings.controlMethod ?? 'swipe';

  // How many buttons?
  const btnCount   = hasTilt ? 4 : 3;  // Save | Resume | Controls? | Load
  const BW = 220, BH = 48, GAP = 14;
  const totalBtnH  = btnCount * BH + (btnCount - 1) * GAP;

  // Panel sizing
  const PW = 300, PH = totalBtnH + 140;
  const PX = _W / 2 - PW / 2;
  const PY = _H / 2 - PH / 2;

  _drawPanel(PX, PY, PW, PH);
  _drawCorners(PX, PY, PW, PH);

  // ── Title ──
  ctx.fillStyle = T.accent;
  ctx.font      = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('// SYSTEM INTERRUPT //', _W / 2, PY + 22);

  ctx.shadowColor = T.accentCyan;
  ctx.shadowBlur  = 14;
  ctx.fillStyle   = T.textPrimary;
  ctx.font        = 'bold 26px monospace';
  ctx.fillText('CRITICAL BREAK', _W / 2, PY + 52);
  ctx.shadowBlur  = 0;

  // Score strip
  ctx.fillStyle = T.textDim;
  ctx.fillRect(PX + 1, PY + 64, PW - 2, 1);
  ctx.fillStyle = T.accentYellow;
  ctx.font      = '13px monospace';
  ctx.fillText(`SCORE  ${Math.floor(score)}   HI  ${Math.floor(highScore)}`, _W / 2, PY + 82);

  ctx.fillStyle = T.textDim;
  ctx.fillRect(PX + 1, PY + 92, PW - 2, 1);

  // ── Buttons ──
  let BY = PY + 108;
  const BX = _W / 2 - BW / 2;

  _drawButton('▶  RESUME',          BX, BY, BW, BH, _onResume);
  BY += BH + GAP;
  _drawButton('💾  SAVE GAME',      BX, BY, BW, BH, _onSave,   'dim');
  BY += BH + GAP;
  _drawButton('📂  LOAD GAME',      BX, BY, BW, BH, _onLoad,   'dim');

  if (hasTilt) {
    BY += BH + GAP;
    _drawButton(`🎮  ${method.toUpperCase()} MODE`, BX, BY, BW, BH, _onToggleControls, 'dim');
  }

  // Swipe-down hint
  ctx.fillStyle   = T.textDim;
  ctx.font        = '10px monospace';
  ctx.textAlign   = 'center';
  ctx.fillText('Tap anywhere to resume', _W / 2, PY + PH - 10);

  // Save success overlay (centered inside pause panel)
  if (_saveMessageTimer > 0) {
    console.log('[Screens] displaying save success overlay, timer:', _saveMessageTimer);
    const msg = 'SAVE SUCCESSFUL';
    const msgW = 200, msgH = 40;
    // Fixed position at top center of canvas for visibility
    const msgX = _W / 2 - msgW / 2;
    const msgY = 20;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(msgX, msgY, msgW, msgH);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(msgX, msgY, msgW, msgH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, _W / 2, msgY + msgH / 2);
    ctx.textBaseline = 'alphabetic';
    _saveMessageTimer--;
  }

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
  _drawNoiseBorder(0,  _W);
  _drawNoiseBorder(_H - 1, _W);

  const BW = 220, BH = 48, GAP = 14;
  const PW = 300, PH = 260;
  const PX = _W / 2 - PW / 2;
  const PY = _H / 2 - PH / 2 + 10;

  _drawPanel(PX, PY, PW, PH, 'rgba(190,24,93,0.3)');
  _drawCorners(PX, PY, PW, PH);

  // ── Title ──
  ctx.fillStyle = T.accentHot;
  ctx.font      = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('// POWER DEPLETED //', _W / 2, PY + 22);

  ctx.shadowColor = T.accentHot;
  ctx.shadowBlur  = 18;
  ctx.fillStyle   = '#fda4af';
  ctx.font        = 'bold 28px monospace';
  ctx.fillText('CRITICAL FAILURE', _W / 2, PY + 54);
  ctx.shadowBlur  = 0;

  // Score strip
  ctx.fillStyle = T.textDim;
  ctx.fillRect(PX + 1, PY + 68, PW - 2, 1);

  ctx.fillStyle   = '#fff';
  ctx.font        = '14px monospace';
  ctx.textAlign   = 'center';
  ctx.fillText(`SCORE  ${Math.floor(score)}`, _W / 2, PY + 86);

  if (isNewHighScore) {
    ctx.shadowColor = T.accentYellow;
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = T.accentYellow;
    ctx.font        = 'bold 13px monospace';
    ctx.fillText('★  NEW RECORD  ★', _W / 2, PY + 106);
    ctx.shadowBlur  = 0;
  } else {
    ctx.fillStyle = T.textSecond;
    ctx.font      = '12px monospace';
    ctx.fillText(`BEST  ${Math.floor(highScore)}`, _W / 2, PY + 106);
  }

  ctx.fillStyle = T.textDim;
  ctx.fillRect(PX + 1, PY + 116, PW - 2, 1);

  // ── Buttons ──
  const BX = _W / 2 - BW / 2;
  let BY   = PY + 132;

  _drawButton('⚡  RESTART',    BX, BY, BW, BH, _onRestart, 'hot');
  BY += BH + GAP;
  _drawButton('📂  LOAD GAME', BX, BY, BW, BH, _onLoad,    'dim');
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

    const PW = 420, PH = 200;
    const PX = _W / 2 - PW / 2;
    const PY = _H / 2 - PH / 2;

    _drawPanel(PX, PY, PW, PH, 'rgba(239,68,68,0.25)');
    _drawCorners(PX, PY, PW, PH);

    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur  = 16;
    ctx.fillStyle   = '#fca5a5';
    ctx.font        = 'bold 22px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('HARDWARE UNSUPPORTED', _W / 2, PY + 56);
    ctx.shadowBlur  = 0;

    ctx.fillStyle   = T.textSecond;
    ctx.font        = '12px monospace';
    ctx.fillText('Battery Status API not available', _W / 2, PY + 86);
    ctx.fillText('Use Chrome or Edge on Android / macOS / Windows', _W / 2, PY + 106);

    ctx.fillStyle = T.textDim;
    ctx.fillRect(PX + 1, PY + 118, PW - 2, 1);

    ctx.fillStyle = T.accentCyan;
    ctx.font      = '11px monospace';
    ctx.fillText('Critical Charge requires a real battery sensor to play.', _W / 2, PY + 138);
    ctx.fillText('iOS Safari and Firefox do not support this API.', _W / 2, PY + 156);
}

// Exported helper to trigger save success overlay
export function triggerSaveMessage() {
    _saveMessageTimer = 120; // display for ~2 seconds at 60fps
}

// Exported helper to render save overlay (used in engine loop for desktop)
export function renderSaveOverlay() {
    if (_saveMessageTimer <= 0) return;
    const ctx = _ctx;
    // Draw overlay at top‑center of canvas for desktop visibility
    const msg = 'SAVE SUCCESSFUL';
    const msgW = 200, msgH = 40;
    const msgX = _W / 2 - msgW / 2;
    const msgY = 20;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(msgX, msgY, msgW, msgH);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(msgX, msgY, msgW, msgH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, _W / 2, msgY + msgH / 2);
    ctx.textBaseline = 'alphabetic';
    _saveMessageTimer--;
}