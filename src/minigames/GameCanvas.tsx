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

import { useEffect, useRef } from "react";
import { mergeClasses } from "@fluentui/react-components";
import type { FC, KeyboardEvent, PointerEvent, ReactNode } from "react";
import type { ReportProgress } from "../services/report/ReportProgress";
import { createInput, detectTheme, getWorldSize } from "./engine";
import type { Game, GameInput } from "./engine";
import useMinigamesStyles from "./Minigames.styles";

export interface GameCanvasProps {
    game: Game;
    progress: ReportProgress | null;
    paused: boolean;
    /** Called when focus leaves the playfield, so the game can pause. */
    onBlur: () => void;
    onTogglePause: () => void;
    /** True while the game fills the screen (or the tool window). */
    fullScreen: boolean;
    onToggleFullScreen: () => void;
    /** Shows or hides the controls over the game (T key). */
    onToggleControls?: () => void;
    /** Called once when the game ends. */
    onGameOver: () => void;
    /** Accumulates the time actually played (seconds). */
    onPlayed: (seconds: number) => void;
    /** Rendered on top of the playfield (pause / game over screens). */
    children?: ReactNode;
}

/** CSS pixels taken by the "exit full screen" button in the top-right corner (button + margin). */
const EXIT_BUTTON_ROOM = 44;

const KEY_BINDINGS: Record<string, keyof Pick<GameInput, "left" | "right" | "up" | "down" | "fire">> = {
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
    ArrowUp: "up",
    KeyW: "up",
    ArrowDown: "down",
    KeyS: "down",
    Space: "fire",
    ShiftLeft: "fire",
    ShiftRight: "fire",
};

/** Hosts a {@link Game}: runs its loop, scales it to the available width and forwards keyboard and pointer input. */
export const GameCanvas: FC<GameCanvasProps> = ({ game, progress, paused, onBlur, onTogglePause, fullScreen, onToggleFullScreen, onToggleControls, onGameOver, onPlayed, children }) => {
    const styles = useMinigamesStyles();
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const input = useRef<GameInput>(createInput());
    // The loop reads the latest props through this ref so it doesn't restart on every progress update.
    const latest = useRef({ progress, paused, fullScreen, onGameOver, onPlayed });
    latest.current = { progress, paused, fullScreen, onGameOver, onPlayed };

    useEffect(() => {
        containerRef.current?.focus();
        input.current = createInput();
    }, [game]);

    useEffect(() => {
        if (paused) {
            input.current = createInput();
        } else {
            containerRef.current?.focus();
        }
    }, [paused, fullScreen]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) {
            return;
        }
        let frame = 0;
        let last = performance.now();
        let ended = game.isOver;
        // Follow the Fluent theme applied around the playfield, including live theme switches.
        let theme = detectTheme(canvas);
        let themeCheck = 0;

        const resize = () => {
            const ratio = window.devicePixelRatio || 1;
            const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
            const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }
            // The world takes the shape of the canvas: no stretching, no black bars.
            const world = getWorldSize(canvas.clientWidth, canvas.clientHeight);
            // In full screen the "exit" button sits in the top-right corner: keep the HUD clear of it.
            game.resize(world.width, world.height, latest.current.fullScreen ? EXIT_BUTTON_ROOM / world.scale : 0);
        };
        const observer = new ResizeObserver(resize);
        observer.observe(canvas);
        resize();

        const tick = (now: number) => {
            // Clamp the step so a background tab or a breakpoint doesn't teleport everything.
            const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
            last = now;
            const { progress, paused, onGameOver, onPlayed } = latest.current;
            if (!paused && !ended) {
                game.update(dt, input.current, progress);
                onPlayed(dt);
                if (game.isOver) {
                    ended = true;
                    onGameOver();
                }
            }
            themeCheck += dt;
            if (themeCheck >= 0.5) {
                themeCheck = 0;
                theme = detectTheme(canvas);
            }
            ctx.setTransform(canvas.width / game.width, 0, 0, canvas.height / game.height, 0, 0);
            game.render(ctx, progress, theme);
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);

        const onVisibilityChange = () => document.hidden && onBlur();
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game]);

    const onKey = (pressed: boolean) => (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.target !== containerRef.current) {
            // Let the overlay buttons handle their own keys.
            return;
        }
        if (pressed && event.code === "KeyF") {
            event.preventDefault();
            onToggleFullScreen();
            return;
        }
        if (pressed && event.code === "KeyT" && !event.repeat) {
            event.preventDefault();
            onToggleControls?.();
            return;
        }
        if (pressed && (event.code === "KeyP" || event.code === "Escape")) {
            event.preventDefault();
            // Escape leaves the full screen first, like everywhere else.
            if (event.code === "Escape" && fullScreen) {
                onToggleFullScreen();
            } else {
                onTogglePause();
            }
            return;
        }
        const binding = KEY_BINDINGS[event.code];
        if (binding) {
            event.preventDefault();
            input.current[binding] = pressed;
        }
    };

    const updatePointer = (event: PointerEvent<HTMLCanvasElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        input.current.pointerX = ((event.clientX - rect.left) / rect.width) * game.width;
        input.current.pointerY = ((event.clientY - rect.top) / rect.height) * game.height;
    };

    return (
        <div
            ref={containerRef}
            className={mergeClasses(styles.playfield, fullScreen && styles.playfieldFullScreen)}
            tabIndex={0}
            role="application"
            aria-label="Minigame playfield. Use the arrow keys and space to play, P to pause."
            onKeyDown={onKey(true)}
            onKeyUp={onKey(false)}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    input.current = createInput();
                    onBlur();
                }
            }}
        >
            <canvas
                ref={canvasRef}
                className={styles.canvas}
                onPointerMove={updatePointer}
                onPointerDown={(event) => {
                    updatePointer(event);
                    event.currentTarget.setPointerCapture(event.pointerId);
                    input.current.pointerDown = true;
                }}
                onPointerUp={(event) => {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    input.current.pointerDown = false;
                }}
                onPointerLeave={() => {
                    input.current.pointerX = null;
                    input.current.pointerY = null;
                    input.current.pointerDown = false;
                }}
            />
            {children}
        </div>
    );
};
