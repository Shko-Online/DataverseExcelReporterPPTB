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

export interface CellPosition {
    /** 1-based column number (A = 1). */
    column: number;
    /** 1-based row number, or `null` when the reference has no row part (e.g. "A"). */
    row: number | null;
}

export interface CellRange {
    start: CellPosition;
    end: CellPosition;
}

const CELL_REFERENCE = /^\$?([A-Za-z]+)\$?(\d*)$/;

/** Converts column letters to a 1-based column number ("A" → 1, "AA" → 27). */
export const columnLettersToNumber = (letters: string): number => {
    let column = 0;
    const upper = letters.toUpperCase();
    for (let i = 0; i < upper.length; i++) {
        column = column * 26 + (upper.charCodeAt(i) - 64);
    }
    return column;
};

/** Converts a 1-based column number to column letters (1 → "A", 27 → "AA"). */
export const columnNumberToLetters = (column: number): string => {
    let letters = "";
    let remaining = column;
    while (remaining > 0) {
        const modulo = (remaining - 1) % 26;
        letters = String.fromCharCode(65 + modulo) + letters;
        remaining = (remaining - modulo - 1) / 26;
    }
    return letters;
};

export const parseCellReference = (reference: string): CellPosition => {
    const match = CELL_REFERENCE.exec(reference.trim());
    if (!match) {
        throw new Error(`Invalid cell reference '${reference}'.`);
    }
    return {
        column: columnLettersToNumber(match[1]),
        row: match[2] ? parseInt(match[2], 10) : null,
    };
};

export const parseCellRange = (range: string): CellRange => {
    const [start, end] = range.split(":");
    const startPosition = parseCellReference(start);
    return {
        start: startPosition,
        end: end ? parseCellReference(end) : startPosition,
    };
};

export const formatCellReference = (column: number, row: number): string => `${columnNumberToLetters(column)}${row}`;

export const formatCellRange = (range: { start: { column: number; row: number }; end: { column: number; row: number } }): string =>
    `${formatCellReference(range.start.column, range.start.row)}:${formatCellReference(range.end.column, range.end.row)}`;
