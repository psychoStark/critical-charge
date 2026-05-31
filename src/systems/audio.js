// src/systems/audio.js

import { isMuted as getIsMuted, setSetting } from '../config.js';
import { BGM_DEFAULT_VOLUME, DEBUG_TIMEOUT_SOUND, DEBUG, ASSET_PATHS } from '../constants.js';

const audioCache = {};
let bgmInstance = null; // Track the background music

// ── FIXED: Single declaration reading from config singleton ──
let isMuted = getIsMuted();

export let debugLastSound = 'None';
export let debugCurrentBGM = 'None';
let debugSoundTimer = null;

// ── Music ID → asset path mapping for lazy-loading ──
const MUSIC_PATHS = {
  music1: ASSET_PATHS.sounds.music1,
  music2: ASSET_PATHS.sounds.music2,
  music3: ASSET_PATHS.sounds.music3,
  corrupted: ASSET_PATHS.sounds.corrupted,
};

// ── Audio pool for SFX to avoid GC pressure and manage memory ──
const POOL_SIZE = 6;
const sfxPools = {}; // { id: [Audio, Audio, ...] }

function _getPooledAudio(id) {
  const pool = sfxPools[id];
  if (!pool) return null;

  // 1. Find an instance that is not currently playing
  for (const inst of pool) {
    if (inst.paused || inst.ended) return inst;
  }

  // 2. If pool is full, recycle the oldest playing instance (the one furthest along)
  let oldest = pool[0];
  for (const inst of pool) {
    if (inst.currentTime > oldest.currentTime) {
      oldest = inst;
    }
  }

  oldest.pause();
  oldest.currentTime = 0;
  return oldest;
}

export function loadSound(id, src) {
  const audio = new Audio(src);
  audioCache[id] = audio;
  // Pre-fill the pool
  sfxPools[id] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const clone = new Audio(src);
    sfxPools[id].push(clone);
  }
}

/**
 * Ensure a music track is loaded into the cache.
 * If not already cached, creates and loads it on demand.
 */
function _ensureMusicLoaded(id) {
  if (audioCache[id]) return true;
  const src = MUSIC_PATHS[id];
  if (!src) return false;
  loadSound(id, src);
  return true;
}

export function playSound(id, volume = 1.0, rate = 1.0) {
  if (isMuted) return;
  const sound = audioCache[id];
  if (sound) {
    if (DEBUG) {
      debugLastSound = `${id.toUpperCase()} (x${rate.toFixed(1)})`;
      if (debugSoundTimer) clearTimeout(debugSoundTimer);
      debugSoundTimer = setTimeout(() => {
        debugLastSound = 'None';
      }, DEBUG_TIMEOUT_SOUND);
    }

    // Use pooled audio instance
    const instance = _getPooledAudio(id);
    if (instance) {
      instance.volume = volume;
      instance.playbackRate = rate;
      instance.preservesPitch = false;
      instance.currentTime = 0;
      instance.play().catch((e) => console.warn('Audio play blocked:', e));
    }
  }
}

// ── BGM CONTROLS ──
export function playBGM(id, volume = BGM_DEFAULT_VOLUME) {
  // Lazy-load music track if not already cached
  _ensureMusicLoaded(id);

  const nextBGM = audioCache[id];
  if (!nextBGM) return;

  if (DEBUG) debugCurrentBGM = id.toUpperCase();

  // If a different track is already playing, pause it and rewind
  if (bgmInstance && bgmInstance !== nextBGM) {
    bgmInstance.pause();
    bgmInstance.currentTime = 0;
  }

  // Set the new track and force it to loop
  bgmInstance = nextBGM;
  bgmInstance.loop = true;
  bgmInstance.volume = volume;

  // Sync the HTML5 Audio muted property ──
  bgmInstance.muted = isMuted;

  bgmInstance.play().catch((e) => console.warn('BGM blocked:', e));
}

export function pauseBGM() {
  if (bgmInstance) bgmInstance.pause();
}

export function stopBGM() {
  if (DEBUG) debugCurrentBGM = 'NONE';
  if (bgmInstance) {
    bgmInstance.pause();
    bgmInstance.currentTime = 0;
  }
}

export function setBGMRate(rate) {
  if (bgmInstance) {
    bgmInstance.playbackRate = rate;
    // Preserves pitch so the music speeds up/slows down without sounding distorted
    bgmInstance.preservesPitch = true;
  }
}

export function getMuteState() {
  return isMuted;
}

export function toggleMute() {
  isMuted = !isMuted;
  if (bgmInstance) bgmInstance.muted = isMuted;

  // If we just unmuted, and the browser blocked autoplay earlier,
  // this user interaction allows us to kickstart the audio safely.
  if (!isMuted && bgmInstance && bgmInstance.paused) {
    bgmInstance.play().catch((e) => console.warn('BGM play on unmute blocked:', e));
  }

  // ── Save the updated state via config singleton ──
  setSetting('isMuted', isMuted);

  return isMuted;
}
