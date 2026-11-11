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
import { FluentProvider, webLightTheme, webDarkTheme, Toolbar, ToolbarButton, Title3, ToolbarDivider, Label, SpinButton, Spinner, useId } from '@fluentui/react-components';
import type { SpinButtonProps } from '@fluentui/react-components';
import { CheckmarkCircle24Regular, Info24Regular, Warning24Regular, DismissCircle24Regular } from '@fluentui/react-icons';
import { ConnectionStatus } from './components/ConnectionStatus';
import EllipsisText from './components/EllipsisText';
import useAppStyles from './App.styles';
import { ToolboxAPIContext } from './context/ToolboxAPIContext';
import ConnectionContext from './context/ConnectionContext';
import { DocumentTemplates } from './components/DocumentTemplates';
import { ApplicationDataContext } from './context/ApplicationDataContext';
import { MAX_PAGE_SIZE, MIN_PAGE_SIZE } from './services/report/ExcelReportGenerator';

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

    const { isGeneratingReport, isLoading, selectedTable, selectedView, selectedDocument, exportedRecords, pageSize, refreshMetadata, generateReport, stopReportGeneration, setPageSize } = useContext(ApplicationDataContext);
    const pageSizeId = useId('pageSize');

    const onPageSizeChange: SpinButtonProps['onChange'] = (_, data) => {
        const value = data.value ?? (data.displayValue !== undefined ? parseInt(data.displayValue, 10) : NaN);
        if (Number.isFinite(value)) {
            setPageSize(Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.trunc(value as number))));
        }
    };

    return (
        <FluentProvider theme={theme === 'dark' ? webDarkTheme : webLightTheme} className={styles.root}>
            <div className={styles.header}>
                <div className={styles.headerTitle}>
                    <div className={styles.titleGroup}>
                        <img className={styles.headerIcon} src="/DataverseExcelReporter.svg" alt="" />
                        <Title3 className={styles.title}>Dataverse Excel Reporter</Title3>
                    </div>
                    <EllipsisText
                        className={styles.subtitle}
                        value="Export Dataverse data using a system or personal Excel template from the selected environment, with pagination so large exports never time out."
                    />
                </div>
            </div>

            <Toolbar className={styles.toolbar}>
                {isGeneratingReport ?
                    <ToolbarButton icon={<DismissCircle24Regular />} onClick={stopReportGeneration}>
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
                <div className={styles.pageSize}>
                    <Info24Regular />
                    <Label htmlFor={pageSizeId}>Batch Size:</Label>
                    <SpinButton
                        id={pageSizeId}
                        className={styles.pageSizeInput}
                        value={pageSize}
                        min={MIN_PAGE_SIZE}
                        max={MAX_PAGE_SIZE}
                        disabled={isGeneratingReport}
                        onChange={onPageSizeChange}
                    />
                </div>
                <ToolbarDivider />
                <div className={styles.connection}>
                    <ConnectionStatus />
                </div>
                {isGeneratingReport && (
                    <>
                        <ToolbarDivider />
                        <Spinner size="tiny" label={`Exported ${exportedRecords} records`} />
                    </>
                )}
            </Toolbar>

            <div className={styles.content}>
                <DocumentTemplates />
            </div>
        </FluentProvider>
    );
}

export default App;
