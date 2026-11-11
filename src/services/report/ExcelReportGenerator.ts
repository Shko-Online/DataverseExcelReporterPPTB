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

import type DataverseAPI from "@pptb/types/dataverseAPI";
import type DataverseView from "../../dataModel/DataverseView";
import type DocumentTemplate from "../../dataModel/DocumentTemplate";
import { ExcelTemplate } from "../excel/ExcelTemplate";
import type { CellWrite } from "../excel/ExcelTemplate";
import { parseCellRange } from "../excel/cellReference";
import { getCellContent, getRowVersion } from "./cellValue";
import { CHECKSUM_LOGICAL_NAME, ReportQuery, extractPagingCookie, getReferencedRelationshipIds, parseRelatedColumn } from "./ReportQuery";
import type { ManyToOneRelationship } from "./ReportQuery";

/** Name of the Excel table Dataverse puts the data in. */
export const DATA_TABLE_NAME = "Table1";
/** Number format used for date/time cells (same as the XrmToolBox tool). */
export const DATE_TIME_FORMAT = "yyyy/mm/dd hh:mm:ss";
export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 5000;
export const DEFAULT_PAGE_SIZE = 100;

export interface GenerateReportOptions {
    dataverseApi: DataverseAPI.API;
    template: DocumentTemplate;
    view: DataverseView;
    /** Records retrieved per request (1 - 5000). */
    pageSize: number;
    /** Aborts the generation between two requests. */
    signal?: AbortSignal;
    /** Called after every page with the total number of exported records. */
    onProgress?: (exportedRecords: number) => void;
}

export interface GenerateReportResult {
    /** The bytes of the generated .xlsx file. */
    content: Uint8Array;
    recordCount: number;
}

interface ColumnPlan {
    column: number;
    kind: "checksum" | "attribute";
    attribute: string;
    alias?: string;
    attributeType?: string;
    /** Related column whose relationship could not be resolved: always empty. */
    unresolved?: boolean;
}

const clampPageSize = (pageSize: number) => (Number.isFinite(pageSize) ? Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.trunc(pageSize))) : DEFAULT_PAGE_SIZE);

const getAttributeTypes = async (dataverseApi: DataverseAPI.API, table: string): Promise<Map<string, string>> => {
    try {
        const response = await dataverseApi.getEntityRelatedMetadata(table, "Attributes", ["LogicalName", "AttributeType"]);
        return new Map(response.value.map((attribute) => [attribute.LogicalName as string, attribute.AttributeType as string]));
    } catch (error) {
        console.warn(`Could not retrieve the attribute metadata of '${table}'. Value types will be inferred.`, error);
        return new Map();
    }
};

const getManyToOneRelationships = async (dataverseApi: DataverseAPI.API, table: string): Promise<ManyToOneRelationship[]> => {
    const response = await dataverseApi.getEntityRelatedMetadata(table, "ManyToOneRelationships", ["MetadataId", "SchemaName", "ReferencedEntity", "ReferencedAttribute", "ReferencingAttribute"]);
    return response.value as unknown as ManyToOneRelationship[];
};

/**
 * Generates an Excel report by filling the Dataverse Excel template's data table with all the records of a view,
 * retrieving them page by page so large exports never time out.
 */
export const generateExcelReport = async ({ dataverseApi, template, view, pageSize, signal, onProgress }: GenerateReportOptions): Promise<GenerateReportResult> => {
    const clientData = template.ClientData;
    if (!clientData) {
        throw new Error(`The document template '${template.Name}' does not contain column definitions.`);
    }
    const effectivePageSize = clampPageSize(pageSize);

    const retrieveResult = await dataverseApi.retrieve(template.IsPersonal ? "personaldocumenttemplate" : "documenttemplate", template.TemplateId, ["content"]);
    const content = retrieveResult["content"];
    if (typeof content !== "string" || !content) {
        throw new Error(`The document template '${template.Name}' has no content.`);
    }
    signal?.throwIfAborted();

    const tableLogicalName = template.Table.LogicalName;
    const hasRelatedColumns = getReferencedRelationshipIds(clientData).length > 0;
    const [attributeTypes, relationships] = await Promise.all([
        getAttributeTypes(dataverseApi, tableLogicalName),
        hasRelatedColumns ? getManyToOneRelationships(dataverseApi, tableLogicalName) : Promise.resolve([]),
    ]);
    signal?.throwIfAborted();

    const query = new ReportQuery(view.FetchXml, clientData, relationships);

    const relatedTables = [...new Set(query.relationshipTables.values())];
    const relatedAttributeTypes = new Map(await Promise.all(relatedTables.map(async (table) => [table, await getAttributeTypes(dataverseApi, table)] as const)));
    signal?.throwIfAborted();

    const workbook = await ExcelTemplate.open(content);
    const dateStyle = await workbook.addNumberFormatStyle(DATE_TIME_FORMAT);
    await workbook.refreshPivotCachesOnLoad();
    await workbook.forceFullCalculationOnLoad();
    const table = await workbook.findTable(DATA_TABLE_NAME);
    if (!table) {
        throw new Error(`The document template '${template.Name}' does not contain the data table '${DATA_TABLE_NAME}'.`);
    }

    const firstColumn = clientData.Range ? parseCellRange(clientData.Range).start.column : table.firstColumn;
    const columns: ColumnPlan[] = Object.values(clientData.Columns)
        .filter((column) => !!column.LogicalName)
        .map((column): ColumnPlan => {
            const position = firstColumn + column.ColumnIndex;
            if (column.LogicalName === CHECKSUM_LOGICAL_NAME) {
                return { column: position, kind: "checksum", attribute: column.LogicalName };
            }
            const related = parseRelatedColumn(column.LogicalName);
            if (!related) {
                return { column: position, kind: "attribute", attribute: column.LogicalName, attributeType: attributeTypes.get(column.LogicalName) };
            }
            const alias = query.relationshipAliases.get(related.relationshipId);
            const relatedTable = query.relationshipTables.get(related.relationshipId);
            return {
                column: position,
                kind: "attribute",
                attribute: related.attribute,
                alias,
                attributeType: relatedTable ? relatedAttributeTypes.get(relatedTable)?.get(related.attribute) : undefined,
                unresolved: alias === undefined,
            };
        })
        .sort((a, b) => a.column - b.column);

    let rowIndex = table.firstDataRow;
    let exported = 0;
    let page = 1;
    let pagingCookie: string | null = null;
    let moreRecords = true;

    while (moreRecords) {
        signal?.throwIfAborted();
        const result = await dataverseApi.retrieveMultiple(query.toFetchXml(page, effectivePageSize, pagingCookie));
        signal?.throwIfAborted();

        let records = result.value;
        if (query.top !== null && exported + records.length > query.top) {
            records = records.slice(0, query.top - exported);
        }

        for (const record of records) {
            const cells = columns.map(
                (column): CellWrite => {
                    if (column.kind === "checksum") {
                        return { column: column.column, content: { type: "string", value: getRowVersion(record) } };
                    }
                    if (column.unresolved) {
                        return { column: column.column, content: { type: "empty" } };
                    }
                    const cellContent = getCellContent(record, column.attribute, column.attributeType, column.alias);
                    return { column: column.column, content: cellContent, style: cellContent.type === "date" ? dateStyle : undefined };
                },
            );
            table.writeRow(rowIndex, cells);
            rowIndex++;
        }
        exported += records.length;
        onProgress?.(exported);

        const moreRecordsAnnotation = (result as unknown as Record<string, unknown>)["@Microsoft.Dynamics.CRM.morerecords"];
        moreRecords =
            records.length > 0 &&
            (query.top === null || exported < query.top) &&
            (typeof moreRecordsAnnotation === "boolean" ? moreRecordsAnnotation : result.value.length >= effectivePageSize);
        pagingCookie = extractPagingCookie(result["@Microsoft.Dynamics.CRM.fetchxmlpagingcookie"]);
        page++;
    }

    table.commit();
    signal?.throwIfAborted();

    return { content: await workbook.save(), recordCount: exported };
};
