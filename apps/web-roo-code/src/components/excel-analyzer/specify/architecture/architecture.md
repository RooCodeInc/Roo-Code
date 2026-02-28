e# Excel Analyzer Architecture (Revised)

## 1) Architecture Style

The project uses a **client-side modular SPA-style architecture**:

- Runs fully in the browser (no backend required)
- Processes files locally for privacy
- Uses module separation for upload, processing, visualization, dashboard, export
- Supports extensibility through a dedicated **Hook Engine**

## 2) High-Level Layers

1. **Presentation Layer**
   - `src/index.html`
   - `src/css/styles.css`

2. **Application Orchestration Layer**
   - `src/js/main.js`
   - Coordinates upload → preview → analyze → dashboard → export flow

3. **Domain Modules Layer**
   - `src/js/modules/*.js`
   - Encapsulates feature logic (file upload, data processing, charts, dashboard, exports)

4. **Shared Utilities and Config Layer**
   - `src/js/utils/*.js`
   - `src/js/config/*.js`
   - `src/js/events/*.js`

5. **Extensibility Layer (Hooks)**
   - `src/hooks/hook-engine.js`
   - Central hook registry/execution engine for plugging cross-cutting behavior

## 3) Hook Engine Design

Location: `src/hooks/hook-engine.js`

Core capabilities:

- `tap(hookName, handler, { priority, once })`
- `tapOnce(hookName, handler, options)`
- `untap(hookName, hookId)`
- `clear(hookName?)`
- `has(hookName)` / `list(hookName)`
- `run(hookName, context)` for async handler execution
- `runWaterfall(hookName, payload, context)` for payload transformation pipeline

Design goals:

- Keep hook logic isolated in `src/hooks/`
- Make extension points explicit and reusable
- Allow priority ordering and one-time hooks

## 4) Data Flow Layer

```text
User File Input
  -> FileUploadManager
  -> DataProcessor
  -> Visualizer / DashboardManager
  -> Exporter
  -> Download Output
```

Potential hook interception points (recommended):

- `beforeFileParse`
- `afterFileParse`
- `beforeAnalysis`
- `afterAnalysis`
- `beforeExport`
- `afterExport`

## 5) Documentation and Operational Memory

Beyond source code, the project now includes lightweight operational artifacts:

- `CLAUDE.md` — shared brain / durable lessons learned
- `.orchestration/active_intents.yaml` — active priorities/intents
- `.orchestration/agent_trace.jsonl` — chronological action trace
- `.orchestration/intent_map.md` — mapping goals to code areas

## 6) Architectural Principles

- **Separation of concerns** between UI, orchestration, domain logic, utilities, and hooks
- **Local-first processing** for privacy and performance
- **Incremental extensibility** via Hook Engine rather than hardcoded branching
- **Documentation alignment**: structure docs must reflect actual repository state
