# Excel Analyzer Project

Web-based Excel analysis application with modular architecture, local-first processing, and extensibility via a dedicated Hook Engine.

## What It Does

- Upload and parse Excel files (`.xlsx`, `.xls`)
- Preview tabular data with basic quality indicators
- Analyze/visualize data (Chart.js)
- View a compact dashboard summary
- Export results (PDF / Excel / CSV / JSON / PNG)

## Architecture Highlights

- **Client-side only** processing for privacy
- **Module-oriented JS structure** under `src/js/`
- **Hook Engine** under `src/hooks/hook-engine.js` for extensibility
- **Project memory and orchestration artifacts**:
  - `CLAUDE.md`
  - `.orchestration/active_intents.yaml`
  - `.orchestration/agent_trace.jsonl`
  - `.orchestration/intent_map.md`

## Current Structure

```text
Week1_TRP1_Intent_based_planning/
├── README.md
├── CLAUDE.md
├── .orchestration/
│   ├── active_intents.yaml
│   ├── agent_trace.jsonl
│   └── intent_map.md
├── specify/
│   ├── specification.md
│   ├── memory/
│   │   └── constitution.md
│   ├── plan/
│   │   └── plan.md
│   ├── architecture/
│   │   └── architecture.md
│   └── project_structure/
│       └── project_structure.md
└── src/
    ├── index.html
    ├── css/
    │   └── styles.css
    ├── hooks/
    │   └── hook-engine.js
    └── js/
        ├── main.js
        ├── config/
        ├── events/
        ├── modules/
        └── utils/
```

## Run

Open in browser:

```powershell
start Excel-Based-Data-Analzer/src/index.html
```

## Related Docs

- Specification: `specify/specification.md`
- Constitution: `specify/memory/constitution.md`
- Plan: `specify/plan/plan.md`
- Architecture: `specify/architecture/architecture.md`
- Project Structure: `specify/project_structure/project_structure.md`
