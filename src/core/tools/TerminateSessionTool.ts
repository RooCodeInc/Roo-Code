import { Task } from "../task/Task"
import { ToolUse } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ProcessManager } from "../../integrations/terminal/ProcessManager"

import { BaseTool, ToolCallbacks } from "./BaseTool"

/**
 * Parameters for the terminate_session tool.
 */
interface TerminateSessionParams {
	/** Session ID of the running process to terminate */
	session_id: number
}

/**
 * TerminateSessionTool enables the LLM to terminate running terminal sessions.
 *
 * This tool works in conjunction with execute_command:
 * 1. execute_command starts a process and returns a session_id if still running
 * 2. terminate_session uses that session_id to abort the process
 *
 * ## Use Cases
 *
 * - Stopping a development server that's no longer needed
 * - Terminating stuck or unresponsive processes
 * - Cleaning up background processes before completing a task
 * - Freeing resources from long-running processes
 */
export class TerminateSessionTool extends BaseTool<"terminate_session"> {
	readonly name = "terminate_session" as const

	async execute(params: TerminateSessionParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { handleError, pushToolResult } = callbacks

		try {
			const { session_id } = params

			// Validate session_id
			if (session_id === undefined || session_id === null) {
				task.consecutiveMistakeCount++
				task.recordToolError("terminate_session")
				pushToolResult(await task.sayAndCreateMissingParamError("terminate_session", "session_id"))
				return
			}

			// Get ProcessManager and terminate the session
			const processManager = ProcessManager.getInstance()
			const result = processManager.terminateSession(session_id)

			if (result.success) {
				task.consecutiveMistakeCount = 0

				// Format success response
				const response = this.formatResponse({
					sessionId: session_id,
					success: true,
					message: result.message,
				})

				await task.say("tool", response, undefined, false)
				pushToolResult(formatResponse.toolResult(response))
			} else {
				task.consecutiveMistakeCount++
				task.recordToolError("terminate_session")
				task.didToolFailInCurrentTurn = true

				const errorMsg = result.message
				await task.say("error", errorMsg)
				pushToolResult(`Error: ${errorMsg}`)
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			await handleError("terminating session", error instanceof Error ? error : new Error(errorMessage))
			task.recordToolError("terminate_session")
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"terminate_session">): Promise<void> {
		const sessionId = block.params.session_id || block.nativeArgs?.session_id

		if (sessionId) {
			await task.say(
				"tool",
				JSON.stringify({
					tool: "terminate_session",
					session_id: sessionId,
					content: `Terminating session ${sessionId}...`,
				}),
				undefined,
				true,
			)
		}
	}

	/**
	 * Format the response message for the tool result.
	 */
	private formatResponse(params: { sessionId: number; success: boolean; message: string }): string {
		const { sessionId, success, message } = params

		const lines: string[] = []
		lines.push(`## Session ${sessionId} Termination`)
		lines.push("")
		lines.push(`**Status:** ${success ? "✅ Success" : "❌ Failed"}`)
		lines.push(`**Message:** ${message}`)

		return lines.join("\n")
	}
}

// Export singleton instance
export const terminateSessionTool = new TerminateSessionTool()
