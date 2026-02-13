import * as vscode from "vscode"

import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"

interface NotifyUserParams {
	message: string
	level?: "info" | "warning" | "error"
}

export class NotifyUserTool extends BaseTool<"notify_user"> {
	readonly name = "notify_user" as const

	async execute(params: NotifyUserParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { handleError, pushToolResult } = callbacks
		const { message, level = "info" } = params

		try {
			if (!message) {
				task.consecutiveMistakeCount++
				task.recordToolError("notify_user")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("notify_user", "message"))
				return
			}

			task.consecutiveMistakeCount = 0

			// Send VS Code notification without pausing the task loop
			switch (level) {
				case "error":
					vscode.window.showErrorMessage(`[Roo] ${message}`)
					break
				case "warning":
					vscode.window.showWarningMessage(`[Roo] ${message}`)
					break
				case "info":
				default:
					vscode.window.showInformationMessage(`[Roo] ${message}`)
					break
			}

			// Also emit as a say message so it appears in the chat
			await task.say("text", `📢 Notification (${level}): ${message}`)

			this._rpiObservationExtras = {
				summary: `Notified user: ${message.slice(0, 100)}`,
			}

			pushToolResult(`User notified with ${level} message: ${message}`)
		} catch (error) {
			await handleError("notifying user", error as Error)
		}
	}
}

export const notifyUserTool = new NotifyUserTool()
