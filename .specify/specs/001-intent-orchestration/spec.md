# Spec: Intent orchestration and intent–code traceability

**Feature:** 001-intent-orchestration  
**Status:** Draft  
**Constitution:** [.specify/memory/constitution.md](../../memory/constitution.md)

---

## 1. Overview

Introduce an **orchestration layer** so that every AI agent action is tied to a specific user intent. The system uses a **two-stage state machine** (intent selection → execution) and treats **`.orchestration/`** as the source of truth for intents and traceability. This enables an AI-native IDE where “why” (intent) is always traceable to “what” (code/actions).

---

## 2. User stories

| ID   | As a…     | I want…                                                         | So that…                                                          |
| ---- | --------- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| US-1 | Developer | every agent action to be tied to an intent ID                   | I can trace code and edits back to the user’s intent              |
| US-2 | Developer | intents and the state machine to live under `.orchestration/`   | there is a single source of truth for intent definitions and flow |
| US-3 | Developer | a clear separation between “choose intent” and “execute intent” | the system is predictable and testable                            |
| US-4 | Developer | agent flows to go through the hook middleware pattern           | behavior is consistent and extensible                             |

---

## 3. Functional requirements

- **FR-1** Intent selection phase: the system resolves or selects the user’s intent and assigns an **intent ID** before any execution.
- **FR-2** Execution phase: agent actions (e.g. edits, runs, tool calls) are executed only after intent selection and must carry the **intent ID** for traceability.
- **FR-3** `.orchestration/` contains (at least):
    - Intent definitions (e.g. IDs, names, metadata).
    - State machine definition (states, transitions: selection → execution).
    - Traceability metadata linking intent IDs to actions/artifacts where applicable.
- **FR-4** All agent flows use the **hook middleware pattern**; no bypass paths that skip this pattern.
- **FR-5** Traceability: given an intent ID, it must be possible to determine which actions or artifacts were produced for that intent (e.g. logs, state, or references).

---

## 4. Acceptance criteria

- [ ] Intent selection and execution are implemented as distinct phases (two-stage state machine).
- [ ] Every agent action that affects code or UX is associated with an intent ID.
- [ ] `.orchestration/` exists and is the only source of truth for intent definitions and state machine definition.
- [ ] Agent flows use the hook middleware pattern; no ad-hoc paths around it.
- [ ] TypeScript strict mode remains enabled; new code follows existing repo patterns.
- [ ] AGENTS.md (and constitution) are not violated (e.g. Settings View still uses cachedState).

---

## 5. Constraints (from constitution)

- TypeScript strict mode required.
- Hook middleware pattern required for agent flows.
- `.orchestration/` is source of truth; do not duplicate or bypass.
- Two-stage state machine: intent selection → execution only.

---

## 6. Out of scope for this spec

- Detailed UI for “intent picker” or intent selection UX (can be a later spec).
- Migration of all existing agent entry points in one go (can be incremental).
- Specific storage format inside `.orchestration/` (e.g. JSON vs YAML) — to be decided in plan.

---

## 7. Review & acceptance checklist

- [ ] No [NEEDS CLARIFICATION] markers remain.
- [ ] Requirements are testable and unambiguous.
- [ ] Success criteria are measurable.
- [ ] Aligned with constitution (Articles I–VI).

---

_Next step: run `/speckit.clarify` to resolve ambiguities, or `/speckit.plan` to produce the technical implementation plan._
