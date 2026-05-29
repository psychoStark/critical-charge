// src/systems/save-system.js
// Manages saving game state and high scores to the browser's LocalStorage.

const HIGH_SCORE_KEY = 'critical_charge_highscore';
const SAVE_SLOT_KEY = 'critical_charge_manual_save';

// ── HIGH SCORE MANAGEMENT ──
export function getHighScore() {
  const score = localStorage.getItem(HIGH_SCORE_KEY);
  return score ? parseInt(score, 10) : 0;
}

export function checkAndSaveHighScore(currentScore) {
  const currentHigh = getHighScore();
  if (currentScore > currentHigh) {
    localStorage.setItem(HIGH_SCORE_KEY, Math.floor(currentScore).toString());
    return true; // New high score achieved!
  }
  return false;
}

// ── MANUAL SAVE MANAGEMENT ──
export function saveGameData(currentScore, trackPosition, obstacles) {
  const saveState = {
    score: Math.floor(currentScore),
    trackPosition: trackPosition,
    // We sanitize the obstacles array to save only what's necessary
    obstacles: obstacles.map(obs => ({ z: obs.z, lane: obs.lane, type: obs.type })),
    timestamp: Date.now()
  };
  
  localStorage.setItem(SAVE_SLOT_KEY, JSON.stringify(saveState));
  console.log('💾 Game manually saved successfully.');
}

export function loadSavedGameData() {
  const rawData = localStorage.getItem(SAVE_SLOT_KEY);
  if (!rawData) return null;
  try {
    return JSON.parse(rawData);
  } catch (e) {
    console.error('Failed to parse save data:', e);
    return null;
  }
}

// ── PUNISHMENT MECHANICS ──
export function deleteSavedGame() {
  localStorage.removeItem(SAVE_SLOT_KEY);
  console.log('💀 W.I.R.U.S. activated: Manual save deleted.');
}

export function wipeAllData() {
  localStorage.clear();
  console.log('💥 CATASTROPHIC FAILURE: All local storage wiped.');
}