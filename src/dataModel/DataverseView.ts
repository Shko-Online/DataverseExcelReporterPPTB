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

import DataverseTable from "./DataverseTable";

class DataverseView {
    public IsPersonal: boolean;
    public DataverseTable: DataverseTable;
    public Name: string;
    public ViewId: string;
    public FetchXml: string;

    public constructor(isPersonal: boolean, table: DataverseTable, name:string, viewId: string, fetchXML: string){
        this.IsPersonal = isPersonal;
        this.DataverseTable = table;
        this.Name = name;
        this.ViewId = viewId;
        this.FetchXml = fetchXML;
    }

    public toString(){
        return `${(this.IsPersonal ? "👤" : "🏢")} ${this.Name}`;
    }
 }
 
 export default DataverseView;