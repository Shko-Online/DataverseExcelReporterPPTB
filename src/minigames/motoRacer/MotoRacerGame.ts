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
import type { Banner, FloatingText, Game, GameInput, GameTheme, UiPalette } from "../engine";

/** Preferred lane width; lanes get narrower only when even 3 of them don't fit. */
const LANE_WIDTH = 75;
export const MIN_LANES = 3;
export const MAX_LANES = 6;
/** Distance of the bike from the bottom of the world. */
const BIKE_OFFSET = 62;
/** Room needed beside the road for a billboard. */
const BILLBOARD_SHOULDER = 150;

/** The road for a world width: as many lanes as fit (3 - 6), centered, with the rest as roadside. */
export const getRoadLayout = (width: number) => {
    // About one lane per 160 units keeps roadsides wide enough for the scenery: 4 lanes at the reference width.
    const lanes = Math.max(MIN_LANES, Math.min(MAX_LANES, Math.round(width / 160)));
    const laneWidth = Math.min(LANE_WIDTH, (width - 40) / lanes);
    const roadWidth = lanes * laneWidth;
    return { lanes, laneWidth, roadWidth, roadLeft: (width - roadWidth) / 2 };
};
const BIKE_W = 14;
const BIKE_H = 34;

/** Scroll speeds in px/s; the speedometer shows half of it in km/h. */
const MIN_SPEED = 110;
const CRUISE_SPEED = 230;
const MAX_SPEED = 360;
const NITRO_SPEED = 470;
const HIGH_SPEED = 330;
const STEER_SPEED = 230;
const CLOSE_CALL_GAP = 12;
export const CLOSE_CALL_POINTS = 50;
export const CHECKPOINT_POINTS = 100;
export const FINISH_BONUS = 1000;
const NITRO_PER_CHECKPOINT = 40;
/** A close call refills a little nitro, so it can be earned back even when no report is running. */
export const NITRO_PER_CLOSE_CALL = 6;
/** Seconds of survival that add one traffic level. */
const SECONDS_PER_LEVEL = 35;
/** Traffic level from which oversized loads (2 lanes) appear, and from which they can take 3 lanes. */
export const OVERSIZE_LEVEL = 2;
export const WIDE_OVERSIZE_LEVEL = 3;
const OVERSIZE_LOADS = ["MEGA PIVOT TABLE", "MERGED CELLS A1:XFD1", "1,048,576 ROWS", "VLOOKUP XXL"];

const CAR_COLORS = ["#d94848", "#3f7fd9", "#e0b43c", "#7a4fd1", "#f0f0f0", "#2f2f2f", "#36a17a", "#e07c3c"];

/** Darkness laid over the daytime scene in the dark theme, before the lights are added. */
const NIGHT_TINT = "rgba(8, 12, 32, 0.62)";

const BILLBOARDS = ["VLOOKUP · NEXT EXIT", "PIVOT POINT 2 km", "#REF! MOTEL", "MERGE CELLS AHEAD", "PAGING COOKIE DINER", "CTRL+S SERVICE AREA", "FREEZE PANES ROAD", "XLOOKUP 5 km"];

interface Vehicle {
    x: number;
    y: number;
    w: number;
    h: number;
    speed: number;
    color: string;
    truck: boolean;
    /** Number of lanes taken: 1, or 2 - 3 for oversized loads. */
    span: number;
    /** Weaves from lane to lane much more often than the other cars. */
    hopper: boolean;
    load?: string;
    /** Lane change in progress. */
    targetX: number;
    blinker: number;
    passed: boolean;
}

interface Gate {
    y: number;
    batch: number;
    records: number;
    kind: "checkpoint" | "finish";
    passed: boolean;
}

interface Scenery {
    x: number;
    y: number;
    kind: "tree" | "bush" | "billboard" | "milestone";
    text?: string;
    size: number;
}

export class MotoRacerGame implements Game {
    score = 0;
    count = 0;
    isOver = false;

    width = GAME_WIDTH;
    height = GAME_HEIGHT;
    private hudInsetRight = 0;
    lanes = 4;
    laneWidth = LANE_WIDTH;
    roadWidth = 4 * LANE_WIDTH;
    roadLeft = (GAME_WIDTH - 4 * LANE_WIDTH) / 2;
    bikeX = 0;
    speed = CRUISE_SPEED;
    nitro = 50;
    vehicles: Vehicle[] = [];
    gates: Gate[] = [];

    private time = 0;
    private distance = 0;
    private lean = 0;
    private spawnTimer = 1;
    private crashed = false;
    private overTimer = -1;
    private lastGateAt = -10;
    private scoreFraction = 0;
    private scenery: Scenery[] = [];
    private sceneryTimer = 0;
    private billboardIndex = 0;
    private texts: FloatingText[] = [];
    private banner: Banner | null = null;
    private readonly watcher: ReportWatcher;

    constructor(progress: ReportProgress | null, private readonly random: () => number = Math.random) {
        this.watcher = new ReportWatcher(progress);
        this.layoutRoad();
        this.bikeX = this.roadLeft + this.laneWidth * (Math.floor(this.lanes / 2) + 0.5);
        this.fillScenery();
    }

    get bikeY() {
        return this.height - BIKE_OFFSET;
    }

    private get roadRight() {
        return this.roadLeft + this.roadWidth;
    }

    private layoutRoad() {
        Object.assign(this, getRoadLayout(this.width));
    }

    private fillScenery() {
        this.scenery = [];
        for (let y = -20; y < this.height; y += 45) {
            this.addScenery(y);
        }
    }

    /**
     * Adapts to a new world size: the road gets as many lanes as fit, and everything keeps its place in its lane.
     * Vehicles in lanes that no longer exist leave the road.
     */
    resize(width: number, height: number, hudInsetRight = 0) {
        this.hudInsetRight = hudInsetRight;
        if (width === this.width && height === this.height) {
            return;
        }
        const old = { roadLeft: this.roadLeft, laneWidth: this.laneWidth };
        const sy = height / this.height;
        this.width = width;
        this.height = height;
        this.layoutRoad();
        const toLanes = (x: number) => (x - old.roadLeft) / old.laneWidth;
        const fromLanes = (lanes: number) => this.roadLeft + lanes * this.laneWidth;
        this.vehicles = this.vehicles.filter((vehicle) => toLanes(vehicle.x) + vehicle.span / 2 <= this.lanes + 0.01 && toLanes(vehicle.targetX) + vehicle.span / 2 <= this.lanes + 0.01);
        for (const vehicle of this.vehicles) {
            vehicle.x = fromLanes(toLanes(vehicle.x));
            vehicle.targetX = fromLanes(toLanes(vehicle.targetX));
            if (vehicle.span > 1) {
                vehicle.w = vehicle.span * this.laneWidth - 12;
            }
            vehicle.y *= sy;
        }
        for (const item of [...this.gates, ...this.texts]) {
            item.y *= sy;
        }
        this.bikeX = Math.max(this.roadLeft + BIKE_W, Math.min(this.roadRight - BIKE_W, fromLanes(toLanes(this.bikeX))));
        this.fillScenery();
    }

    /** Grows with the time survived: denser traffic, more (and quicker) lane changes, oversized loads. */
    get difficulty() {
        return 1 + this.time / SECONDS_PER_LEVEL;
    }

    get trafficLevel() {
        return Math.floor(this.difficulty);
    }

    /** Points are worth more at higher traffic levels. */
    get scoreMultiplier() {
        return 1 + (this.trafficLevel - 1) * 0.5;
    }

    get kmh() {
        return Math.round(this.speed / 2);
    }

    update(dt: number, input: GameInput, progress: ReportProgress | null) {
        this.time += dt;
        this.texts = updateFloatingTexts(this.texts, dt);
        if (this.banner) {
            this.banner.age += dt;
            if (this.banner.age >= this.banner.ttl) this.banner = null;
        }
        this.handleReportEvents(progress);

        if (this.overTimer >= 0) {
            this.speed = Math.max(0, this.speed - 500 * dt);
            this.scroll(dt);
            this.overTimer -= dt;
            if (this.overTimer < 0) this.isOver = true;
            return;
        }

        this.announceLevel();
        this.updateBike(dt, input);
        this.scroll(dt);
        this.updateTraffic(dt);
        this.updateGates();

        const multiplier = (this.speed >= HIGH_SPEED ? 2 : 1) * this.scoreMultiplier;
        this.scoreFraction += this.speed * dt * 0.05 * multiplier;
        const whole = Math.floor(this.scoreFraction);
        this.score += whole;
        this.scoreFraction -= whole;
    }

    private announcedLevel = 1;

    private announceLevel() {
        const level = this.trafficLevel;
        if (level <= this.announcedLevel) {
            return;
        }
        this.announcedLevel = level;
        const subtitle =
            level === OVERSIZE_LEVEL ? "Oversized loads on the road!" : level === WIDE_OVERSIZE_LEVEL ? "Wide loads now take 3 lanes!" : `Heavier traffic, more lane hoppers · points x${this.scoreMultiplier}`;
        if (this.banner) {
            this.texts.push({ x: this.width / 2, y: getHudLayout(this.width, this.hudInsetRight).top + 52, text: `TRAFFIC LEVEL ${level}`, color: "warning", ttl: 2, age: 0 });
        } else {
            this.banner = { title: `TRAFFIC LEVEL ${level}`, subtitle, color: "warning", ttl: 2, age: 0 };
        }
    }

    private handleReportEvents(progress: ReportProgress | null) {
        const events = this.watcher.poll(progress);
        if (events.newPages > 0 && progress) {
            if (this.time - this.lastGateAt >= 2.5) {
                this.gates.push({ y: -30, batch: progress.pagesRetrieved, records: progress.exportedRecords, kind: "checkpoint", passed: false });
                this.lastGateAt = this.time;
            } else {
                this.nitro = Math.min(100, this.nitro + 5 * events.newPages);
            }
        }
        if (events.decile !== null) {
            this.scenery.push({ x: Math.min(this.width - 24, this.roadRight + Math.max(26, (this.width - this.roadRight) / 3)), y: -40, kind: "milestone", text: `${events.decile * 10}%`, size: 1 });
        }
        if (events.completed) {
            this.gates.push({ y: -30, batch: progress?.pagesRetrieved ?? 0, records: progress?.exportedRecords ?? 0, kind: "finish", passed: false });
            if (!this.crashed) {
                this.score += FINISH_BONUS;
                this.banner = { title: "REPORT READY!", subtitle: `Finish line ahead · +${FINISH_BONUS} bonus`, color: "success", ttl: 4, age: 0 };
            }
        } else if (events.stopped && !this.crashed) {
            this.banner = { title: progress?.phase === "failed" ? "REPORT FAILED" : "REPORT CANCELLED", subtitle: "Road closed ahead... just kidding, keep riding!", color: "danger", ttl: 3.5, age: 0 };
        }
    }

    private updateBike(dt: number, input: GameInput) {
        let steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        if (steer === 0 && input.pointerX !== null) {
            const delta = input.pointerX - this.bikeX;
            steer = Math.abs(delta) < 3 ? 0 : Math.sign(delta) * Math.min(1, Math.abs(delta) / 25);
        }
        this.bikeX = Math.max(this.roadLeft + BIKE_W, Math.min(this.roadLeft + this.roadWidth - BIKE_W, this.bikeX + steer * STEER_SPEED * dt * (0.6 + this.speed / MAX_SPEED * 0.6)));
        this.lean += (steer * 0.35 - this.lean) * Math.min(1, dt * 10);

        const usingNitro = input.fire && this.nitro > 0;
        let target = CRUISE_SPEED;
        if (usingNitro) {
            target = NITRO_SPEED;
            this.nitro = Math.max(0, this.nitro - 28 * dt);
        } else if (input.up || input.pointerDown) {
            target = MAX_SPEED;
        } else if (input.down) {
            target = MIN_SPEED;
        }
        const rate = target > this.speed ? (usingNitro ? 320 : 150) : input.down ? 320 : 120;
        this.speed = target > this.speed ? Math.min(target, this.speed + rate * dt) : Math.max(target, this.speed - rate * dt);
    }

    private scroll(dt: number) {
        const delta = this.speed * dt;
        this.distance += delta;
        for (const item of this.scenery) {
            item.y += delta;
        }
        this.scenery = this.scenery.filter((item) => item.y < this.height + 60);
        this.sceneryTimer -= delta;
        if (this.sceneryTimer <= 0) {
            this.sceneryTimer = 45;
            this.addScenery(-40);
        }
        for (const gate of this.gates) {
            gate.y += delta;
        }
        this.gates = this.gates.filter((gate) => gate.y < this.height + 40);
    }

    private addScenery(y: number) {
        for (const side of [0, 1]) {
            const roll = this.random();
            const shoulder = side === 0 ? this.roadLeft : this.width - this.roadRight;
            if (shoulder < 36) {
                continue;
            }
            const x = side === 0 ? randomBetween(12, this.roadLeft - 22, this.random) : randomBetween(this.roadRight + 22, this.width - 12, this.random);
            if (roll < 0.06 && side === 0 && shoulder >= BILLBOARD_SHOULDER) {
                this.scenery.push({ x: this.roadLeft / 2, y, kind: "billboard", text: BILLBOARDS[this.billboardIndex++ % BILLBOARDS.length], size: 1 });
            } else if (roll < 0.55) {
                this.scenery.push({ x, y: y + randomBetween(-15, 15, this.random), kind: this.random() < 0.6 ? "tree" : "bush", size: randomBetween(0.7, 1.3, this.random) });
            }
        }
    }

    private updateTraffic(dt: number) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            // More lanes, more cars: the traffic density per lane stays the same on wide roads.
            this.spawnTimer = (Math.max(0.32, 1.25 / Math.sqrt(this.difficulty)) * 4 / this.lanes) * randomBetween(0.7, 1.3, this.random);
            this.spawnVehicle();
        }

        const difficulty = this.difficulty;
        const laneChangeSpeed = Math.min(150, 55 + 20 * (difficulty - 1));
        for (const vehicle of this.vehicles) {
            // Don't drive through the vehicle ahead in the same lane: slow down to its speed.
            const ahead = this.vehicles.find((other) => other !== vehicle && other.y < vehicle.y && this.sharesLane(vehicle, other) && vehicle.y - vehicle.h / 2 - (other.y + other.h / 2) < 24);
            if (ahead && ahead.speed < vehicle.speed) {
                vehicle.speed = ahead.speed;
            }
            vehicle.y += (this.speed - vehicle.speed) * dt;
            if (vehicle.blinker > 0) {
                vehicle.blinker -= dt;
            } else if (vehicle.targetX !== vehicle.x) {
                const step = laneChangeSpeed * (vehicle.hopper ? 1.3 : 1) * dt;
                vehicle.x = Math.abs(vehicle.targetX - vehicle.x) <= step ? vehicle.targetX : vehicle.x + Math.sign(vehicle.targetX - vehicle.x) * step;
            } else if (this.wantsLaneChange(vehicle, dt)) {
                this.startLaneChange(vehicle);
            }

            const bike = { x: this.bikeX, y: this.bikeY, w: BIKE_W - 2, h: BIKE_H - 4 };
            if (!this.crashed && overlaps(vehicle, bike)) {
                this.crash();
            }
            if (!vehicle.passed && vehicle.y - vehicle.h / 2 > this.bikeY + BIKE_H / 2) {
                vehicle.passed = true;
                if (!this.crashed) {
                    this.count++;
                    const gap = Math.abs(vehicle.x - this.bikeX) - (vehicle.w + BIKE_W) / 2;
                    if (gap < CLOSE_CALL_GAP) {
                        const points = Math.round(CLOSE_CALL_POINTS * this.scoreMultiplier);
                        this.score += points;
                        this.nitro = Math.min(100, this.nitro + NITRO_PER_CLOSE_CALL);
                        this.texts.push({ x: this.bikeX, y: this.bikeY - 30, text: `Close call! +${points} · Nitro`, color: "highlight", ttl: 1, age: 0 });
                    }
                }
            }
        }
        this.vehicles = this.vehicles.filter((vehicle) => vehicle.y < this.height + 120 && vehicle.y > -260);
    }

    private laneCenter(lane: number) {
        return this.roadLeft + this.laneWidth * (lane + 0.5);
    }

    private laneOf(x: number) {
        return Math.max(0, Math.min(this.lanes - 1, Math.floor((x - this.roadLeft) / this.laneWidth)));
    }

    /** The lanes a vehicle covers when centered on `x` (oversized loads cover several). */
    lanesOf(vehicle: Pick<Vehicle, "w">, x: number): number[] {
        const first = this.laneOf(x - vehicle.w / 2 + 4);
        const last = this.laneOf(x + vehicle.w / 2 - 4);
        return Array.from({ length: last - first + 1 }, (_, index) => first + index);
    }

    /** Lanes taken now or soon (lane change in progress). */
    private occupiedLanes(vehicle: Vehicle) {
        return new Set([...this.lanesOf(vehicle, vehicle.x), ...this.lanesOf(vehicle, vehicle.targetX)]);
    }

    private sharesLane(a: Vehicle, b: Vehicle) {
        const lanes = this.occupiedLanes(b);
        return [...this.occupiedLanes(a)].some((lane) => lanes.has(lane));
    }

    private isLaneBusy(lane: number, top: number, bottom: number, except?: Vehicle) {
        return this.vehicles.some((vehicle) => vehicle !== except && this.occupiedLanes(vehicle).has(lane) && vehicle.y + vehicle.h / 2 > top && vehicle.y - vehicle.h / 2 < bottom);
    }

    /** Lane changes get more frequent with the difficulty; lane hoppers weave all the time and closer to the bike. */
    private wantsLaneChange(vehicle: Vehicle, dt: number) {
        if (vehicle.span > 1 || this.time < 6 || vehicle.y < 0) {
            return false;
        }
        const rate = vehicle.hopper ? 0.9 : Math.min(0.35, 0.05 * this.difficulty);
        const lastChance = vehicle.hopper ? this.bikeY - 90 : this.bikeY - 140;
        return vehicle.y < lastChance && this.random() < rate * dt;
    }

    private spawnVehicle() {
        const difficulty = this.difficulty;
        const lanes = Array.from({ length: this.lanes }, (_, lane) => lane);
        // Keep at least one lane open near the top so the road is never fully blocked.
        const freeLanes = lanes.filter((lane) => !this.isLaneBusy(lane, -260, 140));
        if (freeLanes.length <= 1) {
            return;
        }

        const oversizeChance = difficulty < OVERSIZE_LEVEL ? 0 : Math.min(0.3, 0.12 + 0.06 * (difficulty - OVERSIZE_LEVEL));
        if (this.random() < oversizeChance) {
            const span = difficulty >= WIDE_OVERSIZE_LEVEL && this.random() < 0.35 ? 3 : 2;
            const starts = lanes.filter((first) => first + span <= this.lanes && lanes.slice(first, first + span).every((lane) => freeLanes.includes(lane)) && freeLanes.length - span >= 1);
            if (starts.length > 0) {
                const first = starts[Math.floor(this.random() * starts.length)];
                this.spawnOversize(first, span);
                return;
            }
        }

        const lane = freeLanes[Math.floor(this.random() * freeLanes.length)];
        const truck = this.random() < 0.18;
        const hopper = !truck && this.random() < Math.min(0.55, 0.12 * (difficulty - 1));
        const h = truck ? 92 : 56;
        const x = this.laneCenter(lane);
        this.vehicles.push({
            x,
            y: -h,
            w: truck ? 36 : 32,
            h,
            // Slow lanes on the right, fast lanes on the left.
            speed: (truck ? 70 : 100) + (this.lanes - 1 - lane) * 22 + randomBetween(0, 25, this.random) + (hopper ? 20 : 0),
            color: hopper ? "#e8432f" : CAR_COLORS[Math.floor(this.random() * CAR_COLORS.length)],
            truck,
            span: 1,
            hopper,
            targetX: x,
            blinker: 0,
            passed: false,
        });
    }

    /** A slow flatbed carrying a giant spreadsheet across `span` lanes, starting at lane `first`. */
    spawnOversize(first: number, span: number) {
        const h = span === 3 ? 140 : 120;
        const x = this.roadLeft + this.laneWidth * (first + span / 2);
        this.vehicles.push({
            x,
            y: -h / 2 - 10,
            w: span * this.laneWidth - 12,
            h,
            speed: randomBetween(55, 75, this.random),
            color: "#f2b705",
            truck: true,
            span,
            hopper: false,
            load: OVERSIZE_LOADS[Math.floor(this.random() * OVERSIZE_LOADS.length)],
            targetX: x,
            blinker: 0,
            passed: false,
        });
    }

    private startLaneChange(vehicle: Vehicle) {
        const lane = this.laneOf(vehicle.x);
        const options = [lane - 1, lane + 1].filter((candidate) => candidate >= 0 && candidate < this.lanes && !this.isLaneBusy(candidate, vehicle.y - vehicle.h - 20, vehicle.y + vehicle.h + 20, vehicle));
        if (options.length > 0) {
            vehicle.targetX = this.laneCenter(options[Math.floor(this.random() * options.length)]);
            // Less warning at higher levels, even less from lane hoppers.
            vehicle.blinker = Math.max(0.35, 0.95 - 0.12 * (this.difficulty - 1)) * (vehicle.hopper ? 0.7 : 1);
        }
    }

    private updateGates() {
        for (const gate of this.gates) {
            if (!gate.passed && gate.y >= this.bikeY) {
                gate.passed = true;
                if (gate.kind === "checkpoint") {
                    this.score += CHECKPOINT_POINTS;
                    this.nitro = Math.min(100, this.nitro + NITRO_PER_CHECKPOINT);
                    this.texts.push({ x: this.bikeX, y: this.bikeY - 44, text: `Checkpoint! +${CHECKPOINT_POINTS} · Nitro`, color: "info", ttl: 1.2, age: 0 });
                }
            }
        }
    }

    private crash() {
        this.crashed = true;
        this.overTimer = 1.4;
        this.banner = { title: "CRASH!", subtitle: "Your spreadsheet is fine. Your bike, not so much.", color: "danger", ttl: 10, age: 0 };
    }

    /** Light theme: a sunny afternoon. Dark theme: the same road at night, lit by headlights and signs. */
    render(ctx: CanvasRenderingContext2D, progress: ReportProgress | null, theme: GameTheme) {
        const ui = UI_PALETTES[theme];
        const night = theme === "dark";
        this.drawGround(ctx);
        this.drawRoad(ctx);
        for (const item of this.scenery) {
            if (item.kind === "tree" || item.kind === "bush") {
                this.drawScenery(ctx, item);
            }
        }
        for (const gate of this.gates) {
            this.drawGateLine(ctx, gate);
        }
        for (const vehicle of this.vehicles) {
            this.drawVehicle(ctx, vehicle);
        }
        this.drawBike(ctx);

        if (night) {
            ctx.fillStyle = NIGHT_TINT;
            ctx.fillRect(0, 0, this.width, this.height);
            this.drawNightLights(ctx);
        }

        // Signs are lit at night, so they are drawn after the night tint.
        for (const item of this.scenery) {
            if (item.kind === "billboard" || item.kind === "milestone") {
                this.drawScenery(ctx, item, night);
            }
        }
        for (const gate of this.gates) {
            this.drawGantry(ctx, gate, night);
        }
        drawFloatingTexts(ctx, this.texts, ui);
        this.drawHud(ctx, progress, ui);
        drawBanner(ctx, this.banner, ui, this.width, this.height);
    }

    private drawNightLights(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        if (!this.crashed) {
            // Headlight beam ahead of the bike.
            ctx.save();
            ctx.translate(this.bikeX, this.bikeY - BIKE_H / 2);
            ctx.rotate(this.lean * 0.6);
            const beam = ctx.createLinearGradient(0, 0, 0, -170);
            beam.addColorStop(0, "rgba(255, 236, 170, 0.45)");
            beam.addColorStop(1, "rgba(255, 236, 170, 0)");
            ctx.fillStyle = beam;
            ctx.beginPath();
            ctx.moveTo(-4, 0);
            ctx.lineTo(-48, -170);
            ctx.lineTo(48, -170);
            ctx.lineTo(4, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        for (const vehicle of this.vehicles) {
            const y = vehicle.y + vehicle.h / 2 - 1.5;
            const braking = vehicle.speed < 110;
            for (const x of [vehicle.x - vehicle.w / 2 + 5, vehicle.x + vehicle.w / 2 - 5]) {
                const glow = ctx.createRadialGradient(x, y, 0, x, y, braking ? 16 : 11);
                glow.addColorStop(0, braking ? "rgba(255, 60, 60, 0.9)" : "rgba(255, 60, 60, 0.6)");
                glow.addColorStop(1, "rgba(255, 60, 60, 0)");
                ctx.fillStyle = glow;
                ctx.fillRect(x - 16, y - 16, 32, 32);
            }
            if (vehicle.span > 1 && Math.floor(this.time * 4) % 2 === 0) {
                for (const [bx, by] of this.beaconPositions(vehicle)) {
                    const beacon = ctx.createRadialGradient(bx, by, 0, bx, by, 20);
                    beacon.addColorStop(0, "rgba(255, 176, 0, 0.75)");
                    beacon.addColorStop(1, "rgba(255, 176, 0, 0)");
                    ctx.fillStyle = beacon;
                    ctx.fillRect(bx - 20, by - 20, 40, 40);
                }
            }
            if ((vehicle.blinker > 0 || vehicle.targetX !== vehicle.x) && Math.floor(this.time * 6) % 2 === 0) {
                const bx = vehicle.targetX < vehicle.x ? vehicle.x - vehicle.w / 2 : vehicle.x + vehicle.w / 2;
                const glow = ctx.createRadialGradient(bx, vehicle.y, 0, bx, vehicle.y, 14);
                glow.addColorStop(0, "rgba(255, 176, 0, 0.8)");
                glow.addColorStop(1, "rgba(255, 176, 0, 0)");
                ctx.fillStyle = glow;
                ctx.fillRect(bx - 14, vehicle.y - 14, 28, 28);
            }
        }
        ctx.restore();
        // Redraw the lamps themselves at full brightness.
        ctx.fillStyle = "#ff5a5a";
        for (const vehicle of this.vehicles) {
            ctx.fillRect(vehicle.x - vehicle.w / 2 + 2, vehicle.y + vehicle.h / 2 - 3, 6, 3);
            ctx.fillRect(vehicle.x + vehicle.w / 2 - 8, vehicle.y + vehicle.h / 2 - 3, 6, 3);
        }
    }

    private drawGround(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = "#3f7d3a";
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.fillStyle = "#3a7335";
        const offset = this.distance % 80;
        for (let y = -80 + offset; y < this.height; y += 80) {
            ctx.fillRect(0, y, this.roadLeft, 40);
            ctx.fillRect(this.roadLeft + this.roadWidth, y, this.width - this.roadLeft - this.roadWidth, 40);
        }
    }

    private drawRoad(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = "#4a4d55";
        ctx.fillRect(this.roadLeft, 0, this.roadWidth, this.height);
        // Kerbs
        const kerbOffset = this.distance % 40;
        for (let y = -40 + kerbOffset; y < this.height; y += 40) {
            ctx.fillStyle = "#e05252";
            ctx.fillRect(this.roadLeft - 8, y, 8, 20);
            ctx.fillRect(this.roadLeft + this.roadWidth, y, 8, 20);
            ctx.fillStyle = "#f2f2f2";
            ctx.fillRect(this.roadLeft - 8, y + 20, 8, 20);
            ctx.fillRect(this.roadLeft + this.roadWidth, y + 20, 8, 20);
        }
        // Lane markings
        ctx.fillStyle = "#e8e8e8";
        const dashOffset = this.distance % 50;
        for (let lane = 1; lane < this.lanes; lane++) {
            const x = this.roadLeft + lane * this.laneWidth - 1.5;
            for (let y = -50 + dashOffset; y < this.height; y += 50) {
                ctx.fillRect(x, y, 3, 24);
            }
        }
    }

    private drawScenery(ctx: CanvasRenderingContext2D, item: Scenery, lit = false) {
        ctx.save();
        switch (item.kind) {
            case "tree":
                ctx.fillStyle = "rgba(0,0,0,0.2)";
                ctx.beginPath();
                ctx.arc(item.x + 4, item.y + 4, 13 * item.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "#2a5e2b";
                ctx.beginPath();
                ctx.arc(item.x, item.y, 13 * item.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "#357a35";
                ctx.beginPath();
                ctx.arc(item.x - 3, item.y - 3, 8 * item.size, 0, Math.PI * 2);
                ctx.fill();
                break;
            case "bush":
                ctx.fillStyle = "#4f9a46";
                ctx.beginPath();
                ctx.arc(item.x, item.y, 6 * item.size, 0, Math.PI * 2);
                ctx.arc(item.x + 6 * item.size, item.y + 2, 5 * item.size, 0, Math.PI * 2);
                ctx.fill();
                break;
            case "billboard":
                ctx.fillStyle = "#6b5236";
                ctx.fillRect(item.x - 2, item.y + 10, 4, 16);
                ctx.fillStyle = "#107c41";
                if (lit) {
                    ctx.shadowColor = "#3ccf85";
                    ctx.shadowBlur = 14;
                }
                roundRect(ctx, item.x - 70, item.y - 14, 140, 26, 3);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 10px ui-monospace, Consolas, monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(item.text ?? "", item.x, item.y);
                break;
            case "milestone":
                ctx.fillStyle = "#6b6b6b";
                ctx.fillRect(item.x - 1.5, item.y + 8, 3, 18);
                ctx.fillStyle = "#ffd36b";
                if (lit) {
                    ctx.shadowColor = "#ffd36b";
                    ctx.shadowBlur = 12;
                }
                roundRect(ctx, item.x - 22, item.y - 12, 44, 22, 4);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.fillStyle = "#1a1a1a";
                ctx.font = "bold 11px ui-monospace, Consolas, monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(item.text ?? "", item.x, item.y);
                break;
        }
        ctx.restore();
    }

    /** The line painted across the road (under the traffic). */
    private drawGateLine(ctx: CanvasRenderingContext2D, gate: Gate) {
        ctx.save();
        if (gate.kind === "finish") {
            const size = 10;
            for (let column = 0; column < this.roadWidth / size; column++) {
                for (let row = 0; row < 2; row++) {
                    ctx.fillStyle = (column + row) % 2 === 0 ? "#ffffff" : "#111111";
                    ctx.fillRect(this.roadLeft + column * size, gate.y - size + row * size, size, size);
                }
            }
        } else {
            ctx.fillStyle = "rgba(143, 211, 255, 0.35)";
            ctx.fillRect(this.roadLeft, gate.y - 3, this.roadWidth, 6);
        }
        ctx.restore();
    }

    /** The overhead sign (above the traffic). */
    private drawGantry(ctx: CanvasRenderingContext2D, gate: Gate, lit: boolean) {
        ctx.save();
        ctx.fillStyle = "#2b2f3a";
        ctx.fillRect(this.roadLeft - 14, gate.y - 26, 8, 30);
        ctx.fillRect(this.roadLeft + this.roadWidth + 6, gate.y - 26, 8, 30);
        ctx.fillStyle = gate.kind === "finish" ? "#21a366" : "#1f6fb2";
        if (lit) {
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 16;
        }
        roundRect(ctx, this.roadLeft - 14, gate.y - 34, this.roadWidth + 28, 18, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px ui-monospace, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = gate.kind === "finish" ? `FINISH · REPORT READY · ${gate.records.toLocaleString()} RECORDS` : `BATCH #${gate.batch} · ${gate.records.toLocaleString()} RECORDS EXPORTED`;
        ctx.fillText(label, this.width / 2, gate.y - 25);
        ctx.restore();
    }

    /** Flatbed with a giant spreadsheet on it, "OVERSIZE LOAD" banner at the rear and flashing amber beacons. */
    private drawOversize(ctx: CanvasRenderingContext2D, vehicle: Vehicle) {
        const { x, y, w, h } = vehicle;
        const top = y - h / 2;
        const left = x - w / 2;
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        roundRect(ctx, left + 4, top + 5, w, h, 4);
        ctx.fill();
        // Cab
        ctx.fillStyle = vehicle.color;
        roundRect(ctx, x - 19, top, 38, 26, 5);
        ctx.fill();
        ctx.fillStyle = "#9fd0ff";
        ctx.fillRect(x - 15, top + 17, 30, 6);
        // Flatbed
        ctx.fillStyle = "#5a5f69";
        ctx.fillRect(x - 21, top + 26, 42, h - 26);
        // The load: a spreadsheet much wider than the truck.
        const loadTop = top + 32;
        const loadHeight = h - 50;
        ctx.fillStyle = "#fbfbfb";
        ctx.fillRect(left, loadTop, w, loadHeight);
        ctx.fillStyle = "#107c41";
        ctx.fillRect(left, loadTop, w, 12);
        ctx.strokeStyle = "#c8d3cc";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let gx = left + 24; gx < left + w; gx += 24) {
            ctx.moveTo(gx + 0.5, loadTop + 12);
            ctx.lineTo(gx + 0.5, loadTop + loadHeight);
        }
        for (let gy = loadTop + 24; gy < loadTop + loadHeight; gy += 12) {
            ctx.moveTo(left, gy + 0.5);
            ctx.lineTo(left + w, gy + 0.5);
        }
        ctx.stroke();
        ctx.strokeStyle = "#107c41";
        ctx.lineWidth = 2;
        ctx.strokeRect(left + 1, loadTop + 1, w - 2, loadHeight - 2);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px ui-monospace, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("A   B   C   D   E   F   G   H".substring(0, Math.floor(w / 6)), x, loadTop + 6.5);
        ctx.fillStyle = "#107c41";
        ctx.font = "bold 11px ui-monospace, Consolas, monospace";
        ctx.fillText(vehicle.load ?? "", x, loadTop + loadHeight / 2 + 6);
        // Rear banner
        ctx.fillStyle = "#ffd200";
        ctx.fillRect(left + 6, top + h - 16, w - 12, 12);
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 1;
        ctx.strokeRect(left + 6.5, top + h - 15.5, w - 13, 11);
        ctx.fillStyle = "#1a1a1a";
        ctx.font = "bold 9px ui-monospace, Consolas, monospace";
        ctx.fillText("OVERSIZE LOAD", x, top + h - 9.5);
        // Amber beacons on the corners of the load.
        if (Math.floor(this.time * 4) % 2 === 0) {
            ctx.fillStyle = "#ffb000";
            for (const [bx, by] of this.beaconPositions(vehicle)) {
                ctx.beginPath();
                ctx.arc(bx, by, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.fillStyle = "#ff3b3b";
        ctx.fillRect(left + 2, top + h - 3, 8, 3);
        ctx.fillRect(left + w - 10, top + h - 3, 8, 3);
        ctx.restore();
    }

    private beaconPositions(vehicle: Vehicle): [number, number][] {
        const left = vehicle.x - vehicle.w / 2 + 3;
        const right = vehicle.x + vehicle.w / 2 - 3;
        const top = vehicle.y - vehicle.h / 2 + 35;
        const bottom = vehicle.y + vehicle.h / 2 - 21;
        return [[left, top], [right, top], [left, bottom], [right, bottom]];
    }

    private drawVehicle(ctx: CanvasRenderingContext2D, vehicle: Vehicle) {
        if (vehicle.span > 1) {
            this.drawOversize(ctx, vehicle);
            return;
        }
        const { x, y, w, h, color } = vehicle;
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        roundRect(ctx, x - w / 2 + 3, y - h / 2 + 4, w, h, 6);
        ctx.fill();
        if (vehicle.truck) {
            ctx.fillStyle = color;
            roundRect(ctx, x - w / 2, y - h / 2, w, 26, 5);
            ctx.fill();
            ctx.fillStyle = "#9fd0ff";
            ctx.fillRect(x - w / 2 + 4, y - h / 2 + 18, w - 8, 6);
            ctx.fillStyle = "#e6e6e6";
            ctx.fillRect(x - w / 2, y - h / 2 + 28, w, h - 28);
            ctx.fillStyle = "#107c41";
            ctx.font = "bold 9px ui-monospace, Consolas, monospace";
            ctx.textAlign = "center";
            ctx.save();
            ctx.translate(x, y + 14);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText("XLSX", 0, 3);
            ctx.restore();
        } else {
            ctx.fillStyle = color;
            roundRect(ctx, x - w / 2, y - h / 2, w, h, 8);
            ctx.fill();
            ctx.fillStyle = "rgba(20, 30, 45, 0.85)";
            roundRect(ctx, x - w / 2 + 4, y - h / 2 + 12, w - 8, 10, 3);
            ctx.fill();
            roundRect(ctx, x - w / 2 + 5, y + h / 2 - 16, w - 10, 8, 3);
            ctx.fill();
            if (vehicle.hopper) {
                // Lane hoppers are sports cars with racing stripes.
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(x - 5, y - h / 2 + 1, 3, 10);
                ctx.fillRect(x + 2, y - h / 2 + 1, 3, 10);
                ctx.fillRect(x - 5, y - h / 2 + 24, 3, h - 42);
                ctx.fillRect(x + 2, y - h / 2 + 24, 3, h - 42);
            }
        }
        // Tail lights (the bike sees the cars from behind).
        ctx.fillStyle = "#ff3b3b";
        ctx.fillRect(x - w / 2 + 2, y + h / 2 - 3, 6, 3);
        ctx.fillRect(x + w / 2 - 8, y + h / 2 - 3, 6, 3);
        if (vehicle.blinker > 0 || vehicle.targetX !== vehicle.x) {
            if (Math.floor(this.time * 6) % 2 === 0) {
                ctx.fillStyle = "#ffb000";
                const left = vehicle.targetX < vehicle.x;
                const bx = left ? x - w / 2 - 1 : x + w / 2 - 3;
                ctx.fillRect(bx, y - h / 2 + 1, 4, 4);
                ctx.fillRect(bx, y + h / 2 - 5, 4, 4);
            }
        }
        ctx.restore();
    }

    private drawBike(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.bikeX, this.bikeY);
        if (this.crashed) {
            ctx.rotate(this.time * 9);
        } else {
            ctx.rotate(this.lean);
        }
        // Nitro flame
        if (!this.crashed && this.speed > MAX_SPEED + 5) {
            ctx.fillStyle = "#8fd3ff";
            ctx.globalAlpha = 0.7 + Math.sin(this.time * 40) * 0.3;
            ctx.beginPath();
            ctx.moveTo(-4, BIKE_H / 2);
            ctx.lineTo(0, BIKE_H / 2 + 14 + Math.sin(this.time * 50) * 4);
            ctx.lineTo(4, BIKE_H / 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        roundRect(ctx, -BIKE_W / 2 + 3, -BIKE_H / 2 + 4, BIKE_W, BIKE_H, 6);
        ctx.fill();
        // Wheels
        ctx.fillStyle = "#151515";
        roundRect(ctx, -3, -BIKE_H / 2, 6, 10, 2);
        ctx.fill();
        roundRect(ctx, -3.5, BIKE_H / 2 - 10, 7, 10, 2);
        ctx.fill();
        // Body
        ctx.fillStyle = "#21a366";
        roundRect(ctx, -5, -BIKE_H / 2 + 6, 10, BIKE_H - 12, 4);
        ctx.fill();
        // Handlebar
        ctx.fillStyle = "#333333";
        ctx.fillRect(-9, -BIKE_H / 2 + 9, 18, 3);
        // Rider
        ctx.fillStyle = "#1f3b6e";
        roundRect(ctx, -6.5, -4, 13, 14, 5);
        ctx.fill();
        ctx.fillStyle = "#f2f2f2";
        ctx.beginPath();
        ctx.arc(0, -4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#107c41";
        ctx.fillRect(-1, -9, 2, 10);
        ctx.restore();
    }

    private drawHud(ctx: CanvasRenderingContext2D, progress: ReportProgress | null, ui: UiPalette) {
        const layout = getHudLayout(this.width, this.hudInsetRight);
        const top = layout.top;
        drawHudText(ctx, ui, `SCORE ${this.score}`, 10, top);
        drawHudText(ctx, ui, `${this.kmh} km/h${this.speed >= HIGH_SPEED ? "  x2" : ""}`, 10, top + 16, "left", this.speed >= HIGH_SPEED ? "highlight" : "text");
        drawHudText(ctx, ui, `TRAFFIC LV ${this.trafficLevel}`, 10, top + 32);
        drawHudText(ctx, ui, `OVERTAKEN ${this.count}`, layout.right, top, "right");
        // HUD labels sit on the grass: keep them in the high-contrast text color.
        drawHudText(ctx, ui, "NITRO", layout.right - 56, top + 16, "right");
        ctx.fillStyle = ui.barFrame;
        ctx.fillRect(layout.right - 52, top + 17, 52, 10);
        ctx.fillStyle = ui.info;
        ctx.fillRect(layout.right - 51, top + 18, 50 * (this.nitro / 100), 8);
        drawReportProgressBar(ctx, progress, this.time, "ROAD TRIP", "#1f6fb2", ui, layout);
    }
}
