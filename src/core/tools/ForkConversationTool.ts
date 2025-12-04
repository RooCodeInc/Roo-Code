import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"

import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"

interface ForkConversationParams {
	messageIndex?: number
	targetDirectory?: string
}

export class ForkConversationTool extends BaseTool<"fork_conversation"> {
	readonly name = "fork_conversation" as const

	parseLegacy(params: Partial<Record<string, string>>): ForkConversationParams {
		return {
			messageIndex: params.message_index ? parseInt(params.message_index, 10) : undefined,
			targetDirectory: params.target_directory,
		}
	}

	async execute(params: ForkConversationParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { messageIndex, targetDirectory } = params
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			const provider = task.providerRef.deref()

			if (!provider) {
				pushToolResult(formatResponse.toolError("Provider reference lost"))
				return
			}

			// Get current task messages
			const currentMessages = task.clineMessages
			const currentApiMessages = task.apiConversationHistory

			// Determine fork point (default to current point if not specified)
			const forkIndex = messageIndex ?? currentMessages.length

			if (forkIndex < 0 || forkIndex > currentMessages.length) {
				task.consecutiveMistakeCount++
				task.recordToolError("fork_conversation")
				task.didToolFailInCurrentTurn = true
				pushToolResult(
					formatResponse.toolError(
						`Invalid message index: ${forkIndex}. Must be between 0 and ${currentMessages.length}`,
					),
				)
				return
			}

			// Determine target directory for forked workspace
			const workspacePath = provider.cwd
			const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)
			const defaultTargetDir = path.join(
				path.dirname(workspacePath),
				`${path.basename(workspacePath)}-fork-${timestamp}`,
			)
			const actualTargetDir = targetDirectory || defaultTargetDir

			// Create fork message for approval
			const toolMessage = JSON.stringify({
				tool: "forkConversation",
				forkPoint: forkIndex === currentMessages.length ? "current" : `message ${forkIndex}`,
				sourceWorkspace: workspacePath,
				targetWorkspace: actualTargetDir,
			})

			const didApprove = await askApproval("tool", toolMessage)

			if (!didApprove) {
				return
			}

			task.consecutiveMistakeCount = 0

			// Save checkpoint before forking
			if (task.enableCheckpoints) {
				task.checkpointSave(true)
			}

			// Fork the conversation and workspace
			const forkedTask = await (provider as any).forkConversation({
				parentTaskId: task.taskId,
				forkIndex,
				targetDirectory: actualTargetDir,
				messages: currentMessages.slice(0, forkIndex),
				apiMessages: currentApiMessages.slice(0, forkIndex),
			})

			pushToolResult(
				`Successfully forked conversation to new task ${forkedTask.taskId} with workspace at ${actualTargetDir}`,
			)
			return
		} catch (error) {
			await handleError("forking conversation", error)
			return
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"fork_conversation">): Promise<void> {
		const messageIndex = (block.params as any).message_index
		const targetDirectory = (block.params as any).target_directory

		const partialMessage = JSON.stringify({
			tool: "forkConversation",
			messageIndex: this.removeClosingTag("message_index", messageIndex, block.partial),
			targetDirectory: this.removeClosingTag("target_directory", targetDirectory, block.partial),
		})

		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}
}

export const forkConversationTool = new ForkConversationTool()
