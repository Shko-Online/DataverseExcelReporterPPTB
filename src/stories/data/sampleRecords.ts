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

const FORMATTED = '@OData.Community.Display.V1.FormattedValue';

const PRIMARY_CONTACT_RELATIONSHIP = '7befeabe-bf01-4207-97f8-7a96e05d2332';
const OWNING_TEAM_RELATIONSHIP = 'e30f4437-868d-4e5b-bef4-37efacebb2fd';

/** Related tables whose columns appear in {@link sampleRecords} as `<table>.<attribute>`. */
const RELATED_TABLES = ['contact', 'team'];

const cities =['Tirana', 'Durrës', 'Vlorë', 'Shkodër', 'Milano', 'Seattle'];

const guid = (prefix: string, index: number) => `${prefix}0000000-0000-0000-0000-${String(index).padStart(12, '0')}`;

/**
 * Sample Web API FetchXML results (with annotations), keyed by table.
 * Attributes of related tables are keyed `<related table>.<attribute>`; see {@link applyLinkEntityAliases}.
 */
export const sampleRecords: Record<string, Record<string, unknown>[]> = {
    account: Array.from({ length: 237 }, (_, i) => {
        const index = i + 1;
        const modifiedOn = new Date(Date.UTC(2026, 4, 1 + (i % 28), 8 + (i % 10), i % 60));
        // Related values are keyed by table name: the mock replaces it with the link-entity alias of the query.
        const contact = 'contact';
        const team = 'team';
        return {
            '@odata.etag': `W/"${100000 + index}"`,
            accountid: guid('a', index),
            modifiedon: modifiedOn.toISOString(),
            [`modifiedon${FORMATTED}`]: modifiedOn.toLocaleString(),
            name: `Sample Account ${index}`,
            telephone1: index % 7 === 0 ? null : `+355 69 ${String(1000000 + index).substring(1)}`,
            address1_city: cities[i % cities.length],
            _primarycontactid_value: guid('c', index),
            [`_primarycontactid_value${FORMATTED}`]: `Contact ${index}`,
            [`${contact}.emailaddress1`]: `contact${index}@example.com`,
            [`${team}.emailaddress`]: 'team@example.com',
            [`${team}.administratorid`]: guid('b', 1),
            [`${team}.administratorid${FORMATTED}`]: 'Betim Beja',
            [`${team}.name`]: 'Shko Online',
            statecode: 0,
            [`statecode${FORMATTED}`]: 'Active',
        };
    }),
};

export const sampleAttributes: Record<string, [string, string][]> = {
    account: [
        ['accountid', 'Uniqueidentifier'],
        ['modifiedon', 'DateTime'],
        ['name', 'String'],
        ['telephone1', 'String'],
        ['address1_city', 'String'],
        ['primarycontactid', 'Lookup'],
        ['statecode', 'State'],
    ],
    contact: [['emailaddress1', 'String']],
    team: [
        ['emailaddress', 'String'],
        ['administratorid', 'Lookup'],
        ['name', 'String'],
    ],
};

export const sampleRelationships: Record<string, Record<string, string>[]> = {
    account: [
        {
            MetadataId: PRIMARY_CONTACT_RELATIONSHIP,
            SchemaName: 'account_primary_contact',
            ReferencedEntity: 'contact',
            ReferencedAttribute: 'contactid',
            ReferencingAttribute: 'primarycontactid',
        },
        {
            MetadataId: OWNING_TEAM_RELATIONSHIP,
            SchemaName: 'team_accounts',
            ReferencedEntity: 'team',
            ReferencedAttribute: 'teamid',
            ReferencingAttribute: 'owningteam',
        },
    ],
};

/**
 * Renames `<related table>.<attribute>` keys to `<alias>.<attribute>` using the link-entities of the query,
 * the way the Web API returns attributes of linked tables.
 */
export const applyLinkEntityAliases = (records: Record<string, unknown>[], entityNode: Element) => {
    const aliases = new Map<string, string>();
    entityNode.querySelectorAll(':scope > link-entity').forEach(linkEntity => {
        const name = linkEntity.getAttribute('name');
        const alias = linkEntity.getAttribute('alias');
        if (name && alias) {
            aliases.set(name, alias);
        }
    });
    return records.map(record =>
        Object.fromEntries(
            Object.entries(record).flatMap(([key, value]) => {
                const separator = key.indexOf('.');
                const relatedTable = separator > 0 ? key.substring(0, separator) : '';
                if (!RELATED_TABLES.includes(relatedTable)) {
                    return [[key, value]];
                }
                const alias = aliases.get(relatedTable);
                // Columns of tables that are not linked in the query are not returned.
                return alias ? [[alias + key.substring(separator), value]] : [];
            }),
        ),
    );
};
