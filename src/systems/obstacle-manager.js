// src/systems/obstacle-manager.js
import { randomInt } from '../utils/math.js';

let obstacles = [];

// ── ADDING NEW ENEMIES: STEP 1 ──
// To add new enemies later, add their string names to this array.
// IMPORTANT: The string must perfectly match the 'id' you give the image in asset-cache.js!
// Example for later: const ENEMY_TYPES = ['enemy_charger', 'drone', 'laser_wall'];
const ENEMY_TYPES = ['enemy_charger']; // Placeholder for future enemy types – add new IDs here and define their speed multipliers.

export function resetObstacles() {
  obstacles = [];
}

export function spawnRandomObstacle(startZ = 5.0) {
  const typeIndex = randomInt(0, ENEMY_TYPES.length - 1);
  const lane = randomInt(-1, 1);

  const selectedType = ENEMY_TYPES[typeIndex];

  // ── ADDING NEW ENEMIES: STEP 2 ──
  // If your new enemy needs unique physics or stats, define them here based on the selectedType.
  obstacles.push({
    z: startZ,
    lane: lane,
    type: selectedType,
    // Example: The enemy_charger moves 1.5x faster than the road. Everything else moves at 1.0x.
    // If you add a 'drone' later, you could chain it like this:
    // speedMultiplier: selectedType === 'enemy_charger' ? 1.5 : (selectedType === 'drone' ? 0.8 : 1.0)
    speedMultiplier: selectedType === 'enemy_charger' ? 1.5 : 1.0,
  });

  // Keep obstacles sorted by Z descending for the painter's algorithm
  obstacles.sort((a, b) => b.z - a.z);
}

export function updateAndGetObstacles(dt, gameSpeed) {
  // Move obstacles toward player
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];

    // Calculate final speed based on the game's base speed AND the enemy's personal multiplier
    const obsSpeed = gameSpeed * (obs.speedMultiplier || 1.0);
    obs.z -= dt * obsSpeed * 0.4;

    // Remove the obstacle when it passes behind the camera
    if (obs.z < 0.02) {
      obstacles.splice(i, 1);
    }
  }

  // Since all obstacles move at similar rates (z decreases),
  // their relative Z order mostly stays the same.
  // We only really need to sort when spawning a new one or if speeds differ significantly.
  // For safety and correctness with different speed multipliers, we sort here too,
  // but only if there are multiple obstacles.
  if (obstacles.length > 1) {
    obstacles.sort((a, b) => b.z - a.z);
  }

  return obstacles;
}

/**
 * Overwrites the obstacle array (used when loading a saved game).
 */
export function setObstacles(savedObstacles) {
  obstacles = savedObstacles;
  obstacles.sort((a, b) => b.z - a.z);
}
