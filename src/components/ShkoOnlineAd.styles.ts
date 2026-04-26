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

const useShkoOnlineAdStyles = makeStyles({
    card: {
        maxWidth: '100%',
        width: '100%',
        height: '100%',
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        padding: tokens.spacingVerticalM,
    },
    content: {
        padding: tokens.spacingVerticalM,
        display: 'flex',
        height: '100%',
        flexDirection: 'column',
        gap: tokens.spacingVerticalL,
    },
    section: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: tokens.spacingVerticalS,
    },
});

export default useShkoOnlineAdStyles;
