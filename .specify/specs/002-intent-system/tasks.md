# Tasks: 002-intent-system

**Spec:** [spec.md](./spec.md)  
**Plan:** [plan.md](./plan.md)  
**Constitution:** [.specify/memory/constitution.md](../../memory/constitution.md)

Actionable tasks derived from the spec and the select_active_intent implementation plan. Order follows plan Phase 0 → Phase 6.

---

## Phase 0: Prerequisites and schema

| ID      | Task                                                                                                                                                                                 | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 002-0.1 | Define minimal schema for `.orchestration/active_intents.yaml` (version, current_intent_id, intents with id, scope, constraints, acceptance_criteria) and document in plan or README | ☐      |
| 002-0.2 | Add TypeScript types for ActiveIntentsYaml (e.g. in `src/orchestration/types.ts` or next to tool)                                                                                    | ☐      |
| 002-0.3 | Add `select_active_intent` to ToolName and param type `{ intent_id: string }` in `src/shared/tools.ts` (or packages/types)                                                           | ☐      |
| 002-0.4 | Ensure YAML parsing is available (e.g. `yaml` in package.json); add small loader for active_intents if needed                                                                        | ☐      |

---

## Phase 1: Tool definition

| ID      | Task                                                                                                                                                                                           | Status |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 002-1.1 | Create `src/hooks/tools/selectActiveIntent.ts`: class extending BaseTool, params `{ intent_id: string }`, validate INT-XXX format                                                              | ☐      |
| 002-1.2 | In tool execute(): resolve workspace root, read `.orchestration/active_intents.yaml`, find intent by id, build XML context block, pushToolResult                                               | ☐      |
| 002-1.3 | Add `case "select_active_intent"` in `presentAssistantMessage.ts` and call tool handle(); import from hooks/tools                                                                              | ☐      |
| 002-1.4 | Create `src/core/prompts/tools/native-tools/select_active_intent.ts` (name, description, parameters intent_id); export and add to native tools index and buildNativeToolsArrayWithRestrictions | ☐      |
| 002-1.5 | Add ToolUse<"select_active_intent"> type if codebase uses per-tool types                                                                                                                       | ☐      |

---

## Phase 2: System prompt

| ID      | Task                                                                                                                                                                                       | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 002-2.1 | Add getIntentSelectionSection() in `src/core/prompts/sections/` (or append to rules): require calling select_active_intent with valid INT-XXX before file-modifying or constrained actions | ☐      |
| 002-2.2 | Wire intent-selection section into generatePrompt in `src/core/prompts/system.ts` (early in prompt)                                                                                        | ☐      |

---

## Phase 3: Pre-hook

| ID      | Task                                                                                                                                                                           | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 002-3.1 | Create selectActiveIntentPreHook (e.g. in `src/hooks/preHooks/selectActiveIntent.ts` or `src/orchestration/selectActiveIntentPreHook.ts`)                                      | ☐      |
| 002-3.2 | Pre-hook: read `.orchestration/active_intents.yaml`, validate intent_id exists, set task.currentIntentId and task.currentIntentContext; on failure push error and return false | ☐      |
| 002-3.3 | In presentAssistantMessage, when block.name === "select_active_intent", run pre-hook before invoking tool; if pre-hook returns false, skip tool execution                      | ☐      |

---

## Phase 4: Load YAML and return XML context

| ID      | Task                                                                                                                                | Status |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 002-4.1 | Load intent from YAML in pre-hook or tool; handle missing file or intent not found with clear pushToolResult error                  | ☐      |
| 002-4.2 | Build XML block `<intent_context intent_id="...">` with scope, constraints, acceptance_criteria; pushToolResult(xmlString)          | ☐      |
| 002-4.3 | After successful select_active_intent, set task.currentIntentId and task.currentIntentContext for gatekeeper and future scope hooks | ☐      |

---

## Phase 5: Gatekeeper validation

| ID      | Task                                                                                                                                                                                       | Status |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 002-5.1 | In presentAssistantMessage, before switch(block.name): if block.name !== "select_active_intent" and !task.currentIntentId, pushToolResult("No active intent selected…") and skip execution | ☐      |
| 002-5.2 | Optionally define allowlist of tools that may run without intent (e.g. read_file, list_files); document in plan                                                                            | ☐      |
| 002-5.3 | Clear task.currentIntentId on task/session reset when implemented                                                                                                                          | ☐      |

---

## Phase 6: Integration and spec acceptance

| ID      | Task                                                                                                         | Status |
| ------- | ------------------------------------------------------------------------------------------------------------ | ------ |
| 002-6.1 | Verify INT-XXX format is documented and used consistently in code and active_intents.yaml                    | ☐      |
| 002-6.2 | Verify each intent has scope; plan follow-up for scope enforcement (write_to_file / edit_file checks)        | ☐      |
| 002-6.3 | Verify each intent has constraints section; plan follow-up for constraint enforcement in hooks               | ☐      |
| 002-6.4 | Verify acceptance criteria and status can be stored/updated in active_intents.yaml                           | ☐      |
| 002-6.5 | Confirm `.orchestration/active_intents.yaml` is single source of truth and constitution/001 are not violated | ☐      |

---

## Suggested execution order

1. 002-0.1 → 002-0.4 (schema and types)
2. 002-1.1 → 002-1.5 (tool and native def)
3. 002-3.1 → 002-3.3 (pre-hook)
4. 002-4.1 → 002-4.3 (load + XML)
5. 002-2.1 → 002-2.2 (system prompt)
6. 002-5.1 → 002-5.3 (gatekeeper)
7. 002-6.1 → 002-6.5 (integration and AC)

---

_Scope enforcement (blocking writes outside scope) and constraint enforcement are follow-up work; see plan._
