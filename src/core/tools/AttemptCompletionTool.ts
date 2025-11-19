import * as vscode from "vscode"
import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import { formatResponse } from "../prompts/responses"
import { Package } from "../../shared/package"

export interface AttemptCompletionParams {
	result: string
	command?: string
}

export interface AttemptCompletionCallbacks extends ToolCallbacks {
	askFinishSubTaskApproval: (message: string) => Promise<boolean>
	toolDescription?: (toolName: string, json: string) => string
}

export class AttemptCompletionTool extends BaseTool<"attempt_completion"> {
	readonly name = "attempt_completion" as const

	parseLegacy(params: Partial<Record<string, string>>): AttemptCompletionParams {
		return {
			result: params.result || "",
			command: params.command,
		}
	}

	async execute(params: AttemptCompletionParams, task: Task, callbacks: AttemptCompletionCallbacks): Promise<void> {
		const { result, command } = params
		const { askApproval, handleError, pushToolResult, askFinishSubTaskApproval } = callbacks

		try {
			if (!result) {
				task.consecutiveMistakeCount++
				task.recordToolError("attempt_completion")
				pushToolResult(await task.sayAndCreateMissingParamError("attempt_completion", "result"))
				return
			}

			// Check for open todos if setting enabled
			const preventCompletionWithOpenTodos = vscode.workspace
				.getConfiguration(Package.name)
				.get<boolean>("preventCompletionWithOpenTodos", false)

			if (preventCompletionWithOpenTodos && task.todoList) {
				const incompleteTodos = task.todoList.filter((todo) => todo.status !== "completed")
				if (incompleteTodos.length > 0) {
					task.consecutiveMistakeCount++
					task.recordToolError("attempt_completion")
					pushToolResult(
						formatResponse.toolError(
							"Cannot complete task while there are incomplete todos. Please complete or cancel them first.",
						),
					)
					return
				}
			}

			task.consecutiveMistakeCount = 0

			// If it's a subtask (has parentTaskId), we need special handling
			if (task.parentTaskId) {
				const toolMessage = JSON.stringify({
					tool: "attemptCompletion",
					content: result,
					command,
				})

				const didApprove = await askFinishSubTaskApproval(toolMessage)
				if (!didApprove) {
					return
				}

				const provider = task.providerRef.deref()
				if (provider) {
					await (provider as any).reopenParentFromDelegation({
						parentTaskId: task.parentTaskId,
						childTaskId: task.taskId,
						completionResultSummary: result,
					})
				}

				pushToolResult(result)
				return
			}

			// Root task completion
			const toolMessage = JSON.stringify({
				tool: "attemptCompletion",
				content: result,
				command,
			})

			const didApprove = await askApproval("tool", toolMessage)
			if (!didApprove) {
				return
			}

			if (command) {
				await task.say("text", `Executing command: ${command}`)
				// We don't await the command execution here because we're completing the task
			}

			pushToolResult(result)
			return
		} catch (error) {
			await handleError("attempting completion", error)
			return
		}
	}

	override async handlePartial(task: Task, block: any): Promise<void> {
		// No partial handling needed for attempt_completion as it's usually final
		// But we can implement it if needed for consistent UI
		const result = block.params.result
		const command = block.params.command
		if (result || command) {
			const partialMessage = JSON.stringify({
				tool: "attemptCompletion",
				content: this.removeClosingTag("result", result, block.partial),
				command: this.removeClosingTag("command", command, block.partial),
			})
			await task.ask("tool", partialMessage, block.partial).catch(() => {})
		}
	}
}

export const attemptCompletionTool = new AttemptCompletionTool()
