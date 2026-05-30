// test.js

import { initBattery, setBatteryConfig, MIN_SPEED, MAX_SPEED, SPEED_EXPONENT, getBatterySpeed } from './src/core/battery.js';
import { startEngine, initEngineKeyBindings, setEngineConfig, setSpawnRate, saveGame, loadSavedGame, JUMP_FORCE, GRAVITY, SPAWN_RATE, setForceScreen } from './src/core/engine.js';
import { preloadAssets } from './src/systems/asset-cache.js';
import { initInput, inputState, getControlMethod } from './src/core/input.js';
import { debugLastSound, getMuteState, debugCurrentBGM } from './src/systems/audio.js';
import { debugLastHaptic } from './src/systems/haptics.js';
import { initScreens } from './src/ui/screens.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION & STATE
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  batteryLevel: 0.16,
  minSpeed: MIN_SPEED,
  maxSpeed: MAX_SPEED,
  speedExponent: SPEED_EXPONENT,
  jumpForce: JUMP_FORCE,
  gravity: GRAVITY,
  spawnRate: SPAWN_RATE,
};

let CONFIG = { ...DEFAULT_CONFIG };

let isMockCharging = false;
let useRealBattery = false;
let showDebugPanel = true;
let showShortcutsHint = true;
let realBatteryInstance = null;

let isAutoDraining = false;
let drainInterval = null;

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC MOCK BATTERY
// ─────────────────────────────────────────────────────────────────────────────
const batteryListeners = { chargingchange: [], levelchange: [] };

const mockBattery = {
  get level() {
    return (useRealBattery && realBatteryInstance) ? realBatteryInstance.level : CONFIG.batteryLevel;
  },
  get charging() {
    return (useRealBattery && realBatteryInstance) ? realBatteryInstance.charging : isMockCharging;
  },
  addEventListener: (type, cb) => { if (batteryListeners[type]) batteryListeners[type].push(cb); },
  removeEventListener: (_type, _cb) => {},
  dispatchEvent: () => true
};

function triggerBatteryEvent(type) {
  if (batteryListeners[type]) {
    batteryListeners[type].forEach(cb => cb({ target: mockBattery }));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('keydown', async (e) => {
  const key = e.key.toLowerCase();
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  if (key === '`') {
    window.location.href = './index.html';
    return;
  }

  if (key === 'o') {
    showDebugPanel = !showDebugPanel;
    const debugPanel = document.getElementById('dev-debug-panel');
    const mobileBar = document.getElementById('mobile-shortcut-bar');
    if (debugPanel) debugPanel.style.display = showDebugPanel ? 'block' : 'none';
    if (mobileBar) mobileBar.style.display = showDebugPanel ? 'flex' : 'none';
  }
  if (key === 'h') showShortcutsHint = !showShortcutsHint;
  if (key === 'r') startEngine(canvas);
  if (key === 's') saveGame();
  if (key === 'l') loadSavedGame();
  if (key === 'c') {
    isMockCharging = !isMockCharging;
    triggerBatteryEvent('chargingchange');
  }

  if (key === 'k') {
    if (useRealBattery) return;
    if (CONFIG.batteryLevel <= 0) {
      CONFIG.batteryLevel = 1.0;
      triggerBatteryEvent('levelchange');
      return;
    }
    isAutoDraining = !isAutoDraining;
    if (isAutoDraining) {
      drainInterval = setInterval(() => {
        if (CONFIG.batteryLevel > 0) {
          CONFIG.batteryLevel = Math.max(0, CONFIG.batteryLevel - 0.01);
          triggerBatteryEvent('levelchange');
          if (CONFIG.batteryLevel === 0) {
             clearInterval(drainInterval);
             isAutoDraining = false;
          }
        }
      }, 1000);
    } else {
      clearInterval(drainInterval);
    }
  }

  // ── FIXED TOGGLE LOGIC ──
  if (key === 'b') {
    useRealBattery = !useRealBattery; // Toggle the state FIRST

    if (useRealBattery) {
      const realBattery = await initBattery();
      if (realBattery) {
        realBatteryInstance = realBattery;
        setForceScreen(null);
        console.log('[test] Switched to Real API');
      } else {
        // DO NOT revert useRealBattery to false here!
        // We leave it true so the button stays lit and the state machine knows we are in the "failed real" state.
        realBatteryInstance = null;
        setForceScreen('unsupported');
        console.warn('[test] Hardware unsupported');
      }
    } else {
      // Switches cleanly back to mock on the next tap
      await initBattery(mockBattery);
      realBatteryInstance = null;
      setForceScreen(null);
      console.log('[test] Switched to Mock');
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    triggerBatteryEvent('levelchange');
  }

  if (key === 'z') {
    if (drainInterval) clearInterval(drainInterval);
    isAutoDraining = false;
    Object.assign(CONFIG, DEFAULT_CONFIG);
    isMockCharging = false;
    useRealBattery = false;
    setForceScreen(null);
    localStorage.clear();
    triggerBatteryEvent('chargingchange');
    triggerBatteryEvent('levelchange');
    startEngine(canvas);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// VISUAL DEBUG HARNESS
// ─────────────────────────────────────────────────────────────────────────────
function initVisualDebugger() {
  const panel = document.createElement('div');
  panel.id = 'dev-debug-panel';
  panel.style.cssText = `
    position: fixed; top: 10px; right: 10px; background: rgba(8, 0, 16, 0.9);
    border: 1px solid #7c3aed; color: #e9d5ff; font-family: 'Courier New', monospace;
    font-size: 10px; padding: 8px 12px; border-radius: 4px; z-index: 9999;
    pointer-events: none; min-width: 160px; box-shadow: 0 0 10px rgba(124,58,237,0.3);
  `;
  document.body.appendChild(panel);

  let frameCount = 0;
  let lastFpsTime = performance.now();
  let currentFps = 0;

  function updateDebugUI() {
    const now = performance.now();
    frameCount++;
    if (now - lastFpsTime >= 500) {
      currentFps = Math.round((frameCount * 1000) / (now - lastFpsTime));
      frameCount = 0; lastFpsTime = now;
    }

    const currentLevel = mockBattery.level;
    const currentSpeed = getBatterySpeed ? getBatterySpeed(currentLevel).toFixed(2) : 'N/A';
    const controlMode = getControlMethod ? getControlMethod().toUpperCase() : 'N/A';
    const touchData = document.getElementById('debug-touch')?.innerText || 'None';
    const tiltData = document.getElementById('debug-tilt')?.innerText || 'None';

    // ── DYNAMIC SOURCE DISPLAY ──
    let sourceText = 'MOCK';
    let sourceColor = '#fbbf24';
    if (useRealBattery) {
      if (realBatteryInstance) {
        sourceText = 'REAL API';
        sourceColor = '#22c55e';
      } else {
        sourceText = 'UNSUPPORTED';
        sourceColor = '#ef4444';
      }
    }

    const shortcutsHTML = showShortcutsHint ? `
      <hr style="border-color:#4c1d95; margin: 6px 0;">
      <div style="color:#d946ef; margin-bottom:4px; font-weight:bold;">// SHORTCUTS</div>
      <div style="color:#a78bfa; line-height: 1.4;">
        [B] Toggle Real/Mock<br>[C] Plug/Unplug Charger<br>
        [K] Auto-Drain: <span style="color:${isAutoDraining ? '#ef4444' : '#a78bfa'}">${isAutoDraining ? 'ACTIVE' : 'OFF'}</span><br>
        [\`] Exit to Main Game<br>
        [R] Restart Game<br>[S] Save &nbsp;|&nbsp; [L] Load<br>[Z] Hard Reset<br>[H] Toggle Hints<br>Tap Score to Hide UI
      </div>
    ` : '';

    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; color:#22d3ee; margin-bottom:4px; font-weight:bold;">
        <span>// ENGINE</span> <span style="color:${currentFps < 30 ? '#ef4444' : '#22c55e'}">${currentFps} FPS</span>
      </div>
      <div>Source:  <span style="color:${sourceColor}">${sourceText}</span></div>
      <div>Battery: ${(currentLevel * 100).toFixed(0)}%</div>
      <div>Speedx:  ${currentSpeed}</div>
      <div>Plugged: <span style="color:${mockBattery.charging ? '#ef4444' : '#a78bfa'}">${mockBattery.charging ? 'YES (WIRUS)' : 'NO'}</span></div>
      <hr style="border-color:#4c1d95; margin: 6px 0;">
      <div style="color:#22d3ee; margin-bottom:4px; font-weight:bold;">// INPUT (${controlMode})</div>
      <div>Lane:  ${inputState.lane === -1 ? 'LEFT' : inputState.lane === 1 ? 'RIGHT' : 'CENTER'}</div>
      <div>Jump:  <span style="color:${inputState.jumpTriggered ? '#22c55e' : '#a78bfa'}">${inputState.jumpTriggered}</span></div>
      <div style="color:#6d28d9; margin-top:2px;">[Tch] ${touchData}</div>
      <div style="color:#6d28d9;">[Tlt] ${tiltData}</div>
      <hr style="border-color:#4c1d95; margin: 6px 0;">
      <div style="color:#22d3ee; margin-bottom:4px; font-weight:bold;">// MEDIA & SENSORS</div>
      <div>Audio: <span style="color:${getMuteState() ? '#ef4444' : '#22c55e'}">${getMuteState() ? 'MUTED' : 'ACTIVE'}</span></div>
      <div>Track: <span style="color:#22d3ee">${debugCurrentBGM}</span></div>
      <div>SFX:   <span style="color:${debugLastSound !== 'None' ? '#d946ef' : '#a78bfa'}">${debugLastSound}</span></div>
      <div>Motor: <span style="color:${debugLastHaptic !== 'None' ? '#fbbf24' : '#a78bfa'}">${debugLastHaptic}</span></div>
      ${shortcutsHTML}
    `;

    const btnB = document.getElementById('btn-shortcut-b');
    if (btnB) btnB.style.background = useRealBattery ? '#d946ef' : '#1e0038';
    const btnC = document.getElementById('btn-shortcut-c');
    if (btnC) btnC.style.background = isMockCharging ? '#d946ef' : '#1e0038';
    const btnK = document.getElementById('btn-shortcut-k');
    if (btnK) btnK.style.background = isAutoDraining ? '#d946ef' : '#1e0038';
    const btnH = document.getElementById('btn-shortcut-h');
    if (btnH) btnH.style.background = showShortcutsHint ? '#d946ef' : '#1e0038';

    requestAnimationFrame(updateDebugUI);
  }
  requestAnimationFrame(updateDebugUI);
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE TOUCH SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────
function initMobileShortcuts() {
  const bar = document.createElement('div');
  bar.id = 'mobile-shortcut-bar';
  bar.style.cssText = `
    position: fixed; bottom: 15px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; z-index: 10000;
    background: rgba(8, 0, 16, 0.95); padding: 8px; border: 1px solid #7c3aed; border-radius: 6px;
    box-shadow: 0 0 15px rgba(124,58,237,0.4); flex-wrap: wrap; justify-content: center; width: 95%; max-width: 450px;
  `;

  const shortcuts = [
    { key: 'b', label: 'B', desc: 'API',   isToggle: true },
    { key: 'c', label: 'C', desc: 'PLUG',  isToggle: true },
    { key: 'k', label: 'K', desc: 'DRAIN', isToggle: true },
    { key: 'h', label: 'H', desc: 'HINTS', isToggle: true },
    { key: 'r', label: 'R', desc: 'RST',   isToggle: false },
    { key: 's', label: 'S', desc: 'SAVE',  isToggle: false },
    { key: 'l', label: 'L', desc: 'LOAD',  isToggle: false },
    { key: 'z', label: 'Z', desc: 'NUKE',  isToggle: false }
  ];

  shortcuts.forEach(sc => {
    const btn = document.createElement('button');
    btn.id = `btn-shortcut-${sc.key}`;
    btn.innerHTML = `<strong style="font-size:16px; color:#e9d5ff;">${sc.label}</strong><br><span style="font-size:9px; color:#a78bfa;">${sc.desc}</span>`;
    btn.style.cssText = 'flex: 1; background: #1e0038; border: 1px solid #a855f7; border-radius: 4px; padding: 6px 2px; font-family: \'Courier New\', monospace; cursor: pointer; touch-action: manipulation;';

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: sc.key }));
      if (!sc.isToggle) {
        btn.style.background = '#d946ef';
        setTimeout(() => { btn.style.background = '#1e0038'; }, 150);
      }
    });
    bar.appendChild(btn);
  });
  document.body.appendChild(bar);
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOT SEQUENCE
// ─────────────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('game');
canvas.width = 720; canvas.height = 1280;
canvas.setAttribute('tabindex', '0');
canvas.focus();
canvas.addEventListener('click', () => canvas.focus());
canvas.addEventListener('touchstart', () => canvas.focus());

async function boot() {
  console.log('[test] Booting test harness...');
  initScreens(canvas);

  setBatteryConfig({ minSpeed: CONFIG.minSpeed, maxSpeed: CONFIG.maxSpeed, exp: CONFIG.speedExponent });
  setEngineConfig({ jumpForce: CONFIG.jumpForce, gravity: CONFIG.gravity });
  setSpawnRate(CONFIG.spawnRate);

  await initBattery(mockBattery);

  await preloadAssets();
  initInput();
  initEngineKeyBindings();

  initVisualDebugger();
  initMobileShortcuts();

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
    const offsetX = (rect.width - canvas.width * scale) / 2;
    const offsetY = (rect.height - canvas.height * scale) / 2;
    const x = (e.clientX - rect.left - offsetX) / scale;
    const y = (e.clientY - rect.top - offsetY) / scale;

    if (x >= 0 && x <= 220 && y >= 0 && y <= 120) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'o' }));
    }
  });

  startEngine(canvas);
}

document.addEventListener('DOMContentLoaded', boot);
