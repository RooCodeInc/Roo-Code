# Changelog

All notable changes to the `@roo-code/cli` package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-19

### Added

- **NDJSON Stdin Protocol**: Overhauled the stdin prompt stream from raw text lines to a structured NDJSON command protocol (`start`/`message`/`cancel`/`ping`/`shutdown`) with requestId correlation, ack/done/error lifecycle events, and queue telemetry. See [`stdin-stream.ts`](src/ui/stdin-stream.ts) for implementation.
- **List Subcommands**: New `list` subcommands (`commands`, `modes`, `models`) for programmatic discovery of available CLI capabilities.
- **Shared Utilities**: Added `isRecord` guard utility for improved type safety.

### Changed

- **Modularized Architecture**: Extracted stdin stream logic from `run.ts` into dedicated [`stdin-stream.ts`](src/ui/stdin-stream.ts) module for better code organization and maintainability.

### Fixed

- Fixed a bug in `Task.ts` affecting CLI operation.

## [0.0.55] - 2026-02-17

### Fixed

- **Stdin Stream Mode**: Fixed issue where new tasks were incorrectly being created in stdin-prompt-stream mode. The mode now properly reuses the existing task for subsequent prompts instead of creating new tasks.

## [0.0.54] - 2026-02-15

### Added

- **Stdin Stream Mode**: New `stdin-prompt-stream` mode that reads prompts from stdin, allowing batch processing and piping multiple tasks. Each line of stdin is processed as a separate prompt with streaming JSON output. See [`stdin-prompt-stream.ts`](src/ui/stdin-prompt-stream.ts) for implementation.

### Fixed

- Fixed JSON emitter state not being cleared between tasks in stdin-prompt-stream mode
- Fixed inconsistent user role for prompt echo partials in stream-json mode

## [0.0.53] - 2026-02-12

### Changed

- **Auto-Approve by Default**: The CLI now auto-approves all actions (tools, commands, browser, MCP) by default. Followup questions auto-select the first suggestion after a 60-second timeout.
- **New `--require-approval` Flag**: Replaced `-y`/`--yes`/`--dangerously-skip-permissions` flags with a new `-a, --require-approval` flag for users who want manual approval prompts before actions execute.

### Fixed

- Spamming the escape key to cancel a running task no longer crashes the cli.

## [0.0.52] - 2026-02-09

### Added

- **Linux Support**: Added support for `linux-arm64`.

## [0.0.51] - 2026-02-06

### Changed

- **Default Model Update**: Changed the default model from Opus 4.5 to Opus 4.6 for improved performance and capabilities

## [0.0.50] - 2026-02-05

### Added

- **Linux Support**: The CLI now supports Linux platforms in addition to macOS
- **Roo Provider API Key Support**: Allow `--api-key` flag and `ROO_API_KEY` environment variable for the roo provider instead of requiring cloud auth token
- **Exit on Error**: New `--exit-on-error` flag to exit immediately on API request errors instead of retrying, useful for CI/CD pipelines

### Changed

- **Improved Dev Experience**: Dev scripts now use `tsx` for running directly from source without building first
- **Path Resolution Fixes**: Fixed path resolution in [`version.ts`](src/lib/utils/version.ts), [`extension.ts`](src/lib/utils/extension.ts), and [`extension-host.ts`](src/agent/extension-host.ts) to work from both source and bundled locations
- **Debug Logging**: Debug log file (`~/.roo/cli-debug.log`) is now disabled by default unless `--debug` flag is passed
- Updated README with complete environment variable table and dev workflow documentation

### Fixed

- Corrected example in install script

### Removed

- Dropped macOS 13 support

## [0.0.49] - 2026-01-18

### Added

- **Output Format Options**: New `--output-format` flag to control CLI output format for scripting and automation:
    - `text` (default) - Human-readable interactive output
    - `json` - Single JSON object with all events and final result at task completion
    - `stream-json` - NDJSON (newline-delimited JSON) for real-time streaming of events
    - See [`json-events.ts`](src/types/json-events.ts) for the complete event schema
    - New [`JsonEventEmitter`](src/agent/json-event-emitter.ts) for structured output generation

## [0.0.48] - 2026-01-17

### Changed

- Simplified authentication callback flow by using HTTP redirects instead of POST requests with CORS headers for improved browser compatibility

## [0.0.47] - 2026-01-17

### Added

- **Workspace flag**: New `-w, --workspace <path>` option to specify a custom workspace directory instead of using the current working directory
- **Oneshot mode**: New `--oneshot` flag to exit upon task completion, useful for scripting and automation (can also be saved in settings via [`CliSettings.oneshot`](src/types/types.ts))

### Changed

- Skip onboarding flow when a provider is explicitly specified via `--provider` flag or saved in settings
- Unified permission flags: Combined approval-skipping flags into a single option for Claude Code-like CLI compatibility
- Improved Roo Code Router authentication flow and error messaging

### Fixed

- Removed unnecessary timeout that could cause issues with long-running tasks
- Fixed authentication token validation for Roo Code Router provider

## [0.0.45] - 2026-01-08

### Changed

- **Major Refactor**: Extracted ~1400 lines from [`App.tsx`](src/ui/App.tsx) into reusable hooks and utilities for better maintainability:

    - [`useExtensionHost`](src/ui/hooks/useExtensionHost.ts) - Extension host connection and lifecycle management
    - [`useMessageHandlers`](src/ui/hooks/useMessageHandlers.ts) - Message processing and state updates
    - [`useTaskSubmit`](src/ui/hooks/useTaskSubmit.ts) - Task submission logic
    - [`useGlobalInput`](src/ui/hooks/useGlobalInput.ts) - Global keyboard shortcut handling
    - [`useFollowupCountdown`](src/ui/hooks/useFollowupCountdown.ts) - Auto-approval countdown logic
    - [`useFocusManagement`](src/ui/hooks/useFocusManagement.ts) - Input focus state management
    - [`usePickerHandlers`](src/ui/hooks/usePickerHandlers.ts) - Picker component event handling
    - [`uiStateStore`](src/ui/stores/uiStateStore.ts) - UI-specific state (showExitHint, countdown, etc.)
    - Tool data utilities ([`extractToolData`](src/ui/utils/toolDataUtils.ts), `formatToolOutput`, etc.)
    - [`HorizontalLine`](src/ui/components/HorizontalLine.tsx) component

- **Performance Optimizations**:

    - Added RAF-style scroll throttling to reduce state updates
    - Stabilized `useExtensionHost` hook return values with `useCallback`/`useMemo`
    - Added streaming message debouncing to batch rapid partial updates
    - Added shallow array equality checks to prevent unnecessary re-renders

- Simplified [`ModeTool`](src/ui/components/tools/ModeTool.tsx) layout to horizontal with mode suffix
- Simplified logging by removing verbose debug output and adding first/last partial message logging pattern
- Updated Nerd Font icon codepoints in [`Icon`](src/ui/components/Icon.tsx) component

### Added

- `#` shortcut in help trigger for quick access to task history autocomplete

### Fixed

- Fixed a crash in message handling
- Added protected file warning in tool approval prompts
- Enabled `alwaysAllowWriteProtected` for non-interactive mode

### Removed

- Removed unused `renderLogger.ts` utility file

### Tests

- Updated extension-host tests to expect `[Tool Request]` format
- Updated Icon tests to expect single-char Nerd Font icons

## [0.0.44] - 2026-01-08

### Added

- **Tool Renderer Components**: Specialized renderers for displaying tool outputs with optimized formatting for each tool type. Each renderer provides a focused view of its data structure.

    - [`FileReadTool`](src/ui/components/tools/FileReadTool.tsx) - Display file read operations with syntax highlighting
    - [`FileWriteTool`](src/ui/components/tools/FileWriteTool.tsx) - Show file write/edit operations with diff views
    - [`SearchTool`](src/ui/components/tools/SearchTool.tsx) - Render search results with context
    - [`CommandTool`](src/ui/components/tools/CommandTool.tsx) - Display command execution with output
    - [`BrowserTool`](src/ui/components/tools/BrowserTool.tsx) - Show browser automation actions
    - [`ModeTool`](src/ui/components/tools/ModeTool.tsx) - Display mode switching operations
    - [`CompletionTool`](src/ui/components/tools/CompletionTool.tsx) - Show task completion status
    - [`GenericTool`](src/ui/components/tools/GenericTool.tsx) - Fallback renderer for other tools

- **History Trigger**: New `#` trigger for task history autocomplete with fuzzy search support. Type `#` at the start of a line to browse and resume previous tasks.

    - [`HistoryTrigger.tsx`](src/ui/components/autocomplete/triggers/HistoryTrigger.tsx) - Trigger implementation with fuzzy filtering
    - Shows task status, mode, and relative timestamps
    - Supports keyboard navigation for quick task selection

- **Release Confirmation Prompt**: The release script now prompts for confirmation before creating a release.

### Fixed

- Task history picker selection and navigation issues
- Mode switcher keyboard handling bug

### Changed

- Reorganized test files into `__tests__` directories for better project structure
- Refactored utility modules into dedicated `utils/` directory

## [0.0.43] - 2026-01-07

### Added

- **Toast Notification System**: New toast notifications for user feedback with support for info, success, warning, and error types. Toasts auto-dismiss after a configurable duration and are managed via Zustand store.

    - New [`ToastDisplay`](src/ui/components/ToastDisplay.tsx) component for rendering toast messages
    - New [`useToast`](src/ui/hooks/useToast.ts) hook for managing toast state and displaying notifications

- **Global Input Sequences Registry**: Centralized system for handling keyboard shortcuts at the application level, preventing conflicts with input components.

    - New [`globalInputSequences.ts`](src/ui/utils/globalInputSequences.ts) utility module
    - Support for Kitty keyboard protocol (CSI u encoding) for better terminal compatibility
    - Built-in sequences for `Ctrl+C` (exit) and `Ctrl+M` (mode cycling)

- **Local Tarball Installation**: The install script now supports installing from a local tarball via the `ROO_LOCAL_TARBALL` environment variable, useful for offline installation or testing pre-release builds.

### Changed

- **MultilineTextInput**: Updated to respect global input sequences, preventing the component from consuming shortcuts meant for application-level handling.

### Tests

- Added comprehensive tests for the toast notification system
- Added tests for global input sequence matching

## [0.0.42] - 2025-01-07

The cli is alive!
