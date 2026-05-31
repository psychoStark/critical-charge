// src/core/physics.js

// ── Collision config ──
const COLLISION_Z_MAX = 0.08;
const COLLISION_Z_MIN = 0.02;
const COLLISION_JUMP_CLEARANCE = 120;

export function applyGravity(currentHeight, currentVelocity, gravity, dt) {
  let newVelocity = currentVelocity + gravity * dt;
  let newHeight = currentHeight + newVelocity * dt;

  if (newHeight < 0) {
    newHeight = 0;
    newVelocity = 0;
  }

  return { height: newHeight, velocity: newVelocity };
}

/**
 * Checks if the player is hitting ANY obstacle in the provided list.
 */
export function checkAllCollisions(obstacles, playerLane, playerJumpHeight) {
  for (const obs of obstacles) {
    if (obs.z < COLLISION_Z_MAX && obs.z > COLLISION_Z_MIN && obs.lane === playerLane) {
      if (playerJumpHeight < COLLISION_JUMP_CLEARANCE) {
        return true; // CRASH!
      }
    }
  }
  return false;
}
