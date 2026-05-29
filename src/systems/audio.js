// src/systems/audio.js

import { loadSettings, updateSetting } from './settings.js';

const audioCache = {};
let bgmInstance = null; // Track the background music

// ── FIXED: Single declaration reading from local storage ──
let isMuted = loadSettings().isMuted;

export let debugLastSound = 'None';
export let debugCurrentBGM = 'None';
let debugSoundTimer = null;

export function loadSound(id, src) {
  const audio = new Audio(src);
  audioCache[id] = audio;
}

export function playSound(id, volume = 1.0, rate = 1.0) {
  if (isMuted) return;
  const sound = audioCache[id];
  if (sound) {
    debugLastSound = `${id.toUpperCase()} (x${rate.toFixed(1)})`;
    if (debugSoundTimer) clearTimeout(debugSoundTimer);
    debugSoundTimer = setTimeout(() => { debugLastSound = 'None'; }, 500);

    const clone = sound.cloneNode();
    clone.volume = volume;
    clone.playbackRate = rate; 
    clone.preservesPitch = false; 
    
    clone.play().catch(e => console.warn('Audio play blocked:', e));
  }
}

// ── BGM CONTROLS ──
export function playBGM(id, volume = 0.4) {
  const nextBGM = audioCache[id];
  if (!nextBGM) return;

  debugCurrentBGM = id.toUpperCase();

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

  bgmInstance.play().catch(e => console.warn('BGM blocked:', e));
}

export function pauseBGM() {
  if (bgmInstance) bgmInstance.pause();
}

export function stopBGM() {
  debugCurrentBGM = 'NONE';
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
    bgmInstance.play().catch(e => console.warn('BGM play on unmute blocked:', e));
  }

  // ── Save the updated state to localStorage ──
  updateSetting('isMuted', isMuted);
  
  return isMuted;
}