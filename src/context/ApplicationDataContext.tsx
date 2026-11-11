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

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { FC, ReactNode } from "react";
import ToolboxAPIContext from "./ToolboxAPIContext";
import ConnectionContext from "./ConnectionContext";
import DataverseAPIContext from "./DataverseAPIContext";
import getDocumentTemplateFetch from "../queries/getDocumentTemplateFetch";
import DataverseTable from "../dataModel/DataverseTable";
import DataverseView from "../dataModel/DataverseView";
import DocumentTemplate from "../dataModel/DocumentTemplate";
import getTableViewsFetch from "../queries/getTableViewsFetch";
import { DEFAULT_PAGE_SIZE, generateExcelReport } from "../services/report/ExcelReportGenerator";

const pad = (value: number) => String(value).padStart(2, "0");

/** Report_<Table>_yyyyMMdd_HHmmss.xlsx, like the XrmToolBox tool. */
const getReportFileName = (template: DocumentTemplate) => {
    const now = new Date();
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const tableName = template.Table.Name.replace(/[\\/:*?"<>|]/g, "_");
    return `Report_${tableName}_${timestamp}.xlsx`;
};

export interface ApplicationData {
    tables: DataverseTable[];
    selectedTable: DataverseTable | null;
    documents: DocumentTemplate[];
    selectedDocument: DocumentTemplate | null;
    views: DataverseView[];
    selectedView: DataverseView | null;
    isLoading: boolean;
    isGeneratingReport: boolean;
    /** Number of records exported so far by the running report generation. */
    exportedRecords: number;
    /** Records retrieved per request. */
    pageSize: number;
}

export interface ApplicationActions {
    refreshMetadata: () => Promise<void> | undefined;
    setSelectedDocument: (selectedDocument: DocumentTemplate | null) => void;
    setSelectedTable: (selectedTable: DataverseTable | null) => void;
    setSelectedView: (selectedView: DataverseView | null) => void;
    generateReport: () => void;
    stopReportGeneration: () => void;
    setPageSize: (pageSize: number) => void;
}

export const ApplicationDataContext = createContext<ApplicationData & ApplicationActions>({
    tables: [],
    selectedTable: null,
    documents: [],
    selectedDocument: null,
    views: [],
    selectedView: null,
    isGeneratingReport: false,
    isLoading: true,
    exportedRecords: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    refreshMetadata: () => Promise.resolve(),
    setSelectedDocument: () => { },
    setSelectedTable: () => { },
    setSelectedView: () => { },
    generateReport: () => { },
    stopReportGeneration: () => { },
    setPageSize: () => { },
});

export const ApplicationDataProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const dataverseApi = useContext(DataverseAPIContext);
    const [isLoading, setIsLoading] = useState(true);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [documents, setDocuments] = useState<ApplicationData['documents']>([]);
    const [selectedTable, setSelectedTable] = useState<DataverseTable | null>(null);
    const [selectedView, setSelectedView] = useState<DataverseView | null>(null);
    const [selectedDocument, setSelectedDocument] = useState<DocumentTemplate | null>(null);
    const [views, setViews] = useState<ApplicationData['views']>([]);
    const tables = useRef<ApplicationData['tables']>([]);
    const toolboxAPI = useContext(ToolboxAPIContext);
    const { connection } = useContext(ConnectionContext);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [exportedRecords, setExportedRecords] = useState(0);
    const reportAbortController = useRef<AbortController | null>(null);

    const stopReportGeneration = useCallback(() => {
        reportAbortController.current?.abort();
    }, []);

    const generateReport = useCallback(async () => {
        if (selectedDocument === null || selectedView === null || dataverseApi === null || reportAbortController.current) {
            return;
        }
        const abortController = new AbortController();
        reportAbortController.current = abortController;
        setIsGeneratingReport(true);
        setExportedRecords(0);
        try {
            const { content, recordCount } = await generateExcelReport({
                dataverseApi,
                template: selectedDocument,
                view: selectedView,
                pageSize,
                signal: abortController.signal,
                onProgress: setExportedRecords,
            });
            const savedPath = await toolboxAPI?.fileSystem.saveFile(getReportFileName(selectedDocument), content, [{ name: "Excel Workbook", extensions: ["xlsx"] }]);
            if (savedPath) {
                await toolboxAPI?.utils.showNotification({
                    title: "Report saved",
                    body: `Exported ${recordCount} records to ${savedPath}.`,
                    type: "success",
                });
            }
        } catch (error) {
            if (abortController.signal.aborted) {
                await toolboxAPI?.utils.showNotification({ title: "Report generation stopped", body: "The report generation was cancelled.", type: "warning" });
            } else {
                console.error("Error generating report:", error);
                await toolboxAPI?.utils.showNotification({
                    title: "Error generating the report",
                    body: error instanceof Error ? error.message : String(error),
                    type: "error",
                });
            }
        } finally {
            reportAbortController.current = null;
            setIsGeneratingReport(false);
        }
    }, [selectedDocument, selectedView, dataverseApi, pageSize, toolboxAPI]);

    const templateMap = useCallback((personalTemplate: any) => new DocumentTemplate(
        personalTemplate.personaldocumenttemplateid ? true : false,
        DataverseTable.GetOrCreate(
            tables.current,
            personalTemplate['associatedentitytypecode@OData.Community.Display.V1.FormattedValue'],
            personalTemplate.associatedentitytypecode
        ),
        personalTemplate.clientdata,
        personalTemplate.personaldocumenttemplateid ?
            personalTemplate.personaldocumenttemplateid :
            personalTemplate.documenttemplateid,
        personalTemplate.languagecode,
        personalTemplate.name,
        personalTemplate.description,
        personalTemplate['status']
    ), [tables.current]);

    const viewMap = useCallback((personalView: any) => new DataverseView(
        personalView.userqueryid ? true : false,
        DataverseTable.GetOrCreate(
            tables.current,
            personalView['returnedtypecode@OData.Community.Display.V1.FormattedValue'],
            personalView.returnedtypecode
        ),
        personalView.name,
        personalView.userqueryid ? personalView.userqueryid : personalView.savedqueryid,
        personalView.fetchxml
    ), [tables.current]);

    const refreshMetadata = useCallback(async () => {
        if (!dataverseApi || !connection) return Promise.resolve();
        setIsLoading(true);
        console.log("Refreshing metadata for connection: ", connection);
        const [personalTemplates, systemTemplates] = await toolboxAPI?.utils.executeParallel(
            dataverseApi.retrieveMultiple(getDocumentTemplateFetch(/* isPersonal */ true).toString()),
            dataverseApi.retrieveMultiple(getDocumentTemplateFetch(/* isPersonal */ false).toString())
        )!;
        console.log(personalTemplates);
        console.log(systemTemplates);
        tables.current = new Array();

        const documents = personalTemplates.value.map(templateMap).concat(systemTemplates.value.map(templateMap));
        // Sorts an array in place. This method mutates the array 
        documents.sort((document1, document2) => document1.Name.localeCompare(document2.Name));
        // Sorts an array in place. This method mutates the array 
        tables.current.sort((table1, table2) => table1.LogicalName.localeCompare(table2.LogicalName));

        // const tableMetadatas = await dataverseApi.queryData(`EntityDefinitions?$select=DisplayName,LogicalName,PrimaryIdAttribute,ObjectTypeCode&$filter=${tables.current.map(table => "LogicalName eq '" + table.LogicalName + "'").join(' or ')}`);
        const tableMetadatas = await toolboxAPI?.utils.executeParallel(...tables.current.map(table => dataverseApi.getEntityMetadata(table.LogicalName, true, ['DisplayName', 'LogicalName', 'PrimaryIdAttribute', 'ObjectTypeCode'])))!;
        console.log(tableMetadatas);
        tableMetadatas.forEach(tableMetadata => {
            const table = tables.current.find(table => table.LogicalName === tableMetadata.LogicalName);
            if (!table) {
                return;
            }
            console.log(table);
            table.Metadata = tableMetadata;
            table.Name = tableMetadata.DisplayName?.LocalizedLabels[0].Label ?? table.Name;
        });

        const tableEntityCodes = tables.current.map(table => table.Metadata!.ObjectTypeCode as string);

        const [personalViews, systemViews] = await toolboxAPI?.utils.executeParallel(
            dataverseApi.retrieveMultiple(getTableViewsFetch(/* isPersonal */ true, tableEntityCodes).toString()),
            dataverseApi.retrieveMultiple(getTableViewsFetch(/* isPersonal */ false, tableEntityCodes).toString())
        )!;

        console.log(personalViews);
        console.log(systemViews);

        const views = personalViews.value.map(viewMap).concat(systemViews.value.map(viewMap));
        // Sorts an array in place. This method mutates the array 
        views.sort((view1, view2) => view1.Name.localeCompare(view2.Name));
        console.log(tables, documents, views);
        setDocuments(documents);
        setViews(views);
        setSelectedTable(null);
        setSelectedDocument(null);
        setSelectedView(null);
        setIsLoading(false);
        return;


    }, [dataverseApi, connection, toolboxAPI, tables]);

    useEffect(() => {
        refreshMetadata();
    }, [connection])

    return <ApplicationDataContext.Provider
        value={{
            isGeneratingReport,
            isLoading,
            exportedRecords,
            pageSize,
            documents,
            selectedDocument,
            tables: tables.current,
            selectedTable,
            views,
            selectedView,
            refreshMetadata,
            setSelectedDocument,
            setSelectedTable,
            setSelectedView,
            generateReport,
            stopReportGeneration,
            setPageSize,
        }}
    >{children}</ApplicationDataContext.Provider>;
};

export default ConnectionContext;