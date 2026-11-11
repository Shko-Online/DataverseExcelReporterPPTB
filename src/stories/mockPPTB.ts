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
import { applyLinkEntityAliases, sampleAttributes, sampleRecords, sampleRelationships } from './data/sampleRecords';

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
    } else if (entity && sampleRecords[entity]) {
        // Simulate the Web API paging of FetchXML queries.
        const count = parseInt(fetchNode.getAttribute('count') ?? '5000', 10);
        const page = parseInt(fetchNode.getAttribute('page') ?? '1', 10);
        const records = sampleRecords[entity];
        const moreRecords = page * count < records.length;
        await new Promise(resolve => setTimeout(resolve, 300));
        return {
            value: applyLinkEntityAliases(records.slice((page - 1) * count, page * count), entityNode!),
            '@Microsoft.Dynamics.CRM.morerecords': moreRecords,
            ...(moreRecords ? { '@Microsoft.Dynamics.CRM.fetchxmlpagingcookie': `<cookie pagenumber="${page + 1}" pagingcookie="%253ccookie%2520page%253d%2522${page}%2522%253e%253c%252fcookie%253e" istracking="False" />` } : {}),
        };
    }
    throw new Error(`Could not find data for entity '${fetchXML}'`);
});

dataverseAPIMock.retrieve.callsFake(async (entityLogicalName: string, id: string, columns?: string[], connectionTarget?: "primary" | "secondary") => {
    console.log(entityLogicalName, id, columns, connectionTarget);
    if (id === "ba4c6b5f-9e46-f111-bec7-000d3aba4179") {
        return personalTemplate1;
    } else if (id === "2a6e11cc-9e46-f111-bec7-000d3aba4179") {
        return personalTemplate2;
    } else if (id === systemTemplate1.documenttemplateid) {
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

dataverseAPIMock.getEntityRelatedMetadata.callsFake((async (entityLogicalName: string, relatedPath: string) => {
    if (relatedPath === 'Attributes') {
        return { value: (sampleAttributes[entityLogicalName] ?? []).map(([LogicalName, AttributeType]) => ({ LogicalName, AttributeType })) };
    } else if (relatedPath === 'ManyToOneRelationships') {
        return { value: sampleRelationships[entityLogicalName] ?? [] };
    }
    throw new Error(`Could not find '${relatedPath}' metadata for entity '${entityLogicalName}'`);
}) as typeof dataverseAPIMock.getEntityRelatedMetadata);

// Download the generated file in the browser so it can be inspected.
toolboxAPIMock.fileSystem.saveFile.callsFake(async (defaultPath: string, content: Uint8Array) => {
    const url = URL.createObjectURL(new Blob([content as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = defaultPath;
    link.click();
    URL.revokeObjectURL(url);
    return defaultPath;
});

window.toolboxAPI = toolboxAPIMock;
window.dataverseAPI = dataverseAPIMock;