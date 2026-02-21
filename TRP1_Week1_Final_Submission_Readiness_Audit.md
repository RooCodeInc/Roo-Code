# TRP1 Challenge Week 1: Final Submission Readiness Audit

Role: Senior AI Architect & Technical Auditor
Date: 2026-02-20

Summary

- Purpose: Evaluate the VS Code extension repository for Week 1 TRP1 final submission readiness against the provided checklist.
- Scope: Reviewed `src/hooks/`, `src/core/tools/SelectActiveIntentTool.ts`, `src/core/assistant-message/presentAssistantMessage.ts`, `src/core/prompts/system.ts` + intent protocol section, trace logger, session-state, and extension activation wiring.

Key Findings (top-level)

- The repo contains a near-complete scaffold for Intent-Driven governance: hook registry, pre/post hook execution loops, intent loader, select_active_intent tool, XML formatter, trace logger, and session-state persistence.
- Several critical behaviours are partially present or have TODO markers; many are functionally reachable but not fully enforced end-to-end.

1. Hook Engine & Middleware (30%)

- Implemented:
    - `executePreToolUseHooks` and `executePostToolUseHooks` (file: [src/hooks/middleware.ts](src/hooks/middleware.ts)) implement sequential hook execution and blocking semantics. They include TODO comments but contain working logic to iterate hooks, merge modified params and inject context.
    - Hooks are invoked from the assistant-to-tool path: [src/core/assistant-message/presentAssistantMessage.ts](src/core/assistant-message/presentAssistantMessage.ts) calls `executePreToolUseHooks` before `write_to_file` and `execute_command` handlers.
- Partial / Missing:
    - HITL flow exists as `requestHITLAuthorization` in `middleware.ts` (uses `vscode.window.showWarningMessage`) but is not automatically invoked across every destructive tool path — classification exists (`classifyToolSafety` in [src/hooks/security.ts](src/hooks/security.ts)) but wiring from classification→HITL in the pre-hook path is incomplete.
    - Scope enforcement logic is split: `validateIntentForTool` (intent-validation-hook) blocks tool calls when no active intent is set, but it does not validate a concrete file path against intent `owned_scope` before `write_to_file`. A `validateIntentScope` utility exists in `intent-loader.ts` but is not called at the write boundary.

2. Intent Management & Context Engineering (25%)

- Implemented:
    - YAML parsing: `readActiveIntents` in [src/hooks/intent-loader.ts](src/hooks/intent-loader.ts) reads `.orchestration/active_intents.yaml`, supports array and object shapes, and returns structured Intent objects.
    - XML formatting: `formatIntentAsXml` in `intent-loader.ts` builds `<intent_context>` with escaped fields (function implemented).
    - Tool: `select_active_intent` exists in both the OpenAI tool schema file and as `SelectActiveIntentTool` ([src/core/tools/SelectActiveIntentTool.ts](src/core/tools/SelectActiveIntentTool.ts)). It stores session state and injects an XML block for prompt injection.
    - System prompt: `getIntentProtocolSection()` ensures the system prompt mandates calling `select_active_intent` before changes (see [src/core/prompts/sections/intent-protocol.ts](src/core/prompts/sections/intent-protocol.ts)).
- Partial / Missing:
    - Two-stage enforcement (Request → Intercept → Intent selection → Context injection → Action) is mostly enforced by policy + hooks, but not 100% enforced automatically: if an agent bypasses or fails to call `select_active_intent`, `validateIntentForTool` blocks many destructive operations; however file-scope checks (owned_scope) are not enforced reliably at the write-time hook.

3. Traceability & Data Model (25%)

- Implemented:
    - `.orchestration/agent_trace.jsonl` append helpers exist: `appendToTraceLog` and `appendTraceRecord` in [src/hooks/trace-logger.ts](src/hooks/trace-logger.ts).
    - `computeContentHash` implements SHA-256 content hashing.
    - `buildTraceRecord` includes `content_hash`, `intent_id`, `model_id`, and `related` arrays.
- Partial / Missing:
    - Several trace creation utilities (`createToolUseTrace`, `createToolResultTrace`, sanitizers, and read/analysis helpers) are marked TODO and not fully sanitizing/truncating sensitive fields.
    - Automatic enrichment of trace records with current Git SHA is implemented via `computeGitSha()` but needs verification in call-sites (post-hook must call `appendTraceRecord` with git SHA and intent correlation).
    - Sidecar writes to `.orchestration/agent_trace.jsonl` are implemented, so sidecar storage exists without polluting source files.

4. Parallel Orchestration & Concurrency (20%)

- Implemented:
    - The `Task` class contains many concurrency protections and the codebase includes reasoning about message ordering, tool repetition detection, and assistant message save ordering.
- Missing / High Risk:
    - No explicit optimistic locking enforcement was found at write-time (no code that reads a file's current content hash and compares it to the agent's read-hash before write). This is a required safety for parallel Architect/Builder agents.
    - Shared Brain / lessons artifacts: there are `AGENTS.md` and `CLAUDE.md` files, but automatic updates (“Lessons Learned”) on verification failures are not implemented.
    - Demo readiness for two parallel agent instances is medium risk: the platform supports concurrency, but missing optimistic lock + incomplete HITL/scope enforcement makes multi-agent demo fragile.

5. Deliverables & Artifacts (Pass/Fail)

- Repo structure: `src/hooks/` exists and contains intent loader, middleware, trace logger, session-state, and validation hooks.
- Artifacts: code can read `active_intents.yaml` and append `agent_trace.jsonl`; `intent_map.md` generation isn't present as an automatic artifact generator (could be produced from `readActiveIntents`).
- Meta-Audit Video workflow: supported conceptually by trace writes and pre-hook rejections, but incomplete integrations (optimistic lock, HITL enforcement, scope checks) make the demo flow brittle.

Gap Analysis (specific files/functions)

- `src/hooks/middleware.ts`
    - TODO markers exist but core loop works; missing: automatic HITL invocation for all classified destructive tools.
- `src/hooks/intent-validation-hook.ts`
    - Blocks tools when no active intent set (good), but does not perform file-level `owned_scope` validation on `write_to_file` operations.
- `src/hooks/intent-loader.ts`
    - `readActiveIntents`, `formatIntentAsXml` implemented. `validateIntentScope` exists but is not called where needed.
- `src/hooks/trace-logger.ts`
    - Content hashing, append logic exists but sanitizers and read/analysis functions are TODO; ensure traces include Git SHA at time of write.
- `src/core/tools/SelectActiveIntentTool.ts`
    - Tool exists and is used, sets task active intent; confirm it is registered in the tool registry (present in codebase but ensure it is added to the MCP/native tool list at build-time).
- `src/core/assistant-message/presentAssistantMessage.ts`
    - Calls pre/post hooks correctly around tool use; verify the write tool handlers respect preHook `modifiedParams` and `continue=false` semantics.

Risk Assessment — Showstoppers (would prevent Score 5)

- Missing optimistic locking before `write_to_file` (Showstopper): concurrent agents can overwrite each other's changes; must implement read-hash vs. current-hash check pre-write.
- Scope enforcement not applied at file-write boundary (High): `owned_scope` checks must block out-of-scope writes or the governance model fails.
- HITL not auto-invoked for all destructive actions (High): `requestHITLAuthorization` exists, but unless routed from pre-hook path on destructive operations, destructive commands may proceed without user consent.
- Traces missing mandatory enrichment in some flows (Medium): sanitization and guaranteed git SHA/intent_id injection must be enforced in post-tool hooks.

Remediation Plan — Top 3 critical fixes (code sketch + where to place)

1. Enforce `owned_scope` at pre-write hook (intent validation)
    - Change: Update `validateIntentForTool` in `src/hooks/intent-validation-hook.ts` to check file path for `write_to_file` operations using `validateIntentScope` from `intent-loader.ts`.
    - Snippet (replace or augment the intent validation block):

```ts
// inside validateIntentForTool
if (toolName === "write_to_file") {
	const filePath = String(context.params.path || context.params.file || "")
	const intent = await findIntentById(activeIntentId, context.task.cwd)
	if (!intent) return { continue: false, reason: "Active intent not found in active_intents.yaml" }
	if (!validateIntentScope(filePath, intent)) {
		return {
			continue: false,
			reason: formatRejectionError(
				"Scope Violation",
				"File is outside the intent owned_scope",
				"SCOPE_VIOLATION",
			),
		}
	}
}
```

2. Integrate HITL for dangerous/destructive tools in `executePreToolUseHooks`
    - Change: In `src/hooks/middleware.ts`, after classification (call `classifyToolSafety(toolName, params)` from `security.ts`), if classification is `DESTRUCTIVE` (or `isDangerousCommand` true for `execute_command`), call `requestHITLAuthorization(toolName, params)`. If not approved, return `continue: false` with rejection JSON.
    - Snippet:

```ts
const safety = classifyToolSafety(toolUse.name, params)
if (safety === "DESTRUCTIVE") {
	const approved = await requestHITLAuthorization(toolUse.name, params)
	if (!approved)
		return {
			continue: false,
			reason: formatRejectionError("User rejected HITL", "Operation cancelled by user", "HITL_REJECTED"),
		}
}
```

3. Add optimistic locking at write path (pre-hook) and abort on mismatch
    - Change: In pre-hook for `write_to_file` (middleware), compute current file content hash and compare to an `expected_content_hash` parameter (agent should pass the hash it read). If mismatch -> block and request reconciliation.
    - Snippet (pseudocode):

```ts
if (toolUse.name === "write_to_file") {
	const targetUri = vscode.Uri.file(path.join(context.cwd, String(params.path)))
	try {
		const disk = await vscode.workspace.fs.readFile(targetUri)
		const diskHash = computeContentHash(Buffer.from(disk).toString("utf-8"))
		const expected = String(params.expected_content_hash || "")
		if (expected && expected !== diskHash) {
			return {
				continue: false,
				reason: formatRejectionError(
					"Optimistic Lock Failed",
					"File changed on disk; reconcile and retry",
					"OPTIMISTIC_LOCK_FAIL",
				),
			}
		}
	} catch (e) {
		// file may not exist; proceed
	}
}
```

Remediation Implementation Notes

- Add calls to `appendTraceRecord(buildTraceRecord(...))` in the post-tool hook handling for `write_to_file` so every successful write emits a trace with `content_hash`, `intent_id`, and git SHA from `computeGitSha()`.
- Update sanitizers in `trace-logger.ts` to redact secrets before writing traces.
- Add unit/integration tests for: scope enforcement on write, HITL rejection path, and optimistic locking failure recovery.

Go / No-Go Recommendation

- Status: NO-GO for Score 5 submission today.
- Rationale: Core scaffolding is present and several required components exist, but three showstopper gaps remain: optimistic locking (concurrency safety), file-scope enforcement at write-time, and guaranteed HITL invocation for destructive operations. These must be addressed and tested before a robust SATURDAY demo or Score 5 rating.

Next Steps (recommended order)

1. Implement and test optimistic locking for `write_to_file` (high priority).
2. Wire `validateIntentScope` into `validateIntentForTool` for file-level enforcement.
3. Integrate `classifyToolSafety` → `requestHITLAuthorization` in `executePreToolUseHooks` and add tests.
4. Ensure post-tool trace enrichment (git SHA + intent_id) runs for all write operations.
5. Run parallel-agent integration test (Architect vs Builder) and validate agent_trace.jsonl traces and rejection behaviors.

If you want, I can apply the three remediation snippets as patches to the repo now and add unit tests for each — tell me to proceed and I will implement them in `src/hooks/intent-validation-hook.ts`, `src/hooks/middleware.ts`, and the write pre-hook path plus tests.

---

Generated by: Senior AI Architect Audit (concise technical audit)
