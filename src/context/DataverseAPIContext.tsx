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

import DataverseAPI from "@pptb/types/dataverseAPI";
import { createContext, useState } from "react";
import type {FC, ReactNode} from "react";

export const DataverseAPIContext = createContext<DataverseAPI.API | null>(null);

export const DataverseAPIProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [dataverseAPI] = useState<DataverseAPI.API>(window.dataverseAPI);
    return <DataverseAPIContext.Provider 
                value={dataverseAPI}
            >{children}</DataverseAPIContext.Provider>;
};  

export default DataverseAPIContext;