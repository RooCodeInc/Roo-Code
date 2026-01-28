import delay from "delay"

import { Task } from "../task/Task"
import { ToolUse } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ProcessManager } from "../../integrations/terminal/ProcessManager"
import { t } from "../../i18n"

import { BaseTool, ToolCallbacks } from "./BaseTool"

/**
 * Minimum yield time in milliseconds.
 */
const MIN_YIELD_TIME_MS = 250

/**
 * Maximum yield time in milliseconds.
 */
const MAX_YIELD_TIME_MS = 30_000

/**
 * Default yield time when no input is provided (polling).
 */
const DEFAULT_POLL_YIELD_MS = 5_000

/**
 * Default yield time when input is provided.
 */
const DEFAULT_INPUT_YIELD_MS = 250

/**
 * Default maximum output tokens.
 */
const DEFAULT_MAX_OUTPUT_TOKENS = 10_000

/**
 * Parameters for the write_stdin tool.
 */
interface WriteStdinParams {
	/** Session ID of the running process */
	session_id: number
	/** Characters to write to stdin (may be empty to poll) */
	chars?: string
	/** Milliseconds to wait for output */
	yield_time_ms?: number
	/** Maximum tokens to return */
	max_output_tokens?: number
}

/**
 * WriteStdinTool enables the LLM to write to stdin of running processes.
 *
 * This tool works in conjunction with execute_command:
 * 1. execute_command starts a process and returns a session_id if still running
 * 2. write_stdin uses that session_id to send input to the process
 * 3. The tool returns any new output after sending the input
 *
 * ## Use Cases
 *
 * - Responding to interactive prompts (y/n confirmations, passwords)
 * - Providing input to CLI tools that request it
 * - Sending control characters (Ctrl+C = \x03)
 * - Polling for output from long-running processes
 *
 * ## Terminal Types
 *
 * - VSCode Terminal: Uses terminal.sendText() for stdin
 * - Execa Terminal: Uses subprocess.stdin.write() (requires stdin: "pipe")
 */
export class WriteStdinTool extends BaseTool<"write_stdin"> {
	readonly name = "write_stdin" as const

	async execute(params: WriteStdinParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { handleError, pushToolResult } = callbacks

		try {
			const { session_id, chars = "", yield_time_ms, max_output_tokens = DEFAULT_MAX_OUTPUT_TOKENS } = params

			// Validate session_id
			if (session_id === undefined || session_id === null) {
				task.consecutiveMistakeCount++
				task.recordToolError("write_stdin")
				pushToolResult(await task.sayAndCreateMissingParamError("write_stdin", "session_id"))
				return
			}

			// Get process from ProcessManager
			const processManager = ProcessManager.getInstance()
			const entry = processManager.getProcess(session_id)

			if (!entry) {
				task.consecutiveMistakeCount++
				task.recordToolError("write_stdin")
				task.didToolFailInCurrentTurn = true
				const errorMsg = `Session ${session_id} not found. The process may have exited or the session ID is invalid. Use execute_command to start a new process.`
				await task.say("error", errorMsg)
				pushToolResult(`Error: ${errorMsg}`)
				return
			}

			// Check if process is still running
			if (!entry.running) {
				task.consecutiveMistakeCount++
				task.recordToolError("write_stdin")
				task.didToolFailInCurrentTurn = true
				const errorMsg = `Session ${session_id} has completed. The process is no longer running. Use execute_command to start a new process if needed.`
				await task.say("error", errorMsg)
				pushToolResult(`Error: ${errorMsg}`)
				return
			}

			// Reset mistake count on valid input
			task.consecutiveMistakeCount = 0

			// Calculate yield time
			const hasInput = chars.length > 0
			const defaultYield = hasInput ? DEFAULT_INPUT_YIELD_MS : DEFAULT_POLL_YIELD_MS
			const requestedYield = yield_time_ms ?? defaultYield
			const clampedYield = Math.max(MIN_YIELD_TIME_MS, Math.min(MAX_YIELD_TIME_MS, requestedYield))

			// Process escape sequences in input
			const processedChars = this.processEscapeSequences(chars)

			// Write to stdin using the unified writeStdin interface
			const { terminal, process } = entry
			let writeSuccess = false

			try {
				// Use the process writeStdin method which works for both VSCode and Execa terminals
				writeSuccess = process.writeStdin(processedChars)

				if (!writeSuccess) {
					const errorMsg = `Failed to write to session ${session_id}: stdin is not available`
					await task.say("error", errorMsg)
					pushToolResult(`Error: ${errorMsg}`)
					return
				}
			} catch (writeError) {
				const errorMsg = `Failed to write to session ${session_id}: ${writeError instanceof Error ? writeError.message : String(writeError)}`
				await task.say("error", errorMsg)
				task.didToolFailInCurrentTurn = true
				pushToolResult(`Error: ${errorMsg}`)
				return
			}

			// Wait for output
			await delay(clampedYield)

			// Get any new output
			let output = ""
			if (process.hasUnretrievedOutput()) {
				output = process.getUnretrievedOutput()
			}

			// Check if process has exited
			const isStillRunning = !terminal.isClosed() && terminal.running
			if (!isStillRunning) {
				processManager.markCompleted(session_id)
			}

			// Truncate output if needed
			const truncatedOutput = this.truncateOutput(output, max_output_tokens)

			// Build response
			const result = this.formatResponse({
				sessionId: session_id,
				command: entry.command,
				input: chars,
				output: truncatedOutput.text,
				truncated: truncatedOutput.truncated,
				originalTokens: truncatedOutput.originalTokens,
				running: isStillRunning,
				yieldTime: clampedYield,
			})

			pushToolResult(result)
		} catch (error) {
			await handleError("writing to stdin", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"write_stdin">): Promise<void> {
		const sessionId = block.params.session_id ?? block.nativeArgs?.session_id
		const chars = block.params.chars ?? block.nativeArgs?.chars ?? ""
		await task
			.ask(
				"command",
				`write_stdin session=${sessionId} chars="${chars.slice(0, 20)}${chars.length > 20 ? "..." : ""}"`,
				block.partial,
			)
			.catch(() => {})
	}

	/**
	 * Process escape sequences in the input string.
	 *
	 * Handles:
	 * - \n -> newline
	 * - \r -> carriage return
	 * - \t -> tab
	 * - \xNN -> hex byte
	 * - \\ -> backslash
	 */
	private processEscapeSequences(input: string): string {
		return input.replace(/\\(n|r|t|\\|x[0-9a-fA-F]{2})/g, (match, escape) => {
			switch (escape) {
				case "n":
					return "\n"
				case "r":
					return "\r"
				case "t":
					return "\t"
				case "\\":
					return "\\"
				default:
					// Handle \xNN hex escapes
					if (escape.startsWith("x")) {
						const hexValue = parseInt(escape.slice(1), 16)
						return String.fromCharCode(hexValue)
					}
					return match
			}
		})
	}

	/**
	 * Truncate output to fit within token limit.
	 *
	 * Uses head/tail preservation to keep the beginning and end
	 * while truncating the middle.
	 */
	private truncateOutput(
		output: string,
		maxTokens: number,
	): { text: string; truncated: boolean; originalTokens: number } {
		// Rough estimate: 4 characters per token
		const BYTES_PER_TOKEN = 4
		const maxBytes = maxTokens * BYTES_PER_TOKEN
		const originalTokens = Math.ceil(output.length / BYTES_PER_TOKEN)

		if (output.length <= maxBytes) {
			return { text: output, truncated: false, originalTokens }
		}

		// Split budget 50/50 between head and tail
		const halfBudget = Math.floor(maxBytes / 2)
		const head = output.slice(0, halfBudget)
		const tail = output.slice(-halfBudget)
		const truncatedTokens = originalTokens - maxTokens

		const marker = `\n\n...[${truncatedTokens} tokens truncated]...\n\n`
		return {
			text: head + marker + tail,
			truncated: true,
			originalTokens,
		}
	}

	/**
	 * Format the tool response.
	 */
	private formatResponse(params: {
		sessionId: number
		command: string
		input: string
		output: string
		truncated: boolean
		originalTokens: number
		running: boolean
		yieldTime: number
	}): string {
		const { sessionId, command, input, output, truncated, originalTokens, running, yieldTime } = params

		const lines: string[] = []

		// Header
		if (running) {
			lines.push(`Session ${sessionId} is still running.`)
		} else {
			lines.push(`Session ${sessionId} has exited.`)
		}

		// Input echo (if any)
		if (input) {
			const displayInput = input.length > 50 ? input.slice(0, 50) + "..." : input
			lines.push(`Sent: "${this.escapeForDisplay(displayInput)}"`)
		} else {
			lines.push(`Polled for output (waited ${yieldTime}ms)`)
		}

		// Output
		if (output) {
			if (truncated) {
				lines.push(`Output (truncated from ~${originalTokens} tokens):`)
			} else {
				lines.push(`Output:`)
			}
			lines.push(output)
		} else {
			lines.push(`No new output received.`)
		}

		// Guidance
		if (running) {
			lines.push(`\nUse write_stdin with session_id=${sessionId} to continue interacting with this process.`)
		} else {
			lines.push(`\nUse execute_command to start a new process if needed.`)
		}

		return lines.join("\n")
	}

	/**
	 * Escape control characters for display.
	 */
	private escapeForDisplay(str: string): string {
		return (
			str
				.replace(/\\/g, "\\\\")
				.replace(/\n/g, "\\n")
				.replace(/\r/g, "\\r")
				.replace(/\t/g, "\\t")
				// eslint-disable-next-line no-control-regex -- Intentionally matching control characters for escaping
				.replace(/[\x00-\x1F]/g, (char) => `\\x${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
		)
	}
}

// Export singleton instance
export const writeStdinTool = new WriteStdinTool()
