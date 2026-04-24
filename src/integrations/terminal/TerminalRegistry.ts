import * as vscode from "vscode"

import { arePathsEqual } from "../../utils/path"

import { RooTerminal, RooTerminalProvider } from "./types"
import { TerminalProcess } from "./TerminalProcess"
import { Terminal } from "./Terminal"
import { ExecaTerminal } from "./ExecaTerminal"
import { ShellIntegrationManager } from "./ShellIntegrationManager"

// Although vscode.window.terminals provides a list of all open terminals,
// there's no way to know whether they're busy or not (exitStatus does not
// provide useful information for most commands). In order to prevent creating
// too many terminals, we need to keep track of terminals through the life of
// the extension, as well as session specific terminals for the life of a task
// (to get latest unretrieved output).
// Since we have promises keeping track of terminal processes, we get the added
// benefit of keep track of busy terminals even after a task is closed.

export class TerminalRegistry {
	private static terminals: RooTerminal[] = []
	private static nextTerminalId = 1
	private static disposables: vscode.Disposable[] = []
	private static isInitialized = false

	public static readonly DEFAULT_MAX_TERMINAL_POOL_SIZE = 5
	private static maxTerminalPoolSize: number = TerminalRegistry.DEFAULT_MAX_TERMINAL_POOL_SIZE

	/**
	 * Sets the maximum terminal pool size.
	 * @param size The maximum number of terminals to keep in the pool (1-20)
	 */
	public static setMaxTerminalPoolSize(size: number): void {
		this.maxTerminalPoolSize = Math.max(1, Math.min(20, size))
	}

	/**
	 * Gets the maximum terminal pool size.
	 * @returns The maximum number of terminals allowed in the pool
	 */
	public static getMaxTerminalPoolSize(): number {
		return this.maxTerminalPoolSize
	}

	public static initialize() {
		if (this.isInitialized) {
			throw new Error("TerminalRegistry.initialize() should only be called once")
		}

		this.isInitialized = true

		// TODO: This initialization code is VSCode specific, and therefore
		// should probably live elsewhere.

		// Register handler for terminal close events to clean up temporary
		// directories.
		const closeDisposable = vscode.window.onDidCloseTerminal((vsceTerminal) => {
			const terminal = this.getTerminalByVSCETerminal(vsceTerminal)

			if (terminal) {
				ShellIntegrationManager.zshCleanupTmpDir(terminal.id)
			}
		})

		this.disposables.push(closeDisposable)

		try {
			const startDisposable = vscode.window.onDidStartTerminalShellExecution?.(
				async (e: vscode.TerminalShellExecutionStartEvent) => {
					// Get a handle to the stream as early as possible:
					const stream = e.execution.read()
					const terminal = this.getTerminalByVSCETerminal(e.terminal)

					console.info("[onDidStartTerminalShellExecution]", {
						command: e.execution?.commandLine?.value,
						terminalId: terminal?.id,
					})

					if (terminal) {
						terminal.setActiveStream(stream)
						terminal.busy = true // Mark terminal as busy when shell execution starts
					} else {
						console.error(
							"[onDidStartTerminalShellExecution] Shell execution started, but not from a Roo-registered terminal:",
							e,
						)
					}
				},
			)

			if (startDisposable) {
				this.disposables.push(startDisposable)
			}

			const endDisposable = vscode.window.onDidEndTerminalShellExecution?.(
				async (e: vscode.TerminalShellExecutionEndEvent) => {
					const terminal = this.getTerminalByVSCETerminal(e.terminal)
					const process = terminal?.process
					const exitDetails = TerminalProcess.interpretExitCode(e.exitCode)

					console.info("[onDidEndTerminalShellExecution]", {
						command: e.execution?.commandLine?.value,
						terminalId: terminal?.id,
						...exitDetails,
					})

					if (!terminal) {
						console.error(
							"[onDidEndTerminalShellExecution] Shell execution ended, but not from a Roo-registered terminal:",
							e,
						)

						return
					}

					if (!terminal.running) {
						console.error(
							"[TerminalRegistry] Shell execution end event received, but process is not running for terminal:",
							{ terminalId: terminal?.id, command: process?.command, exitCode: e.exitCode },
						)

						terminal.busy = false
						return
					}

					if (!process) {
						console.error(
							"[TerminalRegistry] Shell execution end event received on running terminal, but process is undefined:",
							{ terminalId: terminal.id, exitCode: e.exitCode },
						)

						return
					}

					// Signal completion to any waiting processes.
					terminal.shellExecutionComplete(exitDetails)
					terminal.busy = false // Mark terminal as not busy when shell execution ends
				},
			)

			if (endDisposable) {
				this.disposables.push(endDisposable)
			}
		} catch (error) {
			console.error("[TerminalRegistry] Error setting up shell execution handlers:", error)
		}
	}

	public static createTerminal(cwd: string, provider: RooTerminalProvider): RooTerminal {
		// Enforce pool size limit before creating a new terminal.
		this.enforcePoolSizeLimit()

		let newTerminal

		if (provider === "vscode") {
			newTerminal = new Terminal(this.nextTerminalId++, undefined, cwd)
		} else {
			newTerminal = new ExecaTerminal(this.nextTerminalId++, cwd)
		}

		this.terminals.push(newTerminal)

		return newTerminal
	}

	/**
	 * Gets an existing terminal or creates a new one for the given working
	 * directory.
	 *
	 * @param cwd The working directory path
	 * @param taskId Optional task ID to associate with the terminal
	 * @returns A Terminal instance
	 */
	public static async getOrCreateTerminal(
		cwd: string,
		taskId?: string,
		provider: RooTerminalProvider = "vscode",
	): Promise<RooTerminal> {
		const terminals = this.getAllTerminals()
		let terminal: RooTerminal | undefined

		// First priority: Find a terminal already assigned to this task with
		// matching directory.
		if (taskId) {
			terminal = terminals.find((t) => {
				if (t.busy || t.taskId !== taskId || t.provider !== provider) {
					return false
				}

				const terminalCwd = t.getCurrentWorkingDirectory()

				if (!terminalCwd) {
					return false
				}

				return arePathsEqual(vscode.Uri.file(cwd).fsPath, terminalCwd)
			})
		}

		// Second priority: Find any available terminal with matching directory.
		if (!terminal) {
			terminal = terminals.find((t) => {
				if (t.busy || t.provider !== provider) {
					return false
				}

				const terminalCwd = t.getCurrentWorkingDirectory()

				if (!terminalCwd) {
					return false
				}

				return arePathsEqual(vscode.Uri.file(cwd).fsPath, terminalCwd)
			})
		}

		// If no suitable terminal found, create a new one.
		if (!terminal) {
			terminal = this.createTerminal(cwd, provider)
		}

		terminal.taskId = taskId

		return terminal
	}

	/**
	 * Gets unretrieved output from a terminal process.
	 *
	 * @param id The terminal ID
	 * @returns The unretrieved output as a string, or empty string if terminal not found
	 */
	public static getUnretrievedOutput(id: number): string {
		return this.getTerminalById(id)?.getUnretrievedOutput() ?? ""
	}

	/**
	 * Checks if a terminal process is "hot" (recently active).
	 *
	 * @param id The terminal ID
	 * @returns True if the process is hot, false otherwise
	 */
	public static isProcessHot(id: number): boolean {
		return this.getTerminalById(id)?.process?.isHot ?? false
	}

	/**
	 * Gets terminals filtered by busy state and optionally by task id.
	 *
	 * @param busy Whether to get busy or non-busy terminals
	 * @param taskId Optional task ID to filter terminals by
	 * @returns Array of Terminal objects
	 */
	public static getTerminals(busy: boolean, taskId?: string): RooTerminal[] {
		return this.getAllTerminals().filter((t) => {
			// Filter by busy state.
			if (t.busy !== busy) {
				return false
			}

			// If taskId is provided, also filter by taskId.
			if (taskId !== undefined && t.taskId !== taskId) {
				return false
			}

			return true
		})
	}

	/**
	 * Gets background terminals (taskId undefined) that have unretrieved output
	 * or are still running.
	 *
	 * @param busy Whether to get busy or non-busy terminals
	 * @returns Array of Terminal objects
	 */
	public static getBackgroundTerminals(busy?: boolean): RooTerminal[] {
		return this.getAllTerminals().filter((t) => {
			// Only get background terminals (taskId undefined).
			if (t.taskId !== undefined) {
				return false
			}

			// If busy is undefined, return all background terminals.
			if (busy === undefined) {
				return t.getProcessesWithOutput().length > 0 || t.process?.hasUnretrievedOutput()
			}

			// Filter by busy state.
			return t.busy === busy
		})
	}

	public static cleanup() {
		// Clean up all temporary directories.
		ShellIntegrationManager.clear()
		this.disposables.forEach((disposable) => disposable.dispose())
		this.disposables = []
	}

	/**
	 * Releases all terminals associated with a task. Idle terminals that
	 * are not busy and have no unretrieved output are disposed (closed).
	 * Busy terminals are simply unassigned from the task.
	 *
	 * @param taskId The task ID
	 */
	public static releaseTerminalsForTask(taskId: string): void {
		const terminalsToDispose: RooTerminal[] = []

		this.terminals.forEach((terminal) => {
			if (terminal.taskId === taskId) {
				terminal.taskId = undefined

				// Dispose idle terminals that have no pending output.
				if (!terminal.busy && !terminal.running && !terminal.process?.hasUnretrievedOutput()) {
					terminalsToDispose.push(terminal)
				}
			}
		})

		for (const terminal of terminalsToDispose) {
			this.disposeTerminal(terminal)
		}
	}

	private static getAllTerminals(): RooTerminal[] {
		this.terminals = this.terminals.filter((t) => !t.isClosed())
		return this.terminals
	}

	private static getTerminalById(id: number): RooTerminal | undefined {
		const terminal = this.terminals.find((t) => t.id === id)

		if (terminal?.isClosed()) {
			this.removeTerminal(id)
			return undefined
		}

		return terminal
	}

	/**
	 * Gets a terminal by its VSCode terminal instance
	 * @param terminal The VSCode terminal instance
	 * @returns The Terminal object, or undefined if not found
	 */
	private static getTerminalByVSCETerminal(vsceTerminal: vscode.Terminal): RooTerminal | undefined {
		const found = this.terminals.find((t) => t instanceof Terminal && t.terminal === vsceTerminal)

		if (found?.isClosed()) {
			this.removeTerminal(found.id)
			return undefined
		}

		return found
	}

	private static removeTerminal(id: number) {
		ShellIntegrationManager.zshCleanupTmpDir(id)
		this.terminals = this.terminals.filter((t) => t.id !== id)
	}

	/**
	 * Enforces the terminal pool size limit by disposing the oldest idle
	 * terminals when the pool is at or above the maximum size.
	 */
	private static enforcePoolSizeLimit(): void {
		const allTerminals = this.getAllTerminals()

		if (allTerminals.length < this.maxTerminalPoolSize) {
			return
		}

		// Find idle terminals (not busy, not running, no task assigned).
		const idleTerminals = allTerminals.filter(
			(t) => !t.busy && !t.running && !t.taskId && !t.process?.hasUnretrievedOutput(),
		)

		// Dispose oldest idle terminals until we're under the limit.
		// Terminals are ordered by creation (oldest first).
		let toRemove = allTerminals.length - this.maxTerminalPoolSize + 1 // +1 to make room for the new one

		for (const terminal of idleTerminals) {
			if (toRemove <= 0) {
				break
			}

			this.disposeTerminal(terminal)
			toRemove--
		}
	}

	/**
	 * Disposes a terminal by closing the underlying VSCode terminal
	 * and removing it from the registry.
	 */
	private static disposeTerminal(terminal: RooTerminal): void {
		// For VSCode terminals, dispose the underlying terminal.
		if (terminal instanceof Terminal) {
			terminal.terminal.dispose()
		}

		this.removeTerminal(terminal.id)
	}
}
