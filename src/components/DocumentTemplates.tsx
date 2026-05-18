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

import { FC, useContext, useMemo, useState } from 'react';
import { Card, Label, Combobox, useComboboxFilter, useId, ComboboxProps } from '@fluentui/react-components';
import useDocumentTemplatesStyles from './DocumentTemplates.styles';
import { ApplicationDataContext } from '../context/ApplicationDataContext';

export const DocumentTemplates: FC = () => {
    const styles = useDocumentTemplatesStyles();
    const tableId = useId('table');
    const documentId = useId('document');
    const viewId = useId('view');
    const { documents, views, tables, isLoading, setSelectedDocument, selectedTable, setSelectedTable, setSelectedView } = useContext(ApplicationDataContext); // Consume context to trigger re-render on data change
    console.log("Render Document Templates", tables);
    const tableOptions = useMemo(() => tables.map(table => ({
        value: table.LogicalName,
        children: table.toString(),
        original: table
    })), [tables]);

    const viewOptions = useMemo(() => selectedTable ? views.filter(view=>view.DataverseTable === selectedTable).map(view => ({
        value: view.ViewId,
        children: view.toString(),
        original: view
    })) : [], [selectedTable, views]);

    const documentOptions = useMemo(() => selectedTable ? documents.filter(document => document.Table === selectedTable).map(document => ({
        value: document.TemplateId,
        children: document.toString(),
        original: document
    })) : [], [selectedTable, documents]);

    const [tableQuery, setTableQuery] = useState<string>("");
    const tableChildren = useComboboxFilter(tableQuery, tableOptions, {
        noOptionsMessage: "No Tables match your search.",
        optionToText: (option) => option.original.toString(),
        optionToReactKey: (option) => option.original.LogicalName,
    });
    const onTableOptionSelect: ComboboxProps["onOptionSelect"] = (_, data) => {
        setSelectedTable(tables.find(table => table.LogicalName == data.optionValue) ?? null);
        setSelectedDocument(null);
        setSelectedView(null);
        setTableQuery(data.optionText ?? "");
        setViewQuery("");
        setDocumentQuery("");
    };

    const [documentQuery, setDocumentQuery] = useState<string>("");
    const documentChildren = useComboboxFilter(documentQuery, documentOptions, {
        noOptionsMessage: "No Document Templates match your search.",
        optionToText: (option) => option.original.toString(),
        optionToReactKey: (option) => option.original.TemplateId
    });
    const onDocumentOptionSelect: ComboboxProps["onOptionSelect"] = (_, data) => {
        setSelectedDocument(documents.find(document=>document.TemplateId === data.optionValue)??null);
        setDocumentQuery(data.optionText ?? "");
    };

    const [viewQuery, setViewQuery] = useState<string>("");
    const viewChildren = useComboboxFilter(viewQuery, viewOptions, {
        noOptionsMessage: "No Views match your search.",
        optionToText: (option) => option.original.toString(),
        optionToReactKey: (option) => option.original.ViewId
    });
    const onViewOptionSelect: ComboboxProps["onOptionSelect"] = (_, data) => {
        setSelectedView(views.find(view=>view.ViewId === data.optionValue)??null);
        console.log("selectedView", views.find(view=>view.ViewId === data.optionValue)??null);
        setViewQuery(data.optionText ?? "");
    };
console.log(tableChildren);
console.log(documentChildren);
console.log(viewChildren);
    return (
        <Card className={styles.card}>

            <div className={styles.content}>
                <div className={styles.inputGroup}>
                    <Label htmlFor={tableId}>Table:</Label>
                    <Combobox
                        aria-labelledby={tableId}
                        clearable
                        disabled={isLoading}
                        inlinePopup
                        onChange={(ev) => setTableQuery(ev.target.value)}
                        value={tableQuery}
                        onOptionSelect={onTableOptionSelect}
                    >
                        {tableChildren}
                    </Combobox>
                </div>
                <div className={styles.inputGroup}>
                    <Label htmlFor={documentId}>Document Template:</Label>
                    <Combobox
                        aria-labelledby={documentId}
                        clearable
                        disabled={isLoading || (selectedTable === null)}
                        inlinePopup
                        onChange={(ev) => setDocumentQuery(ev.target.value)}
                        value={documentQuery}
                        onOptionSelect={onDocumentOptionSelect}
                    >
                        {documentChildren}
                    </Combobox>
                </div>
                <div className={styles.inputGroup}>
                    <Label htmlFor={viewId}>View:</Label>
                    <Combobox
                        aria-labelledby={viewId}
                        clearable
                        disabled={isLoading || (selectedTable === null)}
                        inlinePopup
                        onChange={(ev) => setViewQuery(ev.target.value)}
                        value={viewQuery}
                        onOptionSelect={onViewOptionSelect}
                    >
                        {viewChildren}
                    </Combobox>
                </div>
            </div>
        </Card>
    );
};
