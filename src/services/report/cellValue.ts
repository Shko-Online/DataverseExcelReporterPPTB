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

import type { CellContent } from "../excel/ExcelTemplate";

const FORMATTED_VALUE = "@OData.Community.Display.V1.FormattedValue";

/** Attribute types whose raw value is written to Excel as a number. */
const NUMERIC_ATTRIBUTE_TYPES = new Set(["BigInt", "Decimal", "Double", "Integer", "Money"]);

export type WebApiRecord = Record<string, unknown>;

/**
 * Finds the key under which the Web API returned an attribute.
 * Lookups come back as `_<name>_value`; attributes of a link-entity as `<alias>.<name>`.
 */
const resolveKey = (record: WebApiRecord, attribute: string, alias?: string): string | null => {
    const candidates = alias ? [`${alias}.${attribute}`, `${alias}._${attribute}_value`] : [attribute, `_${attribute}_value`];
    for (const candidate of candidates) {
        if (candidate in record) {
            return candidate;
        }
    }
    return null;
};

/** Extracts the row version from the record's `@odata.etag` (`W/"123456"`), used for the Row Checksum column. */
export const getRowVersion = (record: WebApiRecord): string => {
    const etag = record["@odata.etag"];
    if (typeof etag === "string") {
        const match = /"([^"]*)"/.exec(etag);
        return match ? match[1] : etag;
    }
    const versionNumber = record["versionnumber"];
    return versionNumber === undefined || versionNumber === null ? "" : String(versionNumber);
};

/**
 * Converts a Dataverse Web API attribute value to Excel cell content, mirroring the XrmToolBox implementation:
 * numbers (including Money) as numbers, dates as dates, and everything else as its formatted value.
 *
 * @param record The record returned by the Web API (with `odata.include-annotations="*"`).
 * @param attribute The attribute logical name.
 * @param attributeType The `AttributeType` from the metadata, when known.
 * @param alias The link-entity alias for attributes of related tables.
 */
export const getCellContent = (record: WebApiRecord, attribute: string, attributeType: string | undefined, alias?: string): CellContent => {
    const key = resolveKey(record, attribute, alias);
    if (key === null) {
        return { type: "empty" };
    }
    const value = record[key];
    if (value === null || value === undefined) {
        return { type: "empty" };
    }
    const formattedValue = record[key + FORMATTED_VALUE];

    if (typeof value === "number" && (attributeType === undefined ? formattedValue === undefined : NUMERIC_ATTRIBUTE_TYPES.has(attributeType))) {
        return { type: "number", value };
    }

    if (attributeType === "DateTime" && typeof value === "string") {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
            return { type: "date", value: date };
        }
    }

    if (Array.isArray(value)) {
        // Activity parties: prefer the address used, then the party's name.
        const parties = value.map((party: WebApiRecord) => {
            const address = party["addressused"];
            if (typeof address === "string" && address) {
                return address;
            }
            const name = party["_partyid_value" + FORMATTED_VALUE];
            return typeof name === "string" ? name : "";
        });
        return { type: "string", value: parties.join(";") };
    }

    if (typeof formattedValue === "string") {
        return { type: "string", value: formattedValue };
    }

    return { type: "string", value: typeof value === "object" ? JSON.stringify(value) : String(value) };
};
