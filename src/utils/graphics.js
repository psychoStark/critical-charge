// src/utils/graphics.js
// Shared graphical utilities for canvas rendering.

import { THEME } from '../theme.js';

let _scanlineCanvas = null;

/**
 * Generates or returns a pre-rendered scanline pattern canvas.
 * @param {number} w - Canvas width
 * @param {number} h - Canvas height
 * @returns {HTMLCanvasElement}
 */
export function getScanlinePattern(w, h) {
  if (_scanlineCanvas) {
    // If dimensions match, return cached canvas
    if (_scanlineCanvas.width === w && _scanlineCanvas.height === h) {
      return _scanlineCanvas;
    }
  }

  _scanlineCanvas = document.createElement('canvas');
  _scanlineCanvas.width = w;
  _scanlineCanvas.height = h;
  const sctx = _scanlineCanvas.getContext('2d');

  for (let y = 0; y < h; y += 4) {
    sctx.fillStyle = THEME.scanline;
    sctx.fillRect(0, y, w, 1);
  }

  return _scanlineCanvas;
}
