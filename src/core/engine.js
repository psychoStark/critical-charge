// src/core/engine.js
// Core game engine that handles game state, physics, rendering, and gameplay mechanics.
// This file manages the main game loop, player movement, obstacle generation, collision detection,
// and visual rendering of all game elements.

import { getBatteryLevel, getBatterySpeed } from './battery.js';
import { assetCache } from '../systems/asset-cache.js';
import { inputState } from './input.js';
import { getHighScore, checkAndSaveHighScore, saveGameData, loadSavedGameData } from '../systems/save-system.js';

/**
 * 2D rendering context for the game canvas.
 * Used to draw all game elements including the player, obstacles, and environment.
 * @type {CanvasRenderingContext2D}
 */
let ctx;
// Store a reference to the canvas element used by the engine.
// This is needed for event handlers like handleCanvasClick that reference the canvas globally.
let canvas;

/**
 * Width of the game canvas in pixels.
 * Determines the horizontal boundaries for rendering game elements.
 * @type {number}
 */
let canvasWidth;

/**
 * Height of the game canvas in pixels.
 * Determines the vertical boundaries for rendering game elements.
 * @type {number}
 */
let canvasHeight;

// Renderer configuration - export these so they can be modified by test pages
export let SCROLL_SPEED = 3.0;
export let CAMERA_X_OFFSET = 0;
export let HORIZON_Y = 0; // Will be set to canvasHeight / 2 - 200 in startEngine
export let TRACK_HALF_WIDTH = 200;

/**
 * Current position along the infinite track/road.
 * This value increases as the player moves forward, creating the illusion of endless running.
 * Used to calculate road stripe positions and scrolling effects.
 * @type {number}
 */
let trackPosition = 0;

/**
 * Timestamp of the last frame update.
 * Used to calculate delta time (dt) for smooth, frame-rate-independent animations.
 * @type {number}
 */
let lastTime = 0;

/**
 * Array of active obstacles currently in the game world.
 * Each obstacle has properties like position (z), lane, and type.
 * Obstacles are spawned ahead of the player and move toward them.
 * @type {Array<{z: number, lane: number, type: string}>}
 */
let obstacles = [];

/**
 * Timer that tracks when to spawn the next obstacle.
 * Increases based on game speed; when it exceeds 1.5, a new obstacle is spawned.
 * @type {number}
 */
export let spawnTimer = 0;
export let SPAWN_RATE = 1.5;

/**
 * Visual X position of the player for smooth animation.
 * This value smoothly interpolates toward the target lane position.
 * @type {number}
 */
let playerVisualX = 0;

/**
 * Current jump height of the player in pixels.
 * When > 0, the player is jumping/airborne. When 0, the player is on the ground.
 * Directly affects the player's vertical position in the game world.
 * @type {number}
 */
let playerJumpHeight = 0;

/**
 * Current vertical velocity of the player's jump.
 * Positive values mean upward movement, negative values mean downward movement.
 * Modified by gravity each frame to create realistic jump arcs.
 * @type {number}
 */
let playerJumpVelocity = 0;

/**
 * Gravity constant that pulls the player downward during jumps.
 * Higher absolute values create stronger gravity and shorter jumps.
 * @type {number}
 */
export let GRAVITY = -2500;

/**
 * Initial upward force applied when the player jumps.
 * Higher values create higher, longer jumps.
 * @type {number}
 */
export let JUMP_FORCE = 800;

/**
 * Player's current score, based on distance traveled.
 * Increases continuously as the player moves forward.
 * Higher speeds (from low battery) increase the score faster.
 * @type {number}
 */
let score = 0;
let highScore = 0;

/**
 * Game state flag indicating whether the game is over.
 * When true, the game loop stops updating and shows the game over screen.
 * @type {boolean}
 */
let isGameOver = false;
let isPaused = false;

// Button states for pause and game over screens
let pauseButtonState = { resume: false, load: false, save: false };
let gameOverButtonState = { restart: false, load: false };

/**
 * Initializes the game engine and starts a new game session.
 * Resets all game state variables to their initial values and begins the game loop.
 *
 * @param {HTMLCanvasElement} canvas - The canvas element to render the game on
 */
export function startEngine(canvasParam) {
  // Initialize the 2D rendering context for drawing game elements
  // Save the canvas reference for later use (e.g., click handling)
  canvas = canvasParam;
  ctx = canvas.getContext('2d');
  console.log('Engine started with canvas', canvas.width, canvas.height);
  
  // Store canvas dimensions for use in rendering calculations
  canvasWidth = canvas.width;
  canvasHeight = canvas.height;

  // Add click handling for UI buttons on pause and game over screens
  canvas.addEventListener('click', handleCanvasClick);

  // Initialize high score from storage on bootstrap
  highScore = getHighScore();

  // Reset all game state variables to their initial values
  score = 0; // Reset player score to zero
  isGameOver = false; // Clear game over state to start fresh

  // Initialize renderer constants based on canvas dimensions
  HORIZON_Y = canvasHeight / 2 - 200;
  isPaused = false;         // Ensure the game starts unpaused
  obstacles = [];           // Remove all existing obstacles from the game world
  trackPosition = 0;        // Reset track position to the starting point
  spawnTimer = 0;           // Reset obstacle spawn timer
  playerVisualX = 0;        // Reset player's visual X position (center lane)
  playerJumpHeight = 0;     // Reset player's jump height (on the ground)
  playerJumpVelocity = 0;   // Reset player's jump velocity (stationary)

  // Initialize the game loop with the current timestamp
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

/**
 * Handle mouse clicks on the canvas to activate UI buttons when the game is paused
 * or when the game over screen is displayed.
 */
function handleCanvasClick(event) {
  const rect = canvas.getBoundingClientRect();
  // Translate mouse coordinates to canvas space (account for internal resolution scaling)
  const x = (event.clientX - rect.left) * (canvas.width / rect.width);
  const y = (event.clientY - rect.top) * (canvas.height / rect.height);

  const buttonWidth = 200;
  const buttonHeight = 50;
  const buttonSpacing = 20;

  // Pause screen buttons are centered vertically at canvasHeight/2
  const pauseStartX = canvasWidth / 2 - buttonWidth / 2;
  let pauseStartY = canvasHeight / 2 - buttonHeight - buttonSpacing / 2; // Adjusted to make space for save button above resume

  // Game over screen buttons start a bit lower
  const overStartX = canvasWidth / 2 - buttonWidth / 2;
  const overStartY = canvasHeight / 2 + 20;

  if (isPaused) {
    // Save button
    if (x >= pauseStartX && x <= pauseStartX + buttonWidth &&
        y >= pauseStartY && y <= pauseStartY + buttonHeight) {
      saveGame();
      return;
    }
    // Resume button
    pauseStartY = canvasHeight / 2; // Reset for resume and load button
    if (x >= pauseStartX && x <= pauseStartX + buttonWidth &&
        y >= pauseStartY && y <= pauseStartY + buttonHeight) {
      togglePause();
      return;
    }
    // Load button
    if (x >= pauseStartX && x <= pauseStartX + buttonWidth &&
        y >= pauseStartY + buttonHeight + buttonSpacing &&
        y <= pauseStartY + buttonHeight + buttonSpacing + buttonHeight) {
      loadSavedGame();
      return;
    }
  }

  if (isGameOver) {
    // Restart button
    if (x >= overStartX && x <= overStartX + buttonWidth &&
        y >= overStartY && y <= overStartY + buttonHeight) {
      // Restart the game by reinitializing the engine
      startEngine(canvas);
      return;
    }
    // Load button on game over
    if (x >= overStartX && x <= overStartX + buttonWidth &&
        y >= overStartY + buttonHeight + buttonSpacing &&
        y <= overStartY + buttonHeight + buttonSpacing + buttonHeight) {
      loadSavedGame();
      return;
    }
  }
}

/**
 * Toggles the running clock of the loop.
 */
export function togglePause() {
  if (isGameOver) return; // Can't pause if dead
  
  isPaused = !isPaused;
  if (!isPaused) {
    // Unpausing requires correcting lastTime so game objects don't jump gaps
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }
}

/**
 * Manually saves the current game state.
 */
export function saveGame() {
  saveGameData(score, trackPosition, obstacles);
  console.log("Game state saved manually.");
}

/**
 * Loads manual save file data and rewrites runtime state variables
 */
export function setEngineConfig(config) {
  if (config.jumpForce !== undefined) JUMP_FORCE = config.jumpForce;
  if (config.gravity !== undefined) GRAVITY = config.gravity;
}

export function loadSavedGame() {
  const saveData = loadSavedGameData();
  if (!saveData) {
    console.warn("No save file detected!");
    return;
  }
  
  score = saveData.score;
  trackPosition = saveData.trackPosition;
  obstacles = saveData.obstacles;
  isGameOver = false;
  isPaused = true; // Stay paused on load so they have time to breathe
  
  // Force a single visual frame update to show loaded metrics
  lastTime = performance.now();
  render();
}

/**
 * Main game loop that runs every frame using requestAnimationFrame.
 * Handles frame-rate-independent updates, game logic, and rendering.
 *
 * @param {number} time - Current timestamp from requestAnimationFrame
 */
function gameLoop(time) {
  // If game is over, only render the game over screen and stop updates
  if (isGameOver) {
    // Check if the death score ranks as a record
    checkAndSaveHighScore(score);
    highScore = getHighScore();
    renderGameOver();
    return; // Stop the loop!
  }

  // If paused, render the pause screen and halt physics updates
  if (isPaused) {
    renderPauseScreen();
    return; 
  }

  // Calculate delta time (dt) in seconds since the last frame
  const dt = (time - lastTime) / 1000;
  lastTime = time;

  // Update game state based on the elapsed time
  update(dt);
  
  // Render the current game state to the canvas
  render();

  // Schedule the next frame to continue the game loop
  requestAnimationFrame(gameLoop);
}

export function setSpawnRate(rate) {
  SPAWN_RATE = rate;
}

function update(dt) {
  // Get current battery level and calculate game speed based on it
  const level = getBatteryLevel();
  const speed = getBatterySpeed(level);

  trackPosition += speed * dt * 300;
  score += speed * dt * 10;

  // ── JUMP PHYSICS ──
  if (inputState.jumpTriggered && playerJumpHeight <= 0) {
    playerJumpVelocity = JUMP_FORCE; // blast off!
  }
  inputState.jumpTriggered = false;

  if (playerJumpHeight >= 0) {
    playerJumpHeight += playerJumpVelocity * dt;
    playerJumpVelocity += GRAVITY * dt;

    if (playerJumpHeight < 0) {
      playerJumpHeight = 0;
      playerJumpVelocity = 0;
    }
  }

  // ── OBSTACLE SPAWNING ──
  spawnTimer += dt * speed;
  if (spawnTimer > SPAWN_RATE) {
    obstacles.push({
      z: 1.0,
      lane: Math.floor(Math.random() * 3) - 1,
      type: 'barricade'
    });
    spawnTimer = 0;
  }

  // ── MOVE OBSTACLES & CHECK COLLISIONS ──
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].z -= dt * speed * 0.4; 
    
    // The player is actually standing at Z = 0.14 based on the 1280px screen height.
    if (obstacles[i].z < 0.14 && obstacles[i].z > 0.10) {
      if (obstacles[i].lane === inputState.lane) {
        // If your jump height isn't over 50, you crash!
        if (playerJumpHeight < 50) {
          isGameOver = true;
          console.log("CRASH! Game Over.");
        }
      }
    }

    // Let the obstacle travel further off-screen before culling it
    if (obstacles[i].z < 0.02) {
      obstacles.splice(i, 1); 
    }
  }
}

function render() {
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const horizonY = HORIZON_Y;

  ctx.fillStyle = '#8000ff';
  ctx.fillRect(0, horizonY - 1, canvasWidth, 2);

  const step = 3;

  for (let y = horizonY; y < canvasHeight; y += step) {
    const distance = 100 / (y - horizonY + 1);
    const scale = 1 / distance;
    const roadWidth = 60 + (250 * scale);
    const textureY = distance * 200 + trackPosition * SCROLL_SPEED;

    const isDark = Math.floor(textureY / 40) % 2 === 0;
    const cx = canvasWidth / 2 + CAMERA_X_OFFSET;
    const rw = roadWidth / 2;

    ctx.fillStyle = isDark ? '#111115' : '#1a1a20';
    ctx.fillRect(cx - rw, y, roadWidth, step);
    
    ctx.fillStyle = isDark ? '#8000ff' : '#333333';
    ctx.fillRect(cx - rw - 15, y, 15, step); // Left edge
    ctx.fillRect(cx + rw, y, 15, step);      // Right edge
  }

  // ── OBSTACLE RENDER LOGIC ──
  obstacles.sort((a, b) => b.z - a.z);

  for (const obs of obstacles) {
    if (obs.z > 1.0 || obs.z < 0.02) continue;

    const visualZ = Math.max(obs.z, 0.02);
    const scale = 1 / visualZ;

    const baseW = 25;
    const baseH = 25;
    const w = baseW * scale;
    const h = baseH * scale;

    const laneOffsetTop = obs.lane * 50;
    const laneOffsetGrows = obs.lane * 7;
    const screenX = (canvasWidth / 2 + CAMERA_X_OFFSET) + laneOffsetTop + (laneOffsetGrows * scale);
    const screenY = horizonY + (100 * scale);

    const asset = assetCache[obs.type];
    if (asset) {
      ctx.drawImage(asset, screenX - w/2, screenY - h, w, h);
    }
  }
  
  // ── PLAYER RENDER LOGIC WITH JUMPING ──
  const laneWidth = TRACK_HALF_WIDTH * 0.9;
  const targetX = inputState.lane * laneWidth;

  playerVisualX += (targetX - playerVisualX) * 0.25;

  const playerAsset = assetCache['player'];
  if (playerAsset) {
    const pw = 120;
    const ph = 120;

    const pScreenX = (canvasWidth / 2 + CAMERA_X_OFFSET) + playerVisualX;
    const pScreenY = canvasHeight - ph - 100 - playerJumpHeight;

    if (playerJumpHeight > 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(pScreenX, canvasHeight - 25, 18, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.drawImage(playerAsset, pScreenX - (pw / 2), pScreenY, pw, ph);
  }
  
  // Draw the HUD
  renderHUD();
}

/**
 * Renders the Heads-Up Display (HUD) showing game statistics.
 * Displays score, battery level, and current velocity in the top corners.
 */
export function setRendererConfig(config) {
  if (config.scrollSpeed !== undefined) SCROLL_SPEED = config.scrollSpeed;
  if (config.cameraX !== undefined) CAMERA_X_OFFSET = config.cameraX;
  if (config.horizonY !== undefined) HORIZON_Y = config.horizonY;
  if (config.trackHalf !== undefined) TRACK_HALF_WIDTH = config.trackHalf;
}

function renderHUD() {
  const level = getBatteryLevel();
  const speed = getBatterySpeed(level);
  const percent = Math.round(level * 100);

  ctx.fillStyle = 'white';
  ctx.font = '24px monospace';
  ctx.textAlign = 'left';

  // Draw Score
  ctx.fillText(`SCORE: ${Math.floor(score)}`, 20, 40);
  
  // Draw High Score
  ctx.fillStyle = '#f0c040';
  ctx.font = '16px monospace';
  ctx.fillText(`HI-SCORE: ${Math.floor(highScore)}`, 20, 65);

  // ── NEW: VISUAL PAUSE BUTTON ──
  // Drawn exactly in the top-center where the mobile tap zone is looking
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; // Slightly transparent white
  ctx.font = '20px monospace';
  ctx.fillText('[ || PAUSE ]', canvasWidth / 2, 40);

  ctx.textAlign = 'right';
  ctx.fillStyle = percent <= 20 ? '#ff0055' : '#00ffcc';
  ctx.font = '24px monospace';
  ctx.fillText(`BATTERY: ${percent}%`, canvasWidth - 20, 40);
  ctx.fillText(`VELOCITY: ${speed.toFixed(1)}x`, canvasWidth - 20, 70);
}

/**
 * Draws the custom menu overlay on Pause with interactive buttons
 */
function renderPauseScreen() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = '#f0c040';
  ctx.font = '40px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CRITICAL BREAK', canvasWidth / 2, canvasHeight / 2 - 100);

  ctx.fillStyle = 'white';
  ctx.font = '20px monospace';
  ctx.fillText('Save or Load Game', canvasWidth / 2, canvasHeight / 2 - 60);
  
  // Draw buttons
  const buttonWidth = 200;
  const buttonHeight = 50;
  const buttonSpacing = 20;
  const startX = canvasWidth / 2 - buttonWidth / 2;
  let startY = canvasHeight / 2 - buttonHeight - buttonSpacing / 2; // Adjusted to make space for save button above resume
  
  // Save Button
  ctx.fillStyle = pauseButtonState.save ? '#f0c040' : '#1a1a2e';
  ctx.strokeStyle = '#f0c040';
  ctx.lineWidth = 2;
  ctx.fillRect(startX, startY, buttonWidth, buttonHeight);
  ctx.strokeRect(startX, startY, buttonWidth, buttonHeight);
  ctx.fillStyle = '#000';
  ctx.font = '20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SAVE GAME', canvasWidth / 2, startY + buttonHeight / 2 + 10);

  startY = canvasHeight / 2; // Reset startY for Resume and Load buttons

  // Resume Button
  ctx.fillStyle = pauseButtonState.resume ? '#f0c040' : '#1a1a2e';
  ctx.strokeStyle = '#f0c040';
  ctx.lineWidth = 2;
  ctx.fillRect(startX, startY, buttonWidth, buttonHeight);
  ctx.strokeRect(startX, startY, buttonWidth, buttonHeight);
  ctx.fillStyle = '#000';
  ctx.font = '20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('RESUME', canvasWidth / 2, startY + buttonHeight / 2 + 10);
  
  // Load Button
  ctx.fillStyle = pauseButtonState.load ? '#f0c040' : '#1a1a2e';
  ctx.strokeStyle = '#f0c040';
  ctx.lineWidth = 2;
  ctx.fillRect(startX, startY + buttonHeight + buttonSpacing, buttonWidth, buttonHeight);
  ctx.strokeRect(startX, startY + buttonHeight + buttonSpacing, buttonWidth, buttonHeight);
  ctx.fillStyle = '#000';
  ctx.font = '20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LOAD GAME', canvasWidth / 2, startY + buttonHeight + buttonSpacing + buttonHeight / 2 + 10);
}

/**
 * Renders the game over screen with interactive buttons.
 * Shows a semi-transparent overlay with game over message, final score, and buttons.
 */
function renderGameOver() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = '#ff0055';  
  ctx.font = '48px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CRITICAL FAILURE', canvasWidth / 2, canvasHeight / 2 - 100);

  ctx.fillStyle = 'white';
  ctx.font = '24px monospace';
  ctx.fillText(`FINAL SCORE: ${Math.floor(score)}`, canvasWidth / 2, canvasHeight / 2 - 50);
  
  ctx.fillStyle = '#f0c040';
  ctx.font = '20px monospace';
  ctx.fillText(`BEST RECORD: ${Math.floor(highScore)}`, canvasWidth / 2, canvasHeight / 2 - 10);
  
  // Draw buttons
  const buttonWidth = 200;
  const buttonHeight = 50;
  const buttonSpacing = 20;
  const startX = canvasWidth / 2 - buttonWidth / 2;
  const startY = canvasHeight / 2 + 20;
  
  // Restart Button
  ctx.fillStyle = gameOverButtonState.restart ? '#f0c040' : '#1a1a2e';
  ctx.strokeStyle = '#f0c040';
  ctx.lineWidth = 2;
  ctx.fillRect(startX, startY, buttonWidth, buttonHeight);
  ctx.strokeRect(startX, startY, buttonWidth, buttonHeight);
  ctx.fillStyle = '#000';
  ctx.font = '20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('RESTART', canvasWidth / 2, startY + buttonHeight / 2 + 10);
  
  // Load Button
  ctx.fillStyle = gameOverButtonState.load ? '#f0c040' : '#1a1a2e';
  ctx.strokeStyle = '#f0c040';
  ctx.lineWidth = 2;
  ctx.fillRect(startX, startY + buttonHeight + buttonSpacing, buttonWidth, buttonHeight);
  ctx.strokeRect(startX, startY + buttonHeight + buttonSpacing, buttonWidth, buttonHeight);
  ctx.fillStyle = '#000';
  ctx.font = '20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LOAD GAME', canvasWidth / 2, startY + buttonHeight + buttonSpacing + buttonHeight / 2 + 10);
}