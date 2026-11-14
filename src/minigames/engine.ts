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

import type { ReportProgress } from "../services/report/ReportProgress";
import { formatRecordProgress, getOverallFraction, getPhaseLabel, isReportRunning } from "../services/report/ReportProgress";

/**
 * Reference size of the playfield (and the size of a game until it is resized). The real world keeps about the same
 * area but takes the shape of the canvas, so the games fill any aspect ratio without stretching or black bars.
 */
export const GAME_WIDTH = 640;
export const GAME_HEIGHT = 360;
/** Smallest world: below this the world is zoomed out instead of shrunk, so there's always room to play. */
export const MIN_WORLD_WIDTH = 340;
export const MIN_WORLD_HEIGHT = 300;

export interface WorldSize {
    width: number;
    height: number;
    /** Canvas (CSS) pixels per world unit. */
    scale: number;
}

/** The world for a canvas of the given size: same shape as the canvas, about the area of the reference size. */
export const getWorldSize = (canvasWidth: number, canvasHeight: number): WorldSize => {
    const width = Math.max(1, canvasWidth);
    const height = Math.max(1, canvasHeight);
    const scale = Math.min(Math.sqrt((width * height) / (GAME_WIDTH * GAME_HEIGHT)), width / MIN_WORLD_WIDTH, height / MIN_WORLD_HEIGHT);
    return { width: Math.round(width / scale), height: Math.round(height / scale), scale };
};

/** Where the report progress bar and the HUD texts go for a world width. */
export interface HudLayout {
    barX: number;
    barY: number;
    barWidth: number;
    /** Y of the first HUD text row (below the bar when the bar needs the whole width). */
    top: number;
    /** X where the right-aligned HUD texts end. */
    right: number;
}

/**
 * @param insetRight Room to keep free in the top-right corner (for a control drawn over the game, such as "exit full screen").
 */
export const getHudLayout = (width: number, insetRight = 0): HudLayout => {
    const right = width - 10 - insetRight;
    // The HUD texts take about 140 units on each side of the (centered) bar.
    const space = width - 300 - 2 * insetRight;
    if (space >= 260) {
        const barWidth = Math.min(480, space);
        return { barX: (width - barWidth) / 2, barY: 8, barWidth, top: 8, right };
    }
    return { barX: 10, barY: 8, barWidth: right - 10, top: 30, right };
};

export interface GameInput {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    fire: boolean;
    /** Pointer position in game coordinates while the pointer is over the playfield. */
    pointerX: number | null;
    pointerY: number | null;
    pointerDown: boolean;
}

export type GameTheme = "light" | "dark";

/** Colors shared by the HUD, banners and floating texts of every game. */
export interface UiPalette {
    text: string;
    textShadow: string;
    /** Background of the banners. */
    panel: string;
    panelText: string;
    barFrame: string;
    barTrack: string;
    barFailed: string;
    success: string;
    danger: string;
    warning: string;
    highlight: string;
    info: string;
}

export type UiColor = keyof Pick<UiPalette, "text" | "success" | "danger" | "warning" | "highlight" | "info">;

export const UI_PALETTES: Record<GameTheme, UiPalette> = {
    dark: {
        text: "#ffffff",
        textShadow: "#000000",
        panel: "rgba(0, 0, 0, 0.6)",
        panelText: "#e6e6e6",
        barFrame: "rgba(0, 0, 0, 0.6)",
        barTrack: "#1d2a22",
        barFailed: "#7a2a2a",
        success: "#3ccf85",
        danger: "#ff6b6b",
        warning: "#f0a050",
        highlight: "#ffd36b",
        info: "#8fd3ff",
    },
    light: {
        text: "#1b1b1b",
        textShadow: "rgba(255, 255, 255, 0.95)",
        panel: "rgba(255, 255, 255, 0.85)",
        panelText: "#424242",
        barFrame: "rgba(255, 255, 255, 0.8)",
        barTrack: "#d6e2db",
        barFailed: "#f1bbbc",
        success: "#0e7a3d",
        danger: "#c4314b",
        warning: "#a35200",
        highlight: "#7a5c00",
        info: "#0f6cbd",
    },
};

/** Parses `#rgb`, `#rrggbb`, `rgb()` and `rgba()` CSS colors. */
export const parseCssColor = (value: string): [number, number, number] | null => {
    const color = value.trim();
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
    if (hex) {
        const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1];
        return [0, 2, 4].map((offset) => parseInt(digits.substring(offset, offset + 2), 16)) as [number, number, number];
    }
    const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(color);
    return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
};

/**
 * Light or dark, from the background color of the Fluent theme applied to the element
 * (the `--colorNeutralBackground1` token set by the closest FluentProvider).
 */
export const detectTheme = (element: Element): GameTheme => {
    const background = parseCssColor(getComputedStyle(element).getPropertyValue("--colorNeutralBackground1"));
    if (!background) {
        return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    const [r, g, b] = background;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128 ? "dark" : "light";
};

export const createInput = (): GameInput => ({ left: false, right: false, up: false, down: false, fire: false, pointerX: null, pointerY: null, pointerDown: false });

export interface Game {
    /** Size of the world, in game units. */
    readonly width: number;
    readonly height: number;
    /**
     * Adapts the world (and the gameplay) to a new size.
     * @param hudInsetRight Room (in game units) to keep free in the top-right corner of the HUD.
     */
    resize(width: number, height: number, hudInsetRight?: number): void;
    readonly score: number;
    /** Game-specific counter (errors zapped, cars overtaken). */
    readonly count: number;
    readonly isOver: boolean;
    /**
     * Advances the game.
     * @param dt Elapsed time in seconds (already clamped).
     * @param progress The live report generation progress.
     */
    update(dt: number, input: GameInput, progress: ReportProgress | null): void;
    render(ctx: CanvasRenderingContext2D, progress: ReportProgress | null, theme: GameTheme): void;
}

/** A short floating text, such as "+50" or "Close call!". */
export interface FloatingText {
    x: number;
    y: number;
    text: string;
    color: UiColor;
    ttl: number;
    age: number;
}

export const updateFloatingTexts = (texts: FloatingText[], dt: number) => {
    for (const text of texts) {
        text.age += dt;
        text.y -= 30 * dt;
    }
    return texts.filter((text) => text.age < text.ttl);
};

export const drawFloatingTexts = (ctx: CanvasRenderingContext2D, texts: FloatingText[], palette: UiPalette) => {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "bold 13px ui-monospace, Consolas, monospace";
    ctx.shadowColor = palette.textShadow;
    ctx.shadowBlur = 3;
    for (const text of texts) {
        ctx.globalAlpha = Math.max(0, 1 - text.age / text.ttl);
        ctx.fillStyle = palette[text.color];
        ctx.fillText(text.text, text.x, text.y);
    }
    ctx.restore();
};

/** A big centered message that fades out, e.g. "BATCH #3 RECEIVED". */
export interface Banner {
    title: string;
    subtitle?: string;
    color: UiColor;
    ttl: number;
    age: number;
}

export const drawBanner = (ctx: CanvasRenderingContext2D, banner: Banner | null, palette: UiPalette, width: number, height: number) => {
    if (!banner) {
        return;
    }
    const fadeIn = Math.min(1, banner.age / 0.2);
    const fadeOut = Math.min(1, (banner.ttl - banner.age) / 0.5);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(fadeIn, fadeOut));
    ctx.fillStyle = palette.panel;
    ctx.fillRect(0, height / 2 - 34, width, banner.subtitle ? 68 : 48);
    ctx.textAlign = "center";
    ctx.fillStyle = palette[banner.color];
    // Narrow worlds: shrink the title to fit.
    ctx.font = `bold ${Math.min(24, Math.floor((width - 20) / (banner.title.length * 0.62)))}px ui-monospace, Consolas, monospace`;
    ctx.fillText(banner.title, width / 2, height / 2 - 2);
    if (banner.subtitle) {
        ctx.fillStyle = palette.panelText;
        ctx.font = `${Math.min(13, Math.floor((width - 20) / (banner.subtitle.length * 0.62)))}px ui-monospace, Consolas, monospace`;
        ctx.fillText(banner.subtitle, width / 2, height / 2 + 22);
    }
    ctx.restore();
};

/**
 * Watches the report progress and reports the events games react to:
 * a new page (batch) of records, the report completing, or stopping without a report.
 */
export class ReportWatcher {
    private pages = 0;
    private finished = false;
    private lastDecile = 0;

    /** Starts from the current state so events that happened before the game started are ignored. */
    constructor(progress: ReportProgress | null) {
        this.pages = progress?.pagesRetrieved ?? 0;
        this.finished = progress !== null && !isReportRunning(progress);
        const fraction = progress ? getOverallFraction(progress) : null;
        this.lastDecile = fraction === null ? 0 : Math.floor(fraction * 10);
    }

    poll(progress: ReportProgress | null) {
        const events: { newPages: number; completed: boolean; stopped: boolean; decile: number | null } = { newPages: 0, completed: false, stopped: false, decile: null };
        if (!progress) {
            return events;
        }
        if (progress.pagesRetrieved < this.pages || (this.finished && isReportRunning(progress))) {
            // A new report started.
            this.pages = 0;
            this.finished = false;
            this.lastDecile = 0;
        }
        if (progress.pagesRetrieved > this.pages) {
            events.newPages = progress.pagesRetrieved - this.pages;
            this.pages = progress.pagesRetrieved;
        }
        const fraction = getOverallFraction(progress);
        if (fraction !== null) {
            const decile = Math.min(10, Math.floor(fraction * 10));
            if (decile > this.lastDecile && decile < 10) {
                events.decile = decile;
            }
            this.lastDecile = Math.max(this.lastDecile, decile);
        }
        if (!this.finished && !isReportRunning(progress)) {
            this.finished = true;
            events.completed = progress.phase === "completed";
            events.stopped = progress.phase !== "completed";
        }
        return events;
    }
}

/**
 * Draws the report progress strip at the top of the playfield.
 * When the total is unknown the bar shows moving stripes instead of a fill.
 */
let reducedMotion: MediaQueryList | null | undefined;

/** True when the viewer asked the OS for reduced motion: the status emphasis then stays still. */
export const prefersReducedMotion = () => {
    if (reducedMotion === undefined) {
        reducedMotion = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    }
    return reducedMotion?.matches ?? false;
};

/** How the report status is emphasized on the progress bar. */
export type ReportEmphasis = "none" | "idle" | "ready" | "stopped";

export const getReportEmphasis = (progress: ReportProgress | null): ReportEmphasis => {
    if (!progress) {
        return "idle";
    }
    if (progress.phase === "completed") {
        return "ready";
    }
    return progress.phase === "failed" || progress.phase === "cancelled" ? "stopped" : "none";
};

/**
 * Draws the report progress strip at the top of the playfield.
 * When the total is unknown the bar shows moving stripes instead of a fill.
 * "Report ready", "no report running" and "cancelled / failed" are animated so they stand out.
 */
export const drawReportProgressBar = (ctx: CanvasRenderingContext2D, progress: ReportProgress | null, time: number, label: string, accent: string, palette: UiPalette, layout: HudLayout) => {
    const x = layout.barX;
    const y = layout.barY;
    const width = layout.barWidth;
    const height = 14;
    const emphasis = getReportEmphasis(progress);
    const still = prefersReducedMotion();
    /** 0 - 1, drives the glow and the label size of the emphasized states. */
    const pulse = still ? 1 : 0.5 + 0.5 * Math.sin(time * 4);

    ctx.save();
    if (emphasis !== "none") {
        // Glowing outline around the bar.
        ctx.save();
        ctx.strokeStyle = emphasis === "stopped" ? palette.danger : accent;
        ctx.lineWidth = 2;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 4 + 10 * pulse;
        ctx.globalAlpha = 0.45 + 0.55 * pulse;
        ctx.strokeRect(x - 3, y - 3, width + 6, height + 6);
        ctx.restore();
    }
    ctx.fillStyle = palette.barFrame;
    ctx.fillRect(x - 2, y - 2, width + 4, height + 4);
    ctx.fillStyle = palette.barTrack;
    ctx.fillRect(x, y, width, height);

    const fraction = progress ? getOverallFraction(progress) : null;
    /** Width of the solid fill: the label is drawn in light text over it and in the theme's text color elsewhere. */
    let filled = 0;
    let text: string;
    if (emphasis === "idle") {
        text = `${label}: NO REPORT RUNNING`;
    } else if (emphasis === "ready") {
        text = `${label}: REPORT READY ✓`;
    } else if (emphasis === "stopped") {
        text = `${label}: ${getPhaseLabel(progress!.phase).toUpperCase()}`;
    } else if (progress!.phase === "records") {
        text = `${label}: ${formatRecordProgress(progress!)}`;
    } else {
        text = `${label}: ${getPhaseLabel(progress!.phase)}`;
    }

    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    if (fraction !== null) {
        filled = width * fraction;
        ctx.fillStyle = accent;
        ctx.fillRect(x, y, filled, height);
        text += ` · ${Math.floor(fraction * 100)}%`;
    } else if (progress && isReportRunning(progress)) {
        // Indeterminate: animated diagonal stripes.
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.45;
        const offset = (time * 40) % 20;
        for (let stripe = -20; stripe < width + 20; stripe += 20) {
            ctx.beginPath();
            ctx.moveTo(x + stripe + offset, y + height);
            ctx.lineTo(x + stripe + offset + 10, y + height);
            ctx.lineTo(x + stripe + offset + 20, y);
            ctx.lineTo(x + stripe + offset + 10, y);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    } else if (emphasis === "stopped") {
        ctx.fillStyle = palette.barFailed;
        ctx.globalAlpha = 0.6 + 0.4 * pulse;
        ctx.fillRect(x, y, width, height);
        ctx.globalAlpha = 1;
    }
    if (!still && (emphasis === "ready" || emphasis === "idle")) {
        // A light band sweeping across the bar: a shine on the finished report, a "scanner" while idle.
        const period = emphasis === "ready" ? 1.6 : 2.4;
        const bandX = x - 60 + ((time % period) / period) * (width + 120);
        const band = ctx.createLinearGradient(bandX - 40, 0, bandX + 40, 0);
        const color = emphasis === "ready" ? "255, 255, 255" : "143, 211, 255";
        band.addColorStop(0, `rgba(${color}, 0)`);
        band.addColorStop(0.5, `rgba(${color}, ${emphasis === "ready" ? 0.55 : 0.35})`);
        band.addColorStop(1, `rgba(${color}, 0)`);
        ctx.fillStyle = band;
        ctx.fillRect(bandX - 40, y, 80, height);
    }
    ctx.restore();

    // The emphasized labels gently grow and shrink.
    const scale = emphasis === "none" ? 1 : 1 + 0.08 * pulse;
    const drawLabel = (from: number, to: number, color: string, halo: string) => {
        if (to <= from) {
            return;
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(from, y - 6, to - from, height + 12);
        ctx.clip();
        ctx.translate(x + width / 2, y + height / 2 + 1);
        ctx.scale(scale, scale);
        ctx.font = "bold 10px ui-monospace, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = color;
        ctx.shadowColor = halo;
        ctx.shadowBlur = 3;
        ctx.fillText(text, 0, 0);
        ctx.restore();
    };
    drawLabel(0, x + filled, "#ffffff", "#000000");
    drawLabel(x + filled, x + width + 60, emphasis === "stopped" ? palette.danger : palette.text, palette.textShadow);
};

export const drawHudText = (ctx: CanvasRenderingContext2D, palette: UiPalette, text: string, x: number, y: number, align: CanvasTextAlign = "left", color: UiColor = "text") => {
    ctx.save();
    ctx.font = "bold 12px ui-monospace, Consolas, monospace";
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.fillStyle = palette[color];
    ctx.shadowColor = palette.textShadow;
    ctx.shadowBlur = 3;
    ctx.fillText(text, x, y);
    ctx.restore();
};

export const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
};

export const randomBetween = (min: number, max: number, random: () => number = Math.random) => min + random() * (max - min);

export const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
    Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
