// src/core/player.js
import { applyGravity } from './physics.js';
import { lerp } from '../utils/lerp.js';
import { playSound } from '../systems/audio.js';
import { hapticJump, hapticLand, hapticMove } from '../systems/haptics.js';
import { drawShadow, drawScaledSprite } from './renderer.js';

// ── Player State ──
let x = 0;
let z = 0.75;
let jumpHeight = 0;
let jumpVelocity = 0;
let currentLane = 0;

// Config
const FRAME_SIZE = 120;
const PEAK_JUMP_HEIGHT = 300;

export function resetPlayer() {
  x = 0;
  jumpHeight = 0;
  jumpVelocity = 0;
  currentLane = 0;
}

/**
 * Calculates physical modifiers based on battery level.
 */
export function getPhysicsModifiers(level) {
  // 100-75%: Heavy (High gravity, low jump)
  // 50-75%: Medium
  // 25-50%: Light
  // 0-25%: Ultra-light

  if (level >= 0.75) return { gravity: -4250, jump: 750 };
  if (level >= 0.5) return { gravity: -4000, jump: 1300 };
  if (level >= 0.25) return { gravity: -3750, jump: 1400 };
  return { gravity: -3750, jump: 1500 };
}

/**
 * Updates player physics, lane positioning, and jumping.
 */
export function updatePlayer(dt, targetLane, laneWidth, jumpTriggered, batteryLevel) {
  // Get the dynamic gravity and jump force based on the current battery level!
  const { gravity, jump } = getPhysicsModifiers(batteryLevel);

  if (targetLane !== currentLane) {
    hapticMove();
    currentLane = targetLane;
  }

  // 1. Lane Movement (Smooth sliding)
  const targetX = targetLane * laneWidth;
  x = lerp(x, targetX, 0.25);

  // 2. Jump Trigger
  if (jumpTriggered && jumpHeight <= 0) {
    jumpVelocity = jump;

    // ── EASY JUMP AUDIO CONFIG ──
    const PIVOT_BATTERY = 0.35; // 35% is the middle ground
    const PITCH_AT_100 = 0.6; // Deep, heavy sound for full battery
    const PITCH_AT_PIVOT = 1.0; // Normal jump sound
    const PITCH_AT_0 = 1.25; // High, airy sound for empty battery

    // ── AUTOMATIC MATH ──
    let jumpPitch;
    if (batteryLevel >= PIVOT_BATTERY) {
      const progress = (1.0 - batteryLevel) / (1.0 - PIVOT_BATTERY);
      jumpPitch = PITCH_AT_100 + progress * (PITCH_AT_PIVOT - PITCH_AT_100);
    } else {
      const progress = (PIVOT_BATTERY - batteryLevel) / PIVOT_BATTERY;
      jumpPitch = PITCH_AT_PIVOT + progress * (PITCH_AT_0 - PITCH_AT_PIVOT);
    }

    // Play the sound with standard volume (1.0), but dynamic pitch!
    playSound('jump', 1.0, jumpPitch);
    hapticJump();
  }

  // 3. Jump Physics
  const wasInAir = jumpHeight > 0;
  if (jumpHeight >= 0) {
    const physicsState = applyGravity(jumpHeight, jumpVelocity, gravity, dt);
    jumpHeight = physicsState.height;
    jumpVelocity = physicsState.velocity;
  }
  if (wasInAir && jumpHeight <= 0) {
    hapticLand();
  }
}

export function getPlayerJumpHeight() {
  return jumpHeight;
}

/**
 * Handles all the complex sprite sheet math and draws the player.
 */
export function renderPlayer(ctx, asset, canvasWidth, canvasHeight, horizonY, cameraX, batteryLevel, speed) {
  if (!asset) return;

  // 1. Determine Animation Row (Battery Tier)
  // Note: Arrays/Rows are 0-indexed, so Row 1 = 0, Row 4 = 3, etc.
  let row;

  if (batteryLevel <= 0.15)
    row = 5; // Row 6: < 15%
  else if (batteryLevel <= 0.2)
    row = 4; // Row 5: 15% - 20%
  else if (batteryLevel <= 0.25)
    row = 3; // Row 4: 20% - 25%
  else if (batteryLevel <= 0.5)
    row = 2; // Row 3: 25% - 50%
  else if (batteryLevel <= 0.75)
    row = 1; // Row 2: 50% - 75%
  else row = 0; // Row 1: 75% - 100%

  // 2. Determine Animation Column (Frame Index)
  let frameIndex;
  if (jumpHeight > 0) {
    // Jump Animation Arc
    const progress = Math.min(1, Math.abs(jumpHeight) / PEAK_JUMP_HEIGHT);
    const isAscending = jumpVelocity > 0;

    if (isAscending) {
      frameIndex = 5 + Math.floor(progress * 2.99);
    } else {
      const descentProgress = 1 - progress;
      frameIndex = 8 + Math.floor(descentProgress * 1.99);
    }
    frameIndex = Math.max(5, Math.min(9, frameIndex));
  } else {
    // Running Animation Loop
    const animSpeed = Math.max(50, 150 / (speed * 0.5));
    frameIndex = Math.floor(performance.now() / animSpeed) % 5;
  }

  // 3. Perspective Math
  const scale = 0.5 + z * 0.5;
  const drawSize = 350 * scale;
  const pScreenX = canvasWidth / 2 + cameraX + x * scale;
  const pScreenY = horizonY + (canvasHeight - 250) * z - jumpHeight;

  // 4. Draw Shadow (using renderer utility)
  if (jumpHeight > 0) {
    drawShadow(ctx, pScreenX, horizonY + (canvasHeight - horizonY) * z + drawSize / 2, scale);
  }

  // 5. Draw Player Sprite (using renderer utility)
  drawScaledSprite(
    ctx,
    asset,
    frameIndex * FRAME_SIZE,
    row * FRAME_SIZE,
    FRAME_SIZE,
    pScreenX,
    pScreenY,
    drawSize,
    drawSize,
  );
}
