// src/core/renderer.js

/**
 * A helper to draw a perspective-scaled sprite from a sprite sheet.
 * Automatically centers the sprite on X and anchors it to the bottom on Y.
 */
export function drawScaledSprite(ctx, asset, frameX, frameY, frameSize, destX, destY, destW, destH) {
  if (!asset) return;
  ctx.drawImage(
    asset,
    frameX, frameY,
    frameSize, frameSize,
    destX - (destW / 2), destY - destH,
    destW, destH
  );
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

/**
 * Renders the pseudo-3D scrolling road
 */
export function renderRoad(ctx, canvasWidth, canvasHeight, horizonY, trackPosition, scrollSpeed, cameraX) {
  // Horizon glow line
  ctx.fillStyle = '#8000ff';
  ctx.fillRect(0, horizonY - 1, canvasWidth, 2);

  const step = 3;
  for (let y = horizonY; y < canvasHeight; y += step) {
    const distance  = 100 / (y - horizonY + 1);
    const scale     = 1.5 / distance;
    const roadWidth = 20 + 125 * scale;
    const textureY  = distance * 200 + trackPosition * scrollSpeed;
    const isDark    = Math.floor(textureY / 40) % 2 === 0;
    const cx        = canvasWidth / 2 + cameraX;
    const rw        = roadWidth / 2;
    const stripeWidth = 8 * scale;

    // Road Base
    ctx.fillStyle = isDark ? '#111115' : '#1a1a20';
    ctx.fillRect(cx - rw, y, roadWidth, step);

    // Purple edge stripes
    ctx.fillStyle = isDark ? '#8000ff' : '#333333';
    ctx.fillRect(cx - rw - stripeWidth, y, stripeWidth, step); 
    ctx.fillRect(cx + rw, y, stripeWidth, step);               
  }
}

/**
 * Sorts and renders all obstacles in 3D perspective
 */
export function renderObstacles(ctx, obstacles, assetCache, canvasWidth, horizonY, cameraX) {
  obstacles.sort((a, b) => b.z - a.z);

  for (const obs of obstacles) {
    if (obs.z > 2.0 || obs.z < 0.05) continue;

    const visualZ   = Math.max(obs.z, 0.05);
    const scale     = 1 / (visualZ / 0.5);
    const baseW     = 50, baseH = 50;
    const w         = baseW * scale;
    const h         = baseH * scale;
    const laneBase  = 20;
    const screenX   = (canvasWidth / 2 + cameraX) + (obs.lane * laneBase * scale);
    const screenY   = horizonY + (100 * scale);

    const asset = assetCache[obs.type];
    if (asset) {
      const frameIndex = Math.floor(Date.now() / 150) % 5;
      const FRAME_SIZE = 120;
      
      drawScaledSprite(ctx, asset, frameIndex * FRAME_SIZE, 0, FRAME_SIZE, screenX, screenY, w, h);
    }
  }
}

// ── SPEED TRAILS EFFECT ───────────────────────────────────────────────────────

// ── EASY CONFIGURATION ──
const WARP_CONFIG = {
  startLevel: 0.20,       // Battery level when the effect STARTS fading in (20%)
  maxLevel: 0.00,         // Battery level when the effect is at MAX intensity (0%)
  maxOpacity: 0.5,        // Maximum visibility of the lines (0.0 to 1.0)
  floorLineChance: 0.1,   // 15% chance to spawn a line on the road (0.0 to 1.0)
  particleCount: 60,      // Total number of speed lines
  baseSpeedMin: 1,        // Minimum base speed of a line
  baseSpeedMax: 10,       // Maximum base speed of a line
  cruiseMultiplier: 400,  // How fast they move when they first appear (at 20% battery)
  warpMultiplier: 1500    // The massive EXTRA speed added as battery hits 0%
};

const speedLines = [];
let lastTrailTime = 0;

// Smart angle generator that allows a few lines on the floor
function getWarpAngle() {
  // Roll the dice: should this be a floor line?
  if (Math.random() < WARP_CONFIG.floorLineChance) {
    // Return a random angle strictly inside the bottom "floor" wedge
    return Math.PI * 0.2 + (Math.random() * (Math.PI * 0.6));
  } else {
    // Return a random angle strictly in the sky/walls
    let angle;
    do {
      angle = Math.random() * Math.PI * 2;
    } while (angle > Math.PI * 0.2 && angle < Math.PI * 0.8);
    return angle;
  }
}

// Initialize the particle pool
for (let i = 0; i < WARP_CONFIG.particleCount; i++) {
  speedLines.push({
    angle: getWarpAngle(),
    distance: Math.random() * 800, 
    length: Math.random() * 80 + 20,
    speed: WARP_CONFIG.baseSpeedMin + Math.random() * (WARP_CONFIG.baseSpeedMax - WARP_CONFIG.baseSpeedMin),
    color: Math.random() > 0.5 ? '#22d3ee' : '#d946ef' 
  });
}

/**
 * Renders hyper-speed warp lines that increase in intensity based on WARP_CONFIG.
 */
export function renderSpeedTrails(ctx, canvasWidth, canvasHeight, horizonY, cameraX, batteryLevel) {
  // If we are above the start threshold, completely hide the effect
  if (batteryLevel > WARP_CONFIG.startLevel) return; 

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
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
  ctx.lineWidth = 1.5 + (2 * intensity);
  
  // Opacity smoothly scales up to your configured maximum
  ctx.globalAlpha = WARP_CONFIG.maxOpacity * intensity; 

  for (const line of speedLines) {
    line.distance += line.speed * (WARP_CONFIG.cruiseMultiplier + (WARP_CONFIG.warpMultiplier * intensity)) * dt;

    // Recycle lines
    if (line.distance > 1200) {
      line.distance = Math.random() * 50; 
      line.angle = getWarpAngle(); // Re-rolls the floor/sky chance automatically
    }

    // Draw lines
    if (line.distance > 80) {
      const startX = cx + Math.cos(line.angle) * line.distance;
      const startY = cy + Math.sin(line.angle) * line.distance;
      
      const endDist = line.distance + (line.length * (1 + 3 * intensity));
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