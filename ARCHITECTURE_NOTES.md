## Roo Code – Architecture Notes

### The Archaeological Dig

**Goal**: Map the “nervous system” for tools and prompting so we can later enforce a robust reasoning loop.

---

### 1. Tool Loop – `execute_command`

- **Entry point (tool class)**: `ExecuteCommandTool` in `src/core/tools/ExecuteCommandTool.ts`.
- **Tool name (LLM-facing)**: `"execute_command"` (`readonly name = "execute_command" as const`).
- **Primary execution method**: `ExecuteCommandTool.execute(params, task, callbacks)`.
- **Terminal execution pipeline**:
    - Validates `command` and applies `rooIgnoreController.validateCommand`.
    - Asks for **user approval** via `askApproval("command", canonicalCommand)`.
    - Builds `ExecuteCommandOptions` (including timeout and shell-integration flags).
    - Delegates to `executeCommandInTerminal(task, options)`.
- **Low-level executor**: `executeCommandInTerminal(task, options)`:
    - Resolves working directory (task.cwd vs customCwd).
    - Uses `TerminalRegistry.getOrCreateTerminal` to obtain a `Terminal` / `RooTerminalProcess`.
    - Streams output through `RooTerminalCallbacks` (`onLine`, `onCompleted`, `onShellExecutionStarted`, `onShellExecutionComplete`).
    - Persists large outputs via `OutputInterceptor` and returns either inline output or an artifact reference.
- **Current TODO**: `//TODO: Modify ExecuteCommand` (hook point for future reasoning-loop-aware behavior around command execution).

---

### 2. Tool Loop – `write_to_file`

- **Entry point (tool class)**: `WriteToFileTool` in `src/core/tools/WriteToFileTool.ts`.
- **Tool name (LLM-facing)**: `"write_to_file"` (`readonly name = "write_to_file" as const`).
- **Primary execution method**: `WriteToFileTool.execute(params, task, callbacks)`.
- **Write pipeline**:
    - Validates `path` & `content`, checks `rooIgnoreController.validateAccess` and `rooProtectedController.isWriteProtected`.
    - Normalizes content (strips surrounding ``` fences, unescapes HTML entities for non-Claude models).
    - Resolves path relative to `task.cwd` and checks if it’s outside the workspace.
    - Derives `fileExists` and sets `task.diffViewProvider.editType` to `"modify"` / `"create"`.
    - For **Prevent Focus Disruption experiment**:
        - Computes a unified diff (`createPrettyPatch` or `convertNewFileToUnifiedDiff`).
        - Sends diff + stats to the UI, requests approval via `askApproval("tool", completeMessage, ..., isWriteProtected)`.
        - On approval, writes directly via `diffViewProvider.saveDirectly`.
    - For **standard flow**:
        - Opens the diff view, streams partial content, scrolls to first diff.
        - Builds unified diff, asks for approval, then saves via `saveChanges`.
    - Tracks edited files in `fileContextTracker` with `RecordSource = "roo_edited"`.
- **Partial handling**: `handlePartial` waits for path to stabilize, then previews edits live in the diff view without committing them.
- **Current TODO**: `//TODO: Modify the WriteToFileTool` (natural insertion point for reasoning-loop constraints around file writes).

---

### 3. Prompt Builder – System Prompt Construction

- **Location**: `src/core/prompts/system.ts`.
- **Core builder function**: `generatePrompt(...)` (internal, async).
- **Public entry point**: `SYSTEM_PROMPT(...)`:
    - Resolves the active `Mode` (built-in vs custom) via `getModeBySlug` / `modes`.
    - Determines `promptComponent` for custom modes via `getPromptComponent`.
    - Delegates to `generatePrompt` with the resolved mode + configuration.
- **Prompt assembly in `generatePrompt`**:
    - Resolves `modeConfig` and pulls `roleDefinition` and `baseInstructions` from `getModeSelection`.
    - Computes whether MCP should be included based on mode groups and active MCP servers.
    - Instantiates `CodeIndexManager` (for codebase context).
    - Assembles sections:
        - Markdown formatting rules (`markdownFormattingSection()`).
        - Shared tool-use & tool-use guidelines (`getSharedToolUseSection`, `getToolUseGuidelinesSection`).
        - Capabilities section, including MCP & filesystem context (`getCapabilitiesSection`).
        - Modes catalog (`getModesSection`) and skills (`getSkillsSection`).
        - Rules (`getRulesSection`), system info (`getSystemInfoSection`), and objective (`getObjectiveSection`).
        - Custom instructions via `addCustomInstructions`, incorporating:
            - Mode-specific base instructions.
            - User/global custom instructions.
            - Language, `rooIgnore` instructions, and settings.

---

### 4. Summary

- **Tool Loop Mapped**:
    - `execute_command` → `ExecuteCommandTool.execute` → `executeCommandInTerminal` → terminal + output persistence.
    - `write_to_file` → `WriteToFileTool.execute` → diff view + approval → file system writes + context tracking.
- **Prompt Builder Located**:
    - System prompt is composed in `generatePrompt` and exposed via `SYSTEM_PROMPT`.
- **Key Hook Points for Future Phases**:
    - `//TODO: Prompt Builder` – inject Reasoning Loop instructions into the system prompt.
    - `//TODO: Modify ExecuteCommand` – control how commands are proposed, verified, and re-run.
    - `//TODO: Modify the WriteToFileTool` – enforce plan/patch/review/commit loops for file edits.
