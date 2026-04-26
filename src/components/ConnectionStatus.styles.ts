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

import {
  makeStyles,
  tokens,
} from "@fluentui/react-components";

const useConnectionStatusStyles = makeStyles({
  card: {
    maxWidth: "100%",
    width: "100%",
    height: "100%",
  },
  content: {
    padding: tokens.spacingVerticalM,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  connectionItem: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    alignItems: "baseline",
  },
  label: {
    fontWeight: tokens.fontWeightSemibold,
    minWidth: "120px",
  },
  warningBox: {
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorPaletteYellowBackground2,
    borderRadius: tokens.borderRadiusMedium,
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
  },
});

export default useConnectionStatusStyles;
