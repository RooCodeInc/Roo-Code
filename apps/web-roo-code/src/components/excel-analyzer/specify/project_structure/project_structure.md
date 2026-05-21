# Excel Analyzer — Project Structure (Revised)

This document reflects the current repository layout after adding:

- `src/hooks/hook-engine.js`
- `.orchestration/*`
- `CLAUDE.md`

## Repository Tree

```text
Week1_TRP1_Intent_based_planning/
├── README.md
├── specify/
│   └── specification.md
└── Excel-Based-Data-Analzer/
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
            │   ├── defaults.js
            │   ├── settings.js
            │   └── themes.js
            ├── events/
            │   ├── event-handlers.js
            │   └── event-system.js
            ├── modules/
            │   ├── analytics.js
            │   ├── dashboard.js
            │   ├── data-processor.js
            │   ├── exporter.js
            │   ├── file-upload.js
            │   ├── help.js
            │   ├── notifications.js
            │   ├── settings.js
            │   └── visualizer.js
            └── utils/
                ├── formatters.js
                ├── helpers.js
                └── validators.js
```

## Structure Notes

- `src/hooks/` is reserved for hook-system code (currently `hook-engine.js`).
- `.orchestration/` stores operational memory and tracing artifacts.
- `CLAUDE.md` stores durable lessons and working agreements.
- `specify/` contains project governance/planning/specification documents.

## Maintenance Rule

Whenever files/folders are reorganized, update this
 document and both README files in the same change.


