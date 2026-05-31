// src/systems/asset-cache.js
// Asset management system for the game.
// Handles loading, rasterizing, and caching SVG assets for optimal performance.
// Pre-rendering SVGs to canvas elements ensures smooth 60 FPS rendering during gameplay.

import { loadSound } from './audio.js';
import { ASSET_PATHS } from '../constants.js';

/**
 * Cache for storing pre-rendered game assets.
 * Maps asset IDs to canvas elements containing the rasterized images.
 * @type {Object<string, HTMLCanvasElement>}
 */
export const assetCache = {};

/**
 * List of assets to preload for the game.
 * Each asset entry specifies an ID, source path, and dimensions for rasterization.
 * @type {Array<{id: string, src: string, width: number, height: number}>
 */
const assetList = [
  {
    id: 'enemy_charger',
    src: ASSET_PATHS.chargerSprite,
    type: 'png',
  },
  {
    id: 'player',
    src: ASSET_PATHS.playerSprite,
    type: 'png',
  },
];

/**
 * Preloads all game assets and caches them for optimal performance.
 * This function loads SVG images, rasterizes them to canvas elements,
 * and stores them in the assetCache for quick access during gameplay.
 *
 * @returns {Promise<void>} Promise that resolves when all assets are loaded and cached
 */
export async function preloadAssets() {
  const promises = assetList.map((asset) => {
    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        // Store the raw image object for the Sprite Sheet
        assetCache[asset.id] = img;
        resolve();
      };

      img.onerror = () => {
        console.error('Failed to load:', asset.src);
        resolve();
      };

      img.src = asset.src;
    });
  });

  await Promise.allSettled(promises);
  // ── LOAD AUDIO FILES (SFX only — music is lazy-loaded on first play) ──
  loadSound('click', ASSET_PATHS.sounds.click);
  loadSound('jump', ASSET_PATHS.sounds.jump);
  loadSound('wirus', ASSET_PATHS.sounds.wirus);
  loadSound('corrupted', ASSET_PATHS.sounds.corrupted);
  loadSound('gameover', ASSET_PATHS.sounds.gameover);
}
