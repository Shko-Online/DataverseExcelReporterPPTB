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
import { Workbook } from "@cj-tech-master/excelts";

export interface ApplicationData {
    tables: DataverseTable[];
    selectedTable: DataverseTable | null;
    documents: DocumentTemplate[];
    selectedDocument: DocumentTemplate | null;
    views: DataverseView[];
    selectedView: DataverseView | null;
    isLoading: boolean;
    isGeneratingReport: boolean;
}

export interface ApplicationActions {
    refreshMetadata: () => Promise<void> | undefined;
    setSelectedDocument: (selectedDocument: DocumentTemplate | null) => void;
    setSelectedTable: (selectedTable: DataverseTable | null) => void;
    setSelectedView: (selectedView: DataverseView | null) => void;
    generateReport: () => void;
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
    refreshMetadata: () => Promise.resolve(),
    setSelectedDocument: () => { },
    setSelectedTable: () => { },
    setSelectedView: () => { },
    generateReport: () => { }
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

    const generateReport = useCallback(async () => {
        setIsGeneratingReport(true);
        if (selectedDocument === null || dataverseApi === null) {
            setIsGeneratingReport(false);
            return;
        }

        const retrieveResult =await dataverseApi.retrieve(
            selectedDocument.IsPersonal ?
                "personaldocumenttemplate" :
                "documenttemplate",
            selectedDocument.TemplateId, ["content"]);
console.log(retrieveResult);
        const documentContent = retrieveResult["content"] as string;

        console.log(documentContent);

        const workbook = new Workbook();
        await workbook.xlsx.load(documentContent, {base64:true});

        console.log(workbook);

        const buffer = await workbook.xlsx.writeBuffer();
        // const blob = new Blob([], {'type':'application/vnd.openxmlformatsofficedocument.spreadsheetml.sheet'});
        toolboxAPI?.fileSystem.saveFile('report.xlsx', buffer);

        setIsGeneratingReport(false);
    }, [selectedDocument, selectedTable, selectedView, dataverseApi, connection]);

    const templateMap = useCallback((personalTemplate: any) => new DocumentTemplate(
        personalTemplate.personaldocumenttemplateid ? true : false,
        DataverseTable.GetOrCreate(
            tables.current,
            personalTemplate['associatedentitytpecode@OData.Community.Display.V1.FormattedValue'],
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
        personalView.userquerid ? personalView.userqueryid : personalView.savedqueryid,
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
            generateReport
        }}
    >{children}</ApplicationDataContext.Provider>;
};

export default ConnectionContext;