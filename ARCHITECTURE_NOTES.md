# Architectural Deep-Dive & Governance Blueprint

This document maps Roo Code’s tool loop, pinpoints side-effect boundaries (Point of No Return), and proposes a decoupled governance middleware to satisfy the TRP1 “Master Thinker” rubric.

## Tool Loop Anatomy

- **`execute_command` path**:
  - Entry: [src/core/tools/ExecuteCommandTool.ts](src/core/tools/ExecuteCommandTool.ts)
    - Signature: `ExecuteCommandTool.execute(params: { command: string, cwd?: string }, task: Task, callbacks: ToolCallbacks): Promise<void>`
    - Governance hooks: `PreHook.validate(...)` and `PostHook.log(...)` integrated.
  - Terminal dispatch: [src/integrations/terminal/Terminal.ts](src/integrations/terminal/Terminal.ts#L79)
    - Signature: `Terminal.runCommand(command: string, callbacks: RooTerminalCallbacks): RooTerminalProcessResultPromise`
    - PONR: `process.run(command)` triggers VS Code shell execution.
  - Shell execution: [src/integrations/terminal/Ter​minalProcess.ts](src/integrations/terminal/TerminalProcess.ts#L90-L105)
    - Side-effect: `terminal.shellIntegration.executeCommand(command)`; fallback `terminal.sendText(...)` when integration absent.

- **`write_to_file` path**:
  - Entry: [src/core/tools/WriteToFileTool.ts](src/core/tools/WriteToFileTool.ts)
    - Signature: `WriteToFileTool.execute(params: { path: string, content: string }, task: Task, callbacks: ToolCallbacks): Promise<void>`
    - Governance hooks: `PreHook.validate(...)` (intent + scope), `PostHook.log(...)` (trace + hash).
  - Diff-stream path (editor memory edits): [src/integrations/editor/DiffViewProvider.ts](src/integrations/editor/DiffViewProvider.ts#L150-L188)
    - Side-effect (memory): `vscode.workspace.applyEdit(...)` repeatedly.
    - Disk PONR (diff path): [src/integrations/editor/DiffViewProvider.ts](src/integrations/editor/DiffViewProvider.ts#L213) → `updatedDocument.save()`.
  - Direct save path (prevent focus disruption): [src/integrations/editor/DiffViewProvider.ts](src/integrations/editor/DiffViewProvider.ts#L660)
    - Disk PONR: `fs.writeFile(absolutePath, content, "utf-8")`.

## Dependency Graph (condensed)

- `Task` → Tools (`ExecuteCommandTool`, `WriteToFileTool`)
- `ExecuteCommandTool` → `TerminalRegistry.getOrCreateTerminal()` → `Terminal.runCommand()` → `TerminalProcess.run()` → VS Code terminal shell integration
- `WriteToFileTool` → `DiffViewProvider` (`open`/`update`/`saveChanges` or `saveDirectly`) → `workspace.applyEdit` → `updatedDocument.save()` or `fs.writeFile`
- Governance: `PreHook` (intent checkout + scope) and `PostHook` (trace ledger + hashing) already imported by both tools.

## Point of No Return (explicit)

- Commands: [process run](src/integrations/terminal/Terminal.ts#L79) → [shell exec](src/integrations/terminal/TerminalProcess.ts#L90-L105)
- Files (diff path): [applyEdit](src/integrations/editor/DiffViewProvider.ts#L150-L188) then [save](src/integrations/editor/DiffViewProvider.ts#L213)
- Files (direct path): [writeFile](src/integrations/editor/DiffViewProvider.ts#L660)

## Risk Assessment

- **Race conditions**: Concurrent terminal runs and parallel file edits; editor memory vs disk divergence before save.
- **Unauthorized writes**: Writes outside intended scope; missing intent checkout; lack of HITL on destructive commands.
- **Context rot**: Tool execution without curated intent context; agent acts on stale state.
- **Trace gaps**: Unlogged side effects (e.g., terminal commands) or missing content-hash linkage to intent.

## Privilege Separation & Intercepts

- **Webview (UI)**: Emits messages only; no secrets or side-effects.
- **Extension Host (Logic)**: Executes tools; must route through middleware.
- **Hook Engine (Middleware)**: Intercepts all tool calls.
  - Pre: intent checkout (`select_active_intent`), scope enforcement (`owned_scope` glob), HITL authorization.
  - Post: ledger append (`agent_trace.jsonl`), content hashing, state evolution (`active_intents.yaml`).

## IoC Middleware Blueprint (decoupled)

- **ToolAdapter**: Wraps all tool `execute()` calls.
  - `beforeExecute(ctx)`: intent validation, scope check, HITL gate.
  - `run(ctx)`: delegate to tool implementation.
  - `afterExecute(ctx)`: compute hash, serialize trace, update orchestration artifacts.
- **Registration**: Tool registry binds adapters, not tools directly.
- **Contracts**: Minimal `ToolContext { toolName, params, targetPaths, mutationClass }` to bind governance, independent of tool internals.
- **Failure semantics**: Adapter must be fail-safe; rejection returns standardized JSON error to the agent.

## Governance Data Model (artifacts)

- `.orchestration/active_intents.yaml`: IN_PROGRESS intent, `owned_scope`, constraints, DoD.
- `.orchestration/agent_trace.jsonl`: Append-only; `{ intent_id, content_hash, ranges, contributor.model_identifier }`.
- `.orchestration/intent_map.md`: Intent → files/AST nodes; updated on `INTENT_EVOLUTION`.
- `CLAUDE.md`: Shared brain; lessons learned on verification failure.

## Evaluation Alignment (Score 5 targets)

- **Hook Architecture**: Clean middleware adapters; tools isolated and composable; pre/post hooks mandatory.
- **Context Engineering**: Dynamic intent injection; agent cannot act without context; curated constraints (not dumps).
- **Intent-AST Correlation**: `agent_trace.jsonl` links intent IDs to content hashes; classifies `AST_REFACTOR` vs `INTENT_EVOLUTION`.
- **Orchestration**: Optimistic locking on writes; shared `CLAUDE.md` prevents collisions; multi-agent “hive mind”.

## Implementation Notes

- Intercept points are stable and testable:
  - Commands: `ExecuteCommandTool.execute()` and terminal dispatch.
  - Files: `WriteToFileTool.execute()` → `DiffViewProvider.saveChanges()` / `saveDirectly()`.
- Use dependency injection to bind hooks; avoid touching tool internals beyond adapter wiring.
- Provide unit/e2e tests around PONR to assert governance invariants (intent required, scope enforced, ledger append).
