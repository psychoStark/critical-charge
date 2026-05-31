// src/utils/lerp.js

/**
 * Linearly interpolates between two values.
 * Great for smooth camera movements, animations, or lane switching.
 * * @param {number} start - Current value
 * @param {number} end - Target value
 * @param {number} amount - Smoothing factor (0.0 to 1.0)
 */
export function lerp(start, end, amount) {
  return start + (end - start) * amount;
}
