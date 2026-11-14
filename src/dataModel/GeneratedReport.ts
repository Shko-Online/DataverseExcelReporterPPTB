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

/** Number of generated reports kept in memory, newest first. */
export const MAX_RECENT_REPORTS = 5;

/**
 * A report generated during this session. Its content stays in memory until the tool is closed
 * or the user removes it from the list, so it can be saved again without regenerating it.
 */
export interface GeneratedReport {
    id: string;
    fileName: string;
    content: Uint8Array;
    recordCount: number;
    tableName: string;
    templateName: string;
    viewName: string;
    generatedOn: Date;
    /** Where the report was last saved, or null while it has never been saved. */
    savedPath: string | null;
}

/** Adds a report at the top of the list, forgetting the oldest ones beyond {@link MAX_RECENT_REPORTS}. */
export const addRecentReport = (reports: GeneratedReport[], report: GeneratedReport, max = MAX_RECENT_REPORTS): GeneratedReport[] =>
    [report, ...reports.filter((existing) => existing.id !== report.id)].slice(0, max);

export const removeRecentReport = (reports: GeneratedReport[], id: string): GeneratedReport[] => reports.filter((report) => report.id !== id);

export const setReportSavedPath = (reports: GeneratedReport[], id: string, savedPath: string): GeneratedReport[] =>
    reports.map((report) => (report.id === id ? { ...report, savedPath } : report));

/** "1.2 MB", "850 KB". */
export const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

let nextId = 0;
export const createReportId = () => `report-${Date.now().toString(36)}-${(nextId++).toString(36)}`;
