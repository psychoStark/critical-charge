// src/systems/haptics.js

let effectTimer = null;

export let debugLastHaptic = 'None';
let debugHapticTimer = null;

export function vibrate(pattern) {
    if (pattern !== 0) {
    debugLastHaptic = Array.isArray(pattern) ? `[${pattern.join(',')}]` : `${pattern}ms`;
    if (debugHapticTimer) clearTimeout(debugHapticTimer);
    debugHapticTimer = setTimeout(() => { debugLastHaptic = 'None'; }, 300);
  }
  // Safely trigger hardware vibration if supported
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}

// ── UI & GAMEPLAY ──
export function hapticTap() { vibrate(15); } // Subtle, sharp UI click
export function hapticCrash() { vibrate([100, 30, 200, 30, 400]); } // Heavy impact rumble
export function hapticJump() { vibrate(25); } // Sharp pop for launch
export function hapticLand() { vibrate(10); } // Very subtle thud for landing
export function hapticMove() { vibrate(8); }  // Barely noticeable tick for lane change

// ── W.I.R.U.S. EFFECTS ──
export function startHijackedHaptics() {
  stopHaptics();
  let lastBlinkState = false;
  
  effectTimer = setInterval(() => {
    const isRed = Math.floor(Date.now() / 300) % 2 === 0;
    if (isRed && !lastBlinkState) vibrate(150);
    lastBlinkState = isRed;
  }, 50); 
}

export function startCorruptedHaptics() {
  stopHaptics();
  effectTimer = setInterval(() => {
    vibrate([
      Math.random() * 50 + 20, 20, 
      Math.random() * 100 + 40, 20, 
      Math.random() * 60 + 20
    ]);
  }, 250);
}

export function stopHaptics() {
  // FIX: Only force-stop the hardware if an earthquake effect was actively running!
  if (effectTimer) {
    clearInterval(effectTimer);
    effectTimer = null;
    vibrate(0); 
  }
}