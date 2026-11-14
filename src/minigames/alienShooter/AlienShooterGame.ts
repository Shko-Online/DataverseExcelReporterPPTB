/*
   Copyright 2026 Shko Online LLC <sales@shko.online>

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
 */

import type { ReportProgress } from "../../services/report/ReportProgress";
import { GAME_HEIGHT, GAME_WIDTH, ReportWatcher, UI_PALETTES, drawBanner, drawFloatingTexts, drawHudText, drawReportProgressBar, getHudLayout, overlaps, randomBetween, roundRect, updateFloatingTexts } from "../engine";
import type { Banner, FloatingText, Game, GameInput, GameTheme, UiColor, UiPalette } from "../engine";

/** The invaders: the Excel errors everybody loves. */
export const ERROR_TYPES = [
    { label: "#N/A", color: "#e05252", hp: 1, points: 10 },
    { label: "#NAME?", color: "#e08a3c", hp: 1, points: 15 },
    { label: "#REF!", color: "#c058d6", hp: 1, points: 20 },
    { label: "#VALUE!", color: "#3c9be0", hp: 2, points: 30 },
    { label: "#DIV/0!", color: "#d6c13c", hp: 3, points: 50 },
] as const;

/** Power-ups dropped by every batch of records the report retrieves. */
export const POWER_UPS = {
    autofill: { name: "AutoFill", description: "spread shot", color: "#21a366", text: "success" },
    recalc: { name: "Rapid Recalc", description: "rapid fire", color: "#3c9be0", text: "info" },
    undo: { name: "Ctrl+Z", description: "extra life", color: "#e05252", text: "danger" },
    freeze: { name: "Freeze Panes", description: "frozen errors", color: "#5aa9e6", text: "info" },
    shield: { name: "Protected Sheet", description: "shield", color: "#d6c13c", text: "highlight" },
} as const satisfies Record<string, { name: string; description: string; color: string; text: UiColor }>;

/** Scene colors: deep space in the dark theme, a daylight worksheet in the light theme. */
interface ScenePalette {
    skyTop: string;
    skyBottom: string;
    star: string;
    /** Worksheet gridlines scrolling behind the action (light theme only). */
    grid: string | null;
    playerBullet: string;
    enemyBullet: string;
    playerWing: string;
    playerBody: string;
    engineGlow: string;
    frozen: string;
    hitFlash: string;
    crateFill: string;
    barrierFill: string;
    barrierStroke: string;
    barrierText: string;
}

const SCENE_PALETTES: Record<GameTheme, ScenePalette> = {
    dark: {
        skyTop: "#050816",
        skyBottom: "#11173a",
        star: "#ffffff",
        grid: null,
        playerBullet: "#b6ffd5",
        enemyBullet: "#ff5c5c",
        playerWing: "#107c41",
        playerBody: "#21a366",
        engineGlow: "#ffd36b",
        frozen: "#8fd3ff",
        hitFlash: "#ffffff",
        crateFill: "#2b2f3a",
        barrierFill: "rgba(120, 140, 175, 0.35)",
        barrierStroke: "#8fa3c7",
        barrierText: "#dfe7f5",
    },
    light: {
        skyTop: "#fbfdfc",
        skyBottom: "#e2efe7",
        star: "#7d9488",
        grid: "#d3e0d8",
        playerBullet: "#0b5a2e",
        enemyBullet: "#c4314b",
        playerWing: "#0b5a2e",
        playerBody: "#107c41",
        engineGlow: "#e08a00",
        frozen: "#5aa9e6",
        hitFlash: "#1b1b1b",
        crateFill: "#ffffff",
        barrierFill: "rgba(16, 124, 65, 0.14)",
        barrierStroke: "#5b7f6b",
        barrierText: "#2d4a3a",
    },
};

export type PowerUpKind = keyof typeof POWER_UPS;
const POWER_UP_KINDS = Object.keys(POWER_UPS) as PowerUpKind[];

/** Distance of the ship from the bottom of the world. */
const PLAYER_OFFSET = 28;
const COLUMN_SPACING = 54;
const ROW_SPACING = 32;
const PLAYER_SPEED = 280;
const MAX_LIVES = 5;
const POWER_UP_DURATION = 10;
const FREEZE_DURATION = 4;
const MIN_CRATE_INTERVAL = 4;
export const REPORT_DELIVERED_BONUS = 1000;
/** Seconds of survival that add one threat level. */
const SECONDS_PER_LEVEL = 40;
/** Threat level from which "Merged Cells" shields protect the errors. */
export const BARRIER_LEVEL = 2;
export const BARRIER_POINTS = 30;
/** Heights of the Merged Cells shields, as fractions of the world height. */
const BARRIER_ROWS = [0.59, 0.5, 0.68, 0.55];

interface Enemy {
    type: (typeof ERROR_TYPES)[number];
    hp: number;
    /** Slot in the formation. */
    slotX: number;
    slotY: number;
    x: number;
    y: number;
    w: number;
    h: number;
    diving: boolean;
    diveTime: number;
    diveOriginX: number;
    hitFlash: number;
}

interface Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    w: number;
    h: number;
}

/** "Merged Cells": a moving shield that absorbs the player's shots (the errors' shots pass through). */
export interface Barrier {
    x: number;
    y: number;
    w: number;
    h: number;
    vx: number;
    baseY: number;
    hp: number;
    maxHp: number;
    hitFlash: number;
}

interface Crate {
    x: number;
    y: number;
    w: number;
    h: number;
    kind: PowerUpKind;
    batch: number;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
}

interface Star {
    x: number;
    y: number;
    speed: number;
    size: number;
}

export class AlienShooterGame implements Game {
    score = 0;
    count = 0;
    isOver = false;
    lives = 3;
    wave = 0;

    width = GAME_WIDTH;
    height = GAME_HEIGHT;
    private hudInsetRight = 0;
    playerX = GAME_WIDTH / 2;
    enemies: Enemy[] = [];
    barriers: Barrier[] = [];
    crates: Crate[] = [];
    readonly activePowerUps: Partial<Record<PowerUpKind, number>> = {};
    shield = false;

    private time = 0;
    private fireCooldown = 0;
    private invulnerable = 0;
    private diveTimer = 2;
    private enemyFireTimer = 1.5;
    private formationY = 0;
    private waveDelay = 0.5;
    private crateCooldown = 0;
    private barrierCooldown = 0;
    private announcedLevel = 1;
    private overTimer = -1;
    private bullets: Bullet[] = [];
    private enemyBullets: Bullet[] = [];
    private particles: Particle[] = [];
    private texts: FloatingText[] = [];
    private banner: Banner | null = null;
    private stars: Star[];
    private readonly watcher: ReportWatcher;

    get playerY() {
        return this.height - PLAYER_OFFSET;
    }

    /** Y of the first HUD row: below the report bar on narrow worlds. */
    private get hudTop() {
        return getHudLayout(this.width, this.hudInsetRight).top;
    }

    /**
     * Adapts to a new world size: everything keeps its relative position, and the next waves and shields
     * are laid out for the new space (more columns on wide screens, more rows and room to dodge on tall ones).
     */
    resize(width: number, height: number, hudInsetRight = 0) {
        this.hudInsetRight = hudInsetRight;
        if (width === this.width && height === this.height) {
            return;
        }
        const sx = width / this.width;
        const sy = height / this.height;
        const scale = (item: { x: number; y: number }) => {
            item.x *= sx;
            item.y *= sy;
        };
        for (const enemy of this.enemies) {
            scale(enemy);
            enemy.slotX *= sx;
            enemy.slotY *= sy;
            enemy.diveOriginX *= sx;
        }
        for (const barrier of this.barriers) {
            scale(barrier);
            barrier.baseY *= sy;
        }
        [...this.crates, ...this.bullets, ...this.enemyBullets, ...this.particles, ...this.texts, ...this.stars].forEach(scale);
        this.formationY *= sy;
        this.playerX = Math.max(20, Math.min(width - 20, this.playerX * sx));
        this.width = width;
        this.height = height;
    }

    constructor(progress: ReportProgress | null, private readonly random: () => number = Math.random) {
        this.watcher = new ReportWatcher(progress);
        this.stars = Array.from({ length: 70 }, () => ({
            x: random() * GAME_WIDTH,
            y: random() * GAME_HEIGHT,
            speed: randomBetween(10, 60, random),
            size: random() < 0.15 ? 2 : 1,
        }));
    }

    /**
     * Grows with the time survived and the waves cleared; every hazard scales with it:
     * formation speed, dives, enemy fire, tougher errors and the Merged Cells shields.
     */
    get difficulty() {
        return 1 + this.time / SECONDS_PER_LEVEL + Math.max(0, this.wave - 1) * 0.15;
    }

    get threatLevel() {
        return Math.floor(this.difficulty);
    }

    /** Points are worth more at higher threat levels. */
    get scoreMultiplier() {
        return 1 + (this.threatLevel - 1) * 0.5;
    }

    update(dt: number, input: GameInput, progress: ReportProgress | null) {
        this.time += dt;
        this.updateStars(dt);
        this.handleReportEvents(progress);
        this.texts = updateFloatingTexts(this.texts, dt);
        this.updateBanner(dt);
        this.updateParticles(dt);

        if (this.overTimer >= 0) {
            this.overTimer -= dt;
            if (this.overTimer < 0) {
                this.isOver = true;
            }
            return;
        }

        for (const kind of POWER_UP_KINDS) {
            const remaining = this.activePowerUps[kind];
            if (remaining !== undefined) {
                this.activePowerUps[kind] = remaining - dt;
                if (remaining - dt <= 0) {
                    delete this.activePowerUps[kind];
                }
            }
        }
        this.invulnerable = Math.max(0, this.invulnerable - dt);
        this.crateCooldown = Math.max(0, this.crateCooldown - dt);

        this.announceLevel();
        this.updatePlayer(dt, input);
        this.updateWaves(dt);
        this.updateBarriers(dt);
        this.updateEnemies(dt);
        this.updateBullets(dt);
        this.updateCrates(dt);
    }

    private handleReportEvents(progress: ReportProgress | null) {
        const events = this.watcher.poll(progress);
        if (events.newPages > 0 && progress) {
            if (this.crates.length < 2 && this.crateCooldown === 0) {
                this.spawnCrate(progress.pagesRetrieved);
            } else {
                // Too many batches at once: turn them into points instead of flooding the screen with crates.
                this.addScore(5 * events.newPages, this.width / 2, this.hudTop + 32, "info");
            }
        }
        if (events.decile !== null) {
            this.texts.push({ x: this.width / 2, y: this.hudTop + 36, text: `Report ${events.decile * 10}% done`, color: "success", ttl: 1.6, age: 0 });
        }
        if (events.completed) {
            this.score += REPORT_DELIVERED_BONUS;
            this.banner = { title: "REPORT DELIVERED!", subtitle: `+${REPORT_DELIVERED_BONUS} bonus · keep zapping or save your score`, color: "success", ttl: 4, age: 0 };
        } else if (events.stopped) {
            this.banner = { title: progress?.phase === "failed" ? "REPORT FAILED" : "REPORT CANCELLED", subtitle: "The errors are winning... keep fighting!", color: "danger", ttl: 3.5, age: 0 };
        }
    }

    private announceLevel() {
        const level = this.threatLevel;
        if (level <= this.announcedLevel) {
            return;
        }
        this.announcedLevel = level;
        const subtitle = level === BARRIER_LEVEL ? "Merged Cells now shield the errors!" : `Faster errors, more fire · points x${this.scoreMultiplier}`;
        if (this.banner) {
            this.texts.push({ x: this.width / 2, y: this.hudTop + 52, text: `THREAT LEVEL ${level}`, color: "danger", ttl: 2, age: 0 });
        } else {
            this.banner = { title: `THREAT LEVEL ${level}`, subtitle, color: "danger", ttl: 2, age: 0 };
        }
    }

    /** Number of Merged Cells shields on the field for the current difficulty. */
    get targetBarriers() {
        return this.difficulty < BARRIER_LEVEL ? 0 : Math.min(4, 1 + Math.floor((this.difficulty - BARRIER_LEVEL) / 0.8));
    }

    private updateBarriers(dt: number) {
        const difficulty = this.difficulty;
        this.barrierCooldown = Math.max(0, this.barrierCooldown - dt);
        if (this.barriers.length < this.targetBarriers && this.barrierCooldown === 0) {
            this.spawnBarrier();
        }
        const frozen = this.activePowerUps.freeze !== undefined;
        for (const barrier of this.barriers) {
            barrier.hitFlash = Math.max(0, barrier.hitFlash - dt);
            if (frozen) {
                continue;
            }
            // Shields speed up as the threat grows.
            const speed = Math.sign(barrier.vx) * Math.min(190, Math.abs(barrier.vx) * (0.85 + difficulty * 0.15));
            barrier.x += speed * dt;
            if (barrier.x < barrier.w / 2 + 6 || barrier.x > this.width - barrier.w / 2 - 6) {
                barrier.vx = -barrier.vx;
                barrier.x = Math.max(barrier.w / 2 + 6, Math.min(this.width - barrier.w / 2 - 6, barrier.x));
            }
            barrier.y = barrier.baseY + Math.sin(this.time * 1.7 + barrier.baseY) * 8;
        }
    }

    private spawnBarrier() {
        const difficulty = this.difficulty;
        const used = new Set(this.barriers.map((barrier) => barrier.baseY));
        const rows = BARRIER_ROWS.map((fraction) => Math.round(this.height * fraction));
        const baseY = rows.find((row) => !used.has(row)) ?? rows[0];
        // Shields are a bit wider on wider worlds, but never block the whole width.
        const w = Math.min(130 * Math.max(1, this.width / GAME_WIDTH), this.width * 0.4, 64 + difficulty * 10 + this.random() * 20);
        const maxHp = Math.round(6 + difficulty * 2);
        const fromLeft = this.random() < 0.5;
        this.barriers.push({
            x: fromLeft ? w / 2 + 6 : this.width - w / 2 - 6,
            y: baseY,
            w,
            h: 16,
            vx: (fromLeft ? 1 : -1) * randomBetween(55, 85, this.random),
            baseY,
            hp: maxHp,
            maxHp,
            hitFlash: 0,
        });
        this.barrierCooldown = 3;
    }

    private spawnCrate(batch: number) {
        const kind = this.lives >= MAX_LIVES ? POWER_UP_KINDS.filter((k) => k !== "undo")[Math.floor(this.random() * (POWER_UP_KINDS.length - 1))] : POWER_UP_KINDS[Math.floor(this.random() * POWER_UP_KINDS.length)];
        this.crates.push({ x: randomBetween(60, this.width - 60, this.random), y: this.hudTop + 22, w: 30, h: 22, kind, batch });
        this.crateCooldown = MIN_CRATE_INTERVAL;
    }

    private updateStars(dt: number) {
        for (const star of this.stars) {
            star.y += star.speed * dt;
            if (star.y > this.height) {
                star.y = 0;
                star.x = this.random() * this.width;
            }
        }
    }

    private updateBanner(dt: number) {
        if (this.banner) {
            this.banner.age += dt;
            if (this.banner.age >= this.banner.ttl) {
                this.banner = null;
            }
        }
    }

    private updateParticles(dt: number) {
        for (const particle of this.particles) {
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            particle.life -= dt;
        }
        this.particles = this.particles.filter((particle) => particle.life > 0);
    }

    private updatePlayer(dt: number, input: GameInput) {
        let direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        if (direction === 0 && input.pointerX !== null) {
            const delta = input.pointerX - this.playerX;
            direction = Math.abs(delta) < 4 ? 0 : Math.sign(delta) * Math.min(1, Math.abs(delta) / 30);
        }
        this.playerX = Math.max(20, Math.min(this.width - 20, this.playerX + direction * PLAYER_SPEED * dt));

        this.fireCooldown -= dt;
        if ((input.fire || input.pointerDown) && this.fireCooldown <= 0) {
            this.fireCooldown = this.activePowerUps.recalc ? 0.11 : 0.26;
            const angles = this.activePowerUps.autofill ? [-0.22, 0, 0.22] : [0];
            for (const angle of angles) {
                this.bullets.push({ x: this.playerX, y: this.playerY - 12, vx: Math.sin(angle) * 430, vy: -Math.cos(angle) * 430, w: 3, h: 10 });
            }
        }
    }

    private updateWaves(dt: number) {
        if (this.enemies.length > 0) {
            return;
        }
        this.waveDelay -= dt;
        if (this.waveDelay > 0) {
            return;
        }
        this.wave++;
        this.waveDelay = 1.5;
        this.formationY = 0;
        // The formation fills the available space: more columns on wide worlds, more rows on tall ones.
        const maxColumns = Math.max(4, Math.floor((this.width - 40) / COLUMN_SPACING));
        const maxRows = Math.max(2, Math.min(7, Math.floor((this.height * 0.5 - 40) / ROW_SPACING) + 1));
        const baseColumns = Math.round((6 * this.width) / GAME_WIDTH);
        const baseRows = Math.max(2, Math.round((2 * this.height) / GAME_HEIGHT));
        const columns = Math.min(maxColumns, baseColumns + Math.floor(this.wave / 2));
        const rows = Math.min(maxRows, baseRows + Math.floor((this.wave + 1) / 3));
        const top = this.hudTop + 40;
        // Tougher errors show up earlier when the threat is high.
        const strongest = Math.min(ERROR_TYPES.length, 1 + this.wave + this.threatLevel);
        for (let row = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) {
                const type = ERROR_TYPES[Math.min(strongest - 1, Math.floor(this.random() * strongest))];
                const slotX = this.width / 2 + (column - (columns - 1) / 2) * COLUMN_SPACING;
                const slotY = top + row * ROW_SPACING;
                this.enemies.push({ type, hp: type.hp, slotX, slotY, x: slotX, y: slotY - 220 - row * 20, w: 46, h: 22, diving: false, diveTime: 0, diveOriginX: slotX, hitFlash: 0 });
            }
        }
        if (this.wave > 1) {
            this.banner = this.banner ?? { title: `WAVE ${this.wave}`, subtitle: "More errors incoming!", color: "warning", ttl: 1.4, age: 0 };
        }
    }

    private updateEnemies(dt: number) {
        const frozen = this.activePowerUps.freeze !== undefined;
        const speed = frozen ? 0 : 1;
        const difficulty = this.difficulty;
        this.formationY = Math.min(this.height * 0.3, this.formationY + (1.5 + difficulty * 1.6) * dt * speed);
        const sway = Math.sin(this.time * 0.9) * 36;

        if (!frozen) {
            this.diveTimer -= dt;
            if (this.diveTimer <= 0) {
                this.diveTimer = Math.max(0.45, 2.6 / difficulty);
                // From threat level 3 the errors also dive in pairs.
                const divers = difficulty >= 3 && this.random() < 0.5 ? 2 : 1;
                for (let i = 0; i < divers; i++) {
                    const candidates = this.enemies.filter((enemy) => !enemy.diving);
                    const diver = candidates[Math.floor(this.random() * candidates.length)];
                    if (diver) {
                        diver.diving = true;
                        diver.diveTime = 0;
                        diver.diveOriginX = diver.x;
                    }
                }
            }
            this.enemyFireTimer -= dt;
            if (this.enemyFireTimer <= 0 && this.enemies.length > 0) {
                this.enemyFireTimer = Math.max(0.22, 1.6 / difficulty);
                const shooter = this.enemies[Math.floor(this.random() * this.enemies.length)];
                const vy = Math.min(330, 130 + difficulty * 25);
                // Aim improves with the threat level.
                const accuracy = Math.min(1, 0.35 + difficulty * 0.15);
                const timeToPlayer = Math.max(0.3, (this.playerY - shooter.y) / vy);
                const vx = Math.max(-140, Math.min(140, ((this.playerX - shooter.x) / timeToPlayer) * accuracy));
                this.enemyBullets.push({ x: shooter.x, y: shooter.y + 10, vx, vy, w: 5, h: 8 });
            }
        }

        for (const enemy of this.enemies) {
            enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
            if (enemy.diving) {
                enemy.diveTime += dt * speed;
                enemy.y += Math.min(300, 105 + difficulty * 28) * dt * speed;
                enemy.x = enemy.diveOriginX + Math.sin(enemy.diveTime * 2.6) * 70 + (this.playerX - enemy.diveOriginX) * Math.min(1, enemy.diveTime / 2.5);
                if (enemy.y > this.height + 30) {
                    // Back to the formation from the top.
                    enemy.diving = false;
                    enemy.y = -30;
                }
            } else {
                const targetX = enemy.slotX + sway;
                const targetY = enemy.slotY + this.formationY;
                enemy.x += (targetX - enemy.x) * Math.min(1, dt * 4) * speed;
                enemy.y += (targetY - enemy.y) * Math.min(1, dt * 3) * speed;
            }
            if (this.invulnerable === 0 && overlaps(enemy, { x: this.playerX, y: this.playerY, w: 30, h: 16 })) {
                enemy.hp = 0;
                this.explode(enemy.x, enemy.y, enemy.type.color);
                this.hitPlayer();
            }
        }
        this.enemies = this.enemies.filter((enemy) => enemy.hp > 0);
    }

    private updateBullets(dt: number) {
        for (const bullet of this.bullets) {
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
            const barrier = this.barriers.find((candidate) => candidate.hp > 0 && overlaps(bullet, candidate));
            if (barrier) {
                bullet.y = -100;
                barrier.hp--;
                barrier.hitFlash = 0.08;
                if (barrier.hp <= 0) {
                    this.addScore(BARRIER_POINTS, barrier.x, barrier.y, "info");
                    this.texts.push({ x: barrier.x, y: barrier.y - 16, text: "Unmerged!", color: "info", ttl: 1, age: 0 });
                    this.explode(barrier.x, barrier.y, "#8fa3c7");
                }
                continue;
            }
            const target = this.enemies.find((enemy) => enemy.hp > 0 && overlaps(bullet, enemy));
            if (target) {
                bullet.y = -100;
                target.hp--;
                target.hitFlash = 0.08;
                if (target.hp <= 0) {
                    this.count++;
                    this.addScore(target.type.points * (target.diving ? 2 : 1), target.x, target.y, "highlight");
                    this.explode(target.x, target.y, target.type.color);
                }
            }
        }
        this.bullets = this.bullets.filter((bullet) => bullet.y > -20 && bullet.x > -20 && bullet.x < this.width + 20);
        this.barriers = this.barriers.filter((barrier) => barrier.hp > 0);
        this.enemies = this.enemies.filter((enemy) => enemy.hp > 0);

        const freezeFactor = this.activePowerUps.freeze ? 0.3 : 1;
        for (const bullet of this.enemyBullets) {
            bullet.x += bullet.vx * dt * freezeFactor;
            bullet.y += bullet.vy * dt * freezeFactor;
            if (this.invulnerable === 0 && overlaps(bullet, { x: this.playerX, y: this.playerY, w: 26, h: 14 })) {
                bullet.y = this.height + 100;
                this.hitPlayer();
            }
        }
        this.enemyBullets = this.enemyBullets.filter((bullet) => bullet.y < this.height + 20);
    }

    private updateCrates(dt: number) {
        for (const crate of this.crates) {
            crate.y += 55 * dt;
            crate.x += Math.sin(this.time * 2 + crate.batch) * 20 * dt;
            if (overlaps(crate, { x: this.playerX, y: this.playerY, w: 34, h: 20 })) {
                crate.y = this.height + 100;
                this.collect(crate);
            }
        }
        this.crates = this.crates.filter((crate) => crate.y < this.height + 20);
    }

    collect(crate: Pick<Crate, "kind" | "batch">) {
        const powerUp = POWER_UPS[crate.kind];
        switch (crate.kind) {
            case "undo":
                this.lives = Math.min(MAX_LIVES, this.lives + 1);
                break;
            case "shield":
                this.shield = true;
                break;
            case "freeze":
                this.activePowerUps.freeze = FREEZE_DURATION;
                break;
            default:
                this.activePowerUps[crate.kind] = POWER_UP_DURATION;
        }
        this.addScore(25, this.playerX, this.playerY - 30, powerUp.text);
        this.texts.push({ x: this.playerX, y: this.playerY - 46, text: `${powerUp.name}!`, color: powerUp.text, ttl: 1.4, age: 0 });
    }

    private hitPlayer() {
        if (this.shield) {
            this.shield = false;
            this.invulnerable = 1;
            this.texts.push({ x: this.playerX, y: this.playerY - 30, text: "Sheet protected!", color: POWER_UPS.shield.text, ttl: 1.2, age: 0 });
            return;
        }
        this.lives--;
        this.invulnerable = 2;
        this.explode(this.playerX, this.playerY, "#21a366");
        if (this.lives <= 0) {
            this.overTimer = 1.2;
            this.banner = { title: "GAME OVER", subtitle: "The errors took over the spreadsheet", color: "danger", ttl: 10, age: 0 };
        }
    }

    private addScore(basePoints: number, x: number, y: number, color: UiColor) {
        const points = Math.round(basePoints * this.scoreMultiplier);
        this.score += points;
        this.texts.push({ x, y, text: `+${points}`, color, ttl: 0.8, age: 0 });
    }

    private explode(x: number, y: number, color: string) {
        for (let i = 0; i < 14; i++) {
            const angle = this.random() * Math.PI * 2;
            const speed = randomBetween(40, 160, this.random);
            this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: randomBetween(0.3, 0.7, this.random), color });
        }
    }

    render(ctx: CanvasRenderingContext2D, progress: ReportProgress | null, theme: GameTheme) {
        const scene = SCENE_PALETTES[theme];
        const ui = UI_PALETTES[theme];
        const background = ctx.createLinearGradient(0, 0, 0, this.height);
        background.addColorStop(0, scene.skyTop);
        background.addColorStop(1, scene.skyBottom);
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, this.width, this.height);

        if (scene.grid) {
            // The battle takes place on a worksheet: cells scroll by like the stars do in space.
            ctx.strokeStyle = scene.grid;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let x = 0.5; x < this.width; x += 64) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, this.height);
            }
            const offset = (this.time * 20) % 20;
            for (let y = offset + 0.5; y < this.height; y += 20) {
                ctx.moveTo(0, y);
                ctx.lineTo(this.width, y);
            }
            ctx.stroke();
        }

        ctx.fillStyle = scene.star;
        for (const star of this.stars) {
            ctx.globalAlpha = 0.3 + star.speed / 90;
            ctx.fillRect(star.x, star.y, star.size, star.size);
        }
        ctx.globalAlpha = 1;

        for (const crate of this.crates) {
            this.drawCrate(ctx, crate, scene, ui);
        }
        for (const enemy of this.enemies) {
            this.drawEnemy(ctx, enemy, scene);
        }
        for (const barrier of this.barriers) {
            this.drawBarrier(ctx, barrier, scene);
        }

        ctx.fillStyle = scene.playerBullet;
        for (const bullet of this.bullets) {
            ctx.fillRect(bullet.x - bullet.w / 2, bullet.y - bullet.h / 2, bullet.w, bullet.h);
        }
        ctx.strokeStyle = scene.enemyBullet;
        ctx.lineWidth = 2;
        for (const bullet of this.enemyBullets) {
            // A red "spell-check" squiggle.
            ctx.beginPath();
            for (let i = 0; i <= 4; i++) {
                const px = bullet.x + (i % 2 === 0 ? -2.5 : 2.5);
                const py = bullet.y - bullet.h / 2 + (i * bullet.h) / 4;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
        }

        if (this.overTimer < 0 && (this.invulnerable === 0 || Math.floor(this.time * 12) % 2 === 0)) {
            this.drawPlayer(ctx, scene);
        }

        for (const particle of this.particles) {
            ctx.globalAlpha = Math.min(1, particle.life * 2);
            ctx.fillStyle = particle.color;
            ctx.fillRect(particle.x - 1.5, particle.y - 1.5, 3, 3);
        }
        ctx.globalAlpha = 1;

        drawFloatingTexts(ctx, this.texts, ui);
        this.drawHud(ctx, progress, ui);
        drawBanner(ctx, this.banner, ui, this.width, this.height);
    }

    private drawPlayer(ctx: CanvasRenderingContext2D, scene: ScenePalette) {
        const x = this.playerX;
        const y = this.playerY;
        ctx.save();
        if (this.shield) {
            ctx.strokeStyle = POWER_UPS.shield.color;
            ctx.globalAlpha = 0.6 + Math.sin(this.time * 8) * 0.2;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 22, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        // Wings
        ctx.fillStyle = scene.playerWing;
        ctx.beginPath();
        ctx.moveTo(x - 18, y + 9);
        ctx.lineTo(x, y - 4);
        ctx.lineTo(x + 18, y + 9);
        ctx.closePath();
        ctx.fill();
        // Body: a spreadsheet cell with the "fx" cockpit.
        ctx.fillStyle = scene.playerBody;
        roundRect(ctx, x - 8, y - 14, 16, 24, 4);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "italic bold 9px Georgia, serif";
        ctx.textAlign = "center";
        ctx.fillText("fx", x, y + 1);
        // Engine glow
        ctx.fillStyle = scene.engineGlow;
        ctx.globalAlpha = 0.6 + Math.sin(this.time * 30) * 0.3;
        ctx.fillRect(x - 3, y + 10, 6, 4);
        ctx.restore();
    }

    private drawBarrier(ctx: CanvasRenderingContext2D, barrier: Barrier, scene: ScenePalette) {
        const left = barrier.x - barrier.w / 2;
        const top = barrier.y - barrier.h / 2;
        ctx.save();
        ctx.globalAlpha = 0.45 + 0.55 * (barrier.hp / barrier.maxHp);
        ctx.fillStyle = barrier.hitFlash > 0 ? scene.hitFlash : scene.barrierFill;
        roundRect(ctx, left, top, barrier.w, barrier.h, 3);
        ctx.fill();
        ctx.strokeStyle = scene.barrierStroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // The faded borders of the cells that were merged.
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let x = left + 22; x < left + barrier.w - 4; x += 22) {
            ctx.moveTo(x, top + 2);
            ctx.lineTo(x, top + barrier.h - 2);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = scene.barrierText;
        ctx.font = "bold 9px ui-monospace, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("MERGED CELLS", barrier.x, barrier.y + 1);
        ctx.restore();
    }

    private drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, scene: ScenePalette) {
        const { x, y, w, h, type } = enemy;
        const wobble = Math.sin(this.time * 6 + enemy.slotX) * 1.5;
        ctx.save();
        // Antennas
        ctx.strokeStyle = type.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 8, y - h / 2);
        ctx.lineTo(x - 12, y - h / 2 - 7 + wobble);
        ctx.moveTo(x + 8, y - h / 2);
        ctx.lineTo(x + 12, y - h / 2 - 7 - wobble);
        ctx.stroke();
        ctx.fillStyle = type.color;
        ctx.beginPath();
        ctx.arc(x - 12, y - h / 2 - 7 + wobble, 2, 0, Math.PI * 2);
        ctx.arc(x + 12, y - h / 2 - 7 - wobble, 2, 0, Math.PI * 2);
        ctx.fill();
        // Body
        ctx.fillStyle = enemy.hitFlash > 0 ? scene.hitFlash : this.activePowerUps.freeze ? scene.frozen : type.color;
        roundRect(ctx, x - w / 2, y - h / 2, w, h, 6);
        ctx.fill();
        // Legs
        ctx.fillRect(x - w / 2 + 4, y + h / 2 - 1, 4, 4 + wobble);
        ctx.fillRect(x + w / 2 - 8, y + h / 2 - 1, 4, 4 - wobble);
        ctx.fillStyle = "#1a1a1a";
        ctx.font = "bold 10px ui-monospace, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(type.label, x, y + 1);
        ctx.restore();
    }

    private drawCrate(ctx: CanvasRenderingContext2D, crate: Crate, scene: ScenePalette, ui: UiPalette) {
        const powerUp = POWER_UPS[crate.kind];
        ctx.save();
        ctx.shadowColor = powerUp.color;
        ctx.shadowBlur = 10 + Math.sin(this.time * 6) * 4;
        ctx.fillStyle = scene.crateFill;
        roundRect(ctx, crate.x - crate.w / 2, crate.y - crate.h / 2, crate.w, crate.h, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = powerUp.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        // A tiny spreadsheet grid on the crate.
        ctx.strokeStyle = powerUp.color;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(crate.x - crate.w / 2, crate.y);
        ctx.lineTo(crate.x + crate.w / 2, crate.y);
        ctx.moveTo(crate.x, crate.y - crate.h / 2);
        ctx.lineTo(crate.x, crate.y + crate.h / 2);
        ctx.stroke();
        ctx.fillStyle = ui.text;
        ctx.font = "bold 9px ui-monospace, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.fillText(`Batch #${crate.batch}`, crate.x, crate.y - crate.h / 2 - 4);
        ctx.fillStyle = ui[powerUp.text];
        ctx.fillText(powerUp.name, crate.x, crate.y + crate.h / 2 + 10);
        ctx.restore();
    }

    private drawHud(ctx: CanvasRenderingContext2D, progress: ReportProgress | null, ui: UiPalette) {
        const layout = getHudLayout(this.width, this.hudInsetRight);
        const top = layout.top;
        drawHudText(ctx, ui, `SCORE ${this.score}`, 10, top);
        drawHudText(ctx, ui, `WAVE ${Math.max(1, this.wave)} · THREAT ${this.threatLevel}`, 10, top + 16, "left", "warning");
        drawHudText(ctx, ui, `${"♥".repeat(Math.max(0, this.lives))}`, layout.right, top, "right", "danger");
        const active = POWER_UP_KINDS.filter((kind) => this.activePowerUps[kind] !== undefined)
            .map((kind) => `${POWER_UPS[kind].name} ${Math.ceil(this.activePowerUps[kind]!)}s`)
            .concat(this.shield ? [POWER_UPS.shield.name] : []);
        active.forEach((text, index) => drawHudText(ctx, ui, text, layout.right, top + 16 + index * 14, "right", "success"));
        drawReportProgressBar(ctx, progress, this.time, "REPORT UPLINK", "#21a366", ui, layout);
    }
}
