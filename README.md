> Copyright 2026 Shko Online LLC <sales@shko.online>
> 
> Licensed under the Apache License, Version 2.0 (the "License");
> you may not use this file except in compliance with the License.
> You may obtain a copy of the License at
> 
>     http://www.apache.org/licenses/LICENSE-2.0
> 
> Unless required by applicable law or agreed to in writing, software
> distributed under the License is distributed on an "AS IS" BASIS,
> WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
> See the License for the specific language governing permissions and
> limitations under the License.

# Dataverse Excel Reporter

This Power Platform ToolBox tool allows you to export Dataverse data using a system or personal excel template from the selected environment. It will properly use pagination and not timeout during data export.

## Features

- ✅ React 18 with TypeScript
- ✅ Vite for fast development and building
- ✅ Hot Module Replacement (HMR) for development

## Structure

```
dataverse-excel-reporter-pptb/
├── src/
│   ├── App.tsx         # Main component
│   ├── main.tsx        # Entry point
│   └── styles.css      # Styling
├── dist/               # Build output
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Installation

Install dependencies:

```bash
npm install
```

## Development

Start development server with HMR:

```bash
npm run dev
```

Build the tool:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Usage in ToolBox

1. Build the tool using `npm run build`
2. Install the tool in ToolBox
3. Load and use the tool from the ToolBox interface


## License

APACHE-2
