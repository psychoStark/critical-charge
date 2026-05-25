// battery.js
// Manages the device's battery status and converts it into game mechanics.
// The Battery Status API provides real-time battery level (0.0 to 1.0),
// which directly influences the player's speed in the game.
// Returns null if the API is unsupported — main.js treats null as a permanent block.

/**
 * Internal reference to the BatteryManager object from the Battery Status API.
 * This object provides real-time updates on battery level, charging status, etc.
 * @type {BatteryManager|null}
 */
let batteryRef = null;

/**
 * Minimum speed multiplier when battery is fully charged (100%).
 * At full charge, the player moves at the slowest pace, making the game easier.
 * @type {number}
 */
export let MIN_SPEED = 1.0;

/**
 * Maximum speed multiplier when battery is depleted (0%).
 * At no charge, the player moves 8x faster, making the game much harder.
 * This creates urgency as the battery drains!
 * @type {number}
 */
export let MAX_SPEED = 8.0;

/**
 * Curve exponent for battery speed calculation.
 * @type {number}
 */
export let SPEED_EXPONENT = 1.0;

/**
 * Sets battery configuration for testing purposes.
 * @param {Object} config - Configuration object
 * @param {number} [config.minSpeed] - Minimum speed multiplier
 * @param {number} [config.maxSpeed] - Maximum speed multiplier
 * @param {number} [config.exp] - Curve exponent
 */
export function setBatteryConfig(config) {
  if (config.minSpeed !== undefined) MIN_SPEED = config.minSpeed;
  if (config.maxSpeed !== undefined) MAX_SPEED = config.maxSpeed;
  if (config.exp !== undefined) SPEED_EXPONENT = config.exp;
}

/**
 * Initializes the Battery Status API connection.
 * This function attempts to access the device's battery information.
 * If successful, it returns the BatteryManager object; otherwise, it returns null.
 *
 * @param {Object|null} simulatedBattery - Optional simulated battery object for testing
 * @returns {Promise<BatteryManager|null>} BatteryManager object if supported, otherwise null
 */
export async function initBattery(simulatedBattery = null) {
  // If a simulated battery is provided (test mode), use it directly
  if (simulatedBattery) {
    batteryRef = simulatedBattery;
    return batteryRef;
  }

  // navigator.getBattery is undefined on iOS Safari and Firefox
  if (!navigator.getBattery) {
    return null;
  }

  try {
    batteryRef = await navigator.getBattery();
    return batteryRef;
  } catch (err) {
    // API exists but threw (e.g., permission denied on some Android builds)
    console.warn('Battery API failed:', err);
    return null;
  }
}

/**
 * Retrieves the current battery level from the BatteryManager.
 * This function is called every frame by the game engine to adjust gameplay.
 *
 * Battery Level Effects:
 * - At 100% charge (1.0), the player moves at the slowest speed (MIN_SPEED)
 * - At 0% charge (0.0), the player moves at the fastest speed (MAX_SPEED)
 * - This creates a challenging dynamic: lower battery = harder gameplay!
 *
 * @returns {number} Current battery level (0.0 to 1.0), or 1.0 if API is unsupported
 */
export function getBatteryLevel() {
  if (!batteryRef) return 1.0; // safe fallback: treat as full
  return batteryRef.level;
}

/**
 * Converts battery level into game speed using an inverse relationship.
 * This creates the core gameplay mechanic: lower battery = higher speed.
 *
 * Speed Calculation:
 * - MIN_SPEED: Speed when battery is at 100% (1.0)
 * - MAX_SPEED: Speed when battery is at 0% (8.0)
 * - The formula creates a progression between these extremes based on exponent
 *
 * @param {number} level - Current battery level (0.0 to 1.0)
 * @returns {number} Game speed multiplier based on battery level
 */
export function getBatterySpeed(level) {
  const t = Math.pow(1.0 - level, SPEED_EXPONENT);
  return MIN_SPEED + (MAX_SPEED - MIN_SPEED) * t;
}
