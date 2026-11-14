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

import { Fragment, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { FC } from "react";
import { Body1, Button, Caption1, Card, Subtitle2, Title3 } from "@fluentui/react-components";
import { ArrowCounterclockwise20Regular, ArrowLeft20Regular, Dismiss20Regular, FullScreenMaximize20Regular, FullScreenMinimize20Regular, Games20Regular, Pause20Regular, Play20Regular, Rocket20Regular, Timer16Regular, Trophy16Regular, VehicleMotorcycle20Regular } from "@fluentui/react-icons";
import { ApplicationDataContext } from "../context/ApplicationDataContext";
import { COMMON_CONTROLS, MINIGAMES, formatControls } from "./catalog";
import type { MinigameDefinition } from "./catalog";
import { getPhaseLabel, isReportRunning } from "../services/report/ReportProgress";
import type { Game } from "./engine";
import { GameCanvas } from "./GameCanvas";
import { formatDuration } from "./minigameStats";
import type { MinigameId, MinigameSession, MinigameStats } from "./minigameStats";
import useMinigamesStyles from "./Minigames.styles";
import { useMinigameStats } from "./useMinigameStats";

const GAME_ICONS: Record<MinigameId, JSX.Element> = {
    alienShooter: <Rocket20Regular />,
    motoRacer: <VehicleMotorcycle20Regular />,
};

/** Games shorter than this (quit right after starting) are not counted as played. */
const MIN_COUNTED_SECONDS = 3;

const StatsList: FC<{ stats: MinigameStats; countLabel: string }> = ({ stats, countLabel }) => {
    const styles = useMinigamesStyles();
    return (
        <dl className={styles.stats}>
            <div className={styles.stat}>
                <dt className={styles.statLabel}>
                    <Trophy16Regular /> High score
                </dt>
                <dd className={styles.statValue}>{stats.highScore.toLocaleString()}</dd>
            </div>
            <div className={styles.stat}>
                <dt className={styles.statLabel}>
                    <Timer16Regular /> Time played
                </dt>
                <dd className={styles.statValue}>{formatDuration(stats.timePlayedMs)}</dd>
            </div>
            <div className={styles.stat}>
                <dt className={styles.statLabel}>Games played</dt>
                <dd className={styles.statValue}>{stats.gamesPlayed.toLocaleString()}</dd>
            </div>
            <div className={styles.stat}>
                <dt className={styles.statLabel}>{countLabel}</dt>
                <dd className={styles.statValue}>{stats.lifetimeCount.toLocaleString()}</dd>
            </div>
        </dl>
    );
};

interface PlayerProps {
    definition: MinigameDefinition;
    stats: MinigameStats;
    onSessionEnd: (session: MinigameSession) => void;
    onBack: () => void;
}

const MinigamePlayer: FC<PlayerProps> = ({ definition, stats, onSessionEnd, onBack }) => {
    const styles = useMinigamesStyles();
    const { reportProgress } = useContext(ApplicationDataContext);
    const [game, setGame] = useState<Game>(() => definition.create(reportProgress));
    const [paused, setPaused] = useState(false);
    const [result, setResult] = useState<{ session: MinigameSession; previousHighScore: number } | null>(null);
    const playedSeconds = useRef(0);
    const recorded = useRef(false);
    // Latest values for the unmount cleanup.
    const latest = useRef({ game, onSessionEnd });
    latest.current = { game, onSessionEnd };

    const endSession = useCallback((finishedGame: Game) => {
        if (recorded.current) {
            return null;
        }
        recorded.current = true;
        const session = { score: finishedGame.score, count: finishedGame.count, durationMs: playedSeconds.current * 1000 };
        if (finishedGame.isOver || playedSeconds.current >= MIN_COUNTED_SECONDS) {
            latest.current.onSessionEnd(session);
        }
        return session;
    }, []);

    /**
     * Full screen only expands the playfield over the tool's own area. The browser full screen API is not used:
     * from the ToolBox iframe it puts the whole ToolBox window in full screen.
     */
    const [fullScreen, setFullScreen] = useState(false);
    const toggleFullScreen = useCallback(() => setFullScreen((value) => !value), []);
    const [showControls, setShowControls] = useState(false);
    const toggleControls = useCallback(() => setShowControls((value) => !value), []);
    const controls = [...definition.controls, ...COMMON_CONTROLS];

    // Quitting (Back, closing the panel) mid-game still counts the time played and the score.
    useEffect(() => () => void endSession(latest.current.game), [endSession]);

    const restart = () => {
        endSession(game);
        playedSeconds.current = 0;
        recorded.current = false;
        setResult(null);
        setPaused(false);
        setGame(definition.create(reportProgress));
    };

    const onGameOver = () => {
        const previousHighScore = stats.highScore;
        const session = endSession(game);
        if (session) {
            setResult({ session, previousHighScore });
        }
    };

    return (
        <div className={styles.player}>
            <div className={styles.playerToolbar}>
                <Button appearance="subtle" icon={<ArrowLeft20Regular />} onClick={onBack}>
                    All games
                </Button>
                <Subtitle2 className={styles.playerTitle}>
                    {GAME_ICONS[definition.id]} {definition.name}
                </Subtitle2>
                <Caption1>
                    High score {Math.max(stats.highScore, result?.session.score ?? 0).toLocaleString()} · Played {formatDuration(stats.timePlayedMs)}
                </Caption1>
                {!result && (
                    <Button
                        icon={paused ? <Play20Regular /> : <Pause20Regular />}
                        // Keep the focus on the playfield so clicking doesn't pause through the blur first.
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => setPaused(!paused)}
                    >
                        {paused ? "Resume" : "Pause"}
                    </Button>
                )}
                <Button icon={<ArrowCounterclockwise20Regular />} onMouseDown={(event) => event.preventDefault()} onClick={restart}>
                    Restart
                </Button>
                <Button
                    icon={fullScreen ? <FullScreenMinimize20Regular /> : <FullScreenMaximize20Regular />}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={toggleFullScreen}
                >
                    {fullScreen ? "Exit full screen" : "Full screen"}
                </Button>
            </div>
            <GameCanvas
                game={game}
                progress={reportProgress}
                paused={paused || result !== null}
                onBlur={() => setPaused(true)}
                onTogglePause={() => setPaused((value) => !value)}
                fullScreen={fullScreen}
                onToggleFullScreen={toggleFullScreen}
                onToggleControls={toggleControls}
                onGameOver={onGameOver}
                onPlayed={(seconds) => (playedSeconds.current += seconds)}
            >
                {showControls && (
                    <dl className={styles.controlsPanel} aria-label="Controls">
                        {controls.map((control) => (
                            <Fragment key={control.keys}>
                                <dt className={styles.controlKeys}>{control.keys}</dt>
                                <dd className={styles.controlAction}>{control.action}</dd>
                            </Fragment>
                        ))}
                    </dl>
                )}
                <Button
                    className={styles.controlsToggle}
                    size="small"
                    appearance="secondary"
                    aria-pressed={showControls}
                    title={showControls ? "Hide the controls (T)" : "Show the controls (T)"}
                    // Keep the focus (and the keyboard) on the game.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={toggleControls}
                >
                    T · {showControls ? "Hide controls" : "Controls"}
                </Button>
                {fullScreen && (
                    <Button
                        className={styles.exitFullScreen}
                        size="small"
                        icon={<FullScreenMinimize20Regular />}
                        aria-label="Exit full screen"
                        title="Exit full screen (Esc)"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={toggleFullScreen}
                    />
                )}
                {paused && !result && (
                    <div className={styles.overlay}>
                        <Title3 className={styles.overlayTitle}>Paused</Title3>
                        <Body1>
                            {isReportRunning(reportProgress)
                                ? "Your report keeps generating in the background."
                                : reportProgress
                                  ? `${getPhaseLabel(reportProgress.phase)}.`
                                  : "No report is being generated right now."}
                        </Body1>
                        <Button appearance="primary" icon={<Play20Regular />} onClick={() => setPaused(false)}>
                            Resume
                        </Button>
                    </div>
                )}
                {result && (
                    <div className={styles.overlay}>
                        <Title3 className={styles.overlayTitle}>Game over</Title3>
                        <Body1>
                            Score {result.session.score.toLocaleString()} · {definition.countLabel} {result.session.count.toLocaleString()} · {formatDuration(result.session.durationMs)}
                        </Body1>
                        {result.session.score > result.previousHighScore && result.session.score > 0 && <Body1 className={styles.newHighScore}>🏆 New high score!</Body1>}
                        <div className={styles.overlayActions}>
                            <Button appearance="primary" icon={<ArrowCounterclockwise20Regular />} onClick={restart}>
                                Play again
                            </Button>
                            <Button icon={<ArrowLeft20Regular />} onClick={onBack}>
                                All games
                            </Button>
                        </div>
                    </div>
                )}
            </GameCanvas>
            <Caption1 className={styles.controls}>{formatControls(controls)}</Caption1>
        </div>
    );
};

export interface MinigamesProps {
    onClose: () => void;
}

/** Optional minigames to play while a report is generated. Their stats are stored on this computer only. */
export const Minigames: FC<MinigamesProps> = ({ onClose }) => {
    const styles = useMinigamesStyles();
    const { stats, recordSession } = useMinigameStats();
    const [selected, setSelected] = useState<MinigameDefinition | null>(null);

    return (
        <Card className={styles.card}>
            <div className={styles.header}>
                <Games20Regular />
                <div className={styles.headerText}>
                    <Subtitle2>Minigames</Subtitle2>
                    <Caption1 className={styles.caption}>Play while your report is generated. The games follow the real progress; stats stay on this computer.</Caption1>
                </div>
                {/* Native title instead of a Fluent tooltip: portaled popups misbehave in the ToolBox iframe. */}
                <Button appearance="subtle" icon={<Dismiss20Regular />} aria-label="Close the minigames" title="Close the minigames" onClick={onClose} />
            </div>
            {selected ? (
                <MinigamePlayer key={selected.id} definition={selected} stats={stats[selected.id]} onSessionEnd={(session) => void recordSession(selected.id, session)} onBack={() => setSelected(null)} />
            ) : (
                <div className={styles.games}>
                    {MINIGAMES.map((definition) => (
                        <section key={definition.id} className={styles.game} aria-label={definition.name}>
                            <Subtitle2 className={styles.gameTitle}>
                                {GAME_ICONS[definition.id]} {definition.name}
                            </Subtitle2>
                            <Body1>{definition.tagline}</Body1>
                            <Caption1 className={styles.tieIn}>{definition.reportTieIn}</Caption1>
                            <StatsList stats={stats[definition.id]} countLabel={definition.countLabel} />
                            <Button className={styles.playButton} appearance="primary" icon={<Play20Regular />} onClick={() => setSelected(definition)}>
                                Play
                            </Button>
                        </section>
                    ))}
                </div>
            )}
        </Card>
    );
};
