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

import { makeStyles, tokens } from '@fluentui/react-components';

const useConnectionDetailsPopupStyles = makeStyles({
    overlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: tokens.spacingVerticalL,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    popup: {
        width: 'min(560px, 100%)',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: tokens.colorNeutralBackground1,
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        borderRadius: tokens.borderRadiusMedium,
        boxShadow: tokens.shadow64,
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: tokens.spacingHorizontalM,
        padding: tokens.spacingVerticalM,
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    title: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        minWidth: 0,
    },
    connectedIcon: {
        color: tokens.colorPaletteGreenForeground2,
        flexShrink: 0,
    },
    warningIcon: {
        color: tokens.colorPaletteYellowForeground2,
        flexShrink: 0,
    },
    body: {
        padding: tokens.spacingVerticalM,
        overflow: 'auto',
        minWidth: 0,
    },
    fields: {
        width: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
    },
    fieldName: {
        width: '30%',
        padding: tokens.spacingVerticalXS,
        color: tokens.colorNeutralForeground2,
        fontWeight: tokens.fontWeightSemibold,
        textAlign: 'left',
        verticalAlign: 'top',
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    fieldValue: {
        padding: tokens.spacingVerticalXS,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        verticalAlign: 'top',
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    environmentBadge: {
        maxWidth: '100%',
        minWidth: 0,
    },
    ellipsis: {
        display: 'block',
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    warningBox: {
        padding: tokens.spacingVerticalM,
        backgroundColor: tokens.colorPaletteYellowBackground2,
        borderRadius: tokens.borderRadiusMedium,
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalM,
    },
});

export default useConnectionDetailsPopupStyles;
