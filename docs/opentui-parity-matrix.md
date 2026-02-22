# OpenTUI Feature Parity Matrix

**Issue:** [#11705](https://github.com/RooCodeInc/Roo-Code/issues/11705)
**Date:** 2026-02-22
**Scope:** All Ink primitives, components, and hooks used in `apps/cli/src/ui/` (69 files, ~10,619 LOC)

## Summary

| Category | Ink Components Used | OpenTUI Equivalent Available | Gap |
|----------|-------------------|------------------------------|-----|
| Layout | 5 | 3 (partial) | 2 |
| Text | 4 | 2 (partial) | 2 |
| Input | 4 | 1 (partial) | 3 |
| Selection | 2 | 1 (partial) | 1 |
| Lifecycle | 2 | 0 | 2 |
| Measurement | 2 | 0 | 2 |
| Testing | 1 | 0 | 1 |
| **Total** | **20** | **7** | **13** |

## Ink Primitives (from `ink`)

| # | Ink API | Usage Count | Files Using | OpenTUI Equivalent | Status | Notes |
|---|---------|-------------|-------------|-------------------|--------|-------|
| 1 | `Box` | 28 | 25 | `View` / flexbox container | Partial | OpenTUI uses different prop names for flexbox |
| 2 | `Text` | 30 | 27 | `Text` | Partial | Ink `Text` supports `color`, `bold`, `italic`, `dimColor`; OpenTUI text styling differs |
| 3 | `Newline` | 2 | 1 | `\n` in text | Yes | Trivial mapping |
| 4 | `useInput` | 7 | 7 | Key event handler | Partial | OpenTUI uses different key event model |
| 5 | `useApp` | 2 | 2 | App context | Gap | No direct equivalent; need custom exit handling |
| 6 | `DOMElement` | 2 | 1 | N/A | Gap | Ink-specific type for DOM node references |
| 7 | `measureElement` | 2 | 1 | N/A | Gap | No equivalent measurement API in OpenTUI |
| 8 | `Key` (type) | 1 | 1 | N/A | Gap | Ink-specific key type definition |
| 9 | `TextProps` (type) | 1 | 1 | N/A | Partial | Type can be recreated |

## @inkjs/ui Components

| # | Component | Usage Count | Files Using | OpenTUI Equivalent | Status | Notes |
|---|-----------|-------------|-------------|-------------------|--------|-------|
| 10 | `Select` | 2 | 2 | Custom select | Gap | Need custom implementation; used in App.tsx, OnboardingScreen.tsx |
| 11 | `Spinner` | 1 | 1 | Custom spinner | Gap | Used in LoadingText.tsx; need frame-based animation |

## Custom Components (Ink-dependent)

| # | Component | File | Ink APIs Used | Migration Complexity | Notes |
|---|-----------|------|---------------|---------------------|-------|
| 12 | `App` | App.tsx | Box, Text, useApp, useInput, Select | High | Main app shell; 450+ LOC, orchestrates all state |
| 13 | `ChatHistoryItem` | ChatHistoryItem.tsx | Box, Newline, Text | Medium | Message rendering with tool results |
| 14 | `Header` | Header.tsx | Text, Box | Low | Status bar display |
| 15 | `HorizontalLine` | HorizontalLine.tsx | Text | Low | Decorative separator |
| 16 | `Icon` | Icon.tsx | Box, Text, TextProps | Low | Unicode icon rendering |
| 17 | `LoadingText` | LoadingText.tsx | Spinner (@inkjs/ui) | Medium | Animated loading indicator |
| 18 | `MetricsDisplay` | MetricsDisplay.tsx | Text, Box | Low | Token/cost metrics |
| 19 | `MultilineTextInput` | MultilineTextInput.tsx | Box, Text, useInput, Key | High | Complex cursor management, line editing |
| 20 | `ProgressBar` | ProgressBar.tsx | Text | Low | Visual progress indicator |
| 21 | `ScrollArea` | ScrollArea.tsx | Box, DOMElement, measureElement, Text, useInput | High | Virtual scrolling with measurement |
| 22 | `ScrollIndicator` | ScrollIndicator.tsx | Box, Text | Low | Scroll position indicator |
| 23 | `ToastDisplay` | ToastDisplay.tsx | Text, Box | Low | Toast notification rendering |
| 24 | `TodoChangeDisplay` | TodoChangeDisplay.tsx | Box, Text | Low | Todo diff display |
| 25 | `TodoDisplay` | TodoDisplay.tsx | Box, Text | Low | Todo list rendering |
| 26 | `AutocompleteInput` | AutocompleteInput.tsx | useInput | High | Keyboard-driven autocomplete |
| 27 | `PickerSelect` | PickerSelect.tsx | Box, Text, useInput | Medium | Filterable selection list |
| 28 | `OnboardingScreen` | OnboardingScreen.tsx | Box, Text, Select | Medium | First-run setup wizard |

## Custom Hooks (Ink-dependent)

| # | Hook | File | Ink APIs Used | Migration Complexity | Notes |
|---|------|------|---------------|---------------------|-------|
| 29 | `useExtensionHost` | useExtensionHost.ts | useApp | Medium | Exit handling via Ink's app context |
| 30 | `useFocusManagement` | useFocusManagement.ts | None (pure state) | Low | Focus toggle logic; no Ink dependency |
| 31 | `useGlobalInput` | useGlobalInput.ts | useInput | Medium | Global keyboard shortcuts |
| 32 | `useInputHistory` | useInputHistory.ts | None (pure state) | Low | Input history navigation |
| 33 | `useFollowupCountdown` | useFollowupCountdown.ts | None (pure state) | Low | Timer-based countdown |
| 34 | `useMessageHandlers` | useMessageHandlers.ts | None (pure state) | Low | Message processing logic |
| 35 | `usePickerHandlers` | usePickerHandlers.ts | None (pure state) | Low | Picker interaction logic |
| 36 | `useTaskSubmit` | useTaskSubmit.ts | None (pure state) | Low | Task submission logic |
| 37 | `useTerminalSize` | useTerminalSize.ts | None (process.stdout) | Low | Terminal dimensions |
| 38 | `useToast` | useToast.ts | None (pure state) | Low | Toast state management |

## Tool Components

| # | Component | File | Ink APIs Used | Migration Complexity |
|---|-----------|------|---------------|---------------------|
| 39 | `CommandTool` | CommandTool.tsx | Box, Text | Low |
| 40 | `CompletionTool` | CompletionTool.tsx | Box, Text | Low |
| 41 | `FileReadTool` | FileReadTool.tsx | Box, Text | Low |
| 42 | `FileWriteTool` | FileWriteTool.tsx | Box, Text | Low |
| 43 | `GenericTool` | GenericTool.tsx | Box, Text | Low |
| 44 | `ModeTool` | ModeTool.tsx | Box, Text | Low |
| 45 | `SearchTool` | SearchTool.tsx | Box, Text | Low |

## Autocomplete Triggers

| # | Component | File | Ink APIs Used | Migration Complexity |
|---|-----------|------|---------------|---------------------|
| 46 | `FileTrigger` | FileTrigger.tsx | Box, Text | Low |
| 47 | `HelpTrigger` | HelpTrigger.tsx | Box, Text | Low |
| 48 | `HistoryTrigger` | HistoryTrigger.tsx | Box, Text | Low |
| 49 | `ModeTrigger` | ModeTrigger.tsx | Box, Text | Low |
| 50 | `SlashCommandTrigger` | SlashCommandTrigger.tsx | Box, Text | Low |

## State Management

| # | File | Ink Dependency | Migration Complexity | Notes |
|---|------|---------------|---------------------|-------|
| 51 | `store.ts` | None (Zustand) | None | Pure Zustand store; framework-agnostic |
| 52 | `uiStateStore.ts` | None (Zustand) | None | UI state; framework-agnostic |

## Testing Infrastructure

| # | Item | Current | OpenTUI Equivalent | Gap |
|---|------|---------|-------------------|-----|
| 53 | `ink-testing-library` | Used in 10 test files | N/A | Full gap -- need custom test renderer |
| 54 | Component snapshot tests | Ink render output | N/A | Need new snapshot format |

## Migration Complexity Summary

| Complexity | Count | Percentage |
|------------|-------|------------|
| None (framework-agnostic) | 12 | 22% |
| Low | 24 | 44% |
| Medium | 8 | 15% |
| High | 4 | 7% |
| Full gap (needs custom impl) | 6 | 11% |
| **Total tracked items** | **54** | **100%** |

## Critical Path Items

The following items are on the critical path for any migration and should be addressed first:

1. **ScrollArea** -- Uses `measureElement` and `DOMElement` which have no OpenTUI equivalent
2. **MultilineTextInput** -- Complex cursor/key handling tightly coupled to Ink's `useInput`
3. **AutocompleteInput** -- Keyboard-driven interaction depends on Ink's input model
4. **App (main shell)** -- Orchestrates all components; highest coupling to Ink lifecycle
5. **Testing infrastructure** -- `ink-testing-library` has no OpenTUI counterpart
6. **Select component** -- `@inkjs/ui` Select used in onboarding and main app
