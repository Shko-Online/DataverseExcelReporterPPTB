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

import { ClientData } from "./ClientData";
import DataverseTable from "./DataverseTable";

const parseClientData = (clientData: string) => {
    if (!clientData) return null;
    const element = document.createElement("textarea");
    element.innerHTML = clientData;
    return JSON.parse(element.value) as ClientData;
}

class DocumentTemplate {

    public IsPersonal: boolean;

    public Table: DataverseTable;

    public ClientData: ClientData | null;

    public TemplateId: string;

    public LanguageCode: number;

    public Name: string;

    public Description: string;

    public Status: string;

    public constructor(
        isPersonal: boolean,
        table: DataverseTable,
        clientData: string,
        templateId: string,
        languageCode: number,
        name: string,
        description: string,
        status: string
    ) {
        this.IsPersonal = isPersonal;
        this.Table = table;
        this.ClientData = parseClientData(clientData);
        this.TemplateId = templateId;
        this.LanguageCode = languageCode;
        this.Name = name;
        this.Description = description;
        this.Status = status;
    }

    public toString() {
        return `${(this.IsPersonal ? "👤" : "🏢")} ${this.Name}`;
    }
}

export default DocumentTemplate;