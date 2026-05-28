// src/systems/audio.js

const audioCache = {};
let isMuted = false;

export function loadSound(id, src) {
  const audio = new Audio(src);
  audioCache[id] = audio;
}

export function playSound(id, volume = 1.0) {
  if (isMuted) return;
  const sound = audioCache[id];
  if (sound) {
    // Clone node allows the same sound to overlap itself (e.g. collecting multiple coins fast)
    const clone = sound.cloneNode();
    clone.volume = volume;
    clone.play().catch(e => console.warn('Audio play blocked:', e));
  }
}

export function toggleMute() {
  isMuted = !isMuted;
  return isMuted;
}