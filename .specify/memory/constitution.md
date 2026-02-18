# Roo Code Project Constitution

We are building an **AI-Native IDE with Intent–Code Traceability**. All specs, plans, and implementation must align with these principles.

---

## I. Intent–Code Traceability (Non‑negotiable)

- **All agent actions must be traceable to intent IDs.** Every action taken by the AI agent must be linkable to a specific user intent.
- The **`.orchestration/` directory is the source of truth** for intent definitions, state machine definitions, and traceability metadata. Do not bypass or duplicate it.
- We implement the **two-stage state machine**: **(1) intent selection** → **(2) execution**. Selection and execution are distinct phases; design and code must reflect this.

---

## II. Hook Middleware Pattern

- We follow the **hook middleware pattern** from the challenge. Agent flows and state transitions go through this pattern; do not introduce ad-hoc or parallel patterns that skip it.

---

## III. TypeScript & Strictness

- We use **TypeScript with strict mode** enabled. No disabling strict checks without documented justification and review.
- Follow existing patterns in the repo (React in webview-ui, extension APIs in `src/`, shared types in `packages/types`). Prefer project tooling: ESLint, Prettier, pnpm, Turbo.

---

## IV. Settings View & State

**Source:** [AGENTS.md](../AGENTS.md)

- When working on **SettingsView** (or any settings UI that edits extension state), inputs **must** bind to the local **cachedState**, NOT the live `useExtensionState()`.
- **cachedState** is the buffer for user edits until the user explicitly clicks **Save**. Wiring inputs directly to live state causes **race conditions**. Do not do it.

---

## V. Testing & Documentation

- New or changed behavior should be covered by tests where practical. UI/state changes must respect the Settings View pattern (cachedState → Save) and the two-stage state machine.
- Update AGENTS.md when introducing new patterns or constraints. Keep README and contributor docs accurate.

---

## VI. Scope & Simplicity

- Prefer small, reviewable changes. Break large features into spec/plan/tasks with clear deliverables.
- Avoid speculative features; tie work to concrete user or product needs.

---

_This constitution is the source of truth for how we build and maintain Roo Code. Specs and implementation plans must reference it and must not contradict it._
