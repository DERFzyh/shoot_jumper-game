import { PhysicsParams, maxBullets, wallBuffer } from './constants.js';
import { applyWallCollision, getFromPool, returnToPool, bulletPool, enemyPool, isOutOfBounds } from './utils.js';
import { Player, Bullet, Point, Wall, Enemy } from './entities.js';

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

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

const player = new Player(canvas.width / 2, canvas.height / 2);
const bullets = [], points = [], enemies = [];
const walls = [];

export function createWalls() {
    // Top Wall
    walls.push(new Wall({ x: 0, y: 0 }, { x: canvas.width, y: 0 }, wallBuffer, PhysicsParams.WALL_BOUNCE, PhysicsParams.WALL_ROUGHNESS));
    // Bottom Wall
    walls.push(new Wall({ x: 0, y: canvas.height }, { x: canvas.width, y: canvas.height }, wallBuffer, PhysicsParams.GROUND_BOUNCE, PhysicsParams.GROUND_ROUGHNESS));
    // Left Wall
    walls.push(new Wall({ x: 0, y: 0 }, { x: 0, y: canvas.height }, wallBuffer, PhysicsParams.WALL_BOUNCE, PhysicsParams.WALL_ROUGHNESS));
    // Right Wall
    walls.push(new Wall({ x: canvas.width, y: 0 }, { x: canvas.width, y: canvas.height }, wallBuffer, PhysicsParams.WALL_BOUNCE, PhysicsParams.WALL_ROUGHNESS));
}

export function spawnPoints() {
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
                // Calculate relative speed for damage
                const relativeVx = bullet.vx - enemy.vx;
                const relativeVy = bullet.vy - enemy.vy;
                const relativeSpeed = Math.sqrt(relativeVx * relativeVx + relativeVy * relativeVy);

                // Damage calculation (example: linear with a multiplier)
                const damage = Math.max(1, Math.floor(relativeSpeed / 5)); // Min 1 damage, scale by speed

                enemy.health -= damage;

                if (enemy.health <= 0) {
                    score++;
                    enemy.active = false;
                }
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
        const enemy = getFromPool(enemyPool, Enemy, canvas.width);
        enemies.push(enemy);
    }
}

function shootAt(x, y) {
    // Bullet shoots AWAY from player's facing direction
    const bulletSpeed = 15;
    const bulletVx = Math.cos(player.angle + Math.PI) * bulletSpeed;
    const bulletVy = Math.sin(player.angle + Math.PI) * bulletSpeed;

    if (bullets.length >= maxBullets) {
        const old = bullets.shift();
        returnToPool(bulletPool, old);
    }
    const bullet = getFromPool(bulletPool, Bullet, player.x, player.y, bulletVx, bulletVy);
    bullets.push(bullet);

    const momentumRatio = bullet.mass / player.mass;
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

export function gameLoop() {
    if (gameOver) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply camera translation
    const cameraX = canvas.width / 2 - player.x;
    const cameraY = canvas.height / 2 - player.y;
    ctx.save();
    ctx.translate(cameraX, cameraY);

    // Update player and handle wall collisions
    player.update(mouseX, mouseY, canvas.height, walls);
    let newHealth = health;
    walls.forEach(wall => {
        newHealth = applyWallCollision(player, wall, true, newHealth);
    });
    health = newHealth;
    if (health <= 0) {
        damageOverlay = 1;
    }
    player.draw(ctx);

    walls.forEach(wall => wall.draw(ctx));

    // Update and draw bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        if (!bullets[i].active || isOutOfBounds(bullets[i], canvas.width, canvas.height)) {
            returnToPool(bulletPool, bullets[i]);
            bullets.splice(i, 1);
        } else {
            bullets[i].update();
            walls.forEach(wall => applyWallCollision(bullets[i], wall));
            bullets[i].draw(ctx);
        }
    }

    points.forEach(p => p.draw(ctx));

    // Update and draw enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (!enemies[i].active || isOutOfBounds(enemies[i], canvas.width, canvas.height)) {
            returnToPool(enemyPool, enemies[i]);
            enemies.splice(i, 1);
        } else {
            enemies[i].update(player, enemies);
            walls.forEach(wall => applyWallCollision(enemies[i], wall));
            enemies[i].draw(ctx);
        }
    }
    checkCollisions();
    spawnEnemies();
    updateUI();
    drawDamageOverlay();
    ctx.restore(); // Restore context after camera translation

    if (health <= 0) {
        gameOver = true;
        damageOverlay = 1;
        drawDamageOverlay(); // Ensure final damage overlay is drawn
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

