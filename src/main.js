// main.js
import { initBattery } from './core/battery.js';
import { startEngine } from './core/engine.js';
import { preloadAssets } from './systems/asset-cache.js';
import { initInput, checkTiltSensor, setControlMethod } from './core/input.js';
import { loadSettings, saveSettings } from './systems/settings.js';

const canvas = document.getElementById('game');

// Internal resolution. (720x1280 is a portrait ratio, typical for mobile runners!)
canvas.width = 720; // Sets the width of the game canvas in pixels.
canvas.height = 1280; // Sets the height of the game canvas in pixels.

// Create control selection screen
function createControlSelectionScreen() {
  const screen = document.createElement('div');
  screen.id = 'screen-control-select';
  screen.style.position = 'fixed';
  screen.style.top = '0';
  screen.style.left = '0';
  screen.style.width = '100%';
  screen.style.height = '100%';
  screen.style.backgroundColor = '#050510';
  screen.style.color = 'white';
  screen.style.display = 'flex';
  screen.style.flexDirection = 'column';
  screen.style.justifyContent = 'center';
  screen.style.alignItems = 'center';
  screen.style.zIndex = '100';
  screen.style.fontFamily = 'monospace';
  
  const title = document.createElement('h1');
  title.textContent = 'CHOOSE CONTROLS';
  title.style.fontSize = '40px';
  title.style.color = '#f0c040';
  title.style.marginBottom = '60px';
  title.style.textAlign = 'center';
  
  const swipeButton = document.createElement('button');
  swipeButton.textContent = 'SWIPE CONTROLS';
  swipeButton.style.width = '250px';
  swipeButton.style.height = '60px';
  swipeButton.style.fontSize = '20px';
  swipeButton.style.backgroundColor = '#1a1a2e';
  swipeButton.style.color = 'white';
  swipeButton.style.border = '2px solid #f0c040';
  swipeButton.style.borderRadius = '5px';
  swipeButton.style.margin = '10px';
  swipeButton.style.cursor = 'pointer';
  swipeButton.style.fontFamily = 'monospace';
  
  const tiltButton = document.createElement('button');
  tiltButton.textContent = 'TILT CONTROLS';
  tiltButton.style.width = '250px';
  tiltButton.style.height = '60px';
  tiltButton.style.fontSize = '20px';
  tiltButton.style.backgroundColor = '#1a1a2e';
  tiltButton.style.color = 'white';
  tiltButton.style.border = '2px solid #f0c040';
  tiltButton.style.borderRadius = '5px';
  tiltButton.style.margin = '10px';
  tiltButton.style.cursor = 'pointer';
  tiltButton.style.fontFamily = 'monospace';
  
  const description = document.createElement('p');
  description.textContent = 'Swipe to jump is always enabled';
  description.style.fontSize = '16px';
  description.style.color = '#888';
  description.style.marginTop = '40px';
  
  screen.appendChild(title);
  screen.appendChild(swipeButton);
  screen.appendChild(tiltButton);
  screen.appendChild(description);
  
  document.body.appendChild(screen);
  
  return { screen, swipeButton, tiltButton };
}

async function boot() {
  const battery = await initBattery();

  if (!battery) {
    const screen = document.getElementById('screen-unsupported');
    screen.style.display = 'flex';
    return;
  }

  await preloadAssets();
  initInput();
  
  // Check if device has tilt sensor
  const hasTiltSensor = await checkTiltSensor();
  const settings = loadSettings();
  
  // Update settings with sensor detection result
  settings.hasTiltSensor = hasTiltSensor;
  saveSettings(settings);
  
  // If we have tilt sensor, show control selection screen
  if (hasTiltSensor) {
    const { screen, swipeButton, tiltButton } = createControlSelectionScreen();
    
    // Set up event listeners
    swipeButton.addEventListener('click', () => {
      setControlMethod('swipe');
      document.body.removeChild(screen);
      startEngine(canvas);
    });
    
    tiltButton.addEventListener('click', () => {
      setControlMethod('tilt');
      document.body.removeChild(screen);
      startEngine(canvas);
    });
  } else {
    // No tilt sensor, default to swipe controls
    setControlMethod('swipe');
    settings.hasTiltSensor = false;
    saveSettings(settings);
    startEngine(canvas);
  }
}

document.addEventListener('DOMContentLoaded', boot);