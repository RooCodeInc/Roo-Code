# Reapplication Plan — PRs Reverted by #11462

> **Analysis date:** 2026-02-14
> **Scope:** 42 PRs reverted by #11462 that were NOT reapplied by #11463
> **Method:** Dry-run `git cherry-pick --no-commit` against `main-sync-rc6`

---

## 1. Executive Summary

| Category              | Count  | %     |
| --------------------- | ------ | ----- |
| **CLEAN_CHERRY_PICK** | 22     | 52 %  |
| **MINOR_CONFLICTS**   | 12     | 29 %  |
| **MAJOR_CONFLICTS**   | 7      | 17 %  |
| **RE_IMPLEMENT**      | 1      | 2 %   |
| **Total**             | **42** | 100 % |

**Progress:** 31 of 42 PRs reapplied (Batches 1+2 complete). 3 delegation PRs reclassified as AI-SDK-entangled. 8 remaining across deferred/Batches 3-5.

### Overall Assessment

Over half (52 %) of the reverted PRs cherry-pick cleanly onto the current branch with zero conflicts. Another 29 % have only minor, mechanically-resolvable conflicts (lockfile diffs, adjacent-line shifts, small provider divergences). Together these 34 PRs can be reapplied with high confidence in 3–4 focused batches.

The remaining 8 PRs (7 MAJOR + 1 RE_IMPLEMENT) require careful handling:

- **Skills infrastructure** (#11102, #11157, #11414) — the entire skills UI was removed during the revert. Reapplying these requires restoring the skills infra first.
- **Cross-cutting removals** (#11253, #11297, #11392) — removing providers, browser use, or Grounding checkboxes are product decisions that need stakeholder sign-off before reapplication.
- **Delegation lifecycle** (#11379) — the largest delegation PR with 8 conflicts; depends on 4 earlier delegation PRs being applied first.
- **Azure Foundry provider** (#11315) — 23 conflicts including package.json, i18n files, and API routing; must be reimplemented from scratch.

### Key Risk Areas

1. **`ClineProvider.ts` and `Task.ts`** are the most frequently touched files — sequential application within batches is essential.
2. **Skills infrastructure** is the #1 conflict magnet across 3 PRs.
3. **API provider files** (`gemini.ts`, `vertex.ts`, `azure.ts`, `bedrock.ts`) have diverged significantly.
4. **i18n `settings.json`** files cause positional conflicts for any PR adding keys.
5. **`pnpm-lock.yaml`** conflicts are trivially regeneratable via `pnpm install`.

---

## 1.5 Progress

| Batch   | Status      | Details                                                                                         |
| ------- | ----------- | ----------------------------------------------------------------------------------------------- |
| Batch 1 | ✅ COMPLETE | 22/22 PRs cherry-picked, PR [#11473](https://github.com/RooCodeInc/Roo-Code/pull/11473) created |
| Batch 2 | ✅ COMPLETE (rebuilt) | 9/13 PRs cherry-picked, 3 delegation PRs removed (AI SDK entangled), 1 skipped (Azure). PR [#11474](https://github.com/RooCodeInc/Roo-Code/pull/11474) |
| Batch 3 | 🔒 BLOCKED  | Awaiting product decisions on #11392, #11414                                                    |
| Batch 4 | 🔒 BLOCKED  | Awaiting product decisions on #11253, #11297                                                    |
| Batch 5 | ⏳ PENDING  | Azure Foundry reimplementation                                                                  |

---

## 2. Dependency Graph

```mermaid
graph TD
    subgraph "Delegation Chain — ✅ MERGED (Batch 1)"
        PR11281["#11281 prevent parent task state loss"]
        PR11302["#11302 delegation-aware removeClineFromStack"]
        PR11331["#11331 delegation race condition"]
        PR11335["#11335 serialize taskHistory writes"]

        PR11281 --> PR11302 --> PR11331 --> PR11335
    end

    subgraph "Delegation Chain — ⚠️ AI_SDK_ENTANGLED (deferred)"
        PR11379["#11379 harden delegation lifecycle"]
        PR11418["#11418 delegation reopen flow"]
        PR11422["#11422 cancel/resume abort races"]

        PR11379 --> PR11418 --> PR11422
    end

    PR11335 -.->|"blocked by AI SDK RooMessage"| PR11379

    subgraph Skills Chain
        PR11102["#11102 skill mode dropdown"]
        PR11157["#11157 improve Skills/Slash Commands UI"]
        PR11414["#11414 remove built-in skills mechanism"]

        PR11102 --> PR11157 --> PR11414
    end

    subgraph Opus 4.6
        PR11224["#11224 Claude Opus 4.6 support"]
        PR11232["#11232 Bedrock model ID for Opus 4.6"]

        PR11224 --> PR11232
    end

    subgraph Azure Foundry
        PR11315["#11315 Azure Foundry provider (RE_IMPLEMENT)"]
        PR11374["#11374 Azure Foundry fix"]

        PR11315 --> PR11374
    end

    subgraph Gemini Provider
        PR11233["#11233 empty-string baseURL guard"]
        PR11303["#11303 Gemini thinkingLevel validation"]
        PR11253["#11253 remove URL context/Grounding checkboxes"]

        PR11233 --> PR11303 --> PR11253
    end

    subgraph Removal PRs – Product Decisions
        PR11253
        PR11297["#11297 remove 9 low-usage providers"]
        PR11392["#11392 remove browser use entirely"]
        PR11414
    end
```

### Textual Dependency Summary

| Dependency Chain       | PRs (in order)                                                   |
| ---------------------- | ---------------------------------------------------------------- |
| Delegation (merged)    | #11281 → #11302 → #11331 → #11335 = ✅ MERGED (Batch 1)        |
| Delegation (deferred)  | #11379 → #11418 → #11422 = ⚠️ AI_SDK_ENTANGLED (deferred)      |
| Skills                 | #11102 → #11157 → #11414                                        |
| Opus 4.6               | #11224 → #11232                                                  |
| Azure Foundry          | #11315 → #11374                                                  |
| Gemini provider        | #11233 → #11303 → #11253                                        |

---

## 3. Recommended Batches

### Batch 1 — Clean Cherry-Picks (Low Risk)

✅ **COMPLETE** — PR [#11473](https://github.com/RooCodeInc/Roo-Code/pull/11473)

**22 PRs · No manual conflict resolution**

Apply all CLEAN_CHERRY_PICK PRs in dependency order. These are safe to apply in a single session. Start with independent PRs, then apply the clean delegation PRs in chain order.

| Order | PR#    | Title                                           |
| ----- | ------ | ----------------------------------------------- |
| 1     | #10874 | image content in MCP tool responses             |
| 2     | #10975 | transform tool blocks to text before condensing |
| 3     | #10981 | Codex-inspired read_file refactor               |
| 4     | #10994 | allow import settings in welcome screen         |
| 5     | #11038 | code-index gemini-embedding-001                 |
| 6     | #11116 | treat extension .env as optional                |
| 7     | #11131 | sanitize tool_use_id                            |
| 8     | #11140 | queue messages during command execution         |
| 9     | #11162 | IPC task cancellation fixes                     |
| 10    | #11183 | AGENTS.local.md support                         |
| 11    | #11205 | cli provider switch race condition              |
| 12    | #11207 | remove dead toolFormat code                     |
| 13    | #11215 | extract translation/merge resolver into skills  |
| 14    | #11224 | Claude Opus 4.6 support across providers        |
| 15    | #11225 | gpt-5.3-codex model                             |
| 16    | #11281 | prevent parent task state loss                  |
| 17    | #11302 | delegation-aware removeClineFromStack           |
| 18    | #11313 | webview postMessage crashes                     |
| 19    | #11331 | delegation race condition                       |
| 20    | #11335 | serialize taskHistory writes                    |
| 21    | #11369 | task resumption in API module                   |
| 22    | #11410 | clean up repo-facing mode rules                 |

**Rationale:** These have zero conflicts and include the first 4 delegation PRs in the chain, which unblocks later batches.

> **Post-application notes:**
>
> - Extra fix commit: `maxReadFileLine` added to `ExtensionState` type for compatibility
> - #11215 and #11410 were empty commits (changes already present in base)
> - Verification: 5,359 backend tests ✅, 1,229 webview-ui tests ✅, TypeScript ✅

---

### Batch 2 — Minor Conflicts (Medium Risk)

✅ **COMPLETE (rebuilt)** — PR [#11474](https://github.com/RooCodeInc/Roo-Code/pull/11474)

**9 PRs (rebuilt) · Originally 13 PRs**

> **Rebuild note:** Originally 13 PRs. Rebuilt after discovering #11379, #11418, #11422 are entangled with AI SDK RooMessage type system. #11374 skipped (depends on #11315 Azure Foundry).

| Order | PR#    | Title                                         | Conflicts | Notes                                       |
| ----- | ------ | --------------------------------------------- | --------- | ------------------------------------------- |
| 1     | #11232 | Bedrock model ID for Opus 4.6                 | 1         | Depends on #11224 (Batch 1)                 |
| 2     | #11233 | empty-string baseURL guard                    | 3         | Provider file conflicts                     |
| 3     | #11218 | defaultTemperature required in getModelParams | 2         | Provider signature changes                  |
| 4     | #11245 | batch consecutive tool calls in chat UI       | 2         | Chat UI content conflicts                   |
| 5     | #11279 | IPC query handlers                            | 2         | IPC event types diverged                    |
| 6     | #11295 | lock toggle to pin API config                 | 1         | Trivial lockfile conflict                   |
| 7     | #11303 | Gemini thinkingLevel validation               | 1         | Depends on #11233                           |
| 8     | #11425 | cli release v0.0.53                           | 2         | Version bump conflicts                      |
| 9     | #11440 | GLM-5 model for Z.ai                          | 2         | Z.ai provider diverged slightly             |

> **Post-application notes:**
>
> - AI SDK contamination cleaned: Removed 3 AI SDK tests + import from gemini.spec.ts
> - Type errors fixed: Added missing `defaultTemperature` to vertex.ts and xai.ts
> - pnpm-lock.yaml regenerated: Clean lockfile matching current dependencies
> - Verification: 5,372 backend tests ✅, 1,250 webview-ui tests ✅, 14/14 type checks ✅, AI SDK contamination check clean

---

### Deferred — AI SDK Entangled Delegation PRs

These 3 delegation PRs were originally in Batch 2 but depend on the `RooMessage` type system
introduced by AI SDK PRs #11380/#11409. They **cannot be cherry-picked** and require
re-implementation without AI SDK dependency.

| PR# | Title | Original Category | Reason |
|-----|-------|-------------------|--------|
| #11379 | harden delegation lifecycle | MAJOR (8 conflicts) | Imports RooMessage types, readRooMessages, saveRooMessages |
| #11418 | delegation reopen flow | MINOR (3 conflicts) | Depends on #11379's RooMessage infrastructure |
| #11422 | cancel/resume abort races | MINOR (1 conflict) | Depends on #11418 |

> **Note:** The earlier delegation chain (#11281 → #11302 → #11331 → #11335) is clean
> and already merged in Batch 1. Only the later PRs that adopted the AI SDK's RooMessage
> type system are affected.

---

### Batch 3 — Major Conflicts: Skills & Browser Use (High Risk)

**4 PRs · Requires product decision on #11392 and #11414**

These PRs touch deeply removed infrastructure. Apply only after product stakeholder sign-off on whether to restore Skills UI and remove browser use.

| Order | PR#    | Title                            | Conflicts | Notes                         |
| ----- | ------ | -------------------------------- | --------- | ----------------------------- |
| 1     | #11102 | skill mode dropdown              | 44        | Skills infra must be restored |
| 2     | #11157 | improve Skills/Slash Commands UI | 48        | Superset of #11102            |
| 3     | #11414 | remove built-in skills mechanism | 30        | Depends on #11102 + #11157    |
| 4     | #11392 | remove browser use entirely      | 15        | Cross-cutting removal         |

---

### Batch 4 — Major Conflicts: Provider Removals (High Risk)

**2 PRs · Requires product decision**

| Order | PR#    | Title                                   | Conflicts | Notes                              |
| ----- | ------ | --------------------------------------- | --------- | ---------------------------------- |
| 1     | #11253 | remove URL context/Grounding checkboxes | 4         | Depends on Gemini PRs from Batch 2 |
| 2     | #11297 | remove 9 low-usage providers            | 18        | Provider files modified/deleted    |

---

### Batch 5 — Re-implement Azure Foundry (Highest Risk)

**1 PR · Full reimplementation required**

| PR#    | Title                  | Conflicts | Notes                                          |
| ------ | ---------------------- | --------- | ---------------------------------------------- |
| #11315 | Azure Foundry provider | 23        | Must be reimplemented against current codebase |

This PR has 23 conflicts spanning `pnpm-lock.yaml`, `api/index.ts`, `package.json`, `ApiOptions.tsx`, `constants.ts`, and 18 i18n files. The provider routing and UI integration have diverged too far for cherry-pick to be viable. A fresh implementation referencing the original PR diff is recommended.

> **Note:** #11374 (Azure Foundry fix) from Batch 2 should be deferred to after #11315 is reimplemented. If #11315 is deferred, #11374 should also be deferred.

---

## 4. Per-PR Analysis Table

| PR#    | Title                                           | Commit SHA   | Category           | Conflicting Files                                                                                                              | Dependencies      | Notes                                                 |
| ------ | ----------------------------------------------- | ------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ----------------------------------------------------- |
| #10874 | image content in MCP tool responses             | `e46fae7ad7` | CLEAN              | —                                                                                                                              | —                 |                                                       |
| #10975 | transform tool blocks to text before condensing | `b4b8cef859` | CLEAN              | —                                                                                                                              | —                 |                                                       |
| #10981 | Codex-inspired read_file refactor               | `cc86049f10` | CLEAN              | —                                                                                                                              | —                 | 19 files (types, core, webview, tests)                |
| #10994 | allow import settings in welcome screen         | `fa93109b76` | CLEAN              | —                                                                                                                              | —                 | 1 file (WelcomeViewProvider.tsx)                      |
| #11038 | code-index gemini-embedding-001                 | `1e790b0d39` | CLEAN              | —                                                                                                                              | —                 |                                                       |
| #11102 | skill mode dropdown                             | `16fbabf2a4` | MAJOR              | 44 files: skills.json ×18, settings.json ×18, + skills infra                                                                   | Skills chain head | Skills UI fully removed in revert                     |
| #11116 | treat extension .env as optional                | `20d1f1f282` | CLEAN              | —                                                                                                                              | —                 | extension.ts + test                                   |
| #11131 | sanitize tool_use_id                            | `3400499917` | CLEAN              | —                                                                                                                              | —                 | auto-merged presentAssistantMessage.ts                |
| #11140 | queue messages during command execution         | `ede1d29299` | CLEAN              | —                                                                                                                              | —                 | auto-merged ChatView.tsx                              |
| #11157 | improve Skills/Slash Commands UI                | `54ea34e2c1` | MAJOR              | 48 files: CreateSkillDialog.tsx, SkillsSettings.tsx, SettingsView.tsx + skills infra                                           | #11102            | Superset of #11102 conflicts                          |
| #11162 | IPC task cancellation fixes                     | `e5fa5e8e46` | CLEAN              | —                                                                                                                              | —                 | auto-merged runTaskInCli.ts, Task.ts                  |
| #11183 | AGENTS.local.md support                         | `1da2b1c457` | CLEAN              | —                                                                                                                              | —                 | .gitignore, custom-instructions.ts, test              |
| #11205 | cli provider switch race condition              | `aa49871a5d` | CLEAN              | —                                                                                                                              | —                 | auto-merged webviewMessageHandler.ts                  |
| #11207 | remove dead toolFormat code                     | `f73b103b87` | CLEAN              | —                                                                                                                              | —                 | trivially clean                                       |
| #11215 | extract translation/merge resolver into skills  | `5507f5ab64` | CLEAN              | —                                                                                                                              | —                 | empty diff — already present                          |
| #11218 | defaultTemperature required in getModelParams   | `0e5407aa76` | MINOR              | cerebras.ts, mistral.ts                                                                                                        | —                 | Provider signature changes                            |
| #11224 | Claude Opus 4.6 support across providers        | `47bba1c2f7` | CLEAN              | —                                                                                                                              | —                 | 30 files (provider types + i18n)                      |
| #11225 | gpt-5.3-codex model                             | `d5b7fdcfa7` | CLEAN              | —                                                                                                                              | —                 | 2 files (openai-codex.ts + test)                      |
| #11232 | Bedrock model ID for Opus 4.6                   | `8c6d1ef15d` | MINOR              | packages/types/src/providers/bedrock.ts                                                                                        | #11224            | Content conflict in bedrock types                     |
| #11233 | empty-string baseURL guard                      | `23d34154d0` | MINOR              | gemini.spec.ts, deepseek.ts, gemini.ts                                                                                         | —                 | Provider file conflicts                               |
| #11245 | batch consecutive tool calls in chat UI         | `7afa43635f` | MINOR              | ChatRow.tsx, ChatView.tsx                                                                                                      | —                 | Content conflicts in chat UI                          |
| #11253 | remove URL context/Grounding checkboxes         | `2053de7b40` | MAJOR              | gemini.ts, vertex.ts, gemini-handler.spec.ts, vertex.spec.ts                                                                   | #11233, #11303    | Gemini/Vertex diverged; needs product decision        |
| #11279 | IPC query handlers                              | `9b39d2242a` | MINOR              | packages/types/src/events.ts, src/extension/api.ts                                                                             | —                 | IPC event types diverged                              |
| #11281 | prevent parent task state loss                  | `6826e20da2` | CLEAN              | —                                                                                                                              | —                 | auto-merged Task.ts, ClineProvider.ts, tests          |
| #11295 | lock toggle to pin API config                   | `5d17f56db7` | MINOR              | pnpm-lock.yaml                                                                                                                 | —                 | Trivial lockfile conflict                             |
| #11297 | remove 9 low-usage providers                    | `ef2fec9a23` | MAJOR              | 18 files: 9 provider files (modify/delete), pnpm-lock.yaml, ApiOptions.tsx, package.json                                       | —                 | Needs product decision                                |
| #11302 | delegation-aware removeClineFromStack           | `70775f0ec1` | CLEAN              | —                                                                                                                              | #11281            | auto-merged ClineProvider.ts                          |
| #11303 | Gemini thinkingLevel validation                 | `a11be8b72e` | MINOR              | src/api/providers/gemini.ts                                                                                                    | #11233            | Content conflict                                      |
| #11313 | webview postMessage crashes                     | `62a0106ce0` | CLEAN              | —                                                                                                                              | —                 | auto-merged ClineProvider.ts                          |
| #11315 | Azure Foundry provider                          | `571be71005` | RE_IMPLEMENT       | 23 files: pnpm-lock.yaml, api/index.ts, package.json, ApiOptions.tsx, constants.ts, 18 i18n files                              | —                 | Must be reimplemented from scratch                    |
| #11331 | delegation race condition                       | `7c58f29975` | CLEAN              | —                                                                                                                              | #11302            | auto-merged task.ts, Task.ts, ClineProvider.ts, tests |
| #11335 | serialize taskHistory writes                    | `115d6c5fce` | CLEAN              | —                                                                                                                              | #11331            | auto-merged ClineProvider.ts + test                   |
| #11369 | task resumption in API module                   | `b02924530c` | CLEAN              | —                                                                                                                              | —                 | auto-merged api.ts                                    |
| #11374 | Azure Foundry fix                               | `4438fdadc6` | MINOR              | azure.spec.ts, azure.ts                                                                                                        | #11315            | modify/delete — azure files deleted in base; ⏭️ skipped (depends on #11315) |
| #11379 | harden delegation lifecycle                     | `b7857bcd6a` | AI_SDK_ENTANGLED   | 8 files: packages/types/src/task.ts, 3 test files, task-persistence/index.ts, Task.ts, ClineProvider.ts, ClineProvider.spec.ts | #11335            | Depends on RooMessage type system from AI SDK PRs #11380/#11409 |
| #11392 | remove browser use entirely                     | `fa9dff4a06` | MAJOR              | 15 files: Task.ts, ClineProvider.ts, system-prompt.spec.ts, mentions/, build-tools.ts, ChatView.tsx, SettingsView.tsx          | —                 | Cross-cutting removal; needs product decision         |
| #11410 | clean up repo-facing mode rules                 | `d2c52c9e09` | CLEAN              | —                                                                                                                              | —                 | trivially clean                                       |
| #11414 | remove built-in skills mechanism                | `b759b92f01` | MAJOR              | 30 files: built-in-skills.ts, generate-built-in-skills.ts, shared/skills.ts + skills infra                                     | #11157            | Skills files deleted in HEAD; needs product decision  |
| #11418 | delegation reopen flow                          | `b51af98278` | AI_SDK_ENTANGLED   | history-resume-delegation.spec.ts, ClineProvider.ts, ClineProvider.spec.ts                                                     | #11379            | Depends on RooMessage type system from AI SDK PRs #11380/#11409 |
| #11422 | cancel/resume abort races                       | `77b76a891f` | AI_SDK_ENTANGLED   | src/core/task/Task.ts                                                                                                          | #11418            | Depends on RooMessage type system from AI SDK PRs #11380/#11409 |
| #11425 | cli release v0.0.53                             | `f54f224a26` | MINOR              | CHANGELOG.md, package.json                                                                                                     | —                 | Version bump conflicts                                |
| #11440 | GLM-5 model for Z.ai                            | `cdf481c8f9` | MINOR              | src/api/providers/zai.ts, zai.spec.ts                                                                                          | —                 | Z.ai provider diverged slightly                       |

---

## 5. Product Decisions Required

The following 4 PRs perform **removals of existing functionality**. They cannot be reapplied without explicit stakeholder sign-off because the removal may conflict with current product direction or user expectations.

### #11253 — Remove URL Context/Grounding Checkboxes

- **What it removes:** URL context and Grounding search checkboxes from Gemini and Vertex providers
- **Why sign-off is needed:** Grounding is a user-visible feature toggle. Removing it changes the Gemini/Vertex UX and may affect users relying on grounded responses. Product must confirm these features are deprecated.
- **Conflict scope:** 4 files (gemini.ts, vertex.ts, and their spec files)
- **Dependencies:** Should be applied after #11233 and #11303

### #11297 — Remove 9 Low-Usage Providers

- **What it removes:** 9 API provider integrations deemed low-usage
- **Why sign-off is needed:** Removing providers breaks existing users of those providers. Product must confirm the usage data supports removal and that affected users have been notified or migrated.
- **Conflict scope:** 18 files — 9 provider files are modify/delete conflicts (files were modified in HEAD but the PR deletes them), plus pnpm-lock.yaml, ApiOptions.tsx, package.json
- **Dependencies:** None, but should be applied after all other provider-touching PRs

### #11392 — Remove Browser Use Entirely

- **What it removes:** The entire browser use feature (browser automation, mentions, tool definitions, UI toggles)
- **Why sign-off is needed:** Browser use is a significant user-facing capability. Its removal is a major product decision affecting workflows that depend on browser automation. Product must confirm this feature is being sunset.
- **Conflict scope:** 15 files — cross-cutting across Task.ts, ClineProvider.ts, system-prompt.spec.ts, mentions/, build-tools.ts, ChatView.tsx, SettingsView.tsx
- **Dependencies:** None, but deeply cross-cutting

### #11414 — Remove Built-In Skills Mechanism

- **What it removes:** The built-in skills infrastructure (generation scripts, shared types, skill definitions)
- **Why sign-off is needed:** This removes the mechanism for shipping skills bundled with the extension. Product must confirm that the skills system is moving entirely to user-managed skills (via SKILL.md files) and that no built-in skills are planned.
- **Conflict scope:** 30 files — skills infrastructure files deleted in HEAD
- **Dependencies:** Requires #11102 and #11157 to be applied first (skills UI must exist before it can be removed)

---

## 6. Recommended Execution Order

### Phase 1: Clean Cherry-Picks (Batch 1) ✅

1. ✅ Cherry-pick the 22 CLEAN PRs in the order listed in Batch 1 (§3)
2. ✅ Run `pnpm install` to regenerate lockfile
3. ✅ Run full test suite to confirm no regressions
4. ✅ Commit/tag checkpoint: `batch-1-clean-complete`

> Checkpoint tagged: branch `reapply/batch-1-clean-cherry-picks`, PR [#11473](https://github.com/RooCodeInc/Roo-Code/pull/11473)

### Phase 2: Minor Conflict Resolution (Batch 2) ✅

5. ✅ Cherry-pick #11232 (Bedrock Opus 4.6 model ID) — resolve 1 conflict in bedrock.ts
6. ✅ Cherry-pick #11233 (empty-string baseURL guard) — resolve 3 provider conflicts
7. ✅ Cherry-pick #11218 (defaultTemperature) — resolve 2 provider signature conflicts
8. ✅ Cherry-pick #11245 (batch tool calls in chat UI) — resolve 2 chat UI conflicts
9. ✅ Cherry-pick #11279 (IPC query handlers) — resolve 2 IPC type conflicts
10. ✅ Cherry-pick #11295 (lock toggle) — resolve lockfile conflict, regenerate with `pnpm install`
11. ✅ Cherry-pick #11303 (Gemini thinkingLevel) — resolve 1 gemini.ts conflict
12. ⏭️ ~~Cherry-pick #11374 (Azure Foundry fix)~~ — skipped (depends on #11315 Azure Foundry reimplementation)
13. ⚠️ ~~Cherry-pick #11379 (harden delegation lifecycle)~~ — AI_SDK_ENTANGLED — deferred
14. ⚠️ ~~Cherry-pick #11418 (delegation reopen flow)~~ — AI_SDK_ENTANGLED — deferred
15. ⚠️ ~~Cherry-pick #11422 (cancel/resume abort races)~~ — AI_SDK_ENTANGLED — deferred
16. ✅ Cherry-pick #11425 (cli release v0.0.53) — resolve version bump conflicts
17. ✅ Cherry-pick #11440 (GLM-5 for Z.ai) — resolve 2 Z.ai conflicts
18. ✅ Run full test suite
19. ✅ Commit/tag checkpoint: `batch-2-minor-complete`

> Checkpoint tagged: branch `reapply/batch-2-minor-conflicts`, PR [#11474](https://github.com/RooCodeInc/Roo-Code/pull/11474)

### Phase 2a: Deferred Delegation Re-implementation

These 3 delegation PRs require re-implementation without AI SDK dependency:

| Step | PR#    | Title                            | Status       | Action Required                          |
| ---- | ------ | -------------------------------- | ------------ | ---------------------------------------- |
| 20   | #11379 | harden delegation lifecycle      | ⏳ DEFERRED  | Re-implement without AI SDK dependency   |
| 21   | #11418 | delegation reopen flow           | ⏳ DEFERRED  | Re-implement without AI SDK dependency   |
| 22   | #11422 | cancel/resume abort races        | ⏳ DEFERRED  | Re-implement without AI SDK dependency   |

> These PRs depend on the `RooMessage` type system from AI SDK PRs #11380/#11409.
> The functionality must be re-implemented using the existing type system (without `RooMessage`,
> `readRooMessages`, `saveRooMessages`). The earlier delegation chain (#11281 → #11302 → #11331 → #11335)
> is clean and provides the foundation for this work.

### Phase 3: Product Decisions Gate

23. **HOLD** — Obtain stakeholder sign-off on:
    - [ ] #11253 — Remove Grounding checkboxes?
    - [ ] #11297 — Remove 9 low-usage providers?
    - [ ] #11392 — Remove browser use?
    - [ ] #11414 — Remove built-in skills mechanism?

### Phase 4: Skills Infrastructure Restoration (Batch 3)

24. Cherry-pick #11102 (skill mode dropdown) — resolve 44 conflicts (skills infra restoration)
25. Cherry-pick #11157 (improve Skills/Slash Commands UI) — resolve 48 conflicts
26. If #11414 approved: cherry-pick #11414 (remove built-in skills) — resolve 30 conflicts
27. If #11392 approved: cherry-pick #11392 (remove browser use) — resolve 15 conflicts
28. Run full test suite
29. Commit/tag checkpoint: `batch-3-skills-complete`

### Phase 5: Provider Removals (Batch 4)

30. If #11253 approved: cherry-pick #11253 (remove Grounding checkboxes) — resolve 4 conflicts
31. If #11297 approved: cherry-pick #11297 (remove 9 providers) — resolve 18 conflicts
32. Run full test suite
33. Commit/tag checkpoint: `batch-4-removals-complete`

### Phase 6: Azure Foundry Reimplementation (Batch 5)

34. Reimplement #11315 (Azure Foundry provider) from scratch, referencing original PR diff
35. Cherry-pick #11374 (Azure Foundry fix) on top of reimplemented provider
36. Run full test suite
37. Commit/tag checkpoint: `batch-5-azure-foundry-complete`

### Final

38. Run complete test suite (`pnpm test`)
39. Run linter (`pnpm lint`)
40. Manual smoke test of key flows (delegation, skills, providers)
41. Tag final checkpoint: `reapplication-complete`
