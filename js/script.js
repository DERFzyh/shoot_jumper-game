const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

const PhysicsParams = {
    GRAVITY: 0.5,           // px/frame^2
    AIR_DENSITY: 0.02,      // Atmospheric density
    GROUND_ROUGHNESS: 0.6,  // Ground friction coefficient
    WALL_ROUGHNESS: 0.4,    // Wall friction coefficient
    WALL_BOUNCE: 0.5,       // Restitution for walls
    GROUND_BOUNCE: 0.3,     // Restitution for ground
    RECOIL_MULTIPLIER: 10.0 // Multiplier for propulsion
};

const maxBullets = 20;
let score = 0;
let health = 5;
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;
let gameOver = false;
let damageOverlay = 0;

const restartButton = document.getElementById("restartButton");
restartButton.onclick = () => {
    score = 0;
    health = 5;
    gameOver = false;
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.vx = 0;
    player.vy = 0;
    bullets.length = 0;
    enemies.length = 0;
    spawnPoints();
    restartButton.style.display = "none";
    gameLoop();
};

const wallHitCooldown = 500;
const speedThreshold = 10;
const wallBuffer = 20;
let lastWallHitTime = 0;

// --- Optimization & Physics Helpers ---

// Generalized Wall Collision
function applyWallCollision(entity, wall, isPlayer = false) {
    if (!entity.physicsTraits.wallCollide) return;

    const now = Date.now();
    let hit = false;

    // Check for collision with the wall
    if (entity.x < wall.x + wall.width &&
        entity.x + entity.radius > wall.x &&
        entity.y < wall.y + wall.height &&
        entity.y + entity.radius > wall.y) {

        // Determine which side of the wall was hit
        const overlapX = Math.min(entity.x + entity.radius - wall.x, wall.x + wall.width - entity.x);
        const overlapY = Math.min(entity.y + entity.radius - wall.y, wall.y + wall.height - entity.y);

        if (overlapX < overlapY) {
            // Horizontal collision
            if (entity.x < wall.x) {
                entity.x = wall.x - entity.radius;
            } else {
                entity.x = wall.x + wall.width;
            }
            entity.vx *= -wall.bounce;
            hit = true;
        } else {
            // Vertical collision
            if (entity.y < wall.y) {
                entity.y = wall.y - entity.radius;
            } else {
                entity.y = wall.y + wall.height;
            }
            entity.vy *= -wall.bounce;
            if (Math.abs(entity.vy) < PhysicsParams.GRAVITY) entity.vy = 0;
            hit = true;
        }
    }

    if (hit && isPlayer) {
        const speed = Math.sqrt(entity.vx * entity.vx + entity.vy * entity.vy);
        if (speed > speedThreshold && now - lastWallHitTime > wallHitCooldown) {
            health = Math.max(0, health - 1);
            lastWallHitTime = now;
            damageOverlay = 1;
        }
    }
}

// Object Pooling
const bulletPool = [];
const enemyPool = [];

function getFromPool(pool, classType, ...args) {
    if (pool.length > 0) {
        const obj = pool.pop();
        obj.reset(...args);
        return obj;
    }
    return new classType(...args);
}

function returnToPool(pool, obj) {
    pool.push(obj);
}

function isOutOfBounds(entity) {
    const limit = 1000; // Culling distance
    return (entity.x < -limit || entity.x > canvas.width + limit ||
        entity.y < -limit || entity.y > canvas.height + limit);
}


class Player {
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
    update() {
        this.angle = Math.atan2(mouseY - this.y, mouseX - this.x);

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
            let onGround = this.y >= canvas.height - wallBuffer - 1;
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

        // --- Collision Handling ---
        walls.forEach(wall => applyWallCollision(this, wall, true));

    }
    draw() {
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

class Bullet {
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
    draw() {
        ctx.fillStyle = "orange";
        ctx.shadowColor = "yellow";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Point {
    constructor(x, y, color, value) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.value = value;
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Wall {
    constructor(x, y, width, height, bounce, roughness) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.bounce = bounce;
        this.roughness = roughness;
    }

    draw() {
        ctx.fillStyle = "rgba(100, 100, 100, 0.5)"; // Semi-transparent grey for walls
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Enemy {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = -20;
        this.vx = 0;
        this.vy = 0;

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
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = -20;
        this.vx = 0;
        this.vy = 0;
        this.active = true;
    }

    update() {
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
    draw() {
        ctx.fillStyle = "crimson";
        ctx.shadowColor = "red";
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

const player = new Player(canvas.width / 2, canvas.height / 2);
const bullets = [], points = [], enemies = [];
const walls = [];

function createWalls() {
    // Top Wall
    walls.push(new Wall(0, 0, canvas.width, wallBuffer, PhysicsParams.WALL_BOUNCE, PhysicsParams.WALL_ROUGHNESS));
    // Bottom Wall
    walls.push(new Wall(0, canvas.height - wallBuffer, canvas.width, wallBuffer, PhysicsParams.GROUND_BOUNCE, PhysicsParams.GROUND_ROUGHNESS));
    // Left Wall
    walls.push(new Wall(0, 0, wallBuffer, canvas.height, PhysicsParams.WALL_BOUNCE, PhysicsParams.WALL_ROUGHNESS));
    // Right Wall
    walls.push(new Wall(canvas.width - wallBuffer, 0, wallBuffer, canvas.height, PhysicsParams.WALL_BOUNCE, PhysicsParams.WALL_ROUGHNESS));
}

function spawnPoints() {
    points.length = 0;
    for (let i = 0; i < 8; i++) {
        let x = Math.random() * (canvas.width - 40) + 20;
        let y = Math.random() * (canvas.height - 40) + 20;
        let color, value;
        if (i % 4 === 0) color = "deepskyblue", value = 0;
        else if (i % 4 === 1) color = "magenta", value = 3;
        else if (i % 2 === 0) color = "yellow", value = 2;
        else color = "lime", value = 1;
        points.push(new Point(x, y, color, value));
    }
}

function checkCollisions() {
    // Check Points
    for (let i = points.length - 1; i >= 0; i--) {
        const point = points[i];
        let dx = player.x - point.x;
        let dy = player.y - point.y;
        if (Math.sqrt(dx * dx + dy * dy) < 25) {
            if (point.color === "yellow" || point.color === "lime") score += point.value;
            if (point.color === "deepskyblue") health = Math.min(health + 1, 5);
            points.splice(i, 1);
            continue;
        }

        for (let j = bullets.length - 1; j >= 0; j--) {
            const bullet = bullets[j];
            if (!bullet.active) continue;
            let bx = bullet.x - point.x;
            let by = bullet.y - point.y;
            if (Math.sqrt(bx * bx + by * by) < 20 && point.color === "lime") {
                score += point.value;
                points.splice(i, 1);
                bullet.active = false;
                break; // Bullet hit point
            }
        }
    }
    if (points.length === 0) spawnPoints();

    // Check Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (!enemy.active) continue;

        let dx = player.x - enemy.x;
        let dy = player.y - enemy.y;
        if (Math.sqrt(dx * dx + dy * dy) < 25) {
            enemy.active = false;
            health--;
            damageOverlay = 1;
            continue;
        }

        for (let j = bullets.length - 1; j >= 0; j--) {
            const bullet = bullets[j];
            if (!bullet.active) continue;
            let bx = bullet.x - enemy.x;
            let by = bullet.y - enemy.y;
            if (Math.sqrt(bx * bx + by * by) < 20) {
                score++;
                enemy.active = false;
                bullet.active = false;
                break; // Bullet hit enemy
            }
        }
    }
}

function drawDamageOverlay() {
    if (damageOverlay > 0) {
        const g = ctx;
        const alpha = 0.6 * damageOverlay;
        const size = 150;

        g.save();

        let grad = g.createLinearGradient(0, 0, 0, size);
        grad.addColorStop(0, `rgba(255, 0, 0, ${alpha})`);
        grad.addColorStop(1, `rgba(255, 0, 0, 0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, canvas.width, size);

        grad = g.createLinearGradient(0, canvas.height, 0, canvas.height - size);
        grad.addColorStop(0, `rgba(255, 0, 0, ${alpha})`);
        grad.addColorStop(1, `rgba(255, 0, 0, 0)`);
        g.fillStyle = grad;
        g.fillRect(0, canvas.height - size, canvas.width, size);

        grad = g.createLinearGradient(0, 0, size, 0);
        grad.addColorStop(0, `rgba(255, 0, 0, ${alpha})`);
        grad.addColorStop(1, `rgba(255, 0, 0, 0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, size, canvas.height);

        grad = g.createLinearGradient(canvas.width, 0, canvas.width - size, 0);
        grad.addColorStop(0, `rgba(255, 0, 0, ${alpha})`);
        grad.addColorStop(1, `rgba(255, 0, 0, 0)`);
        g.fillStyle = grad;
        g.fillRect(canvas.width - size, 0, size, canvas.height);

        g.restore();
        damageOverlay -= 0.02;
    }
}

function spawnEnemies() {
    if (Math.random() < 0.004) {
        const enemy = getFromPool(enemyPool, Enemy);
        enemies.push(enemy);
    }
    // No longer need to shift() if we manage active state, but to keep array size sane if they don't die:
    // Actually, with pooling, we should just clean up inactive ones in the game loop.
}

function shootAt(x, y) {
    // 1. Calculate angle towards target
    const angle = Math.atan2(y - player.y, x - player.x);

    // 2. Bullet shoots AWAY from target (Reverse)
    // angle + PI
    const reverseAngle = angle + Math.PI;

    const bulletSpeed = 15;
    const bulletVx = Math.cos(reverseAngle) * bulletSpeed;
    const bulletVy = Math.sin(reverseAngle) * bulletSpeed;

    if (bullets.length >= maxBullets) {
        // Optional: Recycle oldest bullet if too many? 
        // Or just let them be. With pooling we don't strictly need to limit array length if we clean up.
        // But let's keep the limit for gameplay balance.
        // If we shift, we must return to pool.
        const old = bullets.shift();
        returnToPool(bulletPool, old);
    }
    const bullet = getFromPool(bulletPool, Bullet, player.x, player.y, bulletVx, bulletVy);
    bullets.push(bullet);

    // 3. Propulsion: Player moves TOWARDS target (Recoil from reverse bullet)
    // Bullet momentum vector: p_b = m_b * v_b
    // v_b is AWAY from target.
    // Recoil force on player is OPPOSITE to bullet v_b.
    // So Recoil is TOWARDS target.
    // F_recoil = - dp/dt. Impulse J = - p_b.
    // Delta V_p = J / m_p = - (m_b * v_b) / m_p.
    // Since v_b is AWAY, -v_b is TOWARDS.
    // So player accelerates TOWARDS target.

    const momentumRatio = bullet.mass / player.mass;
    // Apply impulse. Note: bulletVx/Vy are already "reverse", so subtracting them adds "forward" velocity.
    player.vx -= bulletVx * momentumRatio * PhysicsParams.RECOIL_MULTIPLIER;
    player.vy -= bulletVy * momentumRatio * PhysicsParams.RECOIL_MULTIPLIER;
}

// --- UI Logic ---
const settingsPanel = document.getElementById("settingsPanel");
const slidersDiv = document.getElementById("sliders");
const toggleBtn = document.getElementById("toggleSettings");

toggleBtn.onclick = () => {
    settingsPanel.style.display = settingsPanel.style.display === "none" ? "block" : "none";
};

const paramsConfig = [
    { key: "GRAVITY", min: 0, max: 2, step: 0.1 },
    { key: "AIR_DENSITY", min: 0, max: 0.2, step: 0.001 },
    { key: "GROUND_ROUGHNESS", min: 0, max: 2, step: 0.1 },
    { key: "WALL_ROUGHNESS", min: 0, max: 2, step: 0.1 },
    { key: "WALL_BOUNCE", min: 0, max: 2, step: 0.1 },
    { key: "GROUND_BOUNCE", min: 0, max: 2, step: 0.1 },
    { key: "RECOIL_MULTIPLIER", min: 1, max: 50, step: 1 }
];

paramsConfig.forEach(config => {
    const container = document.createElement("div");
    container.className = "slider-container";

    const label = document.createElement("div");
    label.className = "slider-label";
    label.innerHTML = `<span>${config.key}</span><span id="val-${config.key}">${PhysicsParams[config.key]}</span>`;

    const input = document.createElement("input");
    input.type = "range";
    input.min = config.min;
    input.max = config.max;
    input.step = config.step;
    input.value = PhysicsParams[config.key];

    input.oninput = (e) => {
        const val = parseFloat(e.target.value);
        PhysicsParams[config.key] = val;
        document.getElementById(`val-${config.key}`).innerText = val;
    };

    container.appendChild(label);
    container.appendChild(input);
    slidersDiv.appendChild(container);
});

window.addEventListener("mousemove", e => (mouseX = e.clientX, mouseY = e.clientY));
window.addEventListener("click", e => { if (!gameOver) shootAt(e.clientX, e.clientY); });
canvas.addEventListener("touchstart", e => {
    if (e.touches.length > 0) {
        const touch = e.touches[0];
        mouseX = touch.clientX;
        mouseY = touch.clientY;
        if (!gameOver) shootAt(mouseX, mouseY);
    }
});
canvas.addEventListener("touchmove", e => {
    if (e.touches.length > 0) {
        const touch = e.touches[0];
        mouseX = touch.clientX;
        mouseY = touch.clientY;
    }
});

const ui = document.getElementById("ui");
function updateUI() {
    ui.innerHTML = `Score: ${score}<br>Health: ${health}<br>Enemies: ${enemies.length}`;
}

function gameLoop() {
    if (gameOver) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    player.update();
    player.draw();

    walls.forEach(wall => wall.draw());
    // Cleanup inactive objects
    for (let i = bullets.length - 1; i >= 0; i--) {
        if (!bullets[i].active) {
            returnToPool(bulletPool, bullets[i]);
            bullets.splice(i, 1);
        } else {
            bullets[i].update();
            bullets[i].draw();
        }
    }

    points.forEach(p => p.draw());

    for (let i = enemies.length - 1; i >= 0; i--) {
        if (!enemies[i].active) {
            returnToPool(enemyPool, enemies[i]);
            enemies.splice(i, 1);
        } else {
            enemies[i].update();
            enemies[i].draw();
        }
    }
    checkCollisions();
    spawnEnemies();
    updateUI();
    drawDamageOverlay();

    if (health <= 0) {
        gameOver = true;
        damageOverlay = 1;
        drawDamageOverlay();
        ctx.fillStyle = "white";
        ctx.font = "48px sans-serif";
        ctx.fillText("Game Over", canvas.width / 2 - 100, canvas.height / 2);
        restartButton.style.display = "block";
        return;
    }
    requestAnimationFrame(gameLoop);
}

createWalls();
spawnPoints();
gameLoop();
