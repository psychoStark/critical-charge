// src/systems/asset-cache.js
// Asset management system for the game.
// Handles loading, rasterizing, and caching SVG assets for optimal performance.
// Pre-rendering SVGs to canvas elements ensures smooth 60 FPS rendering during gameplay.

/**
 * Cache for storing pre-rendered game assets.
 * Maps asset IDs to canvas elements containing the rasterized images.
 * @type {Object<string, HTMLCanvasElement>}
 */
export const assetCache = {};

/**
 * Path to the barricade/obstacle SVG asset.
 * This asset is used for rendering obstacles that the player must avoid.
 * @type {string}
 */
const CHARGER_SPRITE_SHEET = '/src/assets/enemycharger_dynamicgrid.png';

/***
 * Path to the player character SVG asset.
 * This asset represents the player's ship/vehicle in the game.
 * @type {string}
 */
const PLAYER_SPRITE_SHEET = '/src/assets/herosprite_dynamicgrid.png';

/***
 * List of assets to preload for the game.
 * Each asset entry specifies an ID, source path, and dimensions for rasterization.
 * @type {Array<{id: string, src: string, width: number, height: number}>
 */
const assetList = [
  {
    id: 'enemy_charger',
    src: CHARGER_SPRITE_SHEET,
    type: 'png'
  },
  {
    id: 'player',
    src: PLAYER_SPRITE_SHEET,
    type: 'png'
  }
];

/**
 * Preloads all game assets and caches them for optimal performance.
 * This function loads SVG images, rasterizes them to canvas elements,
 * and stores them in the assetCache for quick access during gameplay.
 *
 * @returns {Promise<void>} Promise that resolves when all assets are loaded and cached
 */
export async function preloadAssets() {
  const promises = assetList.map(asset => {
    return new Promise((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        if (asset.type === 'svg') {
          // Keep your existing rasterization logic for SVGs
          const offscreen = document.createElement('canvas');
          offscreen.width = asset.width;
          offscreen.height = asset.height;
          const ctx = offscreen.getContext('2d');
          ctx.drawImage(img, 0, 0, asset.width, asset.height);
          assetCache[asset.id] = offscreen;
        } else {
          // Just store the raw image object for the Sprite Sheet
          assetCache[asset.id] = img;
        }
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
  console.log('✅ Assets cached.');
}