// src/utils/math.js

/**
 * Restricts a value to be within a minimum and maximum range.
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Returns a random float between min (inclusive) and max (exclusive).
 */
export function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Returns a random integer between min and max (inclusive).
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}