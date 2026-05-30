// src/systems/settings.js
// Manages game settings and preferences using the browser's LocalStorage.

import { DEBUG } from '../constants.js';

const SETTINGS_KEY = 'critical_charge_settings';

// Default settings
const DEFAULT_SETTINGS = {
  controlMethod: 'swipe', // 'swipe' or 'tilt'
  hasTiltSensor: false,
  tiltSensitivity: 0.03,
  swipeThreshold: 30,
  deadzone: 0.05,
  isMuted: false,
};

/**
 * Load game settings from localStorage
 * @returns {Object} Game settings object
 */
export function loadSettings() {
  const rawData = localStorage.getItem(SETTINGS_KEY);
  if (!rawData) return { ...DEFAULT_SETTINGS };

  try {
    const settings = JSON.parse(rawData);
    // Merge with defaults to ensure all settings exist
    return { ...DEFAULT_SETTINGS, ...settings };
  } catch (e) {
    console.error('Failed to parse settings:', e);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save game settings to localStorage
 * @param {Object} settings - Game settings object
 */
export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  if (DEBUG) console.log('⚙️ Settings saved successfully.');
}

/**
 * Update a specific setting
 * @param {string} key - Setting key
 * @param {any} value - Setting value
 */
export function updateSetting(key, value) {
  const settings = loadSettings();
  settings[key] = value;
  saveSettings(settings);
}
