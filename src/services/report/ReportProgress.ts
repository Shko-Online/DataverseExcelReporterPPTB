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

/** Dataverse stops counting the total number of records of a FetchXML query at this value. */
export const TOTAL_RECORD_COUNT_LIMIT = 5000;

export type ReportPhase =
    /** Downloading the Excel template. */
    | "template"
    /** Reading the table and relationship metadata. */
    | "metadata"
    /** Retrieving the records page by page. */
    | "records"
    /** Writing the rows and packaging the .xlsx file. */
    | "workbook"
    /** Waiting for the user to save the file. */
    | "saving"
    | "completed"
    | "cancelled"
    | "failed";

export interface ReportProgress {
    phase: ReportPhase;
    /** Number of records retrieved and written so far. */
    exportedRecords: number;
    /** Number of pages (batches) retrieved so far. */
    pagesRetrieved: number;
    /**
     * Total number of records the report will contain, when known.
     * When {@link totalIsLowerBound} is true the view returns at least this many records.
     */
    totalRecords: number | null;
    /** True when Dataverse only reported that there are more than {@link TOTAL_RECORD_COUNT_LIMIT} records. */
    totalIsLowerBound: boolean;
}

export const createReportProgress = (phase: ReportPhase = "template"): ReportProgress => ({
    phase,
    exportedRecords: 0,
    pagesRetrieved: 0,
    totalRecords: null,
    totalIsLowerBound: false,
});

/** True while the report is still being produced (including the save dialog). */
export const isReportRunning = (progress: ReportProgress | null) =>
    progress !== null && progress.phase !== "completed" && progress.phase !== "cancelled" && progress.phase !== "failed";

const PHASE_LABELS: Record<ReportPhase, string> = {
    template: "Downloading the template",
    metadata: "Reading metadata",
    records: "Exporting records",
    workbook: "Building the workbook",
    saving: "Saving the report",
    completed: "Report ready",
    cancelled: "Report cancelled",
    failed: "Report failed",
};

export const getPhaseLabel = (phase: ReportPhase) => PHASE_LABELS[phase];

/** "1,234 / 5,000+ records", "1,234 / 2,000 records" or "1,234 records". */
export const formatRecordProgress = (progress: ReportProgress) => {
    const exported = progress.exportedRecords.toLocaleString();
    if (progress.totalRecords === null) {
        return `${exported} records`;
    }
    return `${exported} / ${progress.totalRecords.toLocaleString()}${progress.totalIsLowerBound ? "+" : ""} records`;
};

/**
 * Fraction (0 - 1) of the records that have been exported, or null when the total is not known
 * (or only known to be above the count limit).
 */
export const getRecordsFraction = (progress: ReportProgress): number | null => {
    if (progress.totalRecords === null || progress.totalIsLowerBound) {
        return null;
    }
    if (progress.totalRecords === 0) {
        return progress.phase === "records" ? 0 : 1;
    }
    return Math.min(1, progress.exportedRecords / progress.totalRecords);
};

/**
 * Overall completion (0 - 1) of the report, or null when it can't be estimated
 * (records are being exported and their total is unknown).
 */
export const getOverallFraction = (progress: ReportProgress): number | null => {
    switch (progress.phase) {
        case "template":
            return 0;
        case "metadata":
            return 0.03;
        case "records": {
            const records = getRecordsFraction(progress);
            return records === null ? null : 0.05 + records * 0.9;
        }
        case "workbook":
            return 0.96;
        case "saving":
            return 0.99;
        case "completed":
            return 1;
        case "cancelled":
        case "failed":
            return null;
    }
};
