# OpenTUI Migration Implementation Plan

**Issue:** [#11705](https://github.com/RooCodeInc/Roo-Code/issues/11705)
**Date:** 2026-02-22
**Duration:** ~8 weeks (60 tasks across 5 waves)
**ADR:** [docs/adr/cli-opentui-runtime.md](./adr/cli-opentui-runtime.md)

## Overview

This plan covers the full migration path from Ink to OpenTUI for the Roo CLI terminal UI. Per the ADR, the strategy is **Node.js-first with opt-in experimental OpenTUI support**. Each wave builds on the previous one and includes a go/no-go checkpoint.

## Wave 0: Discovery (Complete)

**Duration:** 1 week | **Status:** Complete

| # | Task | Deliverable | Status |
|---|------|------------|--------|
| 1 | Inventory Ink UI capabilities | [Parity Matrix](./opentui-parity-matrix.md) | Done |
| 2 | Build feature parity matrix | [Parity Matrix](./opentui-parity-matrix.md) | Done |
| 3 | Validate OpenTUI runtime constraints | [ADR](./adr/cli-opentui-runtime.md) | Done |
| 4 | Write ADR for runtime strategy | [ADR](./adr/cli-opentui-runtime.md) | Done |
| 5 | Define MVP scope and non-goals | This document (Wave 1 scope) | Done |
| 6 | Instrument current CLI UX timings | [Performance Baseline](./opentui-baseline.md) | Done |
| 7 | Define terminal compatibility matrix | [Performance Baseline](./opentui-baseline.md) | Done |

## Wave 1: Foundation (2 weeks)

**Goal:** Scaffolding, dual-renderer architecture, minimal rendering.

**Go/No-Go Criteria:** OpenTUI can render a static text screen in Node.js behind the `--ui opentui` flag.

| # | Task | Description | Estimate | Dependencies |
|---|------|-------------|----------|--------------|
| 8 | Add OpenTUI dependency | Vendor or git-dep OpenTUI source into `apps/cli` | 2h | None |
| 9 | Create `tsconfig.ui-next.json` | TypeScript config for OpenTUI/SolidJS compilation | 1h | #8 |
| 10 | Create build script for ui-next | `apps/cli/scripts/build-ui-next.ts` | 2h | #9 |
| 11 | Add `--ui` flag to CLI | Extend `commander` options in `run.ts` | 1h | None |
| 12 | Create renderer selection logic | Switch in `run.ts` based on `--ui` flag | 2h | #11 |
| 13 | Create `ui-next/main.tsx` | OpenTUI app entry point | 2h | #8, #12 |
| 14 | Create `ui-next/app.tsx` | Root component with basic layout | 4h | #13 |
| 15 | Implement view-model contracts | Define interfaces for UI state consumed by both renderers | 4h | None |
| 16 | Create adapter layer | Bridge between Zustand stores and OpenTUI reactive state | 4h | #15 |
| 17 | Add error boundary with fallback | Catch OpenTUI errors, fall back to plain text output | 2h | #14 |
| 18 | Wire exit/lifecycle hooks | Process exit, SIGINT handling for OpenTUI context | 2h | #14 |
| 19 | Add smoke test for ui-next | Vitest test that OpenTUI app initializes without crash | 2h | #14 |
| 20 | Update CI to build ui-next | Add build step for OpenTUI target | 1h | #10 |

## Wave 2: Core Components (2 weeks)

**Goal:** Port essential display components for basic chat interaction.

**Go/No-Go Criteria:** Can display a streaming chat message and show the header/footer.

| # | Task | Description | Estimate | Dependencies |
|---|------|-------------|----------|--------------|
| 21 | Port `Text` styling helpers | Color, bold, dim, italic text rendering | 2h | Wave 1 |
| 22 | Port `Box` layout equivalent | Flexbox container with padding/margin/border | 4h | Wave 1 |
| 23 | Port `Header` component | Status bar with mode, model, metrics | 2h | #21, #22 |
| 24 | Port `HorizontalLine` | Separator component | 1h | #21 |
| 25 | Port `Icon` component | Unicode icon rendering | 1h | #21 |
| 26 | Port `LoadingText` / Spinner | Frame-based animation without @inkjs/ui | 4h | #21 |
| 27 | Port `ProgressBar` | Visual progress indicator | 2h | #21 |
| 28 | Port `ChatHistoryItem` | Message rendering with markdown/code blocks | 8h | #21, #22 |
| 29 | Port `MetricsDisplay` | Token count and cost display | 2h | #21, #22 |
| 30 | Port `ToastDisplay` | Toast notification component | 2h | #21, #22 |
| 31 | Port `TodoDisplay` | Checklist rendering | 2h | #21, #22 |
| 32 | Port `TodoChangeDisplay` | Todo diff display | 2h | #21, #22 |
| 33 | Port tool display components (7) | CommandTool, FileReadTool, FileWriteTool, etc. | 8h | #21, #22 |
| 34 | Create component test helpers | Test utilities replacing `ink-testing-library` | 4h | Wave 1 |
| 35 | Add component unit tests | Tests for ported components | 8h | #34 |

## Wave 3: Input and Interaction (2 weeks)

**Goal:** Port input handling, autocomplete, and selection components.

**Go/No-Go Criteria:** Can type a message, use autocomplete, and submit to the agent.

| # | Task | Description | Estimate | Dependencies |
|---|------|-------------|----------|--------------|
| 36 | Create input event handler | Replace Ink's `useInput` with OpenTUI key events | 8h | Wave 2 |
| 37 | Port `MultilineTextInput` | Full cursor management and line editing | 12h | #36 |
| 38 | Port `ScrollArea` | Scrollable container (without `measureElement`) | 12h | #22, #36 |
| 39 | Port `ScrollIndicator` | Scroll position display | 2h | #38 |
| 40 | Port `AutocompleteInput` | Keyboard-driven autocomplete overlay | 8h | #36, #37 |
| 41 | Port `PickerSelect` | Filterable selection list | 6h | #36, #22 |
| 42 | Port autocomplete triggers (5) | File, Help, History, Mode, SlashCommand triggers | 8h | #40 |
| 43 | Port `OnboardingScreen` | First-run wizard with Select replacement | 4h | #41 |
| 44 | Port `useGlobalInput` hook | Global keyboard shortcut handling | 4h | #36 |
| 45 | Port `useFocusManagement` | Focus toggle between scroll area and input | 4h | #36 |
| 46 | Integration test: full chat flow | End-to-end test of message input, display, scroll | 8h | #37-#45 |

## Wave 4: Polish and Evaluation (2 weeks)

**Goal:** Performance testing, cross-platform validation, go/no-go decision.

| # | Task | Description | Estimate | Dependencies |
|---|------|-------------|----------|--------------|
| 47 | Run performance benchmarks | Collect all metrics from baseline doc | 4h | Wave 3 |
| 48 | Compare startup time | Ink vs OpenTUI cold/warm start | 2h | #47 |
| 49 | Compare input latency | Ink vs OpenTUI keypress-to-render | 2h | #47 |
| 50 | Compare memory usage | Heap profiles under load | 2h | #47 |
| 51 | Compare render cadence | FPS during streaming | 2h | #47 |
| 52 | Test on iTerm2 | macOS validation | 2h | Wave 3 |
| 53 | Test on Terminal.app | macOS fallback validation | 2h | Wave 3 |
| 54 | Test on GNOME Terminal | Linux validation | 2h | Wave 3 |
| 55 | Test on Windows Terminal | Windows validation | 2h | Wave 3 |
| 56 | Test on tmux | Multiplexer validation | 2h | Wave 3 |
| 57 | Test on VS Code terminal | IDE terminal validation | 1h | Wave 3 |
| 58 | Document findings | Update ADR with results | 4h | #47-#57 |
| 59 | Write go/no-go recommendation | Based on all collected data | 2h | #58 |
| 60 | Present to team | Summary of findings and recommendation | 2h | #59 |

## MVP Scope (Wave 1)

### In Scope

- Static text rendering (header, messages, status)
- `--ui opentui` flag for opt-in
- Error boundary with plain-text fallback
- Basic layout (vertical stacking, padding)
- Process lifecycle management

### Out of Scope (Deferred)

- Input handling (Wave 3)
- Autocomplete (Wave 3)
- Scroll virtualization (Wave 3)
- Mouse support
- Custom themes
- Animation beyond spinner
- Accessibility features
- Plugin/extension API

## Non-Goals

These items are explicitly not part of this migration effort:

1. **Changing the non-TUI modes** -- `--print` and `--output-format stream-json` are unaffected
2. **Modifying the agent/core** -- Only `apps/cli/src/ui*` and `run.ts` are in scope
3. **Removing Ink** -- Ink remains the default renderer; OpenTUI is experimental
4. **Requiring Bun** -- Node.js compatibility is mandatory per the ADR
5. **Changing the build system** -- tsup remains the bundler; ui-next gets its own tsconfig

## Risk Register

| # | Risk | Probability | Impact | Mitigation | Owner |
|---|------|------------|--------|------------|-------|
| R1 | OpenTUI cannot run on Node.js | Medium | Critical | Validate in Wave 1 task #13; abort if fails | CLI team |
| R2 | ScrollArea cannot be ported without measureElement | Medium | High | Implement custom measurement using ANSI escape sequences | CLI team |
| R3 | Input latency regression | Low | High | Benchmark in Wave 4; revert to Ink if >2x slower | CLI team |
| R4 | Test coverage drops significantly | Medium | Medium | Build test helpers in Wave 2 (#34); maintain parity | CLI team |
| R5 | Cross-terminal rendering inconsistencies | Medium | Medium | Test matrix in Wave 4; document known issues | CLI team |
| R6 | OpenTUI API breaks during migration | Low | Medium | Pin to specific commit/version; vendor if needed | CLI team |

## Effort Summary

| Wave | Duration | Tasks | Estimated Hours |
|------|----------|-------|----------------|
| Wave 0 (Discovery) | 1 week | 7 | 20h |
| Wave 1 (Foundation) | 2 weeks | 13 | 29h |
| Wave 2 (Core Components) | 2 weeks | 15 | 53h |
| Wave 3 (Input/Interaction) | 2 weeks | 11 | 76h |
| Wave 4 (Polish/Evaluation) | 2 weeks | 14 | 32h |
| **Total** | **~8 weeks** | **60** | **~210h** |

## Decision Points

1. **After Wave 1:** Can OpenTUI render anything on Node.js? If no, abort.
2. **After Wave 2:** Is component porting feasible at acceptable quality? If not, abort.
3. **After Wave 3:** Does the full interaction model work? If critical gaps exist, pause.
4. **After Wave 4:** Performance and compatibility results drive final go/no-go.

## References

- [ADR: CLI OpenTUI Runtime Strategy](./adr/cli-opentui-runtime.md)
- [Feature Parity Matrix](./opentui-parity-matrix.md)
- [Performance Baseline](./opentui-baseline.md)
- [Issue #11705](https://github.com/RooCodeInc/Roo-Code/issues/11705)
- [Existing prototype branch: `feat/cli-ui-next-opentui`](https://github.com/RooCodeInc/Roo-Code/tree/feat/cli-ui-next-opentui)
