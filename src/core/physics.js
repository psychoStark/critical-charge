// src/core/physics.js

export function applyGravity(currentHeight, currentVelocity, gravity, dt) {
  let newVelocity = currentVelocity + (gravity * dt);
  let newHeight = currentHeight + (newVelocity * dt);
  
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
    // We use the same collision math as before, but encapsulated here
    if (obs.z < 0.08 && obs.z > 0.02 && obs.lane === playerLane) {
      // 50 is the clearance height; you can make this dynamic later!
      if (playerJumpHeight < 120) {
        return true; // CRASH!
      }
    }
  }
  return false;
}