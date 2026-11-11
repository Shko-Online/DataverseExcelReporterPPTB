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
import { columnLettersToNumber, columnNumberToLetters, formatCellRange, parseCellRange, parseCellReference } from "./cellReference";

describe("cellReference", () => {
    it.each([
        ["A", 1],
        ["Z", 26],
        ["AA", 27],
        ["AZ", 52],
        ["BA", 53],
        ["ZZ", 702],
        ["AAA", 703],
        ["XFD", 16384],
    ])("converts %s <-> %i", (letters, column) => {
        expect(columnLettersToNumber(letters)).toBe(column);
        expect(columnNumberToLetters(column)).toBe(letters);
    });

    it("parses references with and without row numbers", () => {
        expect(parseCellReference("K2")).toEqual({ column: 11, row: 2 });
        expect(parseCellReference("$B$10")).toEqual({ column: 2, row: 10 });
        expect(parseCellReference("C")).toEqual({ column: 3, row: null });
        expect(() => parseCellReference("1A")).toThrow();
    });

    it("parses and formats ranges", () => {
        const range = parseCellRange("A1:K2");
        expect(range).toEqual({ start: { column: 1, row: 1 }, end: { column: 11, row: 2 } });
        expect(formatCellRange({ start: { column: 1, row: 1 }, end: { column: 11, row: 500 } })).toBe("A1:K500");
    });
});
