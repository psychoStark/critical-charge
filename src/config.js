// src/config.js
// Configuration singleton — reads settings from localStorage once at boot
// and provides a reactive settings object that modules can import directly.

import { loadSettings, updateSetting } from './systems/settings.js';

// Load settings once at import time
const _settings = loadSettings();

/**
 * Get a specific setting value.
 * @param {string} key
 * @returns {any}
 */
export function getSetting(key) {
  return _settings[key];
}

/**
 * Update a setting in memory and persist to localStorage.
 * @param {string} key
 * @param {any} value
 */
export function setSetting(key, value) {
  _settings[key] = value;
  updateSetting(key, value);
}

/**
 * Returns the current muted state.
 * Re-exported for audio.js which imports it as `getIsMuted`.
 */
export function isMuted() {
  return _settings.isMuted;
}
