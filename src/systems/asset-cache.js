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
const BARRICADE_SVG = '/src/assets/svg/car-in.svg'

/***
 * Path to the player character SVG asset.
 * This asset represents the player's ship/vehicle in the game.
 * @type {string}
 */
const PLAYER_SVG = '/src/assets/svg/8-Bit-Character.svg'

/***
 * List of assets to preload for the game.
 * Each asset entry specifies an ID, source path, and dimensions for rasterization.
 * @type {Array<{id: string, src: string, width: number, height: number}>
 */
const assetList = [
  {
    id: 'barricade',
    src: BARRICADE_SVG,
    width: 100,  // Width for rasterization
    height: 100  // Height for rasterization
  },
  {
    id: 'player',
    src: PLAYER_SVG,
    width: 80,   // Width for rasterization
    height: 80   // Height for rasterization
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
  // Create a promise for each asset to handle asynchronous loading
  const promises = assetList.map(asset => {
    return new Promise((resolve, reject) => {
      // Create an image element to load the SVG
      const img = new Image();
      
      // Set up load handler for successful loading
      img.onload = () => {
        // Create an offscreen canvas to rasterize the SVG
        const offscreen = document.createElement('canvas');
        offscreen.width = asset.width;   // Set canvas width
        offscreen.height = asset.height; // Set canvas height
        const ctx = offscreen.getContext('2d'); // Get 2D rendering context

        // Draw the SVG image onto the canvas at the specified dimensions
        ctx.drawImage(img, 0, 0, asset.width, asset.height);
        
        // Store the canvas element in the asset cache using the asset ID
        assetCache[asset.id] = offscreen;
        resolve(); // Resolve the promise for this asset
      };
      
      // Set up error handler for failed loading – resolve to continue loading other assets
      img.onerror = (e) => {
        console.error('Failed to load asset', asset.id, asset.src, e);
        // Resolve instead of reject so a single bad asset doesn't abort all loading
        resolve();
      };
      
      // Start loading the SVG image
      img.src = asset.src;
    });
  });

  // Wait for all asset loading promises to settle (either fulfilled or resolved after error)
  await Promise.allSettled(promises);
  console.log('✅ Assets cached (some may have failed, see errors above).');
}