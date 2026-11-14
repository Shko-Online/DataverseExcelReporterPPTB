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
import { AlienShooterGame } from "./alienShooter/AlienShooterGame";
import type { Game } from "./engine";
import type { MinigameId } from "./minigameStats";
import { MotoRacerGame } from "./motoRacer/MotoRacerGame";

/*
 * Playing small games while a long operation runs is inspired by Docentric's game corner for D365FO:
 * https://ax.docentric.com/work-hard-play-hard-the-docentric-game-corner-in-d365fo/
 */

export interface GameControl {
    keys: string;
    action: string;
}

/** Controls every game shares (listed after the game's own). */
export const COMMON_CONTROLS: GameControl[] = [
    { keys: "P", action: "pause" },
    { keys: "F", action: "full screen" },
    { keys: "Esc", action: "leave full screen, or pause" },
    { keys: "T", action: "show / hide controls" },
];

/** "keys action · keys action": the controls as one line. */
export const formatControls = (controls: GameControl[]) => controls.map((control) => `${control.keys} ${control.action}`).join(" · ");

export interface MinigameDefinition {
    id: MinigameId;
    name: string;
    tagline: string;
    /** How the game shows the report generation progress. */
    reportTieIn: string;
    controls: GameControl[];
    /** Label of the game-specific lifetime counter. */
    countLabel: string;
    create: (progress: ReportProgress | null) => Game;
}

export const MINIGAMES: MinigameDefinition[] = [
    {
        id: "alienShooter",
        name: "Attack of the #N/As",
        tagline: "Formula errors are invading your spreadsheet. Zap every #REF! before it reaches row 1,048,576.",
        reportTieIn: "Every batch of records drops a power-up crate, and the uplink bar tracks your report.",
        controls: [
            { keys: "← → / A D", action: "move" },
            { keys: "Space", action: "fire" },
            { keys: "Mouse", action: "move, hold to fire" },
        ],
        countLabel: "Errors zapped",
        create: (progress) => new AlienShooterGame(progress),
    },
    {
        id: "motoRacer",
        name: "Row-d Rage",
        tagline: "Weave through rush-hour traffic on Pagination Highway. Close calls pay extra.",
        reportTieIn: "Every batch of records is a checkpoint that refills your nitro; the finish line shows up when the report is ready.",
        controls: [
            { keys: "← → / A D", action: "steer" },
            { keys: "↑ / W", action: "speed up" },
            { keys: "↓ / S", action: "brake" },
            { keys: "Space", action: "nitro" },
            { keys: "Mouse", action: "steer, hold to speed up" },
        ],
        countLabel: "Cars overtaken",
        create: (progress) => new MotoRacerGame(progress),
    },
];
