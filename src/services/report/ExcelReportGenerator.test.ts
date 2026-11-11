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
import { S, SmlPackage, XElement } from "openxmlsdkts";
import { describe, expect, it, vi } from "vitest";
import type { ClientData } from "../../dataModel/ClientData";
import DataverseTable from "../../dataModel/DataverseTable";
import DataverseView from "../../dataModel/DataverseView";
import DocumentTemplate from "../../dataModel/DocumentTemplate";
import systemTemplate1 from "../../stories/data/systemTemplate1.json";
import systemTemplates from "../../stories/data/systemTemplates.json";
import { generateExcelReport } from "./ExcelReportGenerator";

const FORMATTED = "@OData.Community.Display.V1.FormattedValue";
const PRIMARY_CONTACT_RELATIONSHIP = "7befeabe-bf01-4207-97f8-7a96e05d2332";

const decodeClientData = (clientData: string): ClientData => JSON.parse(clientData.replace(/&quot;/g, '"'));

const createTemplate = () => {
    const raw = systemTemplates.value[0];
    const table = new DataverseTable("Account", "account");
    // The constructor decodes the client data with the DOM, which isn't available here.
    const template = new DocumentTemplate(false, table, "", raw.documenttemplateid, raw.languagecode, raw.name, "", String(raw.status));
    template.ClientData = decodeClientData(raw.clientdata);
    const view = new DataverseView(
        false,
        table,
        "Active Accounts",
        "00000000-0000-0000-00aa-000000666000",
        '<fetch version="1.0" mapping="logical"><entity name="account"><attribute name="name" /><order attribute="name" descending="false" /><filter><condition attribute="statecode" operator="eq" value="0" /></filter></entity></fetch>',
    );
    return { template, view };
};

const createRecord = (index: number) => ({
    "@odata.etag": `W/"${1000 + index}"`,
    accountid: `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
    modifiedon: "2026-05-03T19:58:26Z",
    [`modifiedon${FORMATTED}`]: "5/3/2026 9:58 PM",
    name: index === 1 ? "  Contoso & <Sons>\u0001 " : `Account ${index}`,
    telephone1: index === 2 ? null : "555-0100",
    _primarycontactid_value: "c0000000-0000-0000-0000-000000000001",
    [`_primarycontactid_value${FORMATTED}`]: "Yvonne McKay",
    [`contact_${PRIMARY_CONTACT_RELATIONSHIP.replace(/-/g, "_")}.emailaddress1`]: "yvonne@contoso.com",
    statecode: 0,
    [`statecode${FORMATTED}`]: "Active",
});

const createDataverseApi = (totalRecords: number, pageSize: number) => {
    const records = Array.from({ length: totalRecords }, (_, i) => createRecord(i + 1));
    const retrieveMultiple = vi.fn(async (fetchXml: string) => {
        const page = parseInt(/page='(\d+)'/.exec(fetchXml)![1], 10);
        const value = records.slice((page - 1) * pageSize, page * pageSize);
        const moreRecords = page * pageSize < totalRecords;
        return {
            value,
            "@Microsoft.Dynamics.CRM.morerecords": moreRecords,
            ...(moreRecords ? { "@Microsoft.Dynamics.CRM.fetchxmlpagingcookie": `<cookie pagenumber="${page + 1}" pagingcookie="%253ccookie%2520page%253d%2522${page}%2522%253e%253c%252fcookie%253e" istracking="False" />` } : {}),
        };
    });
    const api = {
        retrieve: vi.fn(async () => systemTemplate1),
        retrieveMultiple,
        getEntityRelatedMetadata: vi.fn(async (table: string, path: string) => {
            if (path === "ManyToOneRelationships") {
                return {
                    value: [
                        {
                            MetadataId: PRIMARY_CONTACT_RELATIONSHIP,
                            SchemaName: "account_primary_contact",
                            ReferencedEntity: "contact",
                            ReferencedAttribute: "contactid",
                            ReferencingAttribute: "primarycontactid",
                        },
                    ],
                };
            }
            const attributes: Record<string, [string, string][]> = {
                account: [
                    ["accountid", "Uniqueidentifier"],
                    ["modifiedon", "DateTime"],
                    ["name", "String"],
                    ["telephone1", "String"],
                    ["primarycontactid", "Lookup"],
                    ["statecode", "State"],
                ],
                contact: [["emailaddress1", "String"]],
            };
            return { value: (attributes[table] ?? []).map(([LogicalName, AttributeType]) => ({ LogicalName, AttributeType })) };
        }),
    };
    return api as typeof api & DataverseAPI.API;
};

const readWorkbook = async (content: Uint8Array) => {
    const pkg = await SmlPackage.open(new Blob([content as BlobPart]));
    const workbookPart = (await pkg.workbookPart())!;
    for (const worksheetPart of await workbookPart.worksheetParts()) {
        const [tablePart] = await worksheetPart.tableDefinitionParts();
        if (tablePart) {
            return {
                worksheet: (await worksheetPart.getXDocument()).root!,
                table: (await tablePart.getXDocument()).root!,
                styles: (await (await workbookPart.workbookStylesPart())!.getXDocument()).root!,
                workbook: (await workbookPart.getXDocument()).root!,
            };
        }
    }
    throw new Error("No table found");
};

const cellsOf = (row: XElement) =>
    Object.fromEntries(
        row.elements(S.c).map((cell) => [
            cell.attribute("r")!.value,
            { t: cell.attribute("t")?.value, s: cell.attribute("s")?.value, value: cell.value },
        ]),
    );

describe("generateExcelReport", () => {
    it("fills Table1 with every page of records", async () => {
        const { template, view } = createTemplate();
        const dataverseApi = createDataverseApi(5, 2);
        const progress: number[] = [];

        const result = await generateExcelReport({ dataverseApi, template, view, pageSize: 2, onProgress: (count) => progress.push(count) });

        expect(result.recordCount).toBe(5);
        expect(progress).toEqual([2, 4, 5]);
        expect(dataverseApi.retrieveMultiple).toHaveBeenCalledTimes(3);
        const [firstQuery, secondQuery] = dataverseApi.retrieveMultiple.mock.calls.map(([fetchXml]) => fetchXml);
        expect(firstQuery).not.toContain("paging-cookie");
        expect(XElement.parse(secondQuery).attribute("paging-cookie")?.value).toBe('<cookie page="1"></cookie>');
        expect(secondQuery).toContain("<condition attribute='statecode' operator='eq' value='0' />");

        const { worksheet, table, styles, workbook } = await readWorkbook(result.content);

        expect(table.attribute("ref")!.value).toBe("A1:I6");
        expect(table.element(S.autoFilter)!.attribute("ref")!.value).toBe("A1:I6");
        expect(worksheet.element(S.dimension)!.attribute("ref")!.value).toBe("A1:I6");
        expect(workbook.element(S.calcPr)!.attribute("fullCalcOnLoad")!.value).toBe("1");

        // The date format was registered as a custom number format and cell style.
        const numFmt = styles.element(S.numFmts)!.elements(S.numFmt).find((format) => format.attribute("formatCode")!.value === "yyyy/mm/dd hh:mm:ss")!;
        expect(numFmt.attribute("numFmtId")!.value).toBe("164");
        const xfs = styles.element(S.cellXfs)!.elements(S.xf);
        expect(styles.element(S.cellXfs)!.attribute("count")!.value).toBe(String(xfs.length));
        const dateStyle = String(xfs.length - 1);
        expect(xfs[xfs.length - 1].attribute("numFmtId")!.value).toBe("164");

        const rows = worksheet.element(S.sheetData)!.elements(S.row);
        expect(rows.map((row) => row.attribute("r")!.value)).toEqual(["1", "2", "3", "4", "5", "6"]);
        // The non-standard <hyperlinks /> inside sheetData of Dataverse templates is preserved after the rows.
        expect(worksheet.element(S.sheetData)!.elements().at(-1)!.name.localName).toBe("hyperlinks");

        const firstRow = cellsOf(rows[1]);
        expect(firstRow.A2).toEqual({ t: "inlineStr", s: "1", value: "00000000-0000-0000-0000-000000000001" });
        expect(firstRow.B2).toEqual({ t: "inlineStr", s: "2", value: "1001" });
        expect(firstRow.C2.t).toBeUndefined();
        expect(firstRow.C2.s).toBe(dateStyle);
        expect(Number(firstRow.C2.value)).toBeCloseTo(46145 + (19 * 3600 + 58 * 60 + 26) / 86400, 8); // 2026-05-03 19:58:26
        expect(firstRow.D2.value).toBe("  Contoso & <Sons> ");
        expect(firstRow.E2.value).toBe("555-0100");
        expect(firstRow.G2.value).toBe("Yvonne McKay");
        expect(firstRow.H2.value).toBe("yvonne@contoso.com");
        expect(firstRow.I2.value).toBe("Active");

        // Null values leave the cell out.
        expect(cellsOf(rows[2]).E3).toBeUndefined();
        expect(cellsOf(rows[5]).D6.value).toBe("Account 5");
    });

    it("keeps a single empty data row when the view returns nothing", async () => {
        const { template, view } = createTemplate();
        const dataverseApi = createDataverseApi(0, 100);

        const result = await generateExcelReport({ dataverseApi, template, view, pageSize: 100 });

        expect(result.recordCount).toBe(0);
        expect(dataverseApi.retrieveMultiple).toHaveBeenCalledTimes(1);
        const { table } = await readWorkbook(result.content);
        expect(table.attribute("ref")!.value).toBe("A1:I2");
    });

    it("stops when the generation is aborted", async () => {
        const { template, view } = createTemplate();
        const dataverseApi = createDataverseApi(10, 2);
        const controller = new AbortController();

        const generation = generateExcelReport({
            dataverseApi,
            template,
            view,
            pageSize: 2,
            signal: controller.signal,
            onProgress: (count) => count >= 4 && controller.abort(),
        });

        await expect(generation).rejects.toMatchObject({ name: "AbortError" });
        expect(dataverseApi.retrieveMultiple).toHaveBeenCalledTimes(2);
    });

    it("honours the view's top attribute", async () => {
        const { template, view } = createTemplate();
        view.FetchXml = view.FetchXml.replace("<fetch ", '<fetch top="3" ');
        const dataverseApi = createDataverseApi(10, 2);

        const result = await generateExcelReport({ dataverseApi, template, view, pageSize: 2 });

        expect(result.recordCount).toBe(3);
        expect(dataverseApi.retrieveMultiple).toHaveBeenCalledTimes(2);
    });
});
