import { PhysicsParams, wallBuffer } from './constants.js';
import { applyWallCollision, getFromPool, returnToPool, enemyPool, bulletPool } from './utils.js';

export class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;

        // Physics properties
        this.mass = 60;       // kg
        this.area = 0.5;      // m^2 (frontal area)
        this.dragCoeff = 1.0; // Cd
        this.radius = 20;     // Radius for collision detection

        this.physicsTraits = {
            gravity: true,
            drag: true,
            friction: true,
            wallCollide: true
        };
    }
    update(mouseX, mouseY, canvasHeight, walls) {
        // Adjust mouse coordinates for camera translation
        // The camera translation is (canvas.width / 2 - player.x, canvas.height / 2 - player.y)
        // So, worldX = mouseX_screen - cameraX = mouseX_screen - (canvas.width / 2 - player.x)
        // worldY = mouseY_screen - cameraY = mouseY_screen - (canvas.height / 2 - player.y)
        const canvas = document.getElementById("gameCanvas"); // Get canvas to access its dimensions
        const worldMouseX = mouseX - (canvas.width / 2 - this.x);
        const worldMouseY = mouseY - (canvas.height / 2 - this.y);

        this.angle = Math.atan2(worldMouseY - this.y, worldMouseX - this.x);

        // --- Physics Calculations ---
        let Fx = 0;
        let Fy = 0;

        // 1. Gravity
        if (this.physicsTraits.gravity) {
            Fy += this.mass * PhysicsParams.GRAVITY;
        }

        // 2. Air Resistance (Drag)
        if (this.physicsTraits.drag) {
            const vSq = this.vx * this.vx + this.vy * this.vy;
            const v = Math.sqrt(vSq);
            if (v > 0.001) {
                const dragMag = 0.5 * PhysicsParams.AIR_DENSITY * this.dragCoeff * this.area * vSq;
                Fx -= (this.vx / v) * dragMag;
                Fy -= (this.vy / v) * dragMag;
            }
        }

        // 3. Friction (Ground & Wall)
        if (this.physicsTraits.friction) {
            // Simple check for contact
            let onGround = this.y >= canvasHeight - wallBuffer - 1;
            if (onGround) {
                const normalForce = this.mass * PhysicsParams.GRAVITY; // Simplified
                const frictionMag = normalForce * PhysicsParams.GROUND_ROUGHNESS;

                // Apply friction opposite to X velocity
                if (Math.abs(this.vx) > 0.01) {
                    const dir = Math.sign(this.vx);
                    // Don't overshoot 0
                    const f = Math.min(Math.abs(this.vx) * this.mass, frictionMag);
                    Fx -= dir * f;
                }
            }
        }

        // Apply Forces
        const ax = Fx / this.mass;
        const ay = Fy / this.mass;

        this.vx += ax;
        this.vy += ay;

        this.x += this.vx;
        this.y += this.vy;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = "aqua";
        ctx.shadowColor = "cyan";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-15, 10);
        ctx.lineTo(-15, -10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

export class Bullet {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;

        this.mass = 0.5;      // kg
        this.area = 0.05;     // Small area
        this.dragCoeff = 0.4; // Streamlined

        this.physicsTraits = {
            gravity: true,
            drag: true,
            friction: false,
            wallCollide: true // Bullets now collide
        };
        this.active = true;
    }
    reset(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.active = true;
    }

    update() {
        // Physics
        let Fx = 0;
        let Fy = 0;

        if (this.physicsTraits.gravity) Fy += this.mass * PhysicsParams.GRAVITY;

        if (this.physicsTraits.drag) {
            const vSq = this.vx * this.vx + this.vy * this.vy;
            const v = Math.sqrt(vSq);
            if (v > 0.001) {
                const dragMag = 0.5 * PhysicsParams.AIR_DENSITY * this.dragCoeff * this.area * vSq;
                Fx -= (this.vx / v) * dragMag;
                Fy -= (this.vy / v) * dragMag;
            }
        }

        const ax = Fx / this.mass;
        const ay = Fy / this.mass;

        this.vx += ax;
        this.vy += ay;

        this.x += this.vx;
        this.y += this.vy;
    }
    draw(ctx) {
        ctx.fillStyle = "orange";
        ctx.shadowColor = "yellow";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

export class Point {
    constructor(x, y, color, value) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.value = value;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
        ctx.fill();
    }
}

export class Wall {
    constructor(p1, p2, thickness, bounce, roughness, allowedThroughList = []) {
        this.p1 = p1;
        this.p2 = p2;
        this.thickness = thickness;
        this.bounce = bounce;
        this.roughness = roughness;
        this.allowedThroughList = allowedThroughList;

        // For drawing, we'll calculate x, y, width, height assuming horizontal or vertical walls for now
        // This can be expanded for angled walls later if needed.
        this.x = Math.min(p1.x, p2.x) - (p1.y === p2.y ? 0 : thickness / 2); // Adjust for thickness if vertical
        this.y = Math.min(p1.y, p2.y) - (p1.x === p2.x ? 0 : thickness / 2); // Adjust for thickness if horizontal
        this.width = Math.abs(p1.x - p2.x) + (p1.y === p2.y ? 0 : thickness);
        this.height = Math.abs(p1.y - p2.y) + (p1.x === p2.x ? 0 : thickness);
    }

    draw(ctx) {
        ctx.save();
        const dx = this.p2.x - this.p1.x;
        const dy = this.p2.y - this.p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        // Translate to the center of p1
        ctx.translate(this.p1.x, this.p1.y);
        // Rotate to the angle of the wall
        ctx.rotate(angle);

        // Draw the rectangle (rotated)
        ctx.fillStyle = "rgba(100, 100, 100, 0.5)"; // Semi-transparent grey for walls
        ctx.fillRect(0, -this.thickness / 2, length, this.thickness);
        ctx.restore();
    }
}

export class Enemy {
    constructor() {
        this.x = Math.random() * 1000; // Placeholder, will be reset
        this.y = -20;
        this.vx = 0;
        this.vy = 0;
        this.health = 3; // Add health property

        this.mass = 40;
        this.area = 0.4;
        this.dragCoeff = 1.2; // Less aerodynamic
        this.radius = 15;
        this.propulsionForce = 15; // Force to move towards player

        this.physicsTraits = {
            gravity: true,
            drag: true,
            friction: true,
            wallCollide: true
        };
        this.active = true;
    }
    reset(canvasWidth) {
        this.x = Math.random() * canvasWidth;
        this.y = -20;
        this.vx = 0;
        this.vy = 0;
        this.health = 3; // Reset health
        this.active = true;
    }

    update(player, enemies) {
        // AI Steering Force
        const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
        let Fx = Math.cos(angleToPlayer) * this.propulsionForce;
        let Fy = Math.sin(angleToPlayer) * this.propulsionForce;

        // Repulsion from other enemies
        for (let other of enemies) {
            if (other === this) continue;
            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = this.radius + other.radius;
            if (distance < minDistance * 1.5) {
                const angle = Math.atan2(dy, dx);
                const force = 50 * (1 - distance / (minDistance * 1.5)); // Strong repulsion force
                Fx -= Math.cos(angle) * force;
                Fy -= Math.sin(angle) * force;
            }
        }

        // Physics
        if (this.physicsTraits.gravity) Fy += this.mass * PhysicsParams.GRAVITY;

        if (this.physicsTraits.drag) {
            const vSq = this.vx * this.vx + this.vy * this.vy;
            const v = Math.sqrt(vSq);
            if (v > 0.001) {
                const dragMag = 0.5 * PhysicsParams.AIR_DENSITY * this.dragCoeff * this.area * vSq;
                Fx -= (this.vx / v) * dragMag;
                Fy -= (this.vy / v) * dragMag;
            }
        }

        const ax = Fx / this.mass;
        const ay = Fy / this.mass;

        this.vx += ax;
        this.vy += ay;

        this.x += this.vx;
        this.y += this.vy;
    }
    draw(ctx) {
        ctx.fillStyle = "crimson";
        ctx.shadowColor = "red";
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

