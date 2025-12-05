import fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { randomUUID } from "crypto"
import * as vscode from "vscode"

import delay from "delay"

import { CommandExecutionStatus, DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { Task } from "../task/Task"

import { ToolUse, ToolResponse } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { unescapeHtmlEntities } from "../../utils/text-normalization"
import { ExitCodeDetails, RooTerminalCallbacks, RooTerminalProcess } from "../../integrations/terminal/types"
import { TerminalRegistry } from "../../integrations/terminal/TerminalRegistry"
import { Terminal } from "../../integrations/terminal/Terminal"
import { Package } from "../../shared/package"
import { t } from "../../i18n"
import { BaseTool, ToolCallbacks } from "./BaseTool"

class ShellIntegrationError extends Error {}

interface ExecuteCommandParams {
	command?: string
	script_content?: string
	script_runner?: string
	cwd?: string
}

export class ExecuteCommandTool extends BaseTool<"execute_command"> {
	readonly name = "execute_command" as const

	parseLegacy(params: Partial<Record<string, string>>): ExecuteCommandParams {
		return {
			command: params.command || "",
			script_content: params.script_content,
			script_runner: params.script_runner,
			cwd: params.cwd,
		}
	}

	async execute(params: ExecuteCommandParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { command, cwd: customCwd, script_content, script_runner } = params
		const { handleError, pushToolResult, askApproval, removeClosingTag, toolProtocol } = callbacks

		const provider = await task.providerRef.deref()
		const providerState = await provider?.getState()
		const isWindows = process.platform === "win32"
		const scriptModeEnabled = isWindows && (providerState?.windowsScriptExecutionEnabled ?? true)

		const trimmedScriptContent = script_content ? unescapeHtmlEntities(script_content).trim() : ""
		const trimmedScriptRunner = script_runner ? script_runner.trim() : ""
		const hasScriptRequest = trimmedScriptContent.length > 0
		const shouldUseScriptMode = hasScriptRequest && scriptModeEnabled

		let tempScriptPath: string | undefined
		let tempScriptDir: string | undefined
		let commandToRun = command

		try {
			if (hasScriptRequest && !scriptModeEnabled) {
				if (!command || !command.trim()) {
					pushToolResult(
						"Script execution mode is not available on this platform or is disabled. Please send a regular command instead.",
					)
					return
				}
			}

			if (shouldUseScriptMode) {
				if (!trimmedScriptRunner) {
					task.consecutiveMistakeCount++
					task.recordToolError("execute_command")
					pushToolResult(await task.sayAndCreateMissingParamError("execute_command", "script_runner"))
					return
				}

				// Prevent command injection: runner must be a single token/path without whitespace or shell metacharacters.
				// Allow only safe runner tokens: alphanumerics plus common path separators and dots/underscores/hyphens/colons.
				// This prevents injection via shell metacharacters while still allowing full paths.
				const runnerPattern = /^[\w.\-\\/:\u0080-\uFFFF]+$/
				if (!runnerPattern.test(trimmedScriptRunner)) {
					task.recordToolError("execute_command")
					pushToolResult(
						"script_runner must be a single executable or path without spaces or shell metacharacters.",
					)
					return
				}

				tempScriptDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-script-"))
				tempScriptPath = path.join(tempScriptDir, `script-${randomUUID()}.tmp`)
				await fs.writeFile(tempScriptPath, trimmedScriptContent, "utf-8")

				// Quote path to handle spaces; runner is provided by the model.
				commandToRun = `${trimmedScriptRunner} ${JSON.stringify(tempScriptPath)}`
			}

			if (!commandToRun || !commandToRun.trim()) {
				task.consecutiveMistakeCount++
				task.recordToolError("execute_command")
				pushToolResult(await task.sayAndCreateMissingParamError("execute_command", "command"))
				return
			}

			const unescapedCommand = unescapeHtmlEntities(commandToRun)

			const ignoredFileAttemptedToAccess = task.rooIgnoreController?.validateCommand(unescapedCommand)

			if (ignoredFileAttemptedToAccess) {
				await task.say("rooignore_error", ignoredFileAttemptedToAccess)
				pushToolResult(formatResponse.rooIgnoreError(ignoredFileAttemptedToAccess, toolProtocol))
				return
			}

			task.consecutiveMistakeCount = 0

			const approvalPreview = shouldUseScriptMode
				? [
						`Runner: ${trimmedScriptRunner}`,
						`Temporary script file will be created and removed automatically: ${tempScriptPath}`,
						"",
						trimmedScriptContent,
					].join("\n")
				: unescapedCommand

			const didApprove = await askApproval("command", approvalPreview)

			if (!didApprove) {
				if (tempScriptPath) {
					await fs.rm(tempScriptPath).catch(() => {})
				}
				return
			}

			const executionId = task.lastMessageTs?.toString() ?? Date.now().toString()
			const {
				terminalOutputLineLimit = 500,
				terminalOutputCharacterLimit = DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT,
				terminalShellIntegrationDisabled = true,
			} = providerState ?? {}

			// Get command execution timeout from VSCode configuration (in seconds)
			const commandExecutionTimeoutSeconds = vscode.workspace
				.getConfiguration(Package.name)
				.get<number>("commandExecutionTimeout", 0)

			// Get command timeout allowlist from VSCode configuration
			const commandTimeoutAllowlist = vscode.workspace
				.getConfiguration(Package.name)
				.get<string[]>("commandTimeoutAllowlist", [])

			// Check if command matches any prefix in the allowlist
			const isCommandAllowlisted = commandTimeoutAllowlist.some((prefix) =>
				unescapedCommand.startsWith(prefix.trim()),
			)

			// Convert seconds to milliseconds for internal use, but skip timeout if command is allowlisted
			const commandExecutionTimeout = isCommandAllowlisted ? 0 : commandExecutionTimeoutSeconds * 1000

			const options: ExecuteCommandOptions = {
				executionId,
				command: unescapedCommand,
				customCwd,
				terminalShellIntegrationDisabled,
				terminalOutputLineLimit,
				terminalOutputCharacterLimit,
				commandExecutionTimeout,
			}

			try {
				const [rejected, result] = await executeCommandInTerminal(task, options)

				if (rejected) {
					task.didRejectTool = true
				}

				pushToolResult(result)
			} catch (error: unknown) {
				const status: CommandExecutionStatus = { executionId, status: "fallback" }
				provider?.postMessageToWebview({ type: "commandExecutionStatus", text: JSON.stringify(status) })
				await task.say("shell_integration_warning")

				if (error instanceof ShellIntegrationError) {
					const [rejected, result] = await executeCommandInTerminal(task, {
						...options,
						terminalShellIntegrationDisabled: true,
					})

					if (rejected) {
						task.didRejectTool = true
					}

					pushToolResult(result)
				} else {
					pushToolResult(`Command failed to execute in terminal due to a shell integration error.`)
				}
			}

			return
		} catch (error) {
			await handleError("executing command", error as Error)
			return
		} finally {
			if (tempScriptDir) {
				await fs.rm(tempScriptDir, { recursive: true, force: true }).catch(() => {})
			} else if (tempScriptPath) {
				await fs.rm(tempScriptPath).catch(() => {})
			}
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"execute_command">): Promise<void> {
		const command = block.params.command
		await task
			.ask("command", this.removeClosingTag("command", command, block.partial), block.partial)
			.catch(() => {})
	}
}

export type ExecuteCommandOptions = {
	executionId: string
	command: string
	customCwd?: string
	terminalShellIntegrationDisabled?: boolean
	terminalOutputLineLimit?: number
	terminalOutputCharacterLimit?: number
	commandExecutionTimeout?: number
}

export async function executeCommandInTerminal(
	task: Task,
	{
		executionId,
		command,
		customCwd,
		terminalShellIntegrationDisabled = true,
		terminalOutputLineLimit = 500,
		terminalOutputCharacterLimit = DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT,
		commandExecutionTimeout = 0,
	}: ExecuteCommandOptions,
): Promise<[boolean, ToolResponse]> {
	// Convert milliseconds back to seconds for display purposes.
	const commandExecutionTimeoutSeconds = commandExecutionTimeout / 1000
	let workingDir: string

	if (!customCwd) {
		workingDir = task.cwd
	} else if (path.isAbsolute(customCwd)) {
		workingDir = customCwd
	} else {
		workingDir = path.resolve(task.cwd, customCwd)
	}

	try {
		await fs.access(workingDir)
	} catch (error) {
		return [false, `Working directory '${workingDir}' does not exist.`]
	}

	let message: { text?: string; images?: string[] } | undefined
	let runInBackground = false
	let completed = false
	let result: string = ""
	let exitDetails: ExitCodeDetails | undefined
	let shellIntegrationError: string | undefined
	let hasAskedForCommandOutput = false

	const terminalProvider = terminalShellIntegrationDisabled ? "execa" : "vscode"
	const provider = await task.providerRef.deref()

	let accumulatedOutput = ""
	const callbacks: RooTerminalCallbacks = {
		onLine: async (lines: string, process: RooTerminalProcess) => {
			accumulatedOutput += lines
			const compressedOutput = Terminal.compressTerminalOutput(
				accumulatedOutput,
				terminalOutputLineLimit,
				terminalOutputCharacterLimit,
			)
			const status: CommandExecutionStatus = { executionId, status: "output", output: compressedOutput }
			provider?.postMessageToWebview({ type: "commandExecutionStatus", text: JSON.stringify(status) })

			if (runInBackground || hasAskedForCommandOutput) {
				return
			}

			// Mark that we've asked to prevent multiple concurrent asks
			hasAskedForCommandOutput = true

			try {
				const { response, text, images } = await task.ask("command_output", "")
				runInBackground = true

				if (response === "messageResponse") {
					message = { text, images }
					process.continue()
				}
			} catch (_error) {
				// Silently handle ask errors (e.g., "Current ask promise was ignored")
			}
		},
		onCompleted: (output: string | undefined) => {
			result = Terminal.compressTerminalOutput(
				output ?? "",
				terminalOutputLineLimit,
				terminalOutputCharacterLimit,
			)

			task.say("command_output", result)
			completed = true
		},
		onShellExecutionStarted: (pid: number | undefined) => {
			const status: CommandExecutionStatus = { executionId, status: "started", pid, command }
			provider?.postMessageToWebview({ type: "commandExecutionStatus", text: JSON.stringify(status) })
		},
		onShellExecutionComplete: (details: ExitCodeDetails) => {
			const status: CommandExecutionStatus = { executionId, status: "exited", exitCode: details.exitCode }
			provider?.postMessageToWebview({ type: "commandExecutionStatus", text: JSON.stringify(status) })
			exitDetails = details
		},
	}

	if (terminalProvider === "vscode") {
		callbacks.onNoShellIntegration = async (error: string) => {
			TelemetryService.instance.captureShellIntegrationError(task.taskId)
			shellIntegrationError = error
		}
	}

	const terminal = await TerminalRegistry.getOrCreateTerminal(workingDir, task.taskId, terminalProvider)

	if (terminal instanceof Terminal) {
		terminal.terminal.show(true)

		// Update the working directory in case the terminal we asked for has
		// a different working directory so that the model will know where the
		// command actually executed.
		workingDir = terminal.getCurrentWorkingDirectory()
	}

	const process = terminal.runCommand(command, callbacks)
	task.terminalProcess = process

	// Implement command execution timeout (skip if timeout is 0).
	if (commandExecutionTimeout > 0) {
		let timeoutId: NodeJS.Timeout | undefined
		let isTimedOut = false

		const timeoutPromise = new Promise<void>((_, reject) => {
			timeoutId = setTimeout(() => {
				isTimedOut = true
				task.terminalProcess?.abort()
				reject(new Error(`Command execution timed out after ${commandExecutionTimeout}ms`))
			}, commandExecutionTimeout)
		})

		try {
			await Promise.race([process, timeoutPromise])
		} catch (error) {
			if (isTimedOut) {
				const status: CommandExecutionStatus = { executionId, status: "timeout" }
				provider?.postMessageToWebview({ type: "commandExecutionStatus", text: JSON.stringify(status) })
				await task.say("error", t("common:errors:command_timeout", { seconds: commandExecutionTimeoutSeconds }))
				task.didToolFailInCurrentTurn = true
				task.terminalProcess = undefined

				return [
					false,
					`The command was terminated after exceeding a user-configured ${commandExecutionTimeoutSeconds}s timeout. Do not try to re-run the command.`,
				]
			}
			throw error
		} finally {
			if (timeoutId) {
				clearTimeout(timeoutId)
			}

			task.terminalProcess = undefined
		}
	} else {
		// No timeout - just wait for the process to complete.
		try {
			await process
		} finally {
			task.terminalProcess = undefined
		}
	}

	if (shellIntegrationError) {
		throw new ShellIntegrationError(shellIntegrationError)
	}

	// Wait for a short delay to ensure all messages are sent to the webview.
	// This delay allows time for non-awaited promises to be created and
	// for their associated messages to be sent to the webview, maintaining
	// the correct order of messages (although the webview is smart about
	// grouping command_output messages despite any gaps anyways).
	await delay(50)

	// If we reached this point without any output or exit details, the command likely
	// failed before producing stream events (common with malformed scripts on Windows).
	// Surface a failure result so the UI doesn't stay in a pending state.
	if (!message && !completed && !exitDetails) {
		let terminalSnapshot = ""
		try {
			// Try to grab whatever the terminal has, to surface any hidden errors.
			if (terminal instanceof Terminal) {
				terminalSnapshot = await Terminal.getTerminalContents(1)
			}
		} catch (snapshotError) {
			console.warn("[ExecuteCommandTool] Failed to grab terminal contents:", snapshotError)
		}

		const workingDirInfo = workingDir ? ` in '${workingDir.toPosix()}'` : ""
		const snapshotInfo = terminalSnapshot ? `\n\nTerminal output snapshot:\n${terminalSnapshot}` : ""

		return [
			false,
			[
				"Command finished without producing output or exit details.",
				`It may have failed immediately${workingDirInfo}.`,
				"Please check runner availability, file paths, or script syntax and retry.",
				snapshotInfo,
			].join("\n"),
		]
	}

	if (message) {
		const { text, images } = message
		await task.say("user_feedback", text, images)

		return [
			true,
			formatResponse.toolResult(
				[
					`Command is still running in terminal from '${terminal.getCurrentWorkingDirectory().toPosix()}'.`,
					result.length > 0 ? `Here's the output so far:\n${result}\n` : "\n",
					`The user provided the following feedback:`,
					`<feedback>\n${text}\n</feedback>`,
				].join("\n"),
				images,
			),
		]
	} else if (completed || exitDetails) {
		let exitStatus: string = ""

		if (exitDetails !== undefined) {
			if (exitDetails.signalName) {
				exitStatus = `Process terminated by signal ${exitDetails.signalName}`

				if (exitDetails.coreDumpPossible) {
					exitStatus += " - core dump possible"
				}
			} else if (exitDetails.exitCode === undefined) {
				result += "<VSCE exit code is undefined: terminal output and command execution status is unknown.>"
				exitStatus = `Exit code: <undefined, notify user>`
			} else {
				if (exitDetails.exitCode !== 0) {
					exitStatus += "Command execution was not successful, inspect the cause and adjust as needed.\n"
				}

				exitStatus += `Exit code: ${exitDetails.exitCode}`
			}
		} else {
			result += "<VSCE exitDetails == undefined: terminal output and command execution status is unknown.>"
			exitStatus = `Exit code: <undefined, notify user>`
		}

		let workingDirInfo = ` within working directory '${terminal.getCurrentWorkingDirectory().toPosix()}'`

		return [false, `Command executed in terminal ${workingDirInfo}. ${exitStatus}\nOutput:\n${result}`]
	} else {
		return [
			false,
			[
				`Command is still running in terminal ${workingDir ? ` from '${workingDir.toPosix()}'` : ""}.`,
				result.length > 0 ? `Here's the output so far:\n${result}\n` : "\n",
				"You will be updated on the terminal status and new output in the future.",
			].join("\n"),
		]
	}
}

export const executeCommandTool = new ExecuteCommandTool()
