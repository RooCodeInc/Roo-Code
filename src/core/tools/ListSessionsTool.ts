import { Task } from "../task/Task"
import { ToolUse } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ProcessManager } from "../../integrations/terminal/ProcessManager"

import { BaseTool, ToolCallbacks } from "./BaseTool"

/**
 * ListSessionsTool enables the LLM to see all active terminal sessions.
 *
 * This tool lists all terminal sessions that were started by execute_command
 * and can be interacted with using write_stdin or terminated.
 *
 * ## Use Cases
 *
 * - Checking which background processes are still running
 * - Finding a session_id that was forgotten
 * - Auditing resource usage before task completion
 * - Verifying that a server/process is still active
 */
export class ListSessionsTool extends BaseTool<"list_sessions"> {
	readonly name = "list_sessions" as const

	async execute(_params: Record<string, never>, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { handleError, pushToolResult } = callbacks

		try {
			// Get all sessions from ProcessManager
			const processManager = ProcessManager.getInstance()
			const sessions = processManager.listSessions(task.taskId)

			task.consecutiveMistakeCount = 0

			// Format response
			const response = this.formatResponse(sessions)

			await task.say("tool", response, undefined, false)
			pushToolResult(formatResponse.toolResult(response))
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			await handleError("listing sessions", error instanceof Error ? error : new Error(errorMessage))
			task.recordToolError("list_sessions")
		}
	}

	override async handlePartial(task: Task, _block: ToolUse<"list_sessions">): Promise<void> {
		await task.say(
			"tool",
			JSON.stringify({
				tool: "list_sessions",
				content: "Listing active sessions...",
			}),
			undefined,
			true,
		)
	}

	/**
	 * Format the sessions list into a readable table.
	 */
	private formatResponse(
		sessions: Array<{
			sessionId: number
			taskId: string
			command: string
			running: boolean
			lastUsed: number
		}>,
	): string {
		if (sessions.length === 0) {
			return `## Active Terminal Sessions

No active sessions found.

Sessions are created when execute_command starts a process that doesn't complete within the yield time.
Use execute_command to start a new process that can be interacted with.`
		}

		const lines: string[] = []
		lines.push("## Active Terminal Sessions")
		lines.push("")
		lines.push(`Found ${sessions.length} active session${sessions.length !== 1 ? "s" : ""}:`)
		lines.push("")
		lines.push("| Session | Command | Status | Last Used |")
		lines.push("|---------|---------|--------|-----------|")

		for (const session of sessions) {
			const status = session.running ? "🟢 Running" : "⚪ Stopped"
			const lastUsed = this.formatTimeSince(session.lastUsed)
			const command = this.truncateCommand(session.command, 40)

			lines.push(`| ${session.sessionId} | \`${command}\` | ${status} | ${lastUsed} |`)
		}

		lines.push("")
		lines.push("**Actions:**")
		lines.push("- Use `write_stdin` with a session_id to send input to a running process")
		lines.push("- Use `terminate_session` with a session_id to stop a process")

		return lines.join("\n")
	}

	/**
	 * Format time since a timestamp as a human-readable string.
	 */
	private formatTimeSince(timestamp: number): string {
		const seconds = Math.floor((Date.now() - timestamp) / 1000)

		if (seconds < 60) {
			return `${seconds}s ago`
		}

		const minutes = Math.floor(seconds / 60)
		if (minutes < 60) {
			return `${minutes}m ago`
		}

		const hours = Math.floor(minutes / 60)
		if (hours < 24) {
			return `${hours}h ago`
		}

		const days = Math.floor(hours / 24)
		return `${days}d ago`
	}

	/**
	 * Truncate a command string for display.
	 */
	private truncateCommand(command: string, maxLength: number): string {
		// Remove newlines and extra whitespace
		const cleaned = command.replace(/\s+/g, " ").trim()

		if (cleaned.length <= maxLength) {
			return cleaned
		}

		return cleaned.slice(0, maxLength - 3) + "..."
	}
}

// Export singleton instance
export const listSessionsTool = new ListSessionsTool()
