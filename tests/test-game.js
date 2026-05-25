// Import necessary battery utilities. Removed invalid getBatterySpeed export.
import { initBattery as originalInitBattery, getBatteryLevel, setBatteryConfig, MIN_SPEED, MAX_SPEED, SPEED_EXPONENT } from '/src/core/battery.js';
import { startEngine, togglePause, loadSavedGame, setEngineConfig, setSpawnRate, setRendererConfig, GRAVITY, JUMP_FORCE } from '/src/core/engine.js';
import { initInput, setInputConfig } from '/src/core/input.js';
import { preloadAssets } from '/src/systems/asset-cache.js';
import { createBatterySimulator } from '/tests/test-runner.js';

console.log('Initializing test game...');
const canvas = document.getElementById('game');
console.log('Canvas element:', canvas);
if (!canvas) {
  console.error('Canvas element not found!');
} else {
  canvas.width = 720;
  canvas.height = 1280;
  console.log('Canvas initialized:', canvas.width, 'x', canvas.height);
}

// Apply test configuration overrides
let testConfig = {};

async function boot() {
  // Retrieve test configuration from sessionStorage
  const configStr = sessionStorage.getItem('testConfig');
  if (configStr) {
    try {
      testConfig = JSON.parse(configStr);
    } catch (e) {
      console.warn('Failed to parse test config:', e);
      testConfig = {};
    }
  }

  // Fallback to individual test values if full config not present
  const batteryLevel = testConfig.batteryLevel !== undefined ? testConfig.batteryLevel :
    (parseFloat(sessionStorage.getItem('testBatteryLevel')) || 0.7);
  const batteryCharging = testConfig.batteryCharging !== undefined ? testConfig.batteryCharging :
    (sessionStorage.getItem('testCharging') === 'true');

  // Override initBattery to use the simulator with test values
  console.log('Creating battery simulator with level:', batteryLevel, 'charging:', batteryCharging);
  const simulatedBattery = createBatterySimulator(batteryLevel, batteryCharging);
  console.log('Simulator created:', simulatedBattery);
  const battery = await originalInitBattery(simulatedBattery);
  console.log('Battery initialized:', battery);

  if (!battery) {
    console.error('Failed to initialize battery simulator');
    const screen = document.getElementById('screen-unsupported');
    screen.style.display = 'flex';
    return;
  }

  console.log('Preloading assets...');
  await preloadAssets();
  console.log('Assets preloaded successfully');

  console.log('Initializing input...');
  initInput();
  console.log('Input initialized');

  console.log('Starting engine...');
  startEngine(canvas);
  console.log('Engine started');

  // Apply test configurations to game constants
  applyTestConfig();

  // Update test controls display
  const updateTestControls = () => {
    document.getElementById('test-battery-level').textContent = `Battery Level: ${Math.round(battery.level * 100)}%`;
    document.getElementById('test-charging-status').textContent = `Charging: ${battery.charging ? 'Yes' : 'No'}`;
  };
  updateTestControls();
  battery.addEventListener('levelchange', updateTestControls);
  battery.addEventListener('chargingchange', updateTestControls);

  // Apply individual test values from different scenario pages
  applyIndividualTestValues();
}

function applyTestConfig() {
  // Apply engine config (jump force, gravity)
  setEngineConfig(testConfig);

  // Apply spawn rate
  if (testConfig.spawnRate !== undefined) {
    setSpawnRate(testConfig.spawnRate);
  }

  // Apply renderer config (scroll speed, camera X, horizon Y, track half-width)
  setRendererConfig(testConfig);

  // Apply battery/velocity config (min speed, max speed, exponent)
  if (testConfig.minSpeed !== undefined || testConfig.maxSpeed !== undefined || testConfig.exp !== undefined) {
    setBatteryConfig({
      minSpeed: testConfig.minSpeed,
      maxSpeed: testConfig.maxSpeed,
      exp: testConfig.exp
    });
  }

  // Apply input config (swipe threshold, tilt sensitivity, deadzone)
  if (testConfig.swipeThreshold !== undefined || testConfig.tiltSensitivity !== undefined || testConfig.deadzone !== undefined) {
    setInputConfig({
      swipeThreshold: testConfig.swipeThreshold,
      tiltSensitivity: testConfig.tiltSensitivity,
      deadzone: testConfig.deadzone
    });
  }

  console.log('Test config applied:', testConfig);
}

function applyIndividualTestValues() {
  // Battery/velocity values (from velocity scenario page)
  const minSpeed = sessionStorage.getItem('testMinSpeed');
  const maxSpeed = sessionStorage.getItem('testMaxSpeed');
  const exp = sessionStorage.getItem('testExp');

  if (minSpeed) {
    setBatteryConfig({
      minSpeed: parseFloat(minSpeed),
      maxSpeed: parseFloat(maxSpeed),
      exp: parseFloat(exp)
    });
    console.log('Battery config applied from scenario. MIN_SPEED:', MIN_SPEED, 'MAX_SPEED:', MAX_SPEED, 'EXPONENT:', SPEED_EXPONENT);
  }

  // Input values (from input scenario page)
  const tiltSensitivity = sessionStorage.getItem('testTiltSensitivity');
  const swipeThreshold = sessionStorage.getItem('testSwipeThreshold');
  const deadzone = sessionStorage.getItem('testDeadzone');

  if (tiltSensitivity) {
    setInputConfig({
      tiltSensitivity: parseFloat(tiltSensitivity),
      swipeThreshold: parseFloat(swipeThreshold),
      deadzone: parseFloat(deadzone)
    });
    console.log('Input config applied from scenario:', {tiltSensitivity, swipeThreshold, deadzone});
  }

  // Obstacle values (from obstacles scenario page)
  const spawnRate = sessionStorage.getItem('testSpawnRate');
  if (spawnRate) {
    setSpawnRate(parseFloat(spawnRate));
    console.log('Spawn rate applied from scenario:', spawnRate);
  }

  // Renderer values (from renderer scenario page)
  const scrollSpeed = sessionStorage.getItem('testScrollSpeed');
  const cameraX = sessionStorage.getItem('testCameraX');
  const horizonY = sessionStorage.getItem('testHORIZON_Y');
  const trackHalf = sessionStorage.getItem('testTRACK_HALF');

  if (scrollSpeed) {
    setRendererConfig({
      scrollSpeed: parseFloat(scrollSpeed),
      cameraX: parseFloat(cameraX),
      horizonY: parseFloat(horizonY),
      trackHalf: parseFloat(trackHalf)
    });
    console.log('Renderer config applied from scenario:', {scrollSpeed, cameraX, horizonY, trackHalf});
  }
}

console.log('Adding DOMContentLoaded event listener');
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded event fired');
  boot();
});

// Expose for debugging/testing in console
window.togglePause = togglePause;
window.loadSavedGame = loadSavedGame;

// Handle keyboard inputs for test game
document.addEventListener('keydown', (event) => {
  if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
    togglePause();
  } else if (event.key === 'l' || event.key === 'L') {
    loadSavedGame();
  }
});
