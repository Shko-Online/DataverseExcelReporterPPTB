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

import { describe, expect, it, vi } from "vitest";
import { createReportProgress } from "../services/report/ReportProgress";
import type { ReportProgress } from "../services/report/ReportProgress";
import { AlienShooterGame, BARRIER_LEVEL, REPORT_DELIVERED_BONUS } from "./alienShooter/AlienShooterGame";
import { GAME_HEIGHT, GAME_WIDTH, MIN_WORLD_HEIGHT, MIN_WORLD_WIDTH, ReportWatcher, UI_PALETTES, createInput, getHudLayout, getReportEmphasis, getWorldSize, parseCssColor } from "./engine";
import { MINIGAME_STATS_KEY, addSession, formatDuration, loadStats, normalizeStats, saveStats } from "./minigameStats";
import { CHECKPOINT_POINTS, CLOSE_CALL_POINTS, FINISH_BONUS, MAX_LANES, MIN_LANES, MotoRacerGame, NITRO_PER_CLOSE_CALL, OVERSIZE_LEVEL, getRoadLayout } from "./motoRacer/MotoRacerGame";

/** Fast-forwards the time survived (the games keep it private). */
const survive = (game: AlienShooterGame | MotoRacerGame, seconds: number) => {
    (game as unknown as { time: number }).time = seconds;
};

const records = (pagesRetrieved: number, exportedRecords = pagesRetrieved * 100): ReportProgress => ({
    ...createReportProgress("records"),
    pagesRetrieved,
    exportedRecords,
    totalRecords: 1000,
});

/** Deterministic pseudo-random numbers. */
const seeded = (seed = 1) => () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
};

describe("ReportWatcher", () => {
    it("reports new pages, milestones and the completion once", () => {
        const watcher = new ReportWatcher(createReportProgress("records"));
        expect(watcher.poll(records(1))).toMatchObject({ newPages: 1, completed: false, decile: 1 }); // 5% + 10% of 90%
        expect(watcher.poll(records(3))).toMatchObject({ newPages: 2, decile: 3 });
        expect(watcher.poll(records(3))).toMatchObject({ newPages: 0, decile: null });
        expect(watcher.poll({ ...records(10), phase: "completed" })).toMatchObject({ newPages: 7, completed: true, stopped: false });
        expect(watcher.poll({ ...records(10), phase: "completed" })).toMatchObject({ completed: false });
    });

    it("ignores what happened before the game started and detects a new report", () => {
        const watcher = new ReportWatcher({ ...records(5), phase: "completed" });
        expect(watcher.poll({ ...records(5), phase: "completed" })).toMatchObject({ newPages: 0, completed: false });
        expect(watcher.poll(records(1))).toMatchObject({ newPages: 1 });
        expect(watcher.poll({ ...records(2), phase: "cancelled" })).toMatchObject({ stopped: true, completed: false });
    });
});

describe("world size", () => {
    it("takes the shape of the canvas with about the reference area", () => {
        for (const [width, height] of [[1600, 900], [1600, 500], [800, 1000], [1200, 1200], [2400, 600]]) {
            const world = getWorldSize(width, height);
            // Same shape as the canvas: no stretching, no bars.
            expect(world.width / world.height).toBeCloseTo(width / height, 1);
            expect(world.width).toBeGreaterThanOrEqual(MIN_WORLD_WIDTH);
            expect(world.height).toBeGreaterThanOrEqual(MIN_WORLD_HEIGHT);
        }
        const reference = getWorldSize(1280, 720);
        expect([reference.width, reference.height]).toEqual([GAME_WIDTH, GAME_HEIGHT]);
        expect(reference.scale).toBe(2);
    });

    it("zooms out instead of shrinking the world below the minimum", () => {
        const tall = getWorldSize(400, 900);
        expect(tall.width).toBe(MIN_WORLD_WIDTH);
        expect(tall.height).toBeGreaterThan(700);
        const wide = getWorldSize(1600, 400);
        expect(wide.height).toBe(MIN_WORLD_HEIGHT);
        expect(wide.width).toBe(1200);
    });

    it("moves the report bar to its own row on narrow worlds", () => {
        expect(getHudLayout(640)).toMatchObject({ barX: 150, barWidth: 340, top: 8 });
        expect(getHudLayout(1200).barWidth).toBe(480);
        expect(getHudLayout(360)).toMatchObject({ barX: 10, barWidth: 340, top: 30 });
        // Room kept free in the top-right corner (the "exit full screen" button).
        const narrow = getHudLayout(360, 30);
        expect(narrow.right).toBe(320);
        expect(narrow.barX + narrow.barWidth).toBeLessThanOrEqual(narrow.right);
        const wide = getHudLayout(900, 30);
        expect(wide.right).toBe(860);
        expect(wide.barX + wide.barWidth).toBeLessThan(wide.right - 100);
    });
});

describe("report status emphasis", () => {
    it("animates the ready, idle and stopped states only", () => {
        expect(getReportEmphasis(null)).toBe("idle");
        expect(getReportEmphasis(createReportProgress("completed"))).toBe("ready");
        expect(getReportEmphasis(createReportProgress("cancelled"))).toBe("stopped");
        expect(getReportEmphasis(createReportProgress("failed"))).toBe("stopped");
        expect(getReportEmphasis(records(3))).toBe("none");
        expect(getReportEmphasis(createReportProgress("saving"))).toBe("none");
    });
});

describe("themes", () => {
    it("parses the CSS colors of the Fluent tokens", () => {
        expect(parseCssColor("#ffffff")).toEqual([255, 255, 255]);
        expect(parseCssColor(" #292929 ")).toEqual([41, 41, 41]);
        expect(parseCssColor("#abc")).toEqual([170, 187, 204]);
        expect(parseCssColor("rgb(31, 31, 31)")).toEqual([31, 31, 31]);
        expect(parseCssColor("rgba(250 250 250 / 0.5)")).toEqual([250, 250, 250]);
        expect(parseCssColor("")).toBeNull();
    });

    it("defines the same UI colors for both themes", () => {
        expect(Object.keys(UI_PALETTES.light).sort()).toEqual(Object.keys(UI_PALETTES.dark).sort());
    });
});

describe("AlienShooterGame", () => {
    it("drops a power-up crate for every batch of records", () => {
        const game = new AlienShooterGame(createReportProgress("records"), seeded());
        game.update(0.016, createInput(), records(1));
        expect(game.crates).toHaveLength(1);
        expect(game.crates[0].batch).toBe(1);
    });

    it("awards a bonus when the report is delivered", () => {
        const game = new AlienShooterGame(records(1), seeded());
        game.update(0.016, createInput(), { ...records(1), phase: "completed" });
        expect(game.score).toBe(REPORT_DELIVERED_BONUS);
    });

    it("applies power-ups", () => {
        const game = new AlienShooterGame(null, seeded());
        game.collect({ kind: "undo", batch: 1 });
        game.collect({ kind: "autofill", batch: 2 });
        expect(game.lives).toBe(4);
        expect(game.activePowerUps.autofill).toBeGreaterThan(0);
    });

    it("eventually ends when the player stands still", () => {
        const game = new AlienShooterGame(null, seeded(7));
        for (let i = 0; i < 20 * 60 * 10 && !game.isOver; i++) {
            game.update(0.05, createInput(), null);
        }
        expect(game.isOver).toBe(true);
        expect(game.lives).toBe(0);
    });

    it("scores by shooting errors", () => {
        const game = new AlienShooterGame(null, seeded(3));
        const input = { ...createInput(), fire: true };
        for (let i = 0; i < 20 * 15; i++) {
            game.update(0.05, input, null);
        }
        expect(game.count).toBeGreaterThan(0);
        expect(game.score).toBeGreaterThan(0);
    });
});

describe("AlienShooterGame difficulty", () => {
    it("raises the threat level the longer the player survives", () => {
        const game = new AlienShooterGame(null, seeded());
        expect(game.threatLevel).toBe(1);
        expect(game.targetBarriers).toBe(0);
        survive(game, 45);
        expect(game.threatLevel).toBe(2);
        expect(game.scoreMultiplier).toBe(1.5);
        survive(game, 200);
        expect(game.threatLevel).toBeGreaterThanOrEqual(5);
        expect(game.targetBarriers).toBe(4);
    });

    it("brings in Merged Cells shields from threat level 2", () => {
        const game = new AlienShooterGame(null, seeded());
        survive(game, (BARRIER_LEVEL - 1) * 40 + 1);
        game.update(0.016, createInput(), null);
        expect(game.barriers.length).toBe(1);
        const barrier = game.barriers[0];
        const x = barrier.x;
        game.update(0.1, createInput(), null);
        expect(barrier.x).not.toBe(x);
    });

    it("lets the shields absorb the player's shots", () => {
        const game = new AlienShooterGame(null, seeded());
        game.barriers = [{ x: game.playerX, y: 214, w: 100, h: 16, vx: 0, baseY: 214, hp: 3, maxHp: 3, hitFlash: 0 }];
        const fire = { ...createInput(), fire: true };
        for (let i = 0; i < 8; i++) {
            game.update(0.05, fire, null);
        }
        expect(game.barriers[0].hp).toBeLessThan(3);
        expect(game.count).toBe(0);
        // Enough shots break the shield.
        for (let i = 0; i < 40 && game.barriers.length > 0; i++) {
            game.update(0.05, fire, null);
        }
        expect(game.barriers).toHaveLength(0);
    });
});

describe("MotoRacerGame difficulty", () => {
    it("raises the traffic level the longer the player survives", () => {
        const game = new MotoRacerGame(null, seeded());
        expect(game.trafficLevel).toBe(1);
        survive(game, 36);
        expect(game.trafficLevel).toBe(2);
        expect(game.scoreMultiplier).toBe(1.5);
    });

    it("puts oversized loads across several lanes", () => {
        const game = new MotoRacerGame(null, seeded());
        game.vehicles = [];
        game.spawnOversize(1, 2);
        game.spawnOversize(0, 3);
        expect(game.lanesOf(game.vehicles[0], game.vehicles[0].x)).toEqual([1, 2]);
        expect(game.lanesOf(game.vehicles[1], game.vehicles[1].x)).toEqual([0, 1, 2]);
    });

    it("sends more lane changers and oversized loads at higher levels, always leaving a lane open", () => {
        const stats = (level: number) => {
            const game = new MotoRacerGame(null, seeded(11));
            survive(game, (level - 1) * 35);
            const hoppers = new Set<object>();
            const oversized = new Set<object>();
            let laneChanges = 0;
            const seen = new Set<object>();
            // 20 seconds: short enough to stay below the next level when starting at level 1.
            for (let i = 0; i < 20 * 20 && !game.isOver; i++) {
                game.vehicles = game.vehicles.filter((vehicle) => Math.abs(vehicle.x - game.bikeX) > vehicle.w / 2 + 25 || vehicle.y < game.bikeY - 150);
                game.update(0.05, createInput(), null);
                for (const vehicle of game.vehicles) {
                    if (vehicle.targetX !== vehicle.x && !seen.has(vehicle)) {
                        laneChanges++;
                        seen.add(vehicle);
                    }
                    if (vehicle.y < -40 && vehicle.y > -80) {
                        // Just spawned: never all lanes at once.
                        const covered = new Set(game.vehicles.filter((other) => other.y < 140).flatMap((other) => game.lanesOf(other, other.x)));
                        expect(covered.size).toBeLessThan(game.lanes);
                    }
                }
                game.vehicles.filter((vehicle) => vehicle.hopper).forEach((vehicle) => hoppers.add(vehicle));
                game.vehicles.filter((vehicle) => vehicle.span > 1).forEach((vehicle) => oversized.add(vehicle));
            }
            expect(game.isOver).toBe(false);
            return { hoppers: hoppers.size, oversized: oversized.size, laneChanges };
        };
        const easy = stats(1);
        const hard = stats(OVERSIZE_LEVEL + 2);
        expect(easy.oversized).toBe(0);
        expect(hard.oversized).toBeGreaterThan(0);
        expect(hard.hoppers).toBeGreaterThan(easy.hoppers);
        expect(hard.laneChanges).toBeGreaterThan(easy.laneChanges);
    });
});

describe("adapting to the available space", () => {
    it("fits as many lanes as the width allows", () => {
        expect(getRoadLayout(GAME_WIDTH)).toMatchObject({ lanes: 4, laneWidth: 75, roadLeft: 170 });
        expect(getRoadLayout(MIN_WORLD_WIDTH).lanes).toBe(MIN_LANES);
        expect(getRoadLayout(1200).lanes).toBe(MAX_LANES);
        const narrow = getRoadLayout(MIN_WORLD_WIDTH);
        expect(narrow.roadLeft).toBeGreaterThan(0);
        expect(narrow.roadLeft + narrow.roadWidth).toBeLessThan(MIN_WORLD_WIDTH);
    });

    it("widens the road and keeps everything in its lane when the racer is resized", () => {
        const game = new MotoRacerGame(null, seeded());
        game.vehicles = [];
        game.spawnOversize(2, 2);
        const lanesBefore = game.lanesOf(game.vehicles[0], game.vehicles[0].x);
        game.resize(1200, 300);
        expect(game.lanes).toBe(MAX_LANES);
        expect(game.lanesOf(game.vehicles[0], game.vehicles[0].x)).toEqual(lanesBefore);
        expect(game.bikeY).toBe(300 - 62);
        // Back to a narrow road: the truck in lanes 2 - 3 doesn't fit in 3 lanes anymore.
        game.resize(MIN_WORLD_WIDTH, 700);
        expect(game.lanes).toBe(MIN_LANES);
        expect(game.vehicles).toHaveLength(0);
        const road = getRoadLayout(MIN_WORLD_WIDTH);
        expect(game.bikeX).toBeGreaterThan(road.roadLeft);
        expect(game.bikeX).toBeLessThan(road.roadLeft + road.roadWidth);
        // And it keeps playing.
        for (let i = 0; i < 100; i++) {
            game.update(0.05, createInput(), null);
        }
        expect(game.score).toBeGreaterThan(0);
    });

    it("lays the shooter's waves out for the space: more columns when wide, more rows when tall", () => {
        const formation = (width: number, height: number) => {
            const game = new AlienShooterGame(null, seeded());
            game.resize(width, height);
            game.update(0.6, createInput(), null);
            const columns = new Set(game.enemies.map((enemy) => Math.round(enemy.slotX))).size;
            const rows = new Set(game.enemies.map((enemy) => Math.round(enemy.slotY))).size;
            expect(Math.min(...game.enemies.map((enemy) => enemy.slotX))).toBeGreaterThan(0);
            expect(Math.max(...game.enemies.map((enemy) => enemy.slotX))).toBeLessThan(width);
            return { columns, rows };
        };
        const reference = formation(GAME_WIDTH, GAME_HEIGHT);
        const wide = formation(1200, 300);
        const tall = formation(MIN_WORLD_WIDTH, 760);
        expect(wide.columns).toBeGreaterThan(reference.columns);
        expect(tall.rows).toBeGreaterThan(reference.rows);
        expect(tall.columns).toBeLessThan(reference.columns);
    });

    it("keeps the ship on screen when the shooter is resized", () => {
        const game = new AlienShooterGame(null, seeded());
        game.playerX = GAME_WIDTH - 30;
        game.resize(MIN_WORLD_WIDTH, 700);
        expect(game.playerX).toBeLessThan(MIN_WORLD_WIDTH);
        expect(game.playerY).toBe(700 - 28);
    });
});

describe("MotoRacerGame", () => {
    it("turns batches into checkpoints that give points and nitro", () => {
        const game = new MotoRacerGame(createReportProgress("records"), seeded());
        game.vehicles = [];
        game.nitro = 0;
        game.update(0.016, createInput(), records(1));
        expect(game.gates).toHaveLength(1);
        const scoreBefore = game.score;
        game.gates[0].y = game.bikeY - 1;
        game.vehicles = [];
        game.update(0.05, createInput(), records(1));
        expect(game.score - scoreBefore).toBeGreaterThanOrEqual(CHECKPOINT_POINTS);
        expect(game.nitro).toBeGreaterThan(0);
    });

    it("shows the finish line and awards a bonus when the report is ready", () => {
        const game = new MotoRacerGame(records(1), seeded());
        game.update(0.016, createInput(), { ...records(1), phase: "completed" });
        expect(game.gates.some((gate) => gate.kind === "finish")).toBe(true);
        expect(game.score).toBeGreaterThanOrEqual(FINISH_BONUS);
    });

    it("refills a little nitro on every close call", () => {
        const game = new MotoRacerGame(null, seeded());
        game.nitro = 10;
        // A car right next to the bike (4 px gap), about to be overtaken.
        const x = game.bikeX + 32 / 2 + 14 / 2 + 4;
        game.vehicles = [{ x, y: game.bikeY - 10, w: 32, h: 56, speed: 0, color: "#fff", truck: false, span: 1, hopper: false, targetX: x, blinker: 0, passed: false }];
        for (let i = 0; i < 10 && game.vehicles.length > 0 && game.vehicles[0].passed === false; i++) {
            game.update(0.05, createInput(), null);
        }
        expect(game.isOver).toBe(false);
        expect(game.score).toBeGreaterThanOrEqual(CLOSE_CALL_POINTS);
        expect(game.nitro).toBe(10 + NITRO_PER_CLOSE_CALL);
    });

    it("ends after crashing into a car", () => {
        const game = new MotoRacerGame(null, seeded());
        game.vehicles = [{ x: game.bikeX, y: game.bikeY - 20, w: 32, h: 56, speed: 0, color: "#fff", truck: false, span: 1, hopper: false, targetX: game.bikeX, blinker: 0, passed: false }];
        for (let i = 0; i < 60 && !game.isOver; i++) {
            game.update(0.05, createInput(), null);
        }
        expect(game.isOver).toBe(true);
    });

    it("counts overtaken cars and scores distance", () => {
        const game = new MotoRacerGame(null, seeded(5));
        const input = { ...createInput(), up: true };
        // Ride along the left kerb, away from the spawned traffic, by removing traffic in the bike's lane.
        for (let i = 0; i < 20 * 20 && !game.isOver; i++) {
            game.vehicles = game.vehicles.filter((vehicle) => Math.abs(vehicle.x - game.bikeX) > vehicle.w / 2 + 25);
            game.update(0.05, input, null);
        }
        expect(game.isOver).toBe(false);
        expect(game.score).toBeGreaterThan(0);
        expect(game.count).toBeGreaterThan(0);
    });
});

describe("minigameStats", () => {
    it("normalizes malformed stored values", () => {
        const stats = normalizeStats({ alienShooter: { highScore: "lots", gamesPlayed: 3, timePlayedMs: -5 } });
        expect(stats.alienShooter).toEqual({ gamesPlayed: 3, timePlayedMs: 0, highScore: 0, lifetimeCount: 0, lastPlayedOn: null });
        expect(stats.motoRacer.gamesPlayed).toBe(0);
    });

    it("accumulates sessions and keeps the highest score", () => {
        const now = new Date("2026-11-14T10:00:00Z");
        let stats = normalizeStats(undefined);
        stats = addSession(stats, "motoRacer", { score: 500, durationMs: 60000, count: 12 }, now);
        stats = addSession(stats, "motoRacer", { score: 300, durationMs: 30000, count: 4 }, now);
        expect(stats.motoRacer).toEqual({ gamesPlayed: 2, timePlayedMs: 90000, highScore: 500, lifetimeCount: 16, lastPlayedOn: now.toISOString() });
        expect(stats.alienShooter.gamesPlayed).toBe(0);
    });

    it("loads from and saves to the tool settings", async () => {
        const store = new Map<string, unknown>();
        const settings = { get: vi.fn(async (key: string) => store.get(key)), set: vi.fn(async (key: string, value: unknown) => void store.set(key, value)) };
        const stats = addSession(normalizeStats(undefined), "alienShooter", { score: 42, durationMs: 1000, count: 3 });
        await saveStats(settings, stats);
        expect(settings.set).toHaveBeenCalledWith(MINIGAME_STATS_KEY, stats);
        expect((await loadStats(settings)).alienShooter.highScore).toBe(42);
    });

    it("survives a failing settings store", async () => {
        const settings = { get: vi.fn(async () => Promise.reject(new Error("offline"))), set: vi.fn(async () => Promise.reject(new Error("offline"))) };
        vi.spyOn(console, "warn").mockImplementation(() => {});
        await expect(saveStats(settings, normalizeStats(undefined))).resolves.toBeUndefined();
        expect((await loadStats(settings)).alienShooter.highScore).toBe(0);
    });

    it("formats durations", () => {
        expect(formatDuration(42_000)).toBe("42s");
        expect(formatDuration(185_000)).toBe("3m 05s");
        expect(formatDuration(3_720_000)).toBe("1h 02m");
    });
});
