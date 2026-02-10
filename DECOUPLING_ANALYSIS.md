# Decoupling Roo Code from VS Code: Deep Analysis

## Executive Summary

Roo Code is a sophisticated AI coding assistant currently packaged as a VS Code extension with **~383 TypeScript source files** in `src/`, of which **~177 files (46%)** import from the `vscode` module. The codebase has already made significant progress toward decoupling through a monorepo architecture with shared packages, a `vscode-shim` package, and a working CLI application. However, the core orchestration layer (`Task.ts`, `ClineProvider.ts`, `webviewMessageHandler.ts`) remains deeply coupled to VS Code APIs.

This analysis maps the full dependency surface, identifies decoupling boundaries, and proposes a phased architecture for making Roo Code truly platform-agnostic.

---

## 1. Current Architecture Overview

### Monorepo Structure

```
Roo-Code/
├── src/                        # VS Code extension (main codebase, 383 files)
├── webview-ui/                 # React frontend (Vite + Tailwind)
├── apps/
│   ├── cli/                    # CLI app (Ink/React TUI)
│   ├── web-roo-code/           # Next.js marketing + cloud dashboard
│   ├── web-evals/              # Evaluation suite
│   └── vscode-e2e/             # E2E tests
├── packages/
│   ├── types/                  # Shared TypeScript types (ZERO vscode deps)
│   ├── core/                   # Platform-agnostic logic (ZERO vscode deps)
│   ├── vscode-shim/            # VS Code API mock (ZERO external deps)
│   ├── cloud/                  # Cloud services
│   ├── telemetry/              # Analytics
│   └── ipc/                    # Inter-process communication
```

### How the CLI Already Works

The CLI (`apps/cli/`) demonstrates the current decoupling strategy:

1. **Module hijacking**: Intercepts `require("vscode")` calls via `Module._resolveFilename`
2. **vscode-shim injection**: Returns `createVSCodeAPI()` mock when extension code requests the `vscode` module
3. **Same bundle**: Loads the same compiled `extension.js` bundle that VS Code uses
4. **Message-based communication**: Extension and CLI communicate through a `postMessage` protocol

This approach works but is fundamentally a **shim strategy** rather than a **clean architecture strategy**. The extension code still thinks it's running in VS Code.

---

## 2. VS Code API Dependency Map

### By API Category (across 177 files)

| Category | Occurrences | Files | Severity |
|----------|------------|-------|----------|
| `vscode.workspace` (config, folders, documents, diagnostics) | ~236 | 64 | **Critical** |
| `vscode.window` (editors, dialogs, notifications, terminals) | ~336 | 48 | **Critical** |
| `vscode.ExtensionContext` / lifecycle | ~92 | 45 | **High** |
| `vscode.Uri` / path handling | ~75 | 29 | **Medium** |
| `vscode.Diagnostic` / language features | ~77 | 6 | **Medium** |
| `vscode.Range`, `Position`, `TextDocument` | ~71 | 10 | **Medium** |
| `vscode.OutputChannel` / logging | ~46 | 20 | **Low** |
| `vscode.WebviewPanel` / webview rendering | ~35 | 10 | **Low** (UI-specific) |
| `vscode.Terminal` | ~7 | 3 | **Medium** |
| `vscode.LanguageModelChat` (Copilot LM API) | ~12 | 2 | **Low** (optional) |
| `vscode.CodeAction` | ~13 | 1 | **Low** (UI-specific) |

### Most-Coupled Files (the "Big Three")

| File | Lines | vscode refs | Role |
|------|-------|-------------|------|
| `src/core/webview/webviewMessageHandler.ts` | 3,611 | 109 | Routes all webview messages |
| `src/core/webview/ClineProvider.ts` | 3,612 | 41 | Manages task lifecycle + webview |
| `src/core/task/Task.ts` | 4,873 | 2 | Core task orchestration |

Notably, `Task.ts` has only **2 direct vscode references** (both `vscode.workspace.getConfiguration` calls), making it nearly decoupled already. The remaining coupling is indirect through imported modules.

### Already Decoupled (~206 files, 54%)

These modules have **zero** `vscode` imports:

- **API providers** (30+ files): `src/api/providers/` - All except `vscode-lm.ts`
- **API transforms** (8 files): Stream processing, format conversion
- **Shared utilities** (24 files): Types, modes, tools, cost calculation
- **Pure utilities** (16 files): Token counting, config, errors, JSON schema
- **`packages/types`**: All domain type definitions
- **`packages/core`**: Custom tools, message utils, debug logging, worktree service

---

## 3. Coupling Analysis by Domain

### 3.1 Storage & Configuration (HIGH coupling)

**Current state**: All persistent state flows through `vscode.ExtensionContext`:
- `context.globalState` - Key-value store for settings, task history, UI state
- `context.secrets` - API keys and tokens
- `context.globalStorageUri` - File-based storage path

**Key files**:
- `src/core/config/ContextProxy.ts` - Wraps ExtensionContext with typed accessors
- `src/core/config/ProviderSettingsManager.ts` - Multi-profile API config storage
- `src/utils/storage.ts` - Storage path resolution

**Decoupling approach**: Extract a `StorageService` interface:
```typescript
interface StorageService {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T): Promise<void>
  getSecret(key: string): Promise<string | undefined>
  setSecret(key: string, value: string): Promise<void>
  getStoragePath(): string
}
```

**Existing precedent**: `vscode-shim` already implements `Memento` and `SecretStorage` backed by JSON files.

### 3.2 File System Operations (MEDIUM coupling)

**Current state**: Hybrid approach mixing Node.js `fs` and `vscode.workspace.fs`:
- File read/write in tools: Mostly Node.js `fs/promises` (already portable)
- Workspace-aware operations: `vscode.workspace.fs.stat()`, `.readFile()`, `.writeFile()`
- Path resolution: `vscode.workspace.workspaceFolders`, `vscode.Uri.file()`

**Key files**:
- `src/core/tools/ReadFileTool.ts`, `WriteToFileTool.ts`, `EditFileTool.ts` - Use Node.js `fs`
- `src/integrations/workspace/WorkspaceTracker.ts` - Uses `vscode.workspace.fs`
- `src/utils/path.ts` - `getWorkspacePath()` depends on `vscode.workspace.workspaceFolders`

**Decoupling approach**: The tool implementations are mostly portable. The key abstraction needed is workspace path resolution:
```typescript
interface WorkspaceService {
  getWorkspacePath(): string
  getWorkspaceFolders(): string[]
  resolveRelativePath(relativePath: string): string
}
```

### 3.3 Terminal / Command Execution (MEDIUM coupling)

**Current state**: Uses VS Code's integrated terminal API:
- `vscode.window.createTerminal()` - Terminal creation
- Shell integration APIs - Command tracking, exit codes
- `vscode.env.clipboard` - Terminal output capture (clipboard workaround)

**Key files**:
- `src/integrations/terminal/Terminal.ts` - VS Code terminal wrapper
- `src/integrations/terminal/TerminalRegistry.ts` - Terminal lifecycle management

**Decoupling approach**: Extract a `TerminalService` interface:
```typescript
interface TerminalService {
  executeCommand(command: string, cwd: string): Promise<TerminalResult>
  getActiveTerminals(): TerminalInfo[]
  createTerminal(options: TerminalOptions): Terminal
}
```

**Note**: The CLI would use Node.js `child_process`, while VS Code would use its terminal API. The vscode-shim already stubs this but doesn't execute processes.

### 3.4 Editor Integration (LOW priority for decoupling)

**Current state**: Deep integration with VS Code editor features:
- `DiffViewProvider` - Custom diff view with streaming decorations
- `EditorUtils` - Tab management, document access, selections
- `CodeActionProvider` - Quick fix actions
- Diagnostics integration - Error/warning tracking

**Key files**:
- `src/integrations/editor/DiffViewProvider.ts` - 49 vscode references
- `src/integrations/editor/EditorUtils.ts` - Tab and document management
- `src/integrations/diagnostics/index.ts` - Language diagnostics

**Decoupling approach**: These are inherently editor-specific features. Rather than abstracting them, they should remain in the VS Code adapter layer. Non-VS Code targets would provide alternative implementations (e.g., CLI shows diffs in terminal, web shows diffs in Monaco).

### 3.5 Webview Communication (HIGH coupling, but well-structured)

**Current state**: Type-safe message protocol between extension and webview:
- `ExtensionMessage` (50+ types) - Extension to webview
- `WebviewMessage` (70+ types) - Webview to extension
- `ExtensionState` (100+ fields) - Full state sync

**Key files**:
- `src/core/webview/ClineProvider.ts` - Webview provider (3,612 lines)
- `src/core/webview/webviewMessageHandler.ts` - Message router (3,611 lines)
- `packages/types/src/vscode-extension-host.ts` - Protocol types

**Decoupling insight**: The message protocol is **already transport-agnostic**. The types in `packages/types` define the contract. Only the transport layer (VS Code's `postMessage`) is platform-specific. This could easily use WebSocket, IPC, or HTTP instead.

### 3.6 Notifications & User Interaction (LOW-MEDIUM coupling)

**Current state**: Uses VS Code's notification system:
- `vscode.window.showErrorMessage()` / `showInformationMessage()` / `showWarningMessage()`
- `vscode.window.showInputBox()` - User prompts
- `vscode.window.showOpenDialog()` - File picker
- `vscode.window.showQuickPick()` - Selection UI

**Decoupling approach**: Abstract behind a `UserInteractionService`:
```typescript
interface UserInteractionService {
  showNotification(level: 'info' | 'warn' | 'error', message: string): void
  promptInput(options: InputOptions): Promise<string | undefined>
  selectFile(options: FilePickerOptions): Promise<string | undefined>
}
```

---

## 4. What's Already Working Well

### 4.1 The `packages/` Layer (Fully Decoupled)

| Package | VS Code deps | Status |
|---------|-------------|--------|
| `@roo-code/types` | None | Production-ready, shared everywhere |
| `@roo-code/core` | None | Custom tools, message utils, worktree service |
| `@roo-code/vscode-shim` | None | Complete VS Code API mock (~8,000 lines) |
| `@roo-code/cloud` | None | Cloud service integration |
| `@roo-code/telemetry` | None | PostHog analytics |
| `@roo-code/ipc` | None | Inter-process communication |

### 4.2 API Provider Layer (Fully Decoupled)

All 30+ AI provider implementations in `src/api/providers/` work without VS Code, with the sole exception of `vscode-lm.ts` (GitHub Copilot integration, inherently VS Code-specific).

### 4.3 The CLI App (Working Non-VS Code Target)

`apps/cli/` proves the architecture can work outside VS Code via the shim approach. It successfully:
- Loads and activates the extension
- Runs tasks with the full tool set
- Provides a React-based terminal UI
- Manages state without VS Code storage

---

## 5. The Core Problem: The "Big Three" Files

The three largest and most coupled files contain the majority of the business logic that would need to be extracted:

### 5.1 `Task.ts` (4,873 lines) - Nearly Decoupled

Despite its size, `Task.ts` has remarkably low direct VS Code coupling:
- **Only 2 `vscode.` references**: Both are `vscode.workspace.getConfiguration()` calls
- **Indirect coupling**: Through imported modules (`Terminal`, `WorkspaceTracker`, etc.)
- **Core loop is pure**: The `attemptApiRequest()` generator and tool execution flow are framework-agnostic

**What it manages**:
- API conversation history
- Tool execution orchestration
- Message streaming and parsing
- Context window management
- Checkpoint management
- Auto-approval logic

**To fully decouple**: Replace the 2 `getConfiguration()` calls with injected config, and ensure all imported services use interfaces.

### 5.2 `ClineProvider.ts` (3,612 lines) - The VS Code Bridge

This is the **central adapter** between VS Code and the core logic. It:
- Implements `vscode.WebviewViewProvider`
- Manages the task stack (`clineStack: Task[]`)
- Initializes all services (MCP, Code Index, Browser, Skills)
- Handles state serialization for the webview
- Coordinates between multiple subsystems

**41 `vscode.` references** covering:
- Webview creation and HTML content
- Extension context access
- Workspace folder resolution
- Theme detection
- Output channel logging

**This file should remain VS Code-specific** but be refactored into a thin adapter that delegates to a platform-agnostic `TaskManager` service.

### 5.3 `webviewMessageHandler.ts` (3,611 lines) - Message Router

The highest coupling (109 `vscode.` references) because it handles every message from the UI:
- Opens files in editor (`vscode.window.showTextDocument`)
- Manages VS Code configuration (`vscode.workspace.getConfiguration`)
- Shows dialogs and notifications
- Accesses workspace state
- Manages terminal operations

**Most of the logic here is business logic wrapped in VS Code API calls**. It should be split into:
1. A platform-agnostic message handler (business logic)
2. A VS Code adapter (UI operations)

---

## 6. Proposed Decoupling Architecture

### Target Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Platform Adapters                          │
├──────────────┬────────────────┬──────────────────────────────┤
│  VS Code     │   CLI          │   Web / Other                │
│  Adapter     │   Adapter      │   Adapter                    │
│  (src/)      │   (apps/cli/)  │   (future)                   │
│              │                │                              │
│  Implements: │  Implements:   │  Implements:                 │
│  - Webview   │  - Ink TUI     │  - WebSocket server          │
│  - Terminal  │  - child_proc  │  - HTTP API                  │
│  - Editor    │  - File-based  │  - Browser-based             │
│  - Storage   │    storage     │    storage                   │
└──────┬───────┴───────┬────────┴──────────────┬───────────────┘
       │               │                       │
       ▼               ▼                       ▼
┌──────────────────────────────────────────────────────────────┐
│                 Platform Interfaces                           │
│  (packages/platform or packages/interfaces)                  │
├──────────────────────────────────────────────────────────────┤
│  StorageService      │  FileSystemService                    │
│  TerminalService     │  WorkspaceService                     │
│  EditorService       │  UserInteractionService               │
│  NotificationService │  DiagnosticsService                   │
│  OutputService       │  ThemeService                         │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Core Engine                                │
│  (packages/engine or refactored src/core)                    │
├──────────────────────────────────────────────────────────────┤
│  TaskManager         │  MessageRouter                        │
│  ToolExecutor        │  PromptBuilder                        │
│  ConversationManager │  ContextManager                       │
│  CheckpointManager   │  AutoApprovalEngine                   │
│                      │                                       │
│  Dependencies: @roo-code/types, @roo-code/core               │
│  VS Code deps: NONE                                          │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                 Shared Packages (existing)                    │
├──────────────────────────────────────────────────────────────┤
│  @roo-code/types     │  @roo-code/core                       │
│  @roo-code/cloud     │  @roo-code/telemetry                  │
│  @roo-code/ipc       │  @roo-code/vscode-shim (for legacy)   │
└──────────────────────────────────────────────────────────────┘
```

### Interface Definitions

The key interfaces that need to be defined:

```typescript
// packages/platform/src/storage.ts
interface StorageService {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T): Promise<void>
  getSecret(key: string): Promise<string | undefined>
  setSecret(key: string, value: string): Promise<void>
  deleteSecret(key: string): Promise<void>
  getStoragePath(): string
}

// packages/platform/src/terminal.ts
interface TerminalService {
  createTerminal(options: TerminalOptions): TerminalHandle
  executeCommand(command: string, cwd: string): Promise<CommandResult>
  getTerminals(): TerminalHandle[]
  disposeTerminal(id: string): void
}

interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

// packages/platform/src/workspace.ts
interface WorkspaceService {
  getWorkspacePath(): string
  getWorkspaceFolders(): WorkspaceFolder[]
  getConfiguration<T>(section: string, key: string): T | undefined
  onConfigurationChange(callback: (e: ConfigChangeEvent) => void): Disposable
  getDiagnostics(uri?: string): Diagnostic[]
}

// packages/platform/src/editor.ts
interface EditorService {
  openFile(path: string, options?: OpenFileOptions): Promise<void>
  showDiff(original: string, modified: string, title: string): Promise<void>
  getActiveFilePath(): string | undefined
  getOpenFiles(): string[]
}

// packages/platform/src/ui.ts
interface UserInteractionService {
  showNotification(level: 'info' | 'warn' | 'error', msg: string): void
  promptInput(options: InputOptions): Promise<string | undefined>
  selectFromList<T>(items: T[], options: ListOptions): Promise<T | undefined>
  showProgress<T>(title: string, task: (report: ProgressReporter) => Promise<T>): Promise<T>
}

// packages/platform/src/output.ts
interface OutputService {
  createChannel(name: string): OutputChannel
  log(channel: string, message: string): void
}
```

---

## 7. Phased Migration Plan

### Phase 1: Define Platform Interfaces (Low risk)

**Goal**: Create `packages/platform` with interface definitions.

1. Define all platform service interfaces (storage, terminal, workspace, editor, UI, output)
2. Define a `PlatformContext` container that holds all services
3. Create VS Code implementations of each interface wrapping current code
4. No behavior change - just formalize existing contracts

**Estimated scope**: ~15-20 new files, 0 behavioral changes

### Phase 2: Extract Core Engine (Medium risk)

**Goal**: Move business logic from `src/core/` to `packages/engine`.

1. **Extract `TaskManager`** from `ClineProvider.ts`:
   - Task creation, lifecycle management, stack operations
   - Remove VS Code webview code
   - Accept `PlatformContext` via constructor injection

2. **Migrate `Task.ts`** (minimal changes needed):
   - Replace 2 `vscode.workspace.getConfiguration()` calls with injected config
   - Ensure all service dependencies come through `PlatformContext`

3. **Split `webviewMessageHandler.ts`**:
   - Business logic handlers → `packages/engine/MessageRouter`
   - VS Code UI operations → `src/adapters/VSCodeUIAdapter`

4. **Move tool implementations** to engine:
   - Tools already use callback interfaces
   - Replace direct `vscode.workspace.fs` calls with `FileSystemService`
   - Replace `vscode.window.showInputBox` calls with `UserInteractionService`

**Estimated scope**: Refactor ~20-30 files, create ~10-15 new files

### Phase 3: Create Platform Adapters (Low risk)

**Goal**: Implement platform-specific adapters.

1. **VS Code Adapter** (`src/` or `packages/vscode-adapter`):
   - Thin wrapper delegating to engine via `PlatformContext`
   - Webview provider remains VS Code-specific
   - Terminal, editor, storage implementations

2. **CLI Adapter** (refactor `apps/cli/`):
   - Replace vscode-shim approach with direct platform interface implementations
   - Node.js `child_process` for `TerminalService`
   - File-based `StorageService`
   - No-op or simple `EditorService`

3. **Web Adapter** (future):
   - WebSocket-based `TerminalService`
   - HTTP API-based `StorageService`
   - Monaco-based `EditorService`

### Phase 4: Retire vscode-shim for Core Usage (Low risk)

**Goal**: The shim becomes optional (only needed for legacy/third-party extensions).

1. CLI uses native platform interfaces instead of mocking VS Code
2. Extension code no longer imports `vscode` in core engine
3. vscode-shim remains available for edge cases

---

## 8. Risk Assessment

### Low Risk
- **API provider layer**: Already decoupled, no changes needed
- **Type definitions**: Already in shared package
- **Prompt generation**: Nearly pure, minimal coupling
- **Tool base class**: Already uses callback interfaces

### Medium Risk
- **Task.ts refactoring**: Large file but low coupling. Risk is in regressions from refactoring a 4,873-line file
- **Tool implementations**: Some use `vscode.Uri` and `vscode.workspace.fs` but alternatives are straightforward
- **Configuration management**: Need to ensure all settings paths are covered

### High Risk
- **webviewMessageHandler.ts split**: 3,611 lines with 109 vscode references. Every message type needs careful routing
- **ClineProvider.ts refactoring**: Central coordinator with complex state management. Extracting TaskManager while preserving behavior is delicate
- **Terminal integration**: VS Code's shell integration provides unique capabilities (command tracking, exit codes) that are hard to replicate

### Mitigations
- Extensive test coverage before refactoring (current test infrastructure exists)
- Feature flags to switch between old and new code paths
- The CLI already validates that the shim approach works, proving the interfaces are sufficient
- Incremental migration - extract one service at a time

---

## 9. Key Metrics

| Metric | Current | After Phase 2 | After Phase 4 |
|--------|---------|---------------|---------------|
| Files importing `vscode` | 177 (46%) | ~50 (13%) | ~30 (8%) |
| Core engine vscode deps | ~20 files | 0 | 0 |
| Platform interface coverage | 0% | ~80% | 100% |
| Non-VS Code targets | 1 (CLI via shim) | 1 (CLI via interfaces) | 3+ |
| vscode-shim required | Yes (CLI) | Optional | Optional |

---

## 10. Recommendations

### Immediate Actions (No Architectural Change)
1. **Remove the 2 `vscode.workspace.getConfiguration` calls from `Task.ts`** - Pass config values through constructor or method parameters instead
2. **Create `packages/platform`** with interface definitions only - No implementation changes
3. **Audit `webviewMessageHandler.ts`** - Categorize each message handler as "business logic" vs "VS Code UI operation"

### Strategic Direction
1. **Invest in the interface layer, not the shim** - The vscode-shim is clever but adds maintenance burden. Clean interfaces are better long-term.
2. **Keep ClineProvider as a thin adapter** - Don't try to make the webview provider portable. Instead, extract the logic it delegates to.
3. **Prioritize `Task.ts` extraction** - It's the highest-value, lowest-risk target since it already has minimal coupling.
4. **Consider the webview-ui as already portable** - The React frontend communicates via messages and could work with any backend transport (WebSocket, HTTP, IPC).

### What NOT to Do
1. **Don't abstract the editor features** (diff view, decorations, code actions) - These are inherently VS Code-specific and should stay in the adapter
2. **Don't create a unified UI abstraction** - The CLI (Ink/React), webview (React), and potential web UI (React) should each have their own presentation layer
3. **Don't force all VS Code code into a single adapter** - Some features (CodeActionProvider, status bar) are legitimately VS Code-only features
