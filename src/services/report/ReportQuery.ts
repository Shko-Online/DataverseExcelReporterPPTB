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

import { XAttribute, XDocument, XElement } from "openxmlsdkts";
import type { ClientData } from "../../dataModel/ClientData";

/** Logical name used by Dataverse templates for the "(Do Not Modify) Row Checksum" column. */
export const CHECKSUM_LOGICAL_NAME = "checksumLogicalName";

/** The subset of a many-to-one relationship's metadata needed to build a link-entity. */
export interface ManyToOneRelationship {
    MetadataId: string;
    SchemaName: string;
    ReferencedEntity: string;
    ReferencedAttribute: string;
    ReferencingAttribute: string;
}

/** A template column whose value comes from a related table (`<relationshipId>.<attribute>`). */
export interface RelatedColumnReference {
    relationshipId: string;
    attribute: string;
}

export const parseRelatedColumn = (logicalName: string): RelatedColumnReference | null => {
    const separator = logicalName.indexOf(".");
    if (separator < 0) {
        return null;
    }
    return {
        relationshipId: logicalName.substring(0, separator).toLowerCase(),
        attribute: logicalName.substring(separator + 1),
    };
};

/** Relationship ids (lower-case) referenced by the template's related columns. */
export const getReferencedRelationshipIds = (clientData: ClientData): string[] => {
    const ids = new Set<string>();
    for (const column of Object.values(clientData.Columns)) {
        const related = column.LogicalName ? parseRelatedColumn(column.LogicalName) : null;
        if (related) {
            ids.add(related.relationshipId);
        }
    }
    return [...ids];
};

const normalizeGuid = (id: string) => id.replace(/[{}]/g, "").toLowerCase();

/**
 * The view's FetchXML rewritten to return exactly the columns used by the template, with paging support.
 */
export class ReportQuery {
    private readonly fetch: XDocument;
    /** Relationship id → link-entity alias. */
    public readonly relationshipAliases = new Map<string, string>();
    /** Relationship id → referenced (related) table logical name. */
    public readonly relationshipTables = new Map<string, string>();
    /** Logical name of the root table of the query. */
    public readonly tableLogicalName: string;
    /** Maximum number of rows to return, when the view defines a `top`. */
    public readonly top: number | null;

    /**
     * @param viewFetchXml The FetchXML of the selected view.
     * @param clientData The template's column definitions.
     * @param relationships Many-to-one relationships of the root table, used to resolve related columns.
     */
    constructor(viewFetchXml: string, clientData: ClientData, relationships: ManyToOneRelationship[]) {
        this.fetch = XDocument.parse(viewFetchXml);
        const fetchElement = this.fetch.root!;
        const entityElement = fetchElement.element("entity");
        if (!entityElement) {
            throw new Error("The view FetchXML does not contain an entity element.");
        }
        this.tableLogicalName = entityElement.attribute("name")?.value ?? "";

        // `top` can't be combined with paging: emulate it by stopping once enough rows have been read.
        const top = fetchElement.attribute("top")?.value;
        this.top = top ? parseInt(top, 10) : null;
        fetchElement.setAttributeValue("top", null);

        // Remove the view's own columns: the template decides what to retrieve.
        entityElement.elements("attribute").forEach((attribute) => attribute.remove());
        entityElement.elements("all-attributes").forEach((attribute) => attribute.remove());

        const relationshipsById = new Map(relationships.map((relationship) => [normalizeGuid(relationship.MetadataId), relationship]));
        const addedAttributes = new Set<string>();

        for (const column of Object.values(clientData.Columns)) {
            const logicalName = column.LogicalName;
            if (!logicalName || logicalName === CHECKSUM_LOGICAL_NAME) {
                continue;
            }

            const related = parseRelatedColumn(logicalName);
            if (!related) {
                if (!addedAttributes.has(logicalName)) {
                    entityElement.add(new XElement("attribute", new XAttribute("name", logicalName)));
                    addedAttributes.add(logicalName);
                }
                continue;
            }

            const relationship = relationshipsById.get(related.relationshipId);
            if (!relationship) {
                // The relationship no longer exists (or is not many-to-one): the column will stay empty.
                continue;
            }

            const linkEntity = this.getOrCreateLinkEntity(entityElement, relationship, related.relationshipId);
            const alias = linkEntity.attribute("alias")!.value;
            this.relationshipAliases.set(related.relationshipId, alias);
            this.relationshipTables.set(related.relationshipId, relationship.ReferencedEntity);
            const hasAttribute = linkEntity.elements("attribute").some((attribute) => attribute.attribute("name")?.value === related.attribute && !attribute.attribute("alias"));
            if (!hasAttribute) {
                linkEntity.add(new XElement("attribute", new XAttribute("name", related.attribute)));
            }
        }
    }

    /**
     * Returns the FetchXML for the given page.
     * @param page 1-based page number.
     * @param pageSize Number of records per page (1 - 5000).
     * @param pagingCookie The (decoded) paging cookie returned by the previous page, if any.
     */
    public toFetchXml(page: number, pageSize: number, pagingCookie?: string | null): string {
        const fetchElement = this.fetch.root!;
        fetchElement.setAttributeValue("count", String(pageSize));
        fetchElement.setAttributeValue("page", String(page));
        fetchElement.setAttributeValue("paging-cookie", pagingCookie ?? null);
        return fetchElement.toString();
    }

    private getOrCreateLinkEntity(entityElement: XElement, relationship: ManyToOneRelationship, relationshipId: string): XElement {
        let linkEntity = entityElement
            .elements("link-entity")
            .find(
                (element) =>
                    element.attribute("name")?.value === relationship.ReferencedEntity &&
                    element.attribute("from")?.value === relationship.ReferencedAttribute &&
                    element.attribute("to")?.value === relationship.ReferencingAttribute,
            );

        const defaultAlias = relationship.ReferencedEntity + "_" + relationshipId.replace(/-/g, "_");
        if (!linkEntity) {
            linkEntity = new XElement(
                "link-entity",
                new XAttribute("name", relationship.ReferencedEntity),
                new XAttribute("from", relationship.ReferencedAttribute),
                new XAttribute("to", relationship.ReferencingAttribute),
                new XAttribute("link-type", "outer"),
                new XAttribute("alias", defaultAlias),
            );
            entityElement.add(linkEntity);
        }
        if (!linkEntity.attribute("alias")) {
            linkEntity.setAttributeValue("alias", defaultAlias);
        }
        return linkEntity;
    }
}

/**
 * Extracts the paging cookie to send with the next page request from the
 * `@Microsoft.Dynamics.CRM.fetchxmlpagingcookie` annotation of a Web API FetchXML response.
 *
 * The annotation looks like `<cookie pagenumber="2" pagingcookie="%253ccookie..." istracking="False" />`,
 * where `pagingcookie` is URL-encoded twice.
 */
export const extractPagingCookie = (annotation: string | undefined | null): string | null => {
    if (!annotation) {
        return null;
    }
    try {
        const cookie = XElement.parse(annotation);
        const encoded = cookie.attribute("pagingcookie")?.value;
        if (!encoded) {
            return null;
        }
        return decodeURIComponent(decodeURIComponent(encoded));
    } catch {
        return null;
    }
};
