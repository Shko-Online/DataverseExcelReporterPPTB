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

import { FC, useState } from 'react';
import { Card, Label, Combobox, useComboboxFilter, useId, ComboboxProps } from '@fluentui/react-components';
import useDocumentTemplatesStyles from './DocumentTemplates.styles';

const tableOptions = [
    { value: 'account', children: 'Account (account)' },
    { value: 'contact', children: 'Contact (contact)' },
    { value: 'opportunity', children: 'Opportunity (opportunity)' },
];

const documentOptions = [
    { value: '0000-0000-00000000-0000', children: 'Account Overview' },
];

const viewOptions = [
    { value: '0000-0000-00000000-0000', children: 'All Accounts' },
];

export const DocumentTemplates: FC = () => {
    const styles = useDocumentTemplatesStyles();
    const tableId = useId('table');
    const documentId = useId('document');
    const viewId = useId('view');

    const [tableQuery, setTableQuery] = useState<string>("");
    const tableChildren = useComboboxFilter(tableQuery, tableOptions, {
        noOptionsMessage: "No Tables match your search.",
    });
    const onTableOptionSelect: ComboboxProps["onOptionSelect"] = (_, data) => {
        setTableQuery(data.optionText ?? "");
    };

    const [documentQuery, setDocumentQuery] = useState<string>("");
    const documentChildren = useComboboxFilter(documentQuery, documentOptions, {
        noOptionsMessage: "No Document Templates match your search.",
    });
    const onDocumentOptionSelect: ComboboxProps["onOptionSelect"] = (_, data) => {
        setDocumentQuery(data.optionText ?? "");
    };

    const [viewQuery, setViewQuery] = useState<string>("");
    const viewChildren = useComboboxFilter(viewQuery, viewOptions, {
        noOptionsMessage: "No Views match your search.",
    });
    const onViewOptionSelect: ComboboxProps["onOptionSelect"] = (_, data) => {
        setViewQuery(data.optionText ?? "");
    };

    return (
        <Card className={styles.card}>

            <div className={styles.content}>
                <div className={styles.inputGroup}>
                    <Label htmlFor={tableId}>Table:</Label>
                    <Combobox
                        aria-labelledby={tableId}
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
