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

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ToolboxAPIContext } from "../context/ToolboxAPIContext";
import { addSession, loadStats, normalizeStats, saveStats } from "./minigameStats";
import type { MinigameId, MinigameSession, MinigameStatsById } from "./minigameStats";

/** The local minigame statistics, and a function to add a finished game to them. */
export const useMinigameStats = () => {
    const toolboxAPI = useContext(ToolboxAPIContext);
    const [stats, setStats] = useState<MinigameStatsById>(() => normalizeStats(undefined));
    const statsRef = useRef(stats);
    const loading = useRef<Promise<void>>(Promise.resolve());

    useEffect(() => {
        loading.current = loadStats(toolboxAPI?.settings).then((loaded) => {
            statsRef.current = loaded;
            setStats(loaded);
        });
    }, [toolboxAPI]);

    const recordSession = useCallback(
        async (id: MinigameId, session: MinigameSession) => {
            // Don't overwrite stored stats with the empty defaults while they are still loading.
            await loading.current;
            const next = addSession(statsRef.current, id, session);
            statsRef.current = next;
            setStats(next);
            await saveStats(toolboxAPI?.settings, next);
        },
        [toolboxAPI],
    );

    return { stats, recordSession };
};
