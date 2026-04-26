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

import { createContext, useState } from "react";
import type {FC, ReactNode} from "react";

export const ToolboxAPIContext = createContext<ToolBoxAPI.API | null>(null);

export const ToolboxAPIProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [toolboxAPI] = useState<ToolBoxAPI.API>(window.toolboxAPI);
    return <ToolboxAPIContext.Provider 
                value={toolboxAPI}
            >{children}</ToolboxAPIContext.Provider>;
};  

export default ToolboxAPIContext;