# Terminal/Shell Integration - Agent Context Document

---

Feature: Terminal/Shell Integration
Last Updated: 2025-01-24
Status: Stable
Audience: Agents/Developers

---

## Overview

Roo Code's terminal integration enables the `execute_command` tool to run shell commands and capture their output. The system supports two execution providers:

1. **VSCode Terminal Provider** (`vscode`) - Uses VSCode's native shell integration APIs for command execution with real-time output streaming and exit code detection
2. **Execa Provider** (`execa`) - A fallback that runs commands via Node.js's `execa` library without VSCode terminal UI integration

## File Structure

### Core Terminal Integration Files

```
src/integrations/terminal/
├── BaseTerminal.ts           # Abstract base class for terminal implementations
├── BaseTerminalProcess.ts    # Abstract base class for process implementations
├── Terminal.ts               # VSCode terminal provider implementation
├── TerminalProcess.ts        # VSCode terminal process implementation
├── ExecaTerminal.ts          # Execa provider implementation
├── ExecaTerminalProcess.ts   # Execa process implementation
├── TerminalRegistry.ts       # Singleton registry managing terminal instances
├── ShellIntegrationManager.ts # Manages zsh shell integration workarounds
├── mergePromise.ts           # Utility for merging process with promise
└── types.ts                  # Type definitions for terminal interfaces
```

### Related Files

| File                                                                             | Purpose                            |
| -------------------------------------------------------------------------------- | ---------------------------------- |
| [`src/core/tools/ExecuteCommandTool.ts`](src/core/tools/ExecuteCommandTool.ts)   | The `execute_command` tool handler |
| [`src/integrations/misc/extract-text.ts`](src/integrations/misc/extract-text.ts) | Output compression utilities       |
| [`packages/types/src/terminal.ts`](packages/types/src/terminal.ts)               | CommandExecutionStatus schema      |
| [`packages/types/src/global-settings.ts`](packages/types/src/global-settings.ts) | Terminal configuration defaults    |

---

## Architecture

### Class Hierarchy

```
BaseTerminal (abstract)
├── Terminal (vscode provider)
└── ExecaTerminal (execa provider)

BaseTerminalProcess (abstract)
├── TerminalProcess (vscode provider)
└── ExecaTerminalProcess (execa provider)
```

### Key Interfaces

**[`RooTerminal`](src/integrations/terminal/types.ts:5)** - Main terminal interface:

```typescript
interface RooTerminal {
	provider: "vscode" | "execa"
	id: number
	busy: boolean
	running: boolean
	taskId?: string
	process?: RooTerminalProcess
	getCurrentWorkingDirectory(): string
	isClosed: () => boolean
	runCommand: (command: string, callbacks: RooTerminalCallbacks) => RooTerminalProcessResultPromise
	setActiveStream(stream: AsyncIterable<string> | undefined, pid?: number): void
	shellExecutionComplete(exitDetails: ExitCodeDetails): void
	getProcessesWithOutput(): RooTerminalProcess[]
	getUnretrievedOutput(): string
	getLastCommand(): string
	cleanCompletedProcessQueue(): void
}
```

**[`RooTerminalCallbacks`](src/integrations/terminal/types.ts:23)** - Callbacks for command execution:

```typescript
interface RooTerminalCallbacks {
	onLine: (line: string, process: RooTerminalProcess) => void
	onCompleted: (output: string | undefined, process: RooTerminalProcess) => void
	onShellExecutionStarted: (pid: number | undefined, process: RooTerminalProcess) => void
	onShellExecutionComplete: (details: ExitCodeDetails, process: RooTerminalProcess) => void
	onNoShellIntegration?: (message: string, process: RooTerminalProcess) => void
}
```

**[`ExitCodeDetails`](src/integrations/terminal/types.ts:55)** - Exit information:

```typescript
interface ExitCodeDetails {
	exitCode: number | undefined
	signal?: number | undefined
	signalName?: string
	coreDumpPossible?: boolean
}
```

---

## Command Execution Flow

### 1. Tool Invocation

When the LLM uses `execute_command`, [`ExecuteCommandTool.execute()`](src/core/tools/ExecuteCommandTool.ts:32) is called:

1. Validates the `command` parameter exists
2. Checks `.rooignore` rules via `task.rooIgnoreController?.validateCommand(command)`
3. Requests user approval via `askApproval("command", unescapedCommand)`
4. Determines provider based on `terminalShellIntegrationDisabled` setting
5. Calls [`executeCommandInTerminal()`](src/core/tools/ExecuteCommandTool.ts:154)

### 2. Terminal Selection

[`TerminalRegistry.getOrCreateTerminal()`](src/integrations/terminal/TerminalRegistry.ts:152) selects a terminal:

1. First priority: Terminal already assigned to this task with matching CWD
2. Second priority: Any available terminal with matching CWD
3. Fallback: Creates new terminal via [`TerminalRegistry.createTerminal()`](src/integrations/terminal/TerminalRegistry.ts:130)

### 3. Command Execution

**VSCode Provider Flow** ([`Terminal.runCommand()`](src/integrations/terminal/Terminal.ts:43)):

1. Sets terminal as busy
2. Creates [`TerminalProcess`](src/integrations/terminal/TerminalProcess.ts:9) instance
3. Waits for shell integration with timeout (default 5s, configurable)
4. If shell integration available: executes via `terminal.shellIntegration.executeCommand()`
5. If shell integration unavailable: emits `no_shell_integration` event

**Execa Provider Flow** ([`ExecaTerminal.runCommand()`](src/integrations/terminal/ExecaTerminal.ts:18)):

1. Sets terminal as busy
2. Creates [`ExecaTerminalProcess`](src/integrations/terminal/ExecaTerminalProcess.ts:8) instance
3. Executes command via `execa` with `shell: true`
4. Streams output via async iterable

### 4. Output Processing

Output is processed through callbacks:

- [`onLine`](src/core/tools/ExecuteCommandTool.ts:197) - Called as output streams in
- [`onCompleted`](src/core/tools/ExecuteCommandTool.ts:226) - Called when command completes
- [`onShellExecutionStarted`](src/core/tools/ExecuteCommandTool.ts:236) - Called when shell execution begins (with PID)
- [`onShellExecutionComplete`](src/core/tools/ExecuteCommandTool.ts:240) - Called when shell execution ends (with exit code)

Output is compressed via [`Terminal.compressTerminalOutput()`](src/integrations/terminal/BaseTerminal.ts:275):

1. Process carriage returns (progress bars)
2. Process backspaces
3. Apply run-length encoding for repeated lines
4. Truncate to line/character limits

---

## VSCode Shell Integration Details

### OSC 633 Protocol

VSCode uses OSC 633 escape sequences for shell integration. Key markers:

| Sequence                             | Meaning                                   |
| ------------------------------------ | ----------------------------------------- |
| `\x1b]633;A`                         | Mark prompt start                         |
| `\x1b]633;B`                         | Mark prompt end                           |
| `\x1b]633;C`                         | Mark pre-execution (command output start) |
| `\x1b]633;D[;<exitcode>]`            | Mark execution finished                   |
| `\x1b]633;E;<commandline>[;<nonce>]` | Explicitly set command line               |

The [`TerminalProcess`](src/integrations/terminal/TerminalProcess.ts) class parses these markers:

- [`matchAfterVsceStartMarkers()`](src/integrations/terminal/TerminalProcess.ts:396) - Finds content after C marker
- [`matchBeforeVsceEndMarkers()`](src/integrations/terminal/TerminalProcess.ts:405) - Finds content before D marker

### Shell Integration Event Handlers

Registered in [`TerminalRegistry.initialize()`](src/integrations/terminal/TerminalRegistry.ts:26):

- [`onDidStartTerminalShellExecution`](src/integrations/terminal/TerminalRegistry.ts:49) - Captures stream and marks terminal busy
- [`onDidEndTerminalShellExecution`](src/integrations/terminal/TerminalRegistry.ts:76) - Processes exit code and signals completion

---

## Configuration Options

All settings are stored in extension state and managed via [`ClineProvider`](src/core/webview/ClineProvider.ts:752).

### Terminal Settings

| Setting                            | Type      | Default  | Description                                                             |
| ---------------------------------- | --------- | -------- | ----------------------------------------------------------------------- |
| `terminalShellIntegrationDisabled` | `boolean` | `true`   | When true, uses execa provider instead of VSCode terminal               |
| `terminalShellIntegrationTimeout`  | `number`  | `30000`  | Milliseconds to wait for shell integration init (VSCode provider only)  |
| `terminalOutputLineLimit`          | `number`  | `500`    | Maximum lines to keep in compressed output                              |
| `terminalOutputCharacterLimit`     | `number`  | `100000` | Maximum characters to keep in compressed output                         |
| `terminalCommandDelay`             | `number`  | `0`      | Milliseconds to delay after command (workaround for VSCode bug #237208) |

### Shell-Specific Settings

| Setting                       | Type      | Default | Description                                                                   |
| ----------------------------- | --------- | ------- | ----------------------------------------------------------------------------- |
| `terminalZshClearEolMark`     | `boolean` | `true`  | Clear ZSH EOL mark (`PROMPT_EOL_MARK=""`)                                     |
| `terminalZshOhMy`             | `boolean` | `true`  | Enable Oh My Zsh integration (`ITERM_SHELL_INTEGRATION_INSTALLED=Yes`)        |
| `terminalZshP10k`             | `boolean` | `false` | Enable Powerlevel10k integration (`POWERLEVEL9K_TERM_SHELL_INTEGRATION=true`) |
| `terminalZdotdir`             | `boolean` | `true`  | Use ZDOTDIR workaround for zsh shell integration                              |
| `terminalPowershellCounter`   | `boolean` | `false` | Add counter workaround for PowerShell                                         |
| `terminalCompressProgressBar` | `boolean` | `true`  | Process carriage returns to compress progress bar output                      |

### VSCode Configuration

The tool also reads from VSCode configuration:

- `roo-cline.commandExecutionTimeout` - Seconds to auto-abort commands (0 = disabled)
- `roo-cline.commandTimeoutAllowlist` - Command prefixes exempt from timeout

---

## Environment Variables

The [`Terminal.getEnv()`](src/integrations/terminal/Terminal.ts:153) method sets environment variables for shell integration:

| Variable                              | Value                       | Purpose                                   |
| ------------------------------------- | --------------------------- | ----------------------------------------- |
| `PAGER`                               | `cat` (non-Windows)         | Prevent pager interruption                |
| `VTE_VERSION`                         | `0`                         | Disable VTE prompt command interference   |
| `ITERM_SHELL_INTEGRATION_INSTALLED`   | `Yes` (if enabled)          | Oh My Zsh compatibility                   |
| `POWERLEVEL9K_TERM_SHELL_INTEGRATION` | `true` (if enabled)         | Powerlevel10k compatibility               |
| `PROMPT_COMMAND`                      | `sleep X` (if delay > 0)    | Workaround for VSCode output race         |
| `PROMPT_EOL_MARK`                     | `""` (if enabled)           | Prevent ZSH EOL mark issues               |
| `ZDOTDIR`                             | Temp directory (if enabled) | Load shell integration before user config |

---

## Fallback Mechanism

When VSCode shell integration fails:

1. [`ShellIntegrationError`](src/core/tools/ExecuteCommandTool.ts:22) is thrown
2. User sees `shell_integration_warning` message
3. Command is re-executed with `terminalShellIntegrationDisabled: true`
4. Execa provider runs command without terminal UI

Fallback triggers:

- Shell integration timeout exceeded
- OSC 633;C marker not received
- Stream did not start within timeout

---

## Process State Management

### Terminal States

| Property       | Type      | Description                                            |
| -------------- | --------- | ------------------------------------------------------ |
| `busy`         | `boolean` | Terminal is executing or waiting for shell integration |
| `running`      | `boolean` | Command is actively executing                          |
| `streamClosed` | `boolean` | Output stream has ended                                |

### Process States

| Property             | Type      | Description                                                |
| -------------------- | --------- | ---------------------------------------------------------- |
| `isHot`              | `boolean` | Process recently produced output (affects request timing)  |
| `isListening`        | `boolean` | Process is still accepting output events                   |
| `fullOutput`         | `string`  | Complete accumulated output                                |
| `lastRetrievedIndex` | `number`  | Index of last retrieved output (for incremental retrieval) |

### Hot Timer

The [`startHotTimer()`](src/integrations/terminal/BaseTerminalProcess.ts:157) method marks a process as "hot" after receiving output:

- Normal output: 2 second hot period
- Compilation output (detected via markers): 15 second hot period

Compilation markers: `compiling`, `building`, `bundling`, `transpiling`, `generating`, `starting`

---

## Command Execution Status Updates

The webview receives status updates via [`CommandExecutionStatus`](packages/types/src/terminal.ts:7):

| Status     | When                   | Data                  |
| ---------- | ---------------------- | --------------------- |
| `started`  | Shell execution begins | `pid`, `command`      |
| `output`   | Output received        | `output` (compressed) |
| `exited`   | Command completes      | `exitCode`            |
| `fallback` | Switching to execa     | -                     |
| `timeout`  | Command timed out      | -                     |

---

## Key Implementation Details

### PowerShell Workarounds

In [`TerminalProcess.run()`](src/integrations/terminal/TerminalProcess.ts:109):

- Counter workaround: Appends `; "(Roo/PS Workaround: N)" > $null` to ensure unique commands
- Delay workaround: Appends `; start-sleep -milliseconds X` for output timing

### ZDOTDIR Workaround

[`ShellIntegrationManager.zshInitTmpDir()`](src/integrations/terminal/ShellIntegrationManager.ts:13):

1. Creates temporary directory
2. Creates `.zshrc` that sources VSCode's shell integration script
3. Sources user's original zsh config files
4. Cleans up after shell integration succeeds or times out

### Signal Handling

[`BaseTerminalProcess.interpretExitCode()`](src/integrations/terminal/BaseTerminalProcess.ts:16) translates exit codes:

- Exit codes > 128 indicate signal termination
- Signal number = exit code - 128
- Maps to signal names (SIGINT, SIGTERM, etc.)
- Identifies signals that may produce core dumps

---

## Testing

Test files are located in `src/integrations/terminal/__tests__/`:

| File                                       | Coverage                            |
| ------------------------------------------ | ----------------------------------- |
| `TerminalProcess.spec.ts`                  | VSCode terminal process logic       |
| `TerminalRegistry.spec.ts`                 | Terminal registration and selection |
| `ExecaTerminal.spec.ts`                    | Execa terminal provider             |
| `ExecaTerminalProcess.spec.ts`             | Execa process execution             |
| `TerminalProcessExec.*.spec.ts`            | Shell-specific execution tests      |
| `TerminalProcessInterpretExitCode.spec.ts` | Exit code interpretation            |

Execute_command tool tests: `src/core/tools/__tests__/executeCommand*.spec.ts`

---

## Common Issues and Debugging

### Shell Integration Not Available

**Symptoms**: `no_shell_integration` event emitted, fallback to execa

**Causes**:

- Shell doesn't support OSC 633 sequences
- User's shell config overrides VSCode's integration
- Timeout too short for slow shell startup

**Resolution**:

- Increase `terminalShellIntegrationTimeout`
- Enable `terminalZdotdir` for zsh
- Check for conflicting shell plugins

### Output Missing or Truncated

**Symptoms**: Incomplete command output

**Causes**:

- VSCode bug #237208 (race between completion and output)
- Output exceeds line/character limits

**Resolution**:

- Enable `terminalCommandDelay` setting
- Increase `terminalOutputLineLimit` or `terminalOutputCharacterLimit`

### Progress Bars Garbled

**Symptoms**: Multiple lines of progress instead of single updating line

**Causes**:

- `terminalCompressProgressBar` disabled
- Multi-byte characters in progress output

**Resolution**:

- Enable `terminalCompressProgressBar`
- Check [`processCarriageReturns()`](src/integrations/misc/extract-text.ts:355) handling

---

## Related Features

- **Terminal Actions** ([`packages/types/src/vscode.ts:17`](packages/types/src/vscode.ts:17)): Context menu actions for terminal output

    - `terminalAddToContext`
    - `terminalFixCommand`
    - `terminalExplainCommand`

- **Background Terminals**: Terminals can continue running after task completion, tracked via [`TerminalRegistry.getBackgroundTerminals()`](src/integrations/terminal/TerminalRegistry.ts:255)

- **Output Retrieval**: Unretrieved output can be retrieved incrementally via [`getUnretrievedOutput()`](src/integrations/terminal/BaseTerminal.ts:133) for background process monitoring
