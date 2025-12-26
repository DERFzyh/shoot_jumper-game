import { PhysicsParams, wallHitCooldown, speedThreshold } from './constants.js';

let lastWallHitTime = 0;

// Generalized Wall Collision
// Helper function to find the closest point on a line segment to a circle's center
function closestPointOnSegment(p1, p2, circle) {
    const segment = { x: p2.x - p1.x, y: p2.y - p1.y };
    const segmentLengthSq = segment.x * segment.x + segment.y * segment.y;

    if (segmentLengthSq === 0) { // p1 and p2 are the same point
        return p1;
    }

    const t = ((circle.x - p1.x) * segment.x + (circle.y - p1.y) * segment.y) / segmentLengthSq;

    if (t < 0) {
        return p1;
    } else if (t > 1) {
        return p2;
    } else {
        return { x: p1.x + t * segment.x, y: p1.y + t * segment.y };
    }
}

// Generalized Wall Collision
export function applyWallCollision(entity, wall, isPlayer = false, health = 0) {
    if (!entity.physicsTraits.wallCollide) return health;

    if (wall.allowedThroughList.includes(entity.constructor.name)) {
        return health;
    }

    const now = Date.now();
    let hit = false;

    // Calculate the closest point on the wall's center line segment to the entity's center
    const closest = closestPointOnSegment(wall.p1, wall.p2, entity);

    const dx = entity.x - closest.x;
    const dy = entity.y - closest.y;
    const distanceSq = dx * dx + dy * dy;
    const combinedRadius = entity.radius + wall.thickness / 2;

    if (distanceSq < combinedRadius * combinedRadius) {
        // Collision detected
        hit = true;

        const distance = Math.sqrt(distanceSq);
        const overlap = combinedRadius - distance;

        // Move entity out of collision
        if (distance < 0.001) { // Entity is very close to or exactly at the center of the wall segment
            const wallDx = wall.p2.x - wall.p1.x;
            const wallDy = wall.p2.y - wall.p1.y;
            let normalX, normalY;

            if (Math.abs(wallDx) > Math.abs(wallDy)) { // More horizontal wall
                normalX = 0;
                normalY = (entity.y > wall.p1.y) ? 1 : -1; // Push away vertically
            } else { // More vertical wall
                normalX = (entity.x > wall.p1.x) ? 1 : -1; // Push away horizontally
                normalY = 0;
            }
            // Normalize if needed, though for axis-aligned this is already unit

            entity.x += normalX * (combinedRadius + 1); // Push away with a small buffer
            entity.y += normalY * (combinedRadius + 1);

            // Apply a simple bounce (might not be perfectly accurate, but prevents sticking)
            entity.vx *= -wall.bounce;
            entity.vy *= -wall.bounce;

        } else {
            const normalX = dx / distance;
            const normalY = dy / distance;

            entity.x += normalX * overlap;
            entity.y += normalY * overlap;

            // Separate velocity into normal and tangent components
            const dotProduct = entity.vx * normalX + entity.vy * normalY; // Define dotProduct here
            const normalVelocity = dotProduct;
            const tangentVelocityX = entity.vx - normalVelocity * normalX;
            const tangentVelocityY = entity.vy - normalVelocity * normalY;

            // Apply restitution to normal velocity
            const newNormalVelocity = -normalVelocity * wall.bounce;

            // Apply friction to tangent velocity
            const tangentSpeed = Math.sqrt(tangentVelocityX * tangentVelocityX + tangentVelocityY * tangentVelocityY);
            if (tangentSpeed > 0.001) {
                const frictionMagnitude = wall.roughness * Math.abs(newNormalVelocity); // Friction based on normal force magnitude
                const frictionEffect = Math.min(tangentSpeed, frictionMagnitude);
                const frictionRatio = (tangentSpeed - frictionEffect) / tangentSpeed;

                entity.vx = (normalX * newNormalVelocity) + (tangentVelocityX * frictionRatio);
                entity.vy = (normalY * newNormalVelocity) + (tangentVelocityY * frictionRatio);
            } else {
                entity.vx = normalX * newNormalVelocity;
                entity.vy = normalY * newNormalVelocity;
            }
        }
    }

    if (hit && isPlayer) {
        const speed = Math.sqrt(entity.vx * entity.vx + entity.vy * entity.vy);
        if (speed > speedThreshold && now - lastWallHitTime > wallHitCooldown) {
            health = Math.max(0, health - 1);
            lastWallHitTime = now;
        }
    }
    return health;
}

// Object Pooling
export const bulletPool = [];
export const enemyPool = [];

export function getFromPool(pool, classType, ...args) {
    if (pool.length > 0) {
        const obj = pool.pop();
        obj.reset(...args);
        return obj;
    }
    return new classType(...args);
}

export function returnToPool(pool, obj) {
    pool.push(obj);
}

export function isOutOfBounds(entity, canvasWidth, canvasHeight) {
    const limit = 1000; // Culling distance
    return (entity.x < -limit || entity.x > canvasWidth + limit ||
        entity.y < -limit || entity.y > canvasHeight + limit);
}

