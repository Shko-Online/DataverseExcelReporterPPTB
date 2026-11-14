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
import { MAX_RECENT_REPORTS, addRecentReport, createReportId, formatFileSize, removeRecentReport, setReportSavedPath } from "./GeneratedReport";
import type { GeneratedReport } from "./GeneratedReport";

const report = (id: string): GeneratedReport => ({
    id,
    fileName: `Report_${id}.xlsx`,
    content: new Uint8Array(10),
    recordCount: 1,
    tableName: "Account",
    templateName: "Template",
    viewName: "View",
    generatedOn: new Date(),
    savedPath: null,
});

describe("recent reports", () => {
    it("keeps the newest reports first and forgets the oldest beyond the limit", () => {
        let reports: GeneratedReport[] = [];
        for (let i = 1; i <= MAX_RECENT_REPORTS + 2; i++) {
            reports = addRecentReport(reports, report(String(i)));
        }
        expect(MAX_RECENT_REPORTS).toBe(5);
        expect(reports.map((r) => r.id)).toEqual(["7", "6", "5", "4", "3"]);
    });

    it("removes a report and records where it was saved", () => {
        let reports = [report("a"), report("b"), report("c")];
        reports = removeRecentReport(reports, "b");
        expect(reports.map((r) => r.id)).toEqual(["a", "c"]);
        const before = reports;
        reports = setReportSavedPath(reports, "c", "C:\\Reports\\c.xlsx");
        expect(reports[1].savedPath).toBe("C:\\Reports\\c.xlsx");
        expect(before[1].savedPath).toBeNull();
        // The bytes are kept, not copied.
        expect(reports[1].content).toBe(before[1].content);
    });

    it("creates unique ids and formats sizes", () => {
        expect(createReportId()).not.toBe(createReportId());
        expect(formatFileSize(500)).toBe("1 KB");
        expect(formatFileSize(850 * 1024)).toBe("850 KB");
        expect(formatFileSize(1.25 * 1024 * 1024)).toBe("1.3 MB");
    });
});
