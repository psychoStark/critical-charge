// src/core/player.js
import { applyGravity } from './physics.js';
import { lerp } from '../utils/lerp.js';

// ── Player State ──
let x = 0;
let z = 0.75;
let jumpHeight = 0;
let jumpVelocity = 0;

// Config
const FRAME_SIZE = 120;
const PEAK_JUMP_HEIGHT = 300;

export function resetPlayer() {
  x = 0;
  jumpHeight = 0;
  jumpVelocity = 0;
}

/**
 * Updates player physics, lane positioning, and jumping.
 */
export function updatePlayer(dt, targetLane, laneWidth, jumpTriggered, jumpForce, gravity) {
  // 1. Lane Movement (Smooth sliding)
  const targetX = targetLane * laneWidth;
  x = lerp(x, targetX, 0.25);

  // 2. Jump Trigger
  if (jumpTriggered && jumpHeight <= 0) {
    jumpVelocity = jumpForce;
  }

  // 3. Jump Physics
  if (jumpHeight >= 0) {
    const physicsState = applyGravity(jumpHeight, jumpVelocity, gravity, dt);
    jumpHeight = physicsState.height;
    jumpVelocity = physicsState.velocity;
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
  let row = 0;
  if      (batteryLevel < 0.25) row = 2;
  else if (batteryLevel < 0.50) row = 2;
  else if (batteryLevel < 0.75) row = 1;
  else                          row = 0;

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
    frameIndex = Math.floor(Date.now() / animSpeed) % 5;
  }

  // 3. Perspective Math
  const scale = 0.5 + (z * 0.5);
  const drawSize = 250 * scale;
  const pScreenX = (canvasWidth / 2 + cameraX) + x * scale;
  const pScreenY = horizonY + (canvasHeight - horizonY) * z - drawSize / 2 - jumpHeight;

  // 4. Draw Shadow
  if (jumpHeight > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(
      pScreenX,
      horizonY + (canvasHeight - horizonY) * z + drawSize / 2,
      18 * scale, 7 * scale, 0, 0, Math.PI * 2
    );
    ctx.fill();
  }

  // 5. Draw Player Sprite
  ctx.drawImage(
    asset,
    frameIndex * FRAME_SIZE, row * FRAME_SIZE,
    FRAME_SIZE, FRAME_SIZE,
    pScreenX - 125, pScreenY, 250, 250
  );
}