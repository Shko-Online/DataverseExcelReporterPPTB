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

import { useCallback, useContext, useEffect, useState } from 'react';
import { FluentProvider, webLightTheme, webDarkTheme, Toolbar, ToolbarButton, Title3, Text, ToolbarDivider } from '@fluentui/react-components';
import { CheckmarkCircle24Regular, Info24Regular, Warning24Regular, DismissCircle24Regular } from '@fluentui/react-icons';
import { ConnectionStatus } from './components/ConnectionStatus';
import { ShkoOnlineAd } from './components/ShkoOnlineAd';
import useAppStyles from './App.styles';
import { ToolboxAPIContext } from './context/ToolboxAPIContext';
import ConnectionContext from './context/ConnectionContext';
import { DocumentTemplates } from './components/DocumentTemplates';
import { ApplicationDataContext } from './context/ApplicationDataContext';

function App() {
    const { refreshConnection } = useContext(ConnectionContext);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const styles = useAppStyles();
    const toolboxAPI = useContext(ToolboxAPIContext);

    const getTheme = useCallback(async () => {
        try {
            const currentTheme = await toolboxAPI?.utils.getCurrentTheme();
            setTheme(currentTheme === 'dark' ? 'dark' : 'light');
        } catch (error) {
            console.error('Error getting theme:', error);
        }
    }, [toolboxAPI]);

    useEffect(() => {
        if (!toolboxAPI) return;
        getTheme();
        const subscription = (_: any, payload: ToolBoxAPI.ToolBoxEventPayload) => {
            switch (payload.event) {
                case 'connection:updated':
                case 'connection:created':
                    refreshConnection();
                    break;

                case 'connection:deleted':
                    refreshConnection();
                    break;

                case 'settings:updated':
                    getTheme();
                    break;
            }
        };
        toolboxAPI.events.on(subscription);

        return () => {
            toolboxAPI.events.off(subscription);
        };
    }, [getTheme, toolboxAPI]);

    const { isGeneratingReport, isLoading, selectedTable, selectedView, selectedDocument, refreshMetadata, generateReport } = useContext(ApplicationDataContext);

    return (
        <FluentProvider theme={theme === 'dark' ? webDarkTheme : webLightTheme} className={styles.root}>
            <div className={styles.header}>
                <Title3 className={styles.headerTitle}>Dataverse Excel Reporter</Title3>
                <Text className={styles.subtitle}>A tool that allows you to export Dataverse data using a system or personal excel template from the selected environment. It will properly use pagination and not timeout during data export.</Text>
            </div>

            <Toolbar className={styles.toolbar}>
                {isGeneratingReport ?
                    <ToolbarButton icon={<DismissCircle24Regular />} onClick={() => { }}>
                        Stop Report Generation
                    </ToolbarButton> :
                    <ToolbarButton disabled={isLoading || selectedTable === null || selectedView === null || selectedDocument === null} icon={<CheckmarkCircle24Regular />} onClick={generateReport}>
                        Generate Report
                    </ToolbarButton>
                }
                <ToolbarButton disabled={isLoading || isGeneratingReport} icon={<Warning24Regular />} onClick={refreshMetadata}>
                    Refresh Metadata
                </ToolbarButton>

                <ToolbarDivider />
                <ToolbarButton icon={<Info24Regular />} onClick={() => { }}>
                    Batch Size: 100
                </ToolbarButton>
            </Toolbar>

            <div className={styles.content}>
                <div className={styles.topRowContainer}>
                    <div className={styles.connectionStatus}>
                        <ConnectionStatus />
                    </div>

                    <div className={styles.toolboxApi}>
                        <ShkoOnlineAd />
                    </div>
                </div>

                <DocumentTemplates />

            </div>
        </FluentProvider>
    );
}

export default App;
