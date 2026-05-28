// src/core/renderer.js

/**
 * A helper to draw a perspective-scaled sprite from a sprite sheet.
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
  ctx.ellipse(x, y, 18 * scale, 7 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}