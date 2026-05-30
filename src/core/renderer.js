// src/core/renderer.js

import {
  OBSTACLE_BASE_W,
  OBSTACLE_BASE_H,
  OBSTACLE_LANE_BASE,
  OBSTACLE_FRAME_SIZE,
  OBSTACLE_FRAME_INTERVAL,
  OBSTACLE_VISIBLE_MAX,
  OBSTACLE_VISIBLE_MIN,
  ROAD_STEP,
  ROAD_BASE_WIDTH,
  ROAD_STRIPE_WIDTH,
  WARP_START_LEVEL,
  WARP_MAX_LEVEL,
  WARP_MAX_OPACITY,
  WARP_FLOOR_CHANCE,
  WARP_PARTICLE_COUNT,
  WARP_SPEED_MIN,
  WARP_SPEED_MAX,
  WARP_CRUISE_MULT,
  WARP_WARP_MULT,
} from '../constants.js';
// Removed unused import of getScanlinePattern

/**
 * A helper to draw a perspective-scaled sprite from a sprite sheet.
 * Automatically centers the sprite on X and anchors it to the bottom on Y.
 */
export function drawScaledSprite(ctx, asset, frameX, frameY, frameSize, destX, destY, destW, destH) {
  if (!asset) return;
  ctx.drawImage(asset, frameX, frameY, frameSize, frameSize, destX - destW / 2, destY - destH, destW, destH);
}

/**
 * Draws a drop shadow beneath jumping entities
 */
export function drawShadow(ctx, x, y, scale) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(x, y, 55 * scale, 7 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ── PRE-CALCULATED ROAD TABLES ──
let _roadTable = null;

function _ensureRoadTable(canvasHeight, horizonY) {
  if (_roadTable && _roadTable.height === canvasHeight && _roadTable.horizon === horizonY) return;

  _roadTable = {
    height: canvasHeight,
    horizon: horizonY,
    steps: []
  };

  for (let y = horizonY; y < canvasHeight; y += ROAD_STEP) {
    const distance = 100 / (y - horizonY + 1);
    const scale = 1.5 / distance;
    const roadWidth = ROAD_BASE_WIDTH + 125 * scale;
    const rw = roadWidth / 2;
    const stripeWidth = ROAD_STRIPE_WIDTH * scale;
    _roadTable.steps.push({
      y,
      distance,
      roadWidth,
      rw,
      stripeWidth
    });
  }
}

/**
 * Renders the pseudo-3D scrolling road
 */
export function renderRoad(ctx, canvasWidth, canvasHeight, horizonY, trackPosition, scrollSpeed, cameraX) {
  // Horizon glow line
  ctx.fillStyle = '#8000ff';
  ctx.fillRect(0, horizonY - 1, canvasWidth, 2);

  _ensureRoadTable(canvasHeight, horizonY);

  const cx = canvasWidth / 2 + cameraX;

  for (const step of _roadTable.steps) {
    const textureY = step.distance * 200 + trackPosition * scrollSpeed;
    const isDark = Math.floor(textureY / 40) % 2 === 0;

    // Road Base
    ctx.fillStyle = isDark ? '#111115' : '#1a1a20';
    ctx.fillRect(cx - step.rw, step.y, step.roadWidth, ROAD_STEP);

    // Purple edge stripes
    ctx.fillStyle = isDark ? '#8000ff' : '#333333';
    ctx.fillRect(cx - step.rw - step.stripeWidth, step.y, step.stripeWidth, ROAD_STEP);
    ctx.fillRect(cx + step.rw, step.y, step.stripeWidth, ROAD_STEP);
  }
}

/**
 * Sorts and renders all obstacles in 3D perspective
 * NOTE: For optimal performance, the obstacles array should be pre-sorted by Z descending.
 */
export function renderObstacles(ctx, obstacles, assetCache, canvasWidth, horizonY, cameraX) {
  // We avoid sorting here if possible, but for safety in the general renderer we can keep it
  // until we confirm the manager handles it.
  // obstacles.sort((a, b) => b.z - a.z);

  for (const obs of obstacles) {
    if (obs.z > OBSTACLE_VISIBLE_MAX || obs.z < OBSTACLE_VISIBLE_MIN) continue;

    const visualZ = Math.max(obs.z, 0.05);
    const scale = 1 / (visualZ / 0.5);
    const w = OBSTACLE_BASE_W * scale;
    const h = OBSTACLE_BASE_H * scale;
    const screenX = canvasWidth / 2 + cameraX + obs.lane * OBSTACLE_LANE_BASE * scale;
    const screenY = horizonY + 100 * scale;

    const asset = assetCache[obs.type];
    if (asset) {
      const frameIndex = Math.floor(performance.now() / OBSTACLE_FRAME_INTERVAL) % 5;

      drawScaledSprite(ctx, asset, frameIndex * OBSTACLE_FRAME_SIZE, 0, OBSTACLE_FRAME_SIZE, screenX, screenY, w, h);
    }
  }
}

// ── SPEED TRAILS EFFECT ───────────────────────────────────────────────────────

// ── EASY CONFIGURATION ──
const WARP_CONFIG = {
  startLevel: WARP_START_LEVEL,
  maxLevel: WARP_MAX_LEVEL,
  maxOpacity: WARP_MAX_OPACITY,
  floorLineChance: WARP_FLOOR_CHANCE,
  particleCount: WARP_PARTICLE_COUNT,
  baseSpeedMin: WARP_SPEED_MIN,
  baseSpeedMax: WARP_SPEED_MAX,
  cruiseMultiplier: WARP_CRUISE_MULT,
  warpMultiplier: WARP_WARP_MULT,
};

let speedLines = null;
let lastTrailTime = 0;

// Pre-computed angle pool to avoid Math.random() in the render hot path
let _anglePool = null;
let _angleIndex = 0;

function _getNextAngle() {
  if (!_anglePool) {
    _anglePool = [];
    for (let i = 0; i < 256; i++) {
      // Roll the dice: should this be a floor line?
      if (Math.random() < WARP_CONFIG.floorLineChance) {
        _anglePool.push(Math.PI * 0.2 + Math.random() * (Math.PI * 0.6));
      } else {
        let angle;
        do {
          angle = Math.random() * Math.PI * 2;
        } while (angle > Math.PI * 0.2 && angle < Math.PI * 0.8);
        _anglePool.push(angle);
      }
    }
  }
  const angle = _anglePool[_angleIndex];
  _angleIndex = (_angleIndex + 1) % _anglePool.length;
  return angle;
}

// Lazy-initialize the particle pool on first render
function _ensureSpeedLines() {
  if (speedLines) return;
  speedLines = [];
  for (let i = 0; i < WARP_CONFIG.particleCount; i++) {
    speedLines.push({
      angle: _getNextAngle(),
      distance: Math.random() * 800,
      length: Math.random() * 80 + 20,
      speed: WARP_CONFIG.baseSpeedMin + Math.random() * (WARP_CONFIG.baseSpeedMax - WARP_CONFIG.baseSpeedMin),
      color: Math.random() > 0.5 ? '#22d3ee' : '#d946ef',
    });
  }
}

/**
 * Renders hyper-speed warp lines that increase in intensity based on WARP_CONFIG.
 */
export function renderSpeedTrails(ctx, canvasWidth, canvasHeight, horizonY, cameraX, batteryLevel) {
  // If we are above the start threshold, completely hide the effect
  if (batteryLevel > WARP_CONFIG.startLevel) return;

  // Ensure the particle pool is initialized before rendering
  _ensureSpeedLines();

  const now = performance.now();
  if (lastTrailTime === 0) lastTrailTime = now;
  const dt = Math.min((now - lastTrailTime) / 1000, 0.05);
  lastTrailTime = now;

  // Calculate intensity from 0.0 to 1.0 based on battery thresholds
  let intensity = (WARP_CONFIG.startLevel - batteryLevel) / (WARP_CONFIG.startLevel - WARP_CONFIG.maxLevel);
  intensity = Math.max(0, Math.min(1, intensity)); // Clamp between 0 and 1

  const cx = canvasWidth / 2 + cameraX;
  const cy = horizonY;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 1.5 + 2 * intensity;

  // Opacity smoothly scales up to your configured maximum
  ctx.globalAlpha = WARP_CONFIG.maxOpacity * intensity;

  for (const line of speedLines) {
    line.distance += line.speed * (WARP_CONFIG.cruiseMultiplier + WARP_CONFIG.warpMultiplier * intensity) * dt;

    // Recycle lines — use pre-computed angle pool instead of Math.random()
    if (line.distance > 1200) {
      line.distance = Math.random() * 50;
      line.angle = _getNextAngle();
    }

    // Draw lines
    if (line.distance > 80) {
      const startX = cx + Math.cos(line.angle) * line.distance;
      const startY = cy + Math.sin(line.angle) * line.distance;

      const endDist = line.distance + line.length * (1 + 3 * intensity);
      const endX = cx + Math.cos(line.angle) * endDist;
      const endY = cy + Math.sin(line.angle) * endDist;

      ctx.strokeStyle = line.color;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }
  ctx.restore();
}
