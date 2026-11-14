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

export type MinigameId = "alienShooter" | "motoRacer";

export const MINIGAME_IDS: MinigameId[] = ["alienShooter", "motoRacer"];

/** Statistics of one minigame, kept on this machine only. */
export interface MinigameStats {
    gamesPlayed: number;
    /** Time spent actually playing (pauses excluded), in milliseconds. */
    timePlayedMs: number;
    highScore: number;
    /** Lifetime game-specific counter: errors zapped / cars overtaken. */
    lifetimeCount: number;
    /** ISO date of the last finished game. */
    lastPlayedOn: string | null;
}

export type MinigameStatsById = Record<MinigameId, MinigameStats>;

/** A single game, as reported when it ends (or is quit). */
export interface MinigameSession {
    score: number;
    durationMs: number;
    count: number;
}

/** Key under which the stats are stored in the tool settings and in localStorage. */
export const MINIGAME_STATS_KEY = "minigameStats";

export const createEmptyStats = (): MinigameStats => ({ gamesPlayed: 0, timePlayedMs: 0, highScore: 0, lifetimeCount: 0, lastPlayedOn: null });

const toCount = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

/** Reads stored stats defensively: anything missing or malformed falls back to zero. */
export const normalizeStats = (stored: unknown): MinigameStatsById => {
    const source = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
    const result = {} as MinigameStatsById;
    for (const id of MINIGAME_IDS) {
        const game = source[id] && typeof source[id] === "object" ? (source[id] as Record<string, unknown>) : {};
        result[id] = {
            gamesPlayed: toCount(game.gamesPlayed),
            timePlayedMs: toCount(game.timePlayedMs),
            highScore: toCount(game.highScore),
            lifetimeCount: toCount(game.lifetimeCount),
            lastPlayedOn: typeof game.lastPlayedOn === "string" ? game.lastPlayedOn : null,
        };
    }
    return result;
};

/** Adds a finished session to the stats of a game. */
export const addSession = (stats: MinigameStatsById, id: MinigameId, session: MinigameSession, now = new Date()): MinigameStatsById => {
    const current = stats[id];
    return {
        ...stats,
        [id]: {
            gamesPlayed: current.gamesPlayed + 1,
            timePlayedMs: current.timePlayedMs + Math.max(0, Math.round(session.durationMs)),
            highScore: Math.max(current.highScore, Math.floor(session.score)),
            lifetimeCount: current.lifetimeCount + Math.max(0, Math.floor(session.count)),
            lastPlayedOn: now.toISOString(),
        },
    };
};

/** "42s", "3m 05s", "1h 02m". */
export const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
    }
    return `${seconds}s`;
};

/** Minimal subset of the ToolBox settings API used to store the stats. */
export type SettingsStore = Pick<ToolBoxAPI.SettingsAPI, "get" | "set">;

const readLocalStorage = (): unknown => {
    try {
        const raw = window.localStorage.getItem(MINIGAME_STATS_KEY);
        return raw ? JSON.parse(raw) : undefined;
    } catch {
        return undefined;
    }
};

const writeLocalStorage = (stats: MinigameStatsById) => {
    try {
        window.localStorage.setItem(MINIGAME_STATS_KEY, JSON.stringify(stats));
    } catch {
        // Storage can be unavailable (private mode, quota): stats then only last for this session.
    }
};

/** Loads the stats from the tool settings, falling back to localStorage. */
export const loadStats = async (settings: SettingsStore | undefined): Promise<MinigameStatsById> => {
    let stored: unknown;
    try {
        stored = await settings?.get(MINIGAME_STATS_KEY);
    } catch (error) {
        console.warn("Could not read the minigame stats from the tool settings.", error);
    }
    return normalizeStats(stored && typeof stored === "object" ? stored : readLocalStorage());
};

/** Saves the stats to the tool settings and to localStorage. */
export const saveStats = async (settings: SettingsStore | undefined, stats: MinigameStatsById) => {
    writeLocalStorage(stats);
    try {
        await settings?.set(MINIGAME_STATS_KEY, stats);
    } catch (error) {
        console.warn("Could not save the minigame stats to the tool settings.", error);
    }
};
