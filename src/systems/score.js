// src/systems/score.js
// Manages the player's score during a game session.
// Extracts score tracking logic out of the main engine loop to keep it clean.

import { getHighScore, checkAndSaveHighScore } from './save-system.js';
import { SCORE_SPEED_MULTIPLIER } from '../constants.js';

// Internal state
let currentScore = 0;
let sessionHighScore = 0;

/**
 * Initialize the score system by loading the saved high score.
 * Call this once during the boot sequence in main.js.
 */
export function initScore() {
  sessionHighScore = getHighScore();
}

/**
 * Resets the current score to zero.
 * Call this inside startEngine() when a new game begins.
 */
export function resetScore() {
  currentScore = 0;
  // Refresh the high score in case it changed during the last run
  sessionHighScore = getHighScore();
}

/**
 * Updates the current score based on elapsed time and battery speed.
 * Call this inside your update(dt) loop.
 * * @param {number} dt - Delta time in seconds
 * @param {number} speed - Current game speed multiplier
 */
export function updateScore(dt, speed) {
  // Score increases faster when battery is low (speed is high)
  currentScore += speed * dt * SCORE_SPEED_MULTIPLIER;
}

/**
 * Returns the current score, rounded down for the HUD.
 */
export function getCurrentScore() {
  return Math.floor(currentScore);
}

/**
 * Returns the current session's high score.
 */
export function getSessionHighScore() {
  return Math.floor(sessionHighScore);
}

/**
 * Finalizes the score when the player crashes.
 * Checks if the current score is a new record and saves it.
 * * @returns {boolean} True if a new high score was achieved.
 */
export function finalizeScore() {
  const isNewRecord = checkAndSaveHighScore(currentScore);
  if (isNewRecord) {
    // Update the local high score immediately so the Game Over screen sees it
    sessionHighScore = Math.floor(currentScore);
  }
  return isNewRecord;
}

/**
 * Overwrites the current score (used when loading a saved game).
 */
export function setScore(savedScore) {
  currentScore = savedScore;
}
