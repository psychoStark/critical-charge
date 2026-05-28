// src/core/physics.js

export function applyGravity(currentHeight, currentVelocity, gravity, dt) {
  let newVelocity = currentVelocity + (gravity * dt);
  let newHeight = currentHeight + (newVelocity * dt);
  
  // Hit the ground
  if (newHeight < 0) {
    newHeight = 0;
    newVelocity = 0;
  }
  
  return { height: newHeight, velocity: newVelocity };
}

export function checkCollision(obstacle, playerLane, playerJumpHeight, jumpClearanceHeight = 50) {
  // Check Z-depth crash zone
  if (obstacle.z < 0.08 && obstacle.z > 0.02) {
    // Check Lane
    if (obstacle.lane === playerLane) {
      // Check Height
      if (playerJumpHeight < jumpClearanceHeight) {
        return true; // CRASH!
      }
    }
  }
  return false; // Safe
}