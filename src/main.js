// main.js
import { initBattery } from './core/battery.js';
import { startEngine } from './core/engine.js';
import { preloadAssets } from './systems/asset-cache.js';
import { initInput } from './core/input.js';

const canvas = document.getElementById('game');

// Internal resolution. (720x1280 is a portrait ratio, typical for mobile runners!)
canvas.width  = 720;
canvas.height = 1280;

async function boot() {
  const battery = await initBattery();

  if (!battery) {
    const screen = document.getElementById('screen-unsupported');
    screen.style.display = 'flex'; 
    return;                        
  }

  await preloadAssets(); 
  
  initInput();
  
  startEngine(canvas);
}

document.addEventListener('DOMContentLoaded', boot);