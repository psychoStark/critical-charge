// src/ui/hud.js
// ─────────────────────────────────────────────────────────────────────────────
// In-game HUD only — drawn every frame while game is running.
// No overlays, no buttons that need hit-testing.
// The pause button IS a registered button so tapping it reliably works.
// ─────────────────────────────────────────────────────────────────────────────

import {
  HUD_PANEL_W,
  HUD_PANEL_H,
  HUD_PADDING,
  HUD_BAR_H,
  PAUSE_BTN_W,
  PAUSE_BTN_H,
  DEBUG,
} from '../constants.js';
import { THEME } from '../theme.js';
import { getScanlinePattern } from '../utils/graphics.js';

// ── Module state ─────────────────────────────────────────────────────────────
let _ctx = null;
let _W = 640;
let _H = 360;
let _onPause = () => {};

// Pause button bounding box in canvas-space (rebuilt each frame)
let _pauseBtn = { x: 0, y: 0, w: 0, h: 0 };

// ── Debug overlay state ────────────────────────────────────────
let _debugTap = null; // { x, y, time } — last tap position
let _debugHit = false; // whether last tap hit the button

// ── Init ─────────────────────────────────────────────────────────────────────
export function initHUD(canvas, callbacks = {}) {
  _ctx = canvas.getContext('2d');
  _W = canvas.width;
  _H = canvas.height;
  _onPause = callbacks.onPause ?? (() => {});

  // Single pointer listener for the pause button only.
  // Checked against the bbox drawn last frame — no stale coords.
  // Ensure we only add the listener once per canvas.
  if (typeof window !== 'undefined' && !window.__hudListenerAdded) {
    canvas.addEventListener('pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
      const offsetX = (rect.width - canvas.width * scale) / 2;
      const offsetY = (rect.height - canvas.height * scale) / 2;
      const x = (e.clientX - rect.left - offsetX) / scale;
      const y = (e.clientY - rect.top - offsetY) / scale;
      const b = _pauseBtn;
      _debugTap = { x, y, time: Date.now() };
      const hit = x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
      if (DEBUG) console.log('[HUD] pointerdown', { x, y, hit, button: b });
      if (hit) {
        _debugHit = true;
        e.stopPropagation();
        _onPause();
      } else {
        _debugHit = false;
      }
    });
    window.__hudListenerAdded = true;
    if (DEBUG) console.log('[HUD] pointer listener added');
  }
}

// ── Main draw call — called by renderHUD() in engine.js ──────────────────────
export function renderHUD(score, highScore, batteryLevel, speed) {
  const ctx = _ctx;
  const percent = Math.round(batteryLevel * 100);

  // ── Top-left: Score panel ─────────────────────────────────────────────────
  _drawHudPanel(HUD_PADDING, HUD_PADDING, HUD_PANEL_W, HUD_PANEL_H);
  ctx.textAlign = 'left';
  ctx.fillStyle = THEME.accentYellow;
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`${Math.floor(score)}`, 22, 32);
  ctx.fillStyle = THEME.textSecond;
  ctx.font = '10px monospace';
  ctx.fillText('SCORE', 22, 47);

  ctx.fillStyle = THEME.textDim;
  ctx.font = '10px monospace';
  ctx.fillText(`HI  ${Math.floor(highScore)}`, 90, 32);

  // ── Top-right: Battery panel ──────────────────────────────────────────────
  _drawHudPanel(_W - HUD_PANEL_W - HUD_PADDING, HUD_PADDING, HUD_PANEL_W, HUD_PANEL_H);
  const battColor =
    percent <= 20 ? THEME.battCrit : percent <= 40 ? THEME.battLow : percent <= 70 ? THEME.battMid : THEME.battFull;

  ctx.textAlign = 'right';
  ctx.fillStyle = battColor;
  if (percent <= 20) {
    // Pulsing glow on critical battery
    ctx.shadowColor = battColor;
    ctx.shadowBlur = 12 + Math.sin(Date.now() / 200) * 6;
  }
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`${percent}%`, _W - 22, 32);
  ctx.shadowBlur = 0;

  ctx.fillStyle = THEME.textSecond;
  ctx.font = '10px monospace';
  ctx.fillText('BATTERY', _W - 22, 47);

  // Velocity sub-label
  ctx.fillStyle = THEME.textDim;
  ctx.font = '10px monospace';
  ctx.fillText(`${speed.toFixed(1)}×`, _W - 90, 32);

  // Battery fill bar (thin strip under the panel)
  const barW = HUD_PANEL_W;
  const barX = _W - HUD_PANEL_W - HUD_PADDING;
  const barY = HUD_PANEL_H + HUD_PADDING + 2;
  const barH = HUD_BAR_H;
  ctx.fillStyle = THEME.borderPanel;
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = battColor;
  ctx.fillRect(barX, barY, Math.round(barW * batteryLevel), barH);

  // ── Top-center: Pause button ──────────────────────────────────────────────
  const PBW = PAUSE_BTN_W,
    PBH = PAUSE_BTN_H;
  const PBX = _W / 2 - PBW / 2;
  const PBY = HUD_PADDING;
  _pauseBtn = { x: PBX, y: PBY, w: PBW, h: PBH };

  ctx.shadowColor = THEME.accent;
  ctx.shadowBlur = 8;
  ctx.fillStyle = THEME.bgPanel;
  ctx.fillRect(PBX, PBY, PBW, PBH);
  ctx.shadowBlur = 0;

  ctx.strokeStyle = THEME.borderPanel;
  ctx.lineWidth = 1;
  ctx.strokeRect(PBX, PBY, PBW, PBH);

  ctx.fillStyle = THEME.textSecond;
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⏸  PAUSE', _W / 2, PBY + PBH / 2);
  ctx.textBaseline = 'alphabetic';

  // ── Critical battery warning strip ───────────────────────────────────────
  if (percent <= 20) {
    const pulse = (Math.sin(Date.now() / 180) + 1) / 2; // 0 → 1
    ctx.fillStyle = `rgba(244,63,94,${0.06 + pulse * 0.08})`;
    ctx.fillRect(0, 0, _W, _H);

    ctx.fillStyle = THEME.battCrit;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = THEME.battCrit;
    ctx.shadowBlur = 8;
    ctx.fillText('⚡  CRITICAL CHARGE  ⚡', _W / 2, _H - 14);
    ctx.shadowBlur = 0;
  }

  // ── Speed boost flash ─────────────────────────────────────────────────────
  if (percent <= 10) {
    ctx.fillStyle = `rgba(217,70,239,${0.04 + Math.random() * 0.04})`;
    ctx.fillRect(0, 0, _W, _H);
  }

  // ── Scanline overlay (pre-rendered, single drawImage call) ────────────────
  ctx.drawImage(getScanlinePattern(_W, _H), 0, 0);

  // ── Debug overlay: show last tap position ─────────────────
  if (typeof window !== 'undefined' && window.__SHOW_DEBUG && _debugTap && Date.now() - _debugTap.time < 2000) {
    // Crosshair at tap position
    ctx.strokeStyle = _debugHit ? '#00ff00' : '#ff0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(_debugTap.x - 10, _debugTap.y);
    ctx.lineTo(_debugTap.x + 10, _debugTap.y);
    ctx.moveTo(_debugTap.x, _debugTap.y - 10);
    ctx.lineTo(_debugTap.x, _debugTap.y + 10);
    ctx.stroke();

    // Label
    ctx.fillStyle = _debugHit ? '#00ff00' : '#ff0000';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(_debugHit ? 'HIT' : 'MISS', _debugTap.x + 14, _debugTap.y + 4);
  }
}

// ── Helper: draw a HUD panel background ──────────────────────────────────────
function _drawHudPanel(x, y, w, h) {
  const ctx = _ctx;
  ctx.shadowColor = THEME.accent;
  ctx.shadowBlur = 6;
  ctx.fillStyle = THEME.bgPanel;
  ctx.fillRect(x, y, w, h);
  ctx.shadowBlur = 0;

  ctx.strokeStyle = THEME.borderPanel;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}
