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

import { useContext, useState } from "react";
import type { FC } from "react";
import { Badge, Body1Strong, Button, Caption1, Card, Subtitle2 } from "@fluentui/react-components";
import { Copy20Regular, Delete20Regular, DocumentTable24Regular, History20Regular, Save20Regular, SaveCopy20Regular } from "@fluentui/react-icons";
import { ApplicationDataContext } from "../context/ApplicationDataContext";
import { MAX_RECENT_REPORTS, formatFileSize } from "../dataModel/GeneratedReport";
import type { GeneratedReport } from "../dataModel/GeneratedReport";
import useRecentReportsStyles from "./RecentReports.styles";

const formatTime = (date: Date) => date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const RecentReport: FC<{ report: GeneratedReport }> = ({ report }) => {
    const styles = useRecentReportsStyles();
    const { saveGeneratedReport, copyGeneratedReportPath, removeGeneratedReport } = useContext(ApplicationDataContext);
    const [isSaving, setIsSaving] = useState(false);
    const saved = report.savedPath !== null;

    const save = async () => {
        setIsSaving(true);
        try {
            await saveGeneratedReport(report.id);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <li className={styles.item}>
            <DocumentTable24Regular className={styles.icon} />
            <div className={styles.details}>
                <div className={styles.titleRow}>
                    <Body1Strong className={styles.fileName} title={report.fileName}>
                        {report.fileName}
                    </Body1Strong>
                    <Badge className={styles.badge} appearance="tint" color={saved ? "success" : "warning"}>
                        {saved ? "Saved" : "Not saved"}
                    </Badge>
                </div>
                <Caption1 className={styles.meta} title={`${report.templateName} · ${report.viewName}`}>
                    {report.recordCount.toLocaleString()} records · {report.tableName} · {report.templateName} · {report.viewName}
                </Caption1>
                <Caption1 className={styles.meta} title={report.savedPath ?? undefined}>
                    Generated at {formatTime(report.generatedOn)} · {formatFileSize(report.content.byteLength)}
                    {report.savedPath ? ` · ${report.savedPath}` : " · not saved to disk yet"}
                </Caption1>
            </div>
            <div className={styles.actions}>
                <Button appearance={saved ? "secondary" : "primary"} icon={saved ? <SaveCopy20Regular /> : <Save20Regular />} disabled={isSaving} onClick={save}>
                    {saved ? "Save a copy" : "Save"}
                </Button>
                {/* Native titles instead of Fluent tooltips: the ToolBox renders the tool in an iframe, where portaled popups misbehave. */}
                {saved && (
                    <Button
                        appearance="subtle"
                        icon={<Copy20Regular />}
                        aria-label="Copy the file path"
                        title="Copy the file path"
                        onClick={() => copyGeneratedReportPath(report.id)}
                    />
                )}
                <Button
                    appearance="subtle"
                    icon={<Delete20Regular />}
                    aria-label="Remove from the list"
                    title="Remove from the list (the saved file is not deleted)"
                    disabled={isSaving}
                    onClick={() => removeGeneratedReport(report.id)}
                />
            </div>
        </li>
    );
};

/** The reports generated during this session, kept in memory so they can be saved again. */
export const RecentReports: FC = () => {
    const styles = useRecentReportsStyles();
    const { generatedReports, clearGeneratedReports } = useContext(ApplicationDataContext);

    if (generatedReports.length === 0) {
        return null;
    }

    return (
        <Card className={styles.card} aria-label="Recent reports">
            <div className={styles.header}>
                <History20Regular />
                <div className={styles.headerText}>
                    <Subtitle2>Recent reports</Subtitle2>
                    <Caption1 className={styles.caption}>
                        The last {MAX_RECENT_REPORTS} reports generated in this session stay available until you close the tool or remove them.
                    </Caption1>
                </div>
                <Button appearance="subtle" onClick={clearGeneratedReports}>
                    Clear list
                </Button>
            </div>
            <ul className={styles.list}>
                {generatedReports.map((report) => (
                    <RecentReport key={report.id} report={report} />
                ))}
            </ul>
        </Card>
    );
};
