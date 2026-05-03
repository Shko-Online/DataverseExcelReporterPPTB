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

import App from './App';
// import { StrictMode } from 'react';
import { ToolboxAPIProvider } from './context/ToolboxAPIContext';
import { createRoot } from 'react-dom/client';
import './index.css';
import { DataverseAPIProvider } from './context/DataverseAPIContext';
import { ConnectionProvider } from './context/ConnectionContext';
import { ApplicationDataProvider } from './context/ApplicationDataContext';

// Ensure DOM is ready and root element exists
const rootElement = document.getElementById('root');
if (rootElement && !rootElement.dataset.reactrootInitialized) {
    // Mark as initialized to prevent double rendering
    rootElement.dataset.reactrootInitialized = 'true';
    
    createRoot(rootElement).render(
        // <StrictMode>
            <ToolboxAPIProvider>
                <DataverseAPIProvider>
                    <ConnectionProvider>
                        <ApplicationDataProvider>
                            <App />
                        </ApplicationDataProvider>
                    </ConnectionProvider>
                </DataverseAPIProvider>
            </ToolboxAPIProvider>
        // </StrictMode>
    );
} else if (!rootElement) {
    console.error('%cRoot element not found.\r\n%cMake sure the HTML contains <div id="root"></div>', 'font-weight: bold;', '');
}
