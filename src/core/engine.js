// src/core/engine.js
// Core game engine — game state, physics, obstacle logic, rendering pipeline.
// UI screens (pause, game over) are delegated to src/ui/screens.js
// HUD (score, battery, pause button) is delegated to src/ui/hud.js
// Input is read from src/core/input.js — this file never touches event listeners.

import { getBatteryLevel, getBatterySpeed, wirusState, resetWirusCount } from './battery.js';
import { assetCache } from '../systems/asset-cache.js';
import { inputState, getControlMethod, setControlMethod } from './input.js';
import { saveGameData, loadSavedGameData, wipeAllData } from '../systems/save-system.js';
import {
  BGM_TRACKS,
  DEFAULT_SCROLL_SPEED,
  DEFAULT_CAMERA_X_OFFSET,
  DEFAULT_TRACK_HALF_WIDTH,
  DEFAULT_GRAVITY,
  DEFAULT_JUMP_FORCE,
  DEFAULT_SPAWN_RATE,
  OBSTACLE_START_Z,
  DEBUG,
} from '../constants.js';
import {
  initScreens,
  renderPauseScreen as _renderPause,
  renderGameOverScreen as _renderGameOver,
  clearScreenButtons,
  triggerSaveMessage,
  triggerLoadErrorMessage,
  triggerLoadSuccessMessage,
  renderSaveOverlay,
  renderHijackedScreen,
  renderCorruptedScreen,
  renderUnsupportedScreen,
} from '../ui/screens.js';
import { initHUD, renderHUD as _renderHUD } from '../ui/hud.js';
import {
  resetScore,
  updateScore,
  getCurrentScore,
  getSessionHighScore,
  finalizeScore,
  setScore,
} from '../systems/score.js';
import { checkAllCollisions } from './physics.js';
import {
  resetObstacles,
  spawnRandomObstacle,
  updateAndGetObstacles,
  setObstacles,
} from '../systems/obstacle-manager.js';
import { resetPlayer, updatePlayer, renderPlayer, getPlayerJumpHeight } from './player.js';
import { playSound, playBGM, pauseBGM, stopBGM, setBGMRate, toggleMute, getMuteState } from '../systems/audio.js';
import {
  hapticTap,
  hapticCrash,
  startHijackedHaptics,
  startCorruptedHaptics,
  stopHaptics,
} from '../systems/haptics.js';
import { renderRoad, renderObstacles, renderSpeedTrails } from './renderer.js';

// ── Canvas / context ─────────────────────────────────────────────────────────
let ctx;
let canvas;
let canvasWidth;
let canvasHeight;

// ── Renderer config (exported so test pages can override) ────────────────────
export let SCROLL_SPEED = DEFAULT_SCROLL_SPEED;
export let CAMERA_X_OFFSET = DEFAULT_CAMERA_X_OFFSET;
export let HORIZON_Y = 0; // set to canvasHeight/2 - 200 on boot
export let TRACK_HALF_WIDTH = DEFAULT_TRACK_HALF_WIDTH;

export function setRendererConfig(config) {
  if (config.scrollSpeed !== undefined) SCROLL_SPEED = config.scrollSpeed;
  if (config.cameraX !== undefined) CAMERA_X_OFFSET = config.cameraX;
  if (config.horizonY !== undefined) HORIZON_Y = config.horizonY;
  if (config.trackHalf !== undefined) TRACK_HALF_WIDTH = config.trackHalf;
}

// ── Physics config ───────────────────────────────────────────────────────────
export let GRAVITY = DEFAULT_GRAVITY;
export let JUMP_FORCE = DEFAULT_JUMP_FORCE;

export function setEngineConfig(config) {
  if (config.jumpForce !== undefined) JUMP_FORCE = config.jumpForce;
  if (config.gravity !== undefined) GRAVITY = config.gravity;
}

// ── Spawn config ─────────────────────────────────────────────────────────────
export let spawnTimer = 0;
export let SPAWN_RATE = DEFAULT_SPAWN_RATE;

export function setSpawnRate(rate) {
  SPAWN_RATE = rate;
}

// ── Game state ───────────────────────────────────────────────────────────────
let trackPosition = 0;
let lastTime = 0;
let obstacles = [];
let isGameOver = false;
let isPaused = false;
let lastWirusState = 'clean';
let hasFinalizedScore = false;
let currentIsNewRecord = false;

// ── MULTIPLE BGM CONFIGURATION ──
const bgmTracks = BGM_TRACKS;

let currentTrackIndex = 0;
let autoMusicTier = -1; // Tracks which battery phase we are currently in
let isManualMusicOverride = false; // Lets the player manually switch without the engine forcing it back

export function cycleMusic() {
  isManualMusicOverride = true; // Tell the engine the player took manual control!
  currentTrackIndex = (currentTrackIndex + 1) % bgmTracks.length;
  playBGM(bgmTracks[currentTrackIndex].id);
  if (DEBUG) console.log(`[Audio] Manual override. Switched track to: ${bgmTracks[currentTrackIndex].id}`);
}

// ── Boot ─────────────────────────────────────────────────────────────────────
export function startEngine(canvasParam) {
  canvas = canvasParam;
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  canvasWidth = canvas.width;
  canvasHeight = canvas.height;

  // Wire screens.js — it owns all overlay pointer handling
  initScreens(canvas, {
    // Resume only if the game is currently paused to avoid toggling unintentionally on taps during active play
    onResume: () => {
      if (isPaused) togglePause();
    },
    onRestart: () => startEngine(canvas),
    onSave: () => saveGame(),
    onLoad: () => loadSavedGame(),
    onNextSong: () => cycleMusic(),
    onToggleMute: () => toggleMute(),
    onTestLab: () => {
      playSound('click');
      window.location.href = window.__TEST_MODE ? './index.html' : './test.html';
    },
    onToggleControls: () => {
      const next = getControlMethod() === 'swipe' ? 'tilt' : 'swipe';
      if (DEBUG) console.log('[Engine] Toggling control method from', getControlMethod(), 'to', next);
      setControlMethod(next);
      // Re-render pause screen to reflect updated control method label
      _renderPause(getCurrentScore(), getSessionHighScore(), getMuteState());
    },
  });
  // Ensure no stale button registrations persist across restarts
  clearScreenButtons();

  // Wire hud.js — it owns the pause button pointer handling
  initHUD(canvas, {
    onPause: () => {
      playSound('click');
      hapticTap();
      togglePause();
    },
  });

  // Reset all game state
  resetScore();
  isGameOver = false;
  isPaused = false;
  resetObstacles();
  obstacles = [];
  trackPosition = 0;
  spawnTimer = 0;
  resetPlayer();
  resetWirusCount();
  lastWirusState = 'clean';
  hasFinalizedScore = false;
  currentIsNewRecord = false;
  // ── Auto-Detect Starting Track ──
  isManualMusicOverride = false; // Reset manual control on fresh runs
  const initialLevel = getBatteryLevel();
  for (let i = 0; i < bgmTracks.length; i++) {
    if (initialLevel >= bgmTracks[i].threshold) {
      currentTrackIndex = i;
      autoMusicTier = i;
      break;
    }
  }

  stopBGM();
  // ONLY start music if the device isn't currently hijacked
  if (wirusState === 'clean') {
    playBGM(bgmTracks[currentTrackIndex].id);
  }
  stopHaptics();
  HORIZON_Y = canvasHeight / 2 - 200;

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);

  // This waits for the first click, tap, or keypress to force the music to start
  if (!window.__unlockAudioRegistered) {
    const unlockAudio = () => {
      // ── Now it plays the auto-detected track ONLY if clean ──
      if (wirusState === 'clean') {
         playBGM(bgmTracks[currentTrackIndex].id);
      }

      // Once it plays, we remove these listeners so it doesn't keep triggering
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.__unlockAudioRegistered = false;
    };

    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.__unlockAudioRegistered = true;
  }
  // ─────────────────────────────────────
}

// ── Keyboard shortcuts — call once from main.js after startEngine ─────────────
// Kept separate from input.js because these are engine commands, not game input.
export function initEngineKeyBindings() {
  if (DEBUG) console.log('[Engine] initEngineKeyBindings called');

  const handler = (e) => {
    // Ignore key repeat events to prevent rapid toggling
    if (e.repeat) return;

    // 1. Pause (P or Escape)
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (DEBUG) console.log('[Engine] pause key matched — calling togglePause');
      togglePause();
    }
  };

  window.addEventListener('keydown', handler);
}

// ── Pause / save / load ───────────────────────────────────────────────────────
export function togglePause() {
  if (DEBUG) console.log('[Engine] togglePause called', { isGameOver, isPaused: !isPaused });
  if (isGameOver) return;
  isPaused = !isPaused;
  if (DEBUG) console.log('[Engine] togglePause new isPaused state', isPaused);
  if (isPaused) {
    // Render pause overlay immediately when pausing
    _renderPause(getCurrentScore(), getSessionHighScore(), getMuteState());
  } else {
    clearScreenButtons();
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }
}

export function saveGame() {
  saveGameData(getCurrentScore(), trackPosition, obstacles);
  if (DEBUG) console.log('Game saved.');
  triggerSaveMessage();
  _renderPause(getCurrentScore(), getSessionHighScore());
}

export function loadSavedGame() {
  const data = loadSavedGameData();
  if (!data) {
    console.warn('No save file found.');
    triggerLoadErrorMessage();
    return;
  }
  setScore(data.score);

  trackPosition = data.trackPosition;

  // Send the loaded obstacles into the manager!
  setObstacles(data.obstacles);
  obstacles = data.obstacles; // Keep our local rendering reference updated

  isGameOver = false;
  isPaused = false;
  clearScreenButtons();
  triggerLoadSuccessMessage();
  lastTime = performance.now();
  render();
  requestAnimationFrame(gameLoop);
}

let _forceScreen = null; // Private variable

export function getForceScreen() {
  return _forceScreen;
}
export function setForceScreen(val) {
  _forceScreen = val;
}

// ── Main loop ─────────────────────────────────────────────────────────────────
function gameLoop(time) {
  // If forced unsupported overlay is active, render it continuously and skip game updates
  if (getForceScreen() === 'unsupported') {
    renderUnsupportedScreen();
    requestAnimationFrame(gameLoop);
    return;
  }

  // ── CHECK FOR W.I.R.U.S. INTERCEPT ──
  if (wirusState === 'corrupted') {
    if (lastWirusState !== 'corrupted') {
      // Use playBGM instead of playSound so it loops forever!
      playBGM('corrupted', 0.8);
      startCorruptedHaptics();
      lastWirusState = 'corrupted';
    }
    wipeAllData();
    resetScore();
    trackPosition = 0;
    renderCorruptedScreen();
    requestAnimationFrame(gameLoop);
    return;
  }

  if (wirusState === 'hijacked') {
    if (lastWirusState !== 'hijacked') {
      pauseBGM();
      playSound('wirus'); // Play once
      startHijackedHaptics();
      lastWirusState = 'hijacked';
    }
    resetScore();
    trackPosition = 0;
    renderHijackedScreen();
    requestAnimationFrame(gameLoop);
    return;
  }

  // Resume music if unplugged
  if (wirusState === 'clean' && lastWirusState !== 'clean') {
    // Resume whatever track matches the current battery phase
    playBGM(bgmTracks[currentTrackIndex].id);

    stopHaptics();
    lastWirusState = 'clean';
  }

  if (isGameOver) {
    // Only finalize and save the score on the very first frame of Game Over
    if (!hasFinalizedScore) {
      currentIsNewRecord = finalizeScore();
      hasFinalizedScore = true;
    }

   _renderGameOver(getCurrentScore(), getSessionHighScore(), currentIsNewRecord);
    renderSaveOverlay();

    // KEEP THE ENGINE LOOP ALIVE SO IT CAN REACT TO API TOGGLES
    requestAnimationFrame(gameLoop);
    return;
  }

  if (isPaused) {
    // Continuously render pause overlay to allow UI updates
    _renderPause(getCurrentScore(), getSessionHighScore(), getMuteState());
    requestAnimationFrame(gameLoop);
    return;
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

  // ── AUTO-SWITCH BGM BASED ON BATTERY ──
  if (!isManualMusicOverride) {
    let expectedTier = 0;

    // Check from top to bottom which threshold we are currently in
    for (let i = 0; i < bgmTracks.length; i++) {
      if (level >= bgmTracks[i].threshold) {
        expectedTier = i;
        break;
      }
    }

    // If the battery dropped to a new tier, switch the music automatically!
    if (autoMusicTier !== expectedTier) {
      autoMusicTier = expectedTier;
      currentTrackIndex = expectedTier;
      playBGM(bgmTracks[currentTrackIndex].id);
      if (DEBUG)
        console.log(`[Audio] Battery dropped below threshold. Auto-switched to: ${bgmTracks[currentTrackIndex].id}`);
    }
  }

  // ── DYNAMIC AUDIO CONFIG (Reads from current track) ──
  const activeTrack = bgmTracks[currentTrackIndex];
  const PIVOT_BATTERY = activeTrack.pivot;
  const SPEED_AT_100 = activeTrack.speedAt100;
  const SPEED_AT_PIVOT = activeTrack.speedAtPivot;
  const SPEED_AT_0 = activeTrack.speedAt0;

  // ── AUTOMATIC MATH ──
  let audioRate;
  if (level >= PIVOT_BATTERY) {
    const progress = (1.0 - level) / (1.0 - PIVOT_BATTERY);
    audioRate = SPEED_AT_100 + progress * (SPEED_AT_PIVOT - SPEED_AT_100);
  } else {
    const progress = (PIVOT_BATTERY - level) / PIVOT_BATTERY;
    audioRate = SPEED_AT_PIVOT + progress * (SPEED_AT_0 - SPEED_AT_PIVOT);
  }

  setBGMRate(audioRate);

  trackPosition += speed * dt * 50;
  updateScore(dt, speed);

  // ── Player Update (Managed by player.js) ──

  // Handle Tilt Input logic
  if (getControlMethod() === 'tilt') {
    const TILT_THRESHOLD = 0.2;
    inputState.lane = Math.abs(inputState.tiltX) > TILT_THRESHOLD ? (inputState.tiltX > 0 ? 1 : -1) : 0;
  }

  // Update the player's physics and positioning
  const laneWidth = TRACK_HALF_WIDTH * 0.9;
  updatePlayer(
    dt,
    inputState.lane,
    laneWidth,
    inputState.jumpTriggered,
    getBatteryLevel(), // Pass current battery level
  );

  inputState.jumpTriggered = false; // consume jump input each frame AFTER player.js reads it

  // ── Obstacle spawning (Managed by obstacle-manager.js) ──
  spawnTimer += dt * speed;
  if (spawnTimer > SPAWN_RATE) {
    spawnRandomObstacle(OBSTACLE_START_Z);
    spawnTimer = 0;
  }

  // ── Move obstacles ──
  obstacles = updateAndGetObstacles(dt, speed);

  // ── Collision Check ──
  const currentJumpHeight = getPlayerJumpHeight();

  if (checkAllCollisions(obstacles, inputState.lane, currentJumpHeight)) {
    isGameOver = true;
    pauseBGM();
    playSound('gameover'); // Play Game Over crash sound
    hapticCrash();
    if (DEBUG) console.log('CRASH! Game Over.');
  }
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 1. Draw Background & Environment
  renderRoad(ctx, canvasWidth, canvasHeight, HORIZON_Y, trackPosition, SCROLL_SPEED, CAMERA_X_OFFSET);

  const level = getBatteryLevel();
  const speed = getBatterySpeed(level);

  // Draw Speed Trails right over the road! ──
  renderSpeedTrails(ctx, canvasWidth, canvasHeight, HORIZON_Y, CAMERA_X_OFFSET, level);

  // 2. Draw Entities
  renderObstacles(ctx, obstacles, assetCache, canvasWidth, HORIZON_Y, CAMERA_X_OFFSET);

  const playerAsset = assetCache['player'];
  renderPlayer(ctx, playerAsset, canvasWidth, canvasHeight, HORIZON_Y, CAMERA_X_OFFSET, level, speed);

  // 3. Draw UI Overlays
  _renderHUD(getCurrentScore(), getSessionHighScore(), level, speed);
  renderSaveOverlay();

}
