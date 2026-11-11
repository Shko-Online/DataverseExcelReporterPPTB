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

import { ContentType, RelationshipType, S, SmlPackage, XAttribute, XDocument, XElement, XName, XNamespace } from "openxmlsdkts";
import type { SmlPart } from "openxmlsdkts";
import { formatCellRange, formatCellReference, parseCellRange, parseCellReference } from "./cellReference";

/**
 * SpreadsheetML element names used by the report generator.
 * Built from the namespace directly because not every name is pre-initialized by openxmlsdkts (e.g. `is`).
 */
const SML = {
    c: S.namespace.getName("c"),
    calcPr: S.namespace.getName("calcPr"),
    cellXfs: S.namespace.getName("cellXfs"),
    col: S.namespace.getName("col"),
    cols: S.namespace.getName("cols"),
    dimension: S.namespace.getName("dimension"),
    is: S.namespace.getName("is"),
    numFmt: S.namespace.getName("numFmt"),
    numFmts: S.namespace.getName("numFmts"),
    row: S.namespace.getName("row"),
    sheetData: S.namespace.getName("sheetData"),
    styleSheet: S.namespace.getName("styleSheet"),
    t: S.namespace.getName("t"),
    v: S.namespace.getName("v"),
    xf: S.namespace.getName("xf"),
    autoFilter: S.namespace.getName("autoFilter"),
};

/** Workbook children that must precede `calcPr` (ECMA-376 CT_Workbook sequence). */
const WORKBOOK_ELEMENTS_BEFORE_CALC_PR = ["fileVersion", "fileSharing", "workbookPr", "workbookProtection", "bookViews", "sheets", "functionGroups", "externalReferences", "definedNames"].map((name) =>
    S.namespace.getName(name),
);

/** Stylesheet children that must precede `cellXfs` (ECMA-376 CT_Stylesheet sequence). */
const STYLESHEET_ELEMENTS_BEFORE_CELL_XFS = ["numFmts", "fonts", "fills", "borders", "cellStyleXfs"].map((name) => S.namespace.getName(name));

const XML_SPACE = XNamespace.xml.getName("space");

/** Excel refuses cells longer than this. */
const MAX_CELL_TEXT_LENGTH = 32767;

/** Characters that are not allowed in XML 1.0 documents. */
// eslint-disable-next-line no-control-regex
const INVALID_XML_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Days between 1899-12-30 (Excel's serial date origin) and the Unix epoch. */
const EXCEL_EPOCH_OFFSET_DAYS = 25569;
const MILLISECONDS_PER_DAY = 86400000;

export type CellContent = { type: "string"; value: string } | { type: "number"; value: number } | { type: "date"; value: Date } | { type: "empty" };

export interface CellWrite {
    /** 1-based column number. */
    column: number;
    content: CellContent;
    /** Style index (`s` attribute) to apply. When omitted the existing cell style or the column default style is kept. */
    style?: number;
}

/** Converts a JavaScript date to an Excel serial date number (UTC based). */
export const toExcelSerialDate = (date: Date): number => date.getTime() / MILLISECONDS_PER_DAY + EXCEL_EPOCH_OFFSET_DAYS;

export const sanitizeCellText = (text: string): string => {
    const sanitized = text.replace(INVALID_XML_CHARACTERS, "");
    return sanitized.length > MAX_CELL_TEXT_LENGTH ? sanitized.substring(0, MAX_CELL_TEXT_LENGTH) : sanitized;
};

const getAttribute = (element: XElement, name: string): string | null => element.attribute(name)?.value ?? null;

const isElement = (node: unknown, name?: XName): node is XElement => node instanceof XElement && (name === undefined || node.name === name);

/**
 * Inserts `element` as a child of `parent`, after the last existing child whose name is in `predecessors`
 * (or as the first child when none exist). Keeps schema element ordering valid.
 */
const insertInSequence = (parent: XElement, element: XElement, predecessors: XName[]) => {
    const children = parent.elements();
    let anchor: XElement | null = null;
    for (const child of children) {
        if (predecessors.includes(child.name)) {
            anchor = child;
        }
    }
    if (anchor) {
        anchor.addAfterSelf(element);
    } else {
        parent.addFirst(element);
    }
};

/**
 * Writes the content of a cell element, replacing whatever value/formula it previously held.
 */
const writeCellContent = (cell: XElement, content: CellContent) => {
    cell.removeNodes();
    cell.setAttributeValue("t", null);
    switch (content.type) {
        case "empty":
            return;
        case "number":
            if (!Number.isFinite(content.value)) {
                writeCellContent(cell, { type: "string", value: String(content.value) });
                return;
            }
            cell.add(new XElement(SML.v, String(content.value)));
            return;
        case "date":
            if (Number.isNaN(content.value.getTime())) {
                return;
            }
            cell.add(new XElement(SML.v, String(toExcelSerialDate(content.value))));
            return;
        case "string": {
            const text = sanitizeCellText(content.value);
            const textElement = new XElement(SML.t, text);
            if (text.length > 0 && (text.trim().length !== text.length || /[\n\r\t]/.test(text))) {
                textElement.add(new XAttribute(XML_SPACE, "preserve"));
            }
            cell.setAttributeValue("t", "inlineStr");
            cell.add(new XElement(SML.is, textElement));
            return;
        }
    }
};

/**
 * Wraps an Excel table (ListObject) inside a worksheet and allows appending data rows below its header.
 *
 * Rows that do not exist yet in the template are accumulated in memory and merged into `sheetData`
 * once in {@link ExcelTableWriter.commit}, because inserting nodes one by one is O(n) per insert.
 */
export class ExcelTableWriter {
    private readonly existingRows = new Map<number, XElement>();
    private readonly newRows = new Map<number, XElement>();
    private readonly columnStyles = new Map<number, number | undefined>();
    private readonly colElements: XElement[];
    private readonly sheetData: XElement;
    private lastWrittenRow = 0;

    /** Row number of the table header. */
    public readonly headerRow: number;
    /** First (left-most) column of the table, 1-based. */
    public readonly firstColumn: number;
    /** Last (right-most) column of the table, 1-based. */
    public readonly lastColumn: number;

    constructor(
        private readonly worksheetPart: SmlPart,
        private readonly worksheet: XDocument,
        private readonly tablePart: SmlPart,
        private readonly table: XDocument,
    ) {
        const reference = getAttribute(this.table.root!, "ref");
        if (!reference) {
            throw new Error(`Table '${this.name}' does not define a cell range.`);
        }
        const range = parseCellRange(reference);
        this.headerRow = range.start.row ?? 1;
        this.firstColumn = range.start.column;
        this.lastColumn = range.end.column;

        let sheetData = this.worksheet.root!.element(SML.sheetData);
        if (!sheetData) {
            sheetData = new XElement(SML.sheetData);
            this.worksheet.root!.add(sheetData);
        }
        this.sheetData = sheetData;

        let previousRowIndex = 0;
        for (const row of this.sheetData.elements(SML.row)) {
            const rowReference = getAttribute(row, "r");
            const rowIndex = rowReference ? parseInt(rowReference, 10) : previousRowIndex + 1;
            this.existingRows.set(rowIndex, row);
            previousRowIndex = rowIndex;
        }

        this.colElements = this.worksheet.root!.element(SML.cols)?.elements(SML.col) ?? [];
    }

    public get name(): string {
        return getAttribute(this.table.root!, "name") ?? getAttribute(this.table.root!, "displayName") ?? "";
    }

    /** The first row available for data. */
    public get firstDataRow(): number {
        return this.headerRow + 1;
    }

    /**
     * Writes the given cells to the row `rowIndex`. Cells that already exist in the template are overwritten.
     */
    public writeRow(rowIndex: number, cells: CellWrite[]) {
        const existing = this.existingRows.get(rowIndex) ?? this.newRows.get(rowIndex);
        if (existing) {
            this.updateExistingRow(existing, rowIndex, cells);
        } else {
            const row = new XElement(SML.row, new XAttribute("r", String(rowIndex)));
            const sortedCells = [...cells].sort((a, b) => a.column - b.column);
            for (const cellWrite of sortedCells) {
                if (cellWrite.content.type === "empty" && cellWrite.style === undefined) {
                    continue;
                }
                row.add(this.createCell(rowIndex, cellWrite));
            }
            this.newRows.set(rowIndex, row);
        }
        this.lastWrittenRow = Math.max(this.lastWrittenRow, rowIndex);
    }

    /**
     * Merges the new rows into the worksheet and resizes the table (and its auto-filter) to cover the
     * header plus all data rows. At least one data row is always kept so that the table stays valid.
     */
    public commit() {
        if (this.newRows.size > 0) {
            const nodes = this.sheetData.nodes();
            const rows = [...this.existingRows.entries(), ...this.newRows.entries()].sort(([a], [b]) => a - b).map(([, row]) => row);
            const otherNodes = nodes.filter((node) => !isElement(node, SML.row));
            this.sheetData.replaceNodes(rows, otherNodes);
            this.newRows.forEach((row, rowIndex) => this.existingRows.set(rowIndex, row));
            this.newRows.clear();
        }

        const lastRow = Math.max(this.lastWrittenRow, this.firstDataRow);
        const tableRange = formatCellRange({
            start: { column: this.firstColumn, row: this.headerRow },
            end: { column: this.lastColumn, row: lastRow },
        });
        this.table.root!.setAttributeValue("ref", tableRange);
        const autoFilter = this.table.root!.element(SML.autoFilter);
        if (autoFilter) {
            autoFilter.setAttributeValue("ref", tableRange);
        }

        this.updateDimension(lastRow);

        this.worksheetPart.putXDocument(this.worksheet);
        this.tablePart.putXDocument(this.table);
    }

    private updateDimension(lastRow: number) {
        const dimension = this.worksheet.root!.element(SML.dimension);
        const reference = dimension ? getAttribute(dimension, "ref") : null;
        if (!dimension || !reference) {
            return;
        }
        const range = parseCellRange(reference);
        dimension.setAttributeValue(
            "ref",
            formatCellRange({
                start: {
                    column: Math.min(range.start.column, this.firstColumn),
                    row: Math.min(range.start.row ?? 1, this.headerRow),
                },
                end: {
                    column: Math.max(range.end.column, this.lastColumn),
                    row: Math.max(range.end.row ?? 1, lastRow),
                },
            }),
        );
    }

    private updateExistingRow(row: XElement, rowIndex: number, cells: CellWrite[]) {
        const cellsByColumn = new Map<number, XElement>();
        let previousColumn = 0;
        for (const cell of row.elements(SML.c)) {
            const reference = getAttribute(cell, "r");
            const column = reference ? parseCellReference(reference).column : previousColumn + 1;
            if (!reference) {
                cell.setAttributeValue("r", formatCellReference(column, rowIndex));
            }
            cellsByColumn.set(column, cell);
            previousColumn = column;
        }

        for (const cellWrite of cells) {
            const cell = cellsByColumn.get(cellWrite.column);
            if (cell) {
                if (cellWrite.style !== undefined) {
                    cell.setAttributeValue("s", String(cellWrite.style));
                }
                writeCellContent(cell, cellWrite.content);
            } else {
                cellsByColumn.set(cellWrite.column, this.createCell(rowIndex, cellWrite));
            }
        }

        const sortedCells = [...cellsByColumn.entries()].sort(([a], [b]) => a - b).map(([, cell]) => cell);
        const otherNodes = row.nodes().filter((node) => !isElement(node, SML.c));
        row.replaceNodes(sortedCells, otherNodes);
    }

    private createCell(rowIndex: number, cellWrite: CellWrite): XElement {
        const cell = new XElement(SML.c, new XAttribute("r", formatCellReference(cellWrite.column, rowIndex)));
        const style = cellWrite.style ?? this.getColumnStyle(cellWrite.column);
        if (style !== undefined) {
            cell.setAttributeValue("s", String(style));
        }
        writeCellContent(cell, cellWrite.content);
        return cell;
    }

    /** Returns the default style of a column as defined in `<cols>`, so new cells look like the template. */
    private getColumnStyle(column: number): number | undefined {
        if (this.columnStyles.has(column)) {
            return this.columnStyles.get(column);
        }
        let style: number | undefined;
        for (const col of this.colElements) {
            const min = parseInt(getAttribute(col, "min") ?? "0", 10);
            const max = parseInt(getAttribute(col, "max") ?? "0", 10);
            const styleAttribute = getAttribute(col, "style");
            if (column >= min && column <= max && styleAttribute !== null) {
                style = parseInt(styleAttribute, 10);
                break;
            }
        }
        this.columnStyles.set(column, style);
        return style;
    }
}

/**
 * An Excel template (as stored in Dataverse `documenttemplate.content`) opened with openxmlsdkts.
 */
export class ExcelTemplate {
    private constructor(
        private readonly pkg: SmlPackage,
        private readonly workbookPart: SmlPart,
    ) {}

    /**
     * Opens a template from a Base64 string (the Dataverse `content` column), a Flat OPC string or a Blob.
     */
    public static async open(document: string | Blob): Promise<ExcelTemplate> {
        const pkg = await SmlPackage.open(document);
        const workbookPart = await pkg.workbookPart();
        if (!workbookPart) {
            throw new Error("The document template does not contain an Excel workbook.");
        }
        return new ExcelTemplate(pkg, workbookPart);
    }

    /** Sets `refreshOnLoad` on every pivot cache so pivot tables pick up the exported data when opened. */
    public async refreshPivotCachesOnLoad() {
        const pivotCacheParts = await this.workbookPart.getPartsByRelationshipType(RelationshipType.pivotTableCacheDefinition);
        for (const part of pivotCacheParts) {
            const document = await part.getXDocument();
            document.root?.setAttributeValue("refreshOnLoad", "1");
            part.putXDocument(document);
        }
    }

    /** Asks Excel to recalculate every formula when the workbook is opened. */
    public async forceFullCalculationOnLoad() {
        const document = await this.workbookPart.getXDocument();
        const workbook = document.root!;
        let calcPr = workbook.element(SML.calcPr);
        if (!calcPr) {
            calcPr = new XElement(SML.calcPr);
            insertInSequence(workbook, calcPr, WORKBOOK_ELEMENTS_BEFORE_CALC_PR);
        }
        calcPr.setAttributeValue("fullCalcOnLoad", "1");
        this.workbookPart.putXDocument(document);
    }

    /**
     * Adds a cell format using the given number format and returns its index in `cellXfs`
     * (the value to put in a cell's `s` attribute).
     */
    public async addNumberFormatStyle(formatCode: string): Promise<number> {
        const stylesPart = (await this.workbookPart.workbookStylesPart()) ?? (await this.createStylesPart());
        const document = await stylesPart.getXDocument();
        const styleSheet = document.root!;

        let numFmts = styleSheet.element(SML.numFmts);
        if (!numFmts) {
            numFmts = new XElement(SML.numFmts);
            styleSheet.addFirst(numFmts);
        }
        const existingFormatIds = numFmts.elements(SML.numFmt).map((numFmt) => parseInt(getAttribute(numFmt, "numFmtId") ?? "0", 10));
        // Custom number formats start at 164; lower ids are reserved for built-in formats.
        const numFmtId = Math.max(163, ...existingFormatIds) + 1;
        numFmts.add(new XElement(SML.numFmt, new XAttribute("numFmtId", String(numFmtId)), new XAttribute("formatCode", formatCode)));
        numFmts.setAttributeValue("count", String(numFmts.elements(SML.numFmt).length));

        let cellXfs = styleSheet.element(SML.cellXfs);
        if (!cellXfs) {
            cellXfs = new XElement(SML.cellXfs, new XElement(SML.xf, new XAttribute("numFmtId", "0")));
            insertInSequence(styleSheet, cellXfs, STYLESHEET_ELEMENTS_BEFORE_CELL_XFS);
        }
        cellXfs.add(new XElement(SML.xf, new XAttribute("numFmtId", String(numFmtId)), new XAttribute("applyNumberFormat", "1")));
        const xfCount = cellXfs.elements(SML.xf).length;
        cellXfs.setAttributeValue("count", String(xfCount));

        stylesPart.putXDocument(document);
        return xfCount - 1;
    }

    /** Finds an Excel table by name (Dataverse templates always use "Table1") and returns a writer for it. */
    public async findTable(name: string): Promise<ExcelTableWriter | null> {
        const worksheetParts = await this.workbookPart.worksheetParts();
        for (const worksheetPart of worksheetParts) {
            const tableParts = await worksheetPart.tableDefinitionParts();
            for (const tablePart of tableParts) {
                const table = await tablePart.getXDocument();
                if (table.root && getAttribute(table.root, "name") === name) {
                    const worksheet = await worksheetPart.getXDocument();
                    return new ExcelTableWriter(worksheetPart, worksheet, tablePart, table);
                }
            }
        }
        return null;
    }

    /** Serializes the workbook to the bytes of an .xlsx file. */
    public async save(): Promise<Uint8Array> {
        const blob = await this.pkg.saveToBlobAsync();
        return new Uint8Array(await blob.arrayBuffer());
    }

    private async createStylesPart(): Promise<SmlPart> {
        const styleSheet = new XDocument(
            new XElement(
                SML.styleSheet,
                new XAttribute(XNamespace.xmlns.getName("x"), S.namespace.uri),
                new XElement(SML.numFmts),
                new XElement(S.namespace.getName("fonts"), new XElement(S.namespace.getName("font"))),
                new XElement(S.namespace.getName("fills"), new XElement(S.namespace.getName("fill"))),
                new XElement(S.namespace.getName("borders"), new XElement(S.namespace.getName("border"))),
                new XElement(SML.cellXfs, new XElement(SML.xf, new XAttribute("numFmtId", "0"))),
            ),
        );
        const uri = "/xl/reportStyles.xml";
        this.pkg.addPart(uri, ContentType.workbookStyles, "xml", styleSheet);
        await this.workbookPart.addRelationship("reportStyles", RelationshipType.styles, uri);
        return (await this.workbookPart.workbookStylesPart())!;
    }
}
