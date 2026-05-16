import { DataverseAPIMock, ToolboxAPIMock } from '@shko.online/pptb-mock';
import accountMetadata from './data/accountMetadata.json';
import personalTemplate1 from './data/personalTemplate1.json';
import personalTemplate2 from './data/personalTemplate2.json';
import personalTemplates from './data/personalTemplates.json';
import systemTemplate1 from './data/systemTemplate1.json';
import systemViews from './data/savedquery.json';
import shko_betimstableMetadata from './data/shko_betimsTableMetadata.json';
import systemTemplates from './data/systemTemplates.json';
import personalViews from './data/userquery.json';

const toolboxAPIMock = new ToolboxAPIMock();
const dataverseAPIMock = new DataverseAPIMock();
const parser = new DOMParser();

dataverseAPIMock.retrieveMultiple.callsFake(async (fetchXML: string) => {
    const fetchDoc = parser.parseFromString(fetchXML, 'text/xml');
    const fetchNode = fetchDoc.documentElement;
    const entityNode = fetchNode.firstElementChild;
    const entity = entityNode?.getAttribute('name');

    if (entity === 'userquery') {
        return personalViews;
    } else if (entity === 'savedquery') {
        return systemViews;
    } else if (entity === "personaldocumenttemplate") {
        return personalTemplates;
    } else if (entity === "documenttemplate") {
        return systemTemplates;
    }
    throw new Error(`Could not find data for entity '${fetchXML}'`);
});

dataverseAPIMock.retrieve.callsFake(async (entityLogicalName: string, id: string, columns?: string[], connectionTarget?: "primary" | "secondary") => {
    console.log(entityLogicalName, id, columns, connectionTarget);
    if (id === "ba4c6b5f-9e46-f111-bec7-000d3aba4179") {
        return personalTemplate1;
    } else if (id === "2a6e11cc-9e46-f111-bec7-000d3aba4179") {
        return personalTemplate2;
    } else if (id === "849fa38a-8ed9-f011-89f5-000d3ab6004a") {
        return systemTemplate1;
    }
    throw new Error(`Could not find the record ${id} for entity ${entityLogicalName}`);
});

dataverseAPIMock.getEntityMetadata.callsFake(async (entityLogicalName: string, searchByLogicalName: boolean, entityProperties?: string[]) => {
    console.log(entityLogicalName, searchByLogicalName, entityProperties);
    if (entityLogicalName === "account") {
        return accountMetadata;
    } else if (entityLogicalName === "shko_betimstable") {
        return shko_betimstableMetadata;
    }
    throw new Error(`Could not find metadata for entity '${entityLogicalName}'`);
});

window.toolboxAPI = toolboxAPIMock;
window.dataverseAPI = dataverseAPIMock;