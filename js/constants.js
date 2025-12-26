export const PhysicsParams = {
    GRAVITY: 0.5,           // px/frame^2
    AIR_DENSITY: 0.02,      // Atmospheric density
    GROUND_ROUGHNESS: 0.6,  // Ground friction coefficient
    WALL_ROUGHNESS: 0.4,    // Wall friction coefficient
    WALL_BOUNCE: 0.5,       // Restitution for walls
    GROUND_BOUNCE: 0.3,     // Restitution for ground
    RECOIL_MULTIPLIER: 10.0 // Multiplier for propulsion
};

export const maxBullets = 20;
export const wallHitCooldown = 500;
export const speedThreshold = 10;
export const wallBuffer = 20;

