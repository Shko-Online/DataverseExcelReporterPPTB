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
import { createReportProgress, formatRecordProgress, getOverallFraction, getRecordsFraction, isReportRunning } from "./ReportProgress";

describe("ReportProgress", () => {
    it("computes the records fraction only when the total is exact", () => {
        expect(getRecordsFraction({ ...createReportProgress("records"), exportedRecords: 50, totalRecords: 200 })).toBe(0.25);
        expect(getRecordsFraction({ ...createReportProgress("records"), exportedRecords: 50, totalRecords: 5000, totalIsLowerBound: true })).toBeNull();
        expect(getRecordsFraction({ ...createReportProgress("records"), exportedRecords: 50 })).toBeNull();
        expect(getRecordsFraction({ ...createReportProgress("workbook"), totalRecords: 0 })).toBe(1);
    });

    it("maps the phases to an overall fraction", () => {
        expect(getOverallFraction(createReportProgress("template"))).toBe(0);
        expect(getOverallFraction({ ...createReportProgress("records"), exportedRecords: 100, totalRecords: 100 })).toBeCloseTo(0.95);
        expect(getOverallFraction(createReportProgress("completed"))).toBe(1);
        expect(getOverallFraction(createReportProgress("cancelled"))).toBeNull();
    });

    it("formats the record counter", () => {
        expect(formatRecordProgress({ ...createReportProgress("records"), exportedRecords: 1200, totalRecords: 5000, totalIsLowerBound: true })).toBe(`${(1200).toLocaleString()} / ${(5000).toLocaleString()}+ records`);
        expect(formatRecordProgress({ ...createReportProgress("records"), exportedRecords: 3 })).toBe("3 records");
    });

    it("knows when the report is running", () => {
        expect(isReportRunning(null)).toBe(false);
        expect(isReportRunning(createReportProgress("saving"))).toBe(true);
        expect(isReportRunning(createReportProgress("failed"))).toBe(false);
    });
});
