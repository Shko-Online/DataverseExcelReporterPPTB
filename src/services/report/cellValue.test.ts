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

import { describe, expect, it } from "vitest";
import { getCellContent, getRowVersion } from "./cellValue";

const FORMATTED = "@OData.Community.Display.V1.FormattedValue";

const record = {
    "@odata.etag": 'W/"5893021"',
    accountid: "a1b2c3d4-0000-0000-0000-000000000001",
    name: "Contoso",
    revenue: 1250000.5,
    [`revenue${FORMATTED}`]: "$1,250,000.50",
    numberofemployees: 42,
    [`numberofemployees${FORMATTED}`]: "42",
    statecode: 0,
    [`statecode${FORMATTED}`]: "Active",
    donotemail: false,
    [`donotemail${FORMATTED}`]: "Allow",
    modifiedon: "2026-05-03T19:58:26Z",
    [`modifiedon${FORMATTED}`]: "5/3/2026 9:58 PM",
    _primarycontactid_value: "c0000000-0000-0000-0000-000000000001",
    [`_primarycontactid_value${FORMATTED}`]: "Yvonne McKay",
    "contact_7b.emailaddress1": "yvonne@contoso.com",
    "team_e3.administratorid": "a0000000-0000-0000-0000-000000000001",
    [`team_e3.administratorid${FORMATTED}`]: "Betim Beja",
    to: [{ addressused: "someone@contoso.com" }, { addressused: null, [`_partyid_value${FORMATTED}`]: "Contoso" }],
    description: null,
};

describe("getCellContent", () => {
    it("writes numeric attributes as numbers", () => {
        expect(getCellContent(record, "revenue", "Money")).toEqual({ type: "number", value: 1250000.5 });
        expect(getCellContent(record, "numberofemployees", "Integer")).toEqual({ type: "number", value: 42 });
    });

    it("writes choices, booleans and lookups using their formatted values", () => {
        expect(getCellContent(record, "statecode", "State")).toEqual({ type: "string", value: "Active" });
        expect(getCellContent(record, "donotemail", "Boolean")).toEqual({ type: "string", value: "Allow" });
        expect(getCellContent(record, "primarycontactid", "Lookup")).toEqual({ type: "string", value: "Yvonne McKay" });
    });

    it("writes date/time attributes as dates", () => {
        expect(getCellContent(record, "modifiedon", "DateTime")).toEqual({ type: "date", value: new Date(Date.UTC(2026, 4, 3, 19, 58, 26)) });
    });

    it("reads attributes of related tables through the link-entity alias", () => {
        expect(getCellContent(record, "emailaddress1", "String", "contact_7b")).toEqual({ type: "string", value: "yvonne@contoso.com" });
        expect(getCellContent(record, "administratorid", "Lookup", "team_e3")).toEqual({ type: "string", value: "Betim Beja" });
    });

    it("joins activity parties", () => {
        expect(getCellContent(record, "to", "PartyList")).toEqual({ type: "string", value: "someone@contoso.com;Contoso" });
    });

    it("returns empty content for missing or null attributes", () => {
        expect(getCellContent(record, "description", "Memo")).toEqual({ type: "empty" });
        expect(getCellContent(record, "telephone1", "String")).toEqual({ type: "empty" });
        expect(getCellContent(record, "emailaddress1", "String", "unknown_alias")).toEqual({ type: "empty" });
    });

    it("infers the type when the metadata is not available", () => {
        expect(getCellContent(record, "revenue", undefined)).toEqual({ type: "string", value: "$1,250,000.50" });
        expect(getCellContent({ count: 3 }, "count", undefined)).toEqual({ type: "number", value: 3 });
        expect(getCellContent(record, "name", undefined)).toEqual({ type: "string", value: "Contoso" });
    });
});

describe("getRowVersion", () => {
    it("reads the version number from the etag", () => {
        expect(getRowVersion(record)).toBe("5893021");
        expect(getRowVersion({ versionnumber: 12 })).toBe("12");
        expect(getRowVersion({})).toBe("");
    });
});
