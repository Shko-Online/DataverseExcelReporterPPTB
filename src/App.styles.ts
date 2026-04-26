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

const useAppStyles = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: tokens.colorNeutralBackground1,
        overflow: 'hidden',
    },
    header: {
        padding: tokens.spacingVerticalL,
        paddingBottom: tokens.spacingVerticalS,
        borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'baseline',
        gap: tokens.spacingVerticalXXS,
    },
    headerTitle: {
        textOverflow: 'ellipsis'
    },
    subtitle: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase300,
    },
    toolbar: {
        borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
        padding: tokens.spacingVerticalS,
    },
    content: {
        flex: 1,
        overflow: 'auto',
        padding: tokens.spacingVerticalL,
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalL,
    },
    topRowContainer: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: tokens.spacingVerticalL,
        alignItems: 'stretch',
    },
    connectionStatus: {
        minHeight: '0',
        height: '100%',
    },
    toolboxApi: {
        minHeight: '0',
        height: '100%',
    },
});

export default useAppStyles;
