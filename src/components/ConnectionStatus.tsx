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

import { useCallback, useContext, useState } from 'react';
import type { FC } from 'react';
import { makeStyles, Spinner, tokens, ToolbarButton } from '@fluentui/react-components';
import { PlugConnected24Regular, PlugDisconnected24Regular } from '@fluentui/react-icons';
import ConnectionContext from '../context/ConnectionContext';
import { ConnectionDetailsPopup } from './ConnectionDetailsPopup';
import EllipsisText from './EllipsisText';

const useConnectionStatusStyles = makeStyles({
    button: {
        // Fluent buttons cap their width at 280px and never shrink their label.
        maxWidth: '100%',
        minWidth: 0,
        justifyContent: 'flex-start',
    },
    connectedIcon: {
        color: tokens.colorPaletteGreenForeground2,
    },
    disconnectedIcon: {
        color: tokens.colorPaletteYellowForeground2,
    },
    name: {
        display: 'block',
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
});

/**
 * Toolbar entry showing the active connection name (truncated when it doesn't fit);
 * clicking it opens the connection details popup.
 */
export const ConnectionStatus: FC = () => {
    const styles = useConnectionStatusStyles();
    const { connection, isLoading } = useContext(ConnectionContext);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const closeDetails = useCallback(() => setIsDetailsOpen(false), []);

    if (isLoading) {
        return <Spinner size="tiny" label="Checking connection..." />;
    }

    const label = connection ? connection.name : 'No active connection';

    return (
        <>
            <ToolbarButton
                className={styles.button}
                icon={connection ? <PlugConnected24Regular className={styles.connectedIcon} /> : <PlugDisconnected24Regular className={styles.disconnectedIcon} />}
                onClick={() => setIsDetailsOpen(true)}
                aria-label={`Connection: ${label}. Show connection details`}
                aria-haspopup="dialog"
            >
                <EllipsisText className={styles.name} value={label} title={connection ? `${connection.name} (${connection.url})` : label} />
            </ToolbarButton>
            {isDetailsOpen && <ConnectionDetailsPopup connection={connection} onClose={closeDetails} />}
        </>
    );
};
