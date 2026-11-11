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

import { XElement } from "openxmlsdkts";
import { describe, expect, it } from "vitest";
import type { ClientData } from "../../dataModel/ClientData";
import { ReportQuery, extractPagingCookie, getReferencedRelationshipIds } from "./ReportQuery";
import type { ManyToOneRelationship } from "./ReportQuery";

const PRIMARY_CONTACT_RELATIONSHIP = "7befeabe-bf01-4207-97f8-7a96e05d2332";
const OWNING_TEAM_RELATIONSHIP = "e30f4437-868d-4e5b-bef4-37efacebb2fd";

const clientData: ClientData = {
    Range: "A1:F2",
    DisplayConditions: "",
    Columns: {
        "(Do Not Modify) Account": { DisplayName: "(Do Not Modify) Account", ColumnIndex: 0, LogicalName: "accountid" },
        "(Do Not Modify) Row Checksum": { DisplayName: "(Do Not Modify) Row Checksum", ColumnIndex: 1, LogicalName: "checksumLogicalName" },
        "Account Name": { DisplayName: "Account Name", ColumnIndex: 2, LogicalName: "name" },
        "Email (Primary Contact) (Contact)": { DisplayName: "Email (Primary Contact) (Contact)", ColumnIndex: 3, LogicalName: `${PRIMARY_CONTACT_RELATIONSHIP}.emailaddress1` },
        "Email (Owning Team) (Team)": { DisplayName: "Email (Owning Team) (Team)", ColumnIndex: 4, LogicalName: `${OWNING_TEAM_RELATIONSHIP}.emailaddress` },
        "Team Name (Owning Team) (Team)": { DisplayName: "Team Name (Owning Team) (Team)", ColumnIndex: 5, LogicalName: `${OWNING_TEAM_RELATIONSHIP}.name` },
    },
};

const relationships: ManyToOneRelationship[] = [
    {
        MetadataId: PRIMARY_CONTACT_RELATIONSHIP,
        SchemaName: "account_primary_contact",
        ReferencedEntity: "contact",
        ReferencedAttribute: "contactid",
        ReferencingAttribute: "primarycontactid",
    },
    {
        MetadataId: OWNING_TEAM_RELATIONSHIP.toUpperCase(),
        SchemaName: "team_accounts",
        ReferencedEntity: "team",
        ReferencedAttribute: "teamid",
        ReferencingAttribute: "owningteam",
    },
];

const count = (xml: string, pattern: RegExp) => (xml.match(new RegExp(pattern, "g")) ?? []).length;

describe("ReportQuery", () => {
    const viewFetchXml =
        '<fetch version="1.0" output-format="xml-platform" mapping="logical" top="50"><entity name="account"><attribute name="name" /><attribute name="telephone1" /><order attribute="name" descending="false" />' +
        '<link-entity name="contact" from="contactid" to="primarycontactid" link-type="inner"><filter><condition attribute="statecode" operator="eq" value="0" /></filter></link-entity></entity></fetch>';

    it("lists the relationships referenced by the template", () => {
        expect(getReferencedRelationshipIds(clientData).sort()).toEqual([PRIMARY_CONTACT_RELATIONSHIP, OWNING_TEAM_RELATIONSHIP].sort());
    });

    it("replaces the view columns with the template columns and reuses existing link-entities", () => {
        const query = new ReportQuery(viewFetchXml, clientData, relationships);
        const fetchXml = query.toFetchXml(1, 250);

        expect(query.tableLogicalName).toBe("account");
        expect(query.top).toBe(50);
        expect(fetchXml).not.toContain("top=");
        expect(fetchXml).not.toContain("telephone1");
        expect(fetchXml).toMatch(/<entity name=['"]account['"]/);
        expect(count(fetchXml, /<attribute name=['"]accountid['"]/)).toBe(1);
        expect(count(fetchXml, /<attribute name=['"]name['"]/)).toBe(2); // account.name and team.name
        expect(fetchXml).not.toContain("checksumLogicalName");

        // The existing inner link-entity to contact is reused (and keeps its filter) and gets an alias.
        expect(count(fetchXml, /<link-entity name=['"]contact['"]/)).toBe(1);
        expect(fetchXml).toContain("link-type='inner'");
        const contactAlias = query.relationshipAliases.get(PRIMARY_CONTACT_RELATIONSHIP)!;
        expect(fetchXml).toContain(`alias='${contactAlias}'`);
        expect(fetchXml).toContain("<attribute name='emailaddress1' />");

        // A new outer link-entity is added for the owning team, with both columns.
        const teamAlias = query.relationshipAliases.get(OWNING_TEAM_RELATIONSHIP)!;
        expect(teamAlias).toBeTruthy();
        expect(fetchXml).toContain(`<link-entity name='team' from='teamid' to='owningteam' link-type='outer' alias='${teamAlias}'><attribute name='emailaddress' /><attribute name='name' /></link-entity>`);
        expect(query.relationshipTables.get(OWNING_TEAM_RELATIONSHIP)).toBe("team");

        expect(fetchXml).toContain("count='250'");
        expect(fetchXml).toContain("page='1'");
        expect(fetchXml).not.toContain("paging-cookie");
    });

    it("leaves columns of unknown relationships out of the query", () => {
        const query = new ReportQuery(viewFetchXml, clientData, relationships.slice(0, 1));
        expect(query.relationshipAliases.has(OWNING_TEAM_RELATIONSHIP)).toBe(false);
        expect(query.toFetchXml(1, 10)).not.toContain("team");
    });

    it("adds the escaped paging cookie to subsequent pages", () => {
        const query = new ReportQuery(viewFetchXml, clientData, relationships);
        const cookie = '<cookie page="1"><accountid last="{A}" first="{B}" /></cookie>';
        const fetchXml = query.toFetchXml(2, 100, cookie);
        expect(fetchXml).toContain("page='2'");
        // The XML must round-trip.
        expect(XElement.parse(fetchXml).attribute("paging-cookie")?.value).toBe(cookie);
    });
});

describe("extractPagingCookie", () => {
    it("decodes the double URL-encoded paging cookie of the Web API annotation", () => {
        const annotation =
            '<cookie pagenumber="2" pagingcookie="%253ccookie%2520page%253d%25221%2522%253e%253caccountid%2520last%253d%2522%257b7A4814F5-9A69-E811-A955-000D3AB0F7F4%257d%2522%2520first%253d%2522%257b475B158C-541C-E511-80D3-3863BB347BA8%257d%2522%2520%252f%253e%253c%252fcookie%253e" istracking="False" />';
        expect(extractPagingCookie(annotation)).toBe(
            '<cookie page="1"><accountid last="{7A4814F5-9A69-E811-A955-000D3AB0F7F4}" first="{475B158C-541C-E511-80D3-3863BB347BA8}" /></cookie>',
        );
    });

    it("returns null when there is no cookie", () => {
        expect(extractPagingCookie(undefined)).toBeNull();
        expect(extractPagingCookie('<cookie pagenumber="2" istracking="False" />')).toBeNull();
        expect(extractPagingCookie("not xml")).toBeNull();
    });
});
