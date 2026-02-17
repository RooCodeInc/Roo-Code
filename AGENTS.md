# AGENTS.md

This file provides guidance to agents when working with code in this repository.

- Settings View Pattern: When working on `SettingsView`, inputs must bind to the local `cachedState`, NOT the live `useExtensionState()`. The `cachedState` acts as a buffer for user edits, isolating them from the `ContextProxy` source-of-truth until the user explicitly clicks "Save". Wiring inputs directly to the live state causes race conditions.
- Spec-Driven Development (SDD) Enforcement:
    - For mutation-capable tasks, select an intent from `.orchestration/active_intents.yaml` before writes or destructive commands.
    - Respect `owned_scope` boundaries. If a requested file is outside scope, request scope expansion by updating the relevant intent.
    - Preserve append-only behavior of `.orchestration/agent_trace.jsonl`.
    - Update `.orchestration/intent_map.md` whenever changes represent intent evolution.
    - Keep work aligned with canonical specs in `specs/000-system-charter.md` through `specs/008-definition-of-done.md`.
