// src/core/engine.js
// Core game engine — game state, physics, obstacle logic, rendering pipeline.
// UI screens (pause, game over) are delegated to src/ui/screens.js
// HUD (score, battery, pause button) is delegated to src/ui/hud.js
// Input is read from src/core/input.js — this file never touches event listeners.

import { getBatteryLevel, getBatterySpeed }             from './battery.js';
import { assetCache }                                    from '../systems/asset-cache.js';
import { inputState, getControlMethod,
         checkTiltSensor, setControlMethod }             from './input.js';
import { getHighScore, checkAndSaveHighScore,
         saveGameData, loadSavedGameData }               from '../systems/save-system.js';
import { loadSettings }                                  from '../systems/settings.js';
import { initScreens,
         renderPauseScreen     as _renderPause,
         renderGameOverScreen  as _renderGameOver,
         clearScreenButtons,
         triggerSaveMessage,
         renderSaveOverlay }                     from '../ui/screens.js';
import { initHUD,
         renderHUD             as _renderHUD }           from '../ui/hud.js';

// ── Canvas / context ─────────────────────────────────────────────────────────
let ctx;
let canvas;
let canvasWidth;
let canvasHeight;

// ── Renderer config (exported so test pages can override) ────────────────────
export let SCROLL_SPEED      = 3.0;
export let CAMERA_X_OFFSET   = 0;
export let HORIZON_Y         = 0;   // set to canvasHeight/2 - 200 on boot
export let TRACK_HALF_WIDTH  = 200;

export function setRendererConfig(config) {
  if (config.scrollSpeed  !== undefined) SCROLL_SPEED     = config.scrollSpeed;
  if (config.cameraX      !== undefined) CAMERA_X_OFFSET  = config.cameraX;
  if (config.horizonY     !== undefined) HORIZON_Y        = config.horizonY;
  if (config.trackHalf    !== undefined) TRACK_HALF_WIDTH = config.trackHalf;
}

// ── Physics config ───────────────────────────────────────────────────────────
export let GRAVITY    = -3500;
export let JUMP_FORCE = 1200;

export function setEngineConfig(config) {
  if (config.jumpForce !== undefined) JUMP_FORCE = config.jumpForce;
  if (config.gravity   !== undefined) GRAVITY    = config.gravity;
}

// ── Spawn config ─────────────────────────────────────────────────────────────
export let spawnTimer = 0;
export let SPAWN_RATE = 1.5;

export function setSpawnRate(rate) { SPAWN_RATE = rate; }

// ── Game state ───────────────────────────────────────────────────────────────
let trackPosition      = 0;
let lastTime           = 0;
let obstacles          = [];
let playerVisualX      = 0;
let playerVisualZ      = 0.75;
let playerJumpHeight   = 0;
let playerJumpVelocity = 0;
let score              = 0;
let highScore          = 0;
let isGameOver         = false;
let isPaused           = false;

// ── Boot ─────────────────────────────────────────────────────────────────────
export function startEngine(canvasParam) {
  canvas      = canvasParam;
  ctx         = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  canvasWidth  = canvas.width;
  canvasHeight = canvas.height;

  // Wire screens.js — it owns all overlay pointer handling
  initScreens(canvas, {
    // Resume only if the game is currently paused to avoid toggling unintentionally on taps during active play
    onResume:         () => { if (isPaused) togglePause(); },
    onRestart:        () => startEngine(canvas),
    onSave:           () => saveGame(),
    onLoad:           () => loadSavedGame(),
    onToggleControls: () => {
      const next = getControlMethod() === 'swipe' ? 'tilt' : 'swipe';
      console.log('[Engine] Toggling control method from', getControlMethod(), 'to', next);
      setControlMethod(next);
      // Re-render pause screen to reflect updated control method label
      _renderPause(score, highScore);
    },
  });
  // Ensure no stale button registrations persist across restarts
  clearScreenButtons();

  // Wire hud.js — it owns the pause button pointer handling
  initHUD(canvas, {
    onPause: () => togglePause(),
  });

  // Reset all game state
  highScore          = getHighScore();
  score              = 0;
  isGameOver         = false;
  isPaused           = false;
  obstacles          = [];
  trackPosition      = 0;
  spawnTimer         = 0;
  playerVisualX      = 0;
  playerJumpHeight   = 0;
  playerJumpVelocity = 0;
  HORIZON_Y          = canvasHeight / 2 - 200;

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

// ── Keyboard shortcuts — call once from main.js after startEngine ─────────────
// Kept separate from input.js because these are engine commands, not game input.
export function initEngineKeyBindings() {
  console.log('[Engine] initEngineKeyBindings called');
  const handler = e => {
    // Ignore key repeat events to prevent rapid toggling
    if (e.repeat) return;
    console.log('[Engine] keydown', { key: e.key, code: e.code, isGameOver, isPaused });
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      console.log('[Engine] pause key matched — calling togglePause');
      _debugKeyPress = 'P';  // visual debug
      _debugKeyTime = Date.now();
      togglePause();
    }
    if (e.code === 'Space' && isGameOver) {
      startEngine(canvas);
    }
    if (e.key === 'l' || e.key === 'L') {
      loadSavedGame();
    }
  };
  document.addEventListener('keydown', handler);
  window.addEventListener('keydown', handler);
}

// Simple fallback key listener for "p" to ensure pause works
window.addEventListener('keydown', e => {
  if (e.key === 'p' || e.key === 'P') {
    console.log('[Engine] fallback p key pressed');
    togglePause();
  }
});

// For debugging: show alert on "p" press (removed)

// ── Debug key-press visual state ──────────────────────────────
let _debugKeyPress = null;
let _debugKeyTime = 0;

// Global keydown listener for debug overlay (test harness only)
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', e => {
    if (window.__SHOW_DEBUG) {
      _debugKeyPress = e.key;
      _debugKeyTime = Date.now();
    }
  });
}

// ── Pause / save / load ───────────────────────────────────────────────────────
export function togglePause() {
  console.log('[Engine] togglePause called', { isGameOver, isPaused: !isPaused });
  if (isGameOver) return;
  isPaused = !isPaused;
  console.log('[Engine] togglePause new isPaused state', isPaused);
  if (isPaused) {
    // Render pause overlay immediately when pausing
    _renderPause(score, highScore);
  } else {
    // Clear any lingering UI buttons from pause screen
    clearScreenButtons();
    lastTime = performance.now(); // prevent dt spike on resume
    requestAnimationFrame(gameLoop);
  }
}

export function saveGame() {
  saveGameData(score, trackPosition, obstacles);
  console.log('Game saved.');
  triggerSaveMessage();
  // Re-render pause screen to display the save success overlay
  _renderPause(score, highScore);
}

export function loadSavedGame() {
  const data = loadSavedGameData();
  if (!data) { console.warn('No save file found.'); return; }
  score         = data.score;
  trackPosition = data.trackPosition;
  obstacles     = data.obstacles;
  isGameOver    = false;
  // Immediately resume after loading; no need for pause button
  isPaused      = false;
  // Clear any lingering UI button registrations (e.g., from pause or game‑over screens)
  clearScreenButtons();
  lastTime      = performance.now();
  // Render one frame then continue game loop
  render();
  requestAnimationFrame(gameLoop);
}

// ── Main loop ─────────────────────────────────────────────────────────────────
function gameLoop(time) {
  if (isGameOver) {
    checkAndSaveHighScore(score);
    highScore = getHighScore();
    _renderGameOver(score, highScore, checkAndSaveHighScore(score));
    return; // stop scheduling
  }

  if (isPaused) {
    // Continuously render pause overlay to allow UI updates (e.g., save success message)
    _renderPause(score, highScore);
    // Render save overlay on top of pause screen
    renderSaveOverlay();
    requestAnimationFrame(gameLoop);
    return; // keep scheduling while paused
  }

  const dt = Math.min((time - lastTime) / 1000, 0.05); // cap dt at 50ms
  lastTime = time;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  const level = getBatteryLevel();
  const speed = getBatterySpeed(level);

  trackPosition += speed * dt * 50;
  score         += speed * dt * 10;

  // ── Jump trigger ──
  if (inputState.jumpTriggered && playerJumpHeight <= 0) {
    playerJumpVelocity = JUMP_FORCE;
  }
  inputState.jumpTriggered = false; // consume each frame

  // ── Lane control ──
  if (getControlMethod() === 'tilt') {
    const TILT_THRESHOLD = 0.2;
    if (Math.abs(inputState.tiltX) > TILT_THRESHOLD) {
      inputState.lane = inputState.tiltX > 0 ? 1 : -1;
    } else {
      // Reset to middle lane when tilt is neutral
      inputState.lane = 0;
    }
    // Diagnostic logging
    if (typeof window !== 'undefined' && window.__SHOW_DEBUG) {
      console.log('[Engine] tiltX:', inputState.tiltX.toFixed(3), 'lane:', inputState.lane);
    }
  }
  // Swipe mode: inputState.lane is already set by input.js event handlers

  // ── Jump physics ──
  if (playerJumpHeight >= 0) {
    playerJumpHeight   += playerJumpVelocity * dt;
    playerJumpVelocity += GRAVITY * dt;
    if (playerJumpHeight < 0) {
      playerJumpHeight   = 0;
      playerJumpVelocity = 0;
    }
  }

  // ── Obstacle spawning ──
  spawnTimer += dt * speed;
  if (spawnTimer > SPAWN_RATE) {
    obstacles.push({
      z:    5.0,
      lane: Math.floor(Math.random() * 3) - 1,
      type: 'barricade',
    });
    spawnTimer = 0;
  }

  // ── Move obstacles + collision ──
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].z -= dt * speed * 0.4;

    // Collision window
    if (obstacles[i].z < 0.08 && obstacles[i].z > 0.02) {
      if (obstacles[i].lane === inputState.lane && playerJumpHeight < 50) {
        isGameOver = true;
      }
    }

    if (obstacles[i].z < 0.02) {
      obstacles.splice(i, 1);
    }
  }
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  _renderRoad();
  _renderObstacles();
  _renderPlayer();

  // Delegate HUD to hud.js (draws score, battery, pause button, critical flash)
  const level = getBatteryLevel();
  const speed = getBatterySpeed(level);
  _renderHUD(score, highScore, level, speed);
  // Render save success overlay if active (desktop view)
  renderSaveOverlay();

  // ── Debug: show key-press indicator ────────────────────────
  if (typeof window !== 'undefined' && window.__SHOW_DEBUG && _debugKeyPress && Date.now() - _debugKeyTime < 1500) {
    ctx.fillStyle = 'rgba(0,255,0,0.9)';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`KEY: ${_debugKeyPress}`, canvasWidth / 2, canvasHeight - 40);
  }
}

// ── Road ──────────────────────────────────────────────────────────────────────
function _renderRoad() {
  const horizonY = HORIZON_Y;

  // Horizon glow line
  ctx.fillStyle = '#8000ff';
  ctx.fillRect(0, horizonY - 1, canvasWidth, 2);

  const step = 3;
  for (let y = horizonY; y < canvasHeight; y += step) {
    const distance  = 100 / (y - horizonY + 1);
    const scale     = 1.5 / distance;
    const roadWidth = 20 + 125 * scale;
    const textureY  = distance * 200 + trackPosition * SCROLL_SPEED;
    const isDark    = Math.floor(textureY / 40) % 2 === 0;
    const cx        = canvasWidth / 2 + CAMERA_X_OFFSET;
    const rw        = roadWidth / 2;

    ctx.fillStyle = isDark ? '#111115' : '#1a1a20';
    ctx.fillRect(cx - rw, y, roadWidth, step);

    // Purple edge stripes
    ctx.fillStyle = isDark ? '#8000ff' : '#333333';
    ctx.fillRect(cx - rw - 15, y, 15, step);
    ctx.fillRect(cx + rw,      y, 15, step);
  }
}

// ── Obstacles ─────────────────────────────────────────────────────────────────
function _renderObstacles() {
  const horizonY = HORIZON_Y;

  obstacles.sort((a, b) => b.z - a.z);

  for (const obs of obstacles) {
    if (obs.z > 2.0 || obs.z < 0.05) continue;

    const visualZ   = Math.max(obs.z, 0.05);
    const scale     = 1 / (visualZ / 0.5);
    const baseW     = 50, baseH = 50;
    const w         = baseW * scale;
    const h         = baseH * scale;
    const laneBase  = 20;
    const screenX   = (canvasWidth / 2 + CAMERA_X_OFFSET) + (obs.lane * laneBase * scale);
    const screenY   = horizonY + (100 * scale);

    const asset = assetCache[obs.type];
    if (asset) {
      const frameIndex = Math.floor(Date.now() / 150) % 5;
      const FRAME_SIZE = 120;
      ctx.drawImage(
        asset,
        frameIndex * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE,
        screenX - w / 2, screenY - h, w, h
      );
    }
  }
}

// ── Player ────────────────────────────────────────────────────────────────────
function _renderPlayer() {
  const horizonY  = HORIZON_Y;
  const laneWidth = TRACK_HALF_WIDTH * 0.9;
  const targetX   = inputState.lane * laneWidth;
  playerVisualX  += (targetX - playerVisualX) * 0.25;

  const playerAsset = assetCache['player'];
  if (!playerAsset) return;

  const FRAME_SIZE = 120;
  const level      = getBatteryLevel();

  // Row = battery tier
  let row = 0;
  if      (level < 0.25) row = 2;
  else if (level < 0.50) row = 2;
  else if (level < 0.75) row = 1;
  else                   row = 0;

  // Frame index
  let frameIndex;
  if (playerJumpHeight > 0) {
    const peakJumpHeight = 300;
    const progress       = Math.min(1, Math.abs(playerJumpHeight) / peakJumpHeight);
    const isAscending    = playerJumpVelocity > 0;

    if (isAscending) {
      frameIndex = 5 + Math.floor(progress * 2.99);
    } else {
      const descentProgress = 1 - progress;
      frameIndex = 8 + Math.floor(descentProgress * 1.99);
    }
    frameIndex = Math.max(5, Math.min(9, frameIndex));
  } else {
    const speed        = getBatterySpeed(level);
    const animSpeed    = Math.max(50, 150 / (speed * 0.5));
    frameIndex         = Math.floor(Date.now() / animSpeed) % 5;
  }

  // Screen position
  const scale    = 0.5 + playerVisualZ * 0.5;
  const drawSize = 250 * scale;
  const pScreenX = (canvasWidth / 2 + CAMERA_X_OFFSET) + playerVisualX * scale;
  const pScreenY = horizonY + (canvasHeight - horizonY) * playerVisualZ - drawSize / 2 - playerJumpHeight;

  // Jump shadow
  if (playerJumpHeight > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(
      pScreenX,
      horizonY + (canvasHeight - horizonY) * playerVisualZ + drawSize / 2,
      18 * scale, 7 * scale, 0, 0, Math.PI * 2
    );
    ctx.fill();
  }

  ctx.drawImage(
    playerAsset,
    frameIndex * FRAME_SIZE, row * FRAME_SIZE,
    FRAME_SIZE, FRAME_SIZE,
    pScreenX - 125, pScreenY, 250, 250
  );
}