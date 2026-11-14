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

import { makeStyles, tokens } from "@fluentui/react-components";

const useMinigamesStyles = makeStyles({
    card: {
        flexShrink: 0,
    },
    header: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        flexWrap: "wrap",
    },
    headerText: {
        display: "flex",
        flexDirection: "column",
        flex: "1 1 240px",
        minWidth: "0",
    },
    caption: {
        color: tokens.colorNeutralForeground3,
    },
    games: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: tokens.spacingHorizontalM,
    },
    game: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
        padding: tokens.spacingVerticalM,
        borderRadius: tokens.borderRadiusLarge,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        backgroundColor: tokens.colorNeutralBackground2,
    },
    gameTitle: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
    },
    tieIn: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
    },
    stats: {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
        margin: 0,
    },
    stat: {
        display: "flex",
        flexDirection: "column",
        minWidth: "0",
    },
    statLabel: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalXXS,
    },
    statValue: {
        fontWeight: tokens.fontWeightSemibold,
        fontVariantNumeric: "tabular-nums",
        margin: 0,
    },
    playButton: {
        alignSelf: "flex-start",
    },
    player: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
        alignItems: "center",
    },
    playerToolbar: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        flexWrap: "wrap",
        width: "100%",
    },
    playerTitle: {
        flex: "1 1 auto",
        minWidth: "0",
    },
    playfield: {
        position: "relative",
        width: "100%",
        // Any shape works (the games adapt to it): use the width available and a height that fits the window.
        height: "clamp(260px, calc(100vh - 330px), 720px)",
        borderRadius: tokens.borderRadiusMedium,
        overflow: "hidden",
        outline: "none",
        boxShadow: tokens.shadow8,
        ":focus-visible": {
            outline: `2px solid ${tokens.colorStrokeFocus2}`,
            outlineOffset: "2px",
        },
    },
    /** Full screen: the playfield covers the tool's area (not the ToolBox window); the game takes its shape. */
    playfieldFullScreen: {
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        width: "auto",
        height: "auto",
        borderRadius: 0,
        boxShadow: "none",
        ":focus-visible": {
            outline: "none",
        },
    },
    canvas: {
        display: "block",
        width: "100%",
        height: "100%",
        touchAction: "none",
        cursor: "crosshair",
    },
    exitFullScreen: {
        position: "absolute",
        top: tokens.spacingVerticalS,
        right: tokens.spacingHorizontalS,
        // Above the pause / game over screens, so the full screen can always be left.
        zIndex: 1,
        opacity: 0.75,
        ":hover": {
            opacity: 1,
        },
    },
    /** Controls shown over the game (T): bottom-left, translucent, clicks go through to the game. */
    controlsPanel: {
        position: "absolute",
        left: tokens.spacingHorizontalS,
        bottom: "40px",
        maxWidth: "calc(100% - 16px)",
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        columnGap: tokens.spacingHorizontalM,
        rowGap: "2px",
        padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
        borderRadius: tokens.borderRadiusMedium,
        backgroundColor: tokens.colorNeutralBackgroundAlpha2,
        color: tokens.colorNeutralForeground1,
        boxShadow: tokens.shadow8,
        fontSize: tokens.fontSizeBase200,
        lineHeight: tokens.lineHeightBase200,
        pointerEvents: "none",
        margin: 0,
    },
    controlKeys: {
        fontFamily: tokens.fontFamilyMonospace,
        fontWeight: tokens.fontWeightSemibold,
        whiteSpace: "nowrap",
        margin: 0,
    },
    controlAction: {
        margin: 0,
    },
    controlsToggle: {
        position: "absolute",
        left: tokens.spacingHorizontalS,
        bottom: tokens.spacingVerticalS,
        opacity: 0.8,
        ":hover": {
            opacity: 1,
        },
    },
    overlay: {
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacingVerticalM,
        backgroundColor: tokens.colorNeutralBackgroundAlpha2,
        color: tokens.colorNeutralForeground1,
        textAlign: "center",
        padding: tokens.spacingHorizontalL,
    },
    overlayTitle: {
        color: tokens.colorNeutralForeground1,
    },
    overlayActions: {
        display: "flex",
        gap: tokens.spacingHorizontalS,
        flexWrap: "wrap",
        justifyContent: "center",
    },
    newHighScore: {
        color: tokens.colorPaletteMarigoldForeground1,
        fontWeight: tokens.fontWeightSemibold,
    },
    controls: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
        textAlign: "center",
    },
});

export default useMinigamesStyles;
