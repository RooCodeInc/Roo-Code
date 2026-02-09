import * as vscode from "vscode"

import { RooCodeEventName, type HistoryItem } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { Package } from "../../shared/package"
import type { ToolUse } from "../../shared/tools"
import { t } from "../../i18n"

import { BaseTool, ToolCallbacks } from "./BaseTool"

interface AttemptCompletionParams {
	result: string
	command?: string
}

export interface AttemptCompletionCallbacks extends ToolCallbacks {
	askFinishSubTaskApproval: () => Promise<boolean>
	toolDescription: () => string
}

/**
 * Interface for provider methods needed by AttemptCompletionTool for delegation handling.
 */
interface DelegationProvider {
	getTaskWithId(id: string): Promise<{ historyItem: HistoryItem }>
	reopenParentFromDelegation(params: {
		parentTaskId: string
		childTaskId: string
		completionResultSummary: string
	}): Promise<void>
}

export class AttemptCompletionTool extends BaseTool<"attempt_completion"> {
	readonly name = "attempt_completion" as const

	async execute(params: AttemptCompletionParams, task: Task, callbacks: AttemptCompletionCallbacks): Promise<void> {
		const { result } = params
		const { handleError, pushToolResult, askFinishSubTaskApproval } = callbacks

		// Prevent attempt_completion if any tool failed in the current turn
		if (task.didToolFailInCurrentTurn) {
			const errorMsg = t("common:errors.attempt_completion_tool_failed")

			await task.say("error", errorMsg)
			pushToolResult(formatResponse.toolError(errorMsg))
			return
		}

		const preventCompletionWithOpenTodos = vscode.workspace
			.getConfiguration(Package.name)
			.get<boolean>("preventCompletionWithOpenTodos", false)

		const hasIncompleteTodos = task.todoList && task.todoList.some((todo) => todo.status !== "completed")

		if (preventCompletionWithOpenTodos && hasIncompleteTodos) {
			task.consecutiveMistakeCount++
			task.recordToolError("attempt_completion")

			pushToolResult(
				formatResponse.toolError(
					"Cannot complete task while there are incomplete todos. Please finish all todos before attempting completion.",
				),
			)

			return
		}

		const rpiCompletionBlocker = await (task as any).getRpiCompletionBlocker?.()
		if (rpiCompletionBlocker) {
			task.consecutiveMistakeCount++
			task.recordToolError("attempt_completion")
			pushToolResult(formatResponse.toolError(rpiCompletionBlocker))
			return
		}

		try {
			if (!result) {
				task.consecutiveMistakeCount++
				task.recordToolError("attempt_completion")
				pushToolResult(await task.sayAndCreateMissingParamError("attempt_completion", "result"))
				return
			}

			task.consecutiveMistakeCount = 0

			await task.say("completion_result", result, undefined, false)

			// Force final token usage update before emitting TaskCompleted
			// This ensures the most recent stats are captured regardless of throttle timer
			// and properly updates the snapshot to prevent redundant emissions
			task.emitFinalTokenUsageUpdate()

			TelemetryService.instance.captureTaskCompleted(task.taskId)
			task.emit(RooCodeEventName.TaskCompleted, task.taskId, task.getTokenUsage(), task.toolUsage)

			// Check for subtask using parentTaskId (metadata-driven delegation)
			if (task.parentTaskId) {
				// Check both child and parent metadata before deciding delegation.
				// Parent metadata is authoritative for orchestration flow and prevents
				// child tasks from "self-completing" when the parent is still awaiting them.
				const provider = task.providerRef.deref() as DelegationProvider | undefined
				if (provider) {
					try {
						const [{ historyItem: childHistory }, { historyItem: parentHistory }] = await Promise.all([
							provider.getTaskWithId(task.taskId),
							provider.getTaskWithId(task.parentTaskId),
						])
						const childStatus = childHistory?.status
						const shouldDelegate = this.shouldDelegateToParent({
							childStatus,
							parentHistory,
							childTaskId: task.taskId,
						})

						if (shouldDelegate) {
							// Normal subtask completion - delegate back to parent/orchestrator
							const delegated = await this.delegateToParent(
								task,
								result,
								provider,
								askFinishSubTaskApproval,
								pushToolResult,
							)
							if (delegated) return
						} else if (childStatus !== "completed") {
							// Unexpected combination - log error and skip delegation to avoid corruption.
							console.error(
								`[AttemptCompletionTool] Unexpected delegation state for child ${task.taskId} -> parent ${task.parentTaskId}. ` +
									`childStatus="${childStatus}", parentStatus="${parentHistory?.status}", awaitingChildId="${parentHistory?.awaitingChildId}", delegatedToId="${parentHistory?.delegatedToId}". ` +
									`Skipping delegation to prevent duplicate completion writes.`,
							)
						} else {
							// Child is already completed and parent is not awaiting it.
							// This is typically a history revisit; do not delegate again.
						}
					} catch (err) {
						// If we can't get the history, log error and skip delegation
						console.error(
							`[AttemptCompletionTool] Failed to get history for task ${task.taskId}: ${(err as Error)?.message ?? String(err)}. ` +
								`Skipping delegation.`,
						)
						// Fall through to normal completion ask flow
					}
				}
			}

			const { response, text, images } = await task.ask("completion_result", "", false)

			if (response === "yesButtonClicked") {
				await (task as any).markRpiCompletionAccepted?.()
				return
			}

			// User provided feedback - push tool result to continue the conversation
			await task.say("user_feedback", text ?? "", images)

			const feedbackText = `<user_message>\n${text}\n</user_message>`
			pushToolResult(formatResponse.toolResult(feedbackText, images))
		} catch (error) {
			await handleError("inspecting site", error as Error)
		}
	}

	private shouldDelegateToParent(params: {
		childStatus: HistoryItem["status"] | undefined
		parentHistory: HistoryItem | undefined
		childTaskId: string
	}): boolean {
		const { childStatus, parentHistory, childTaskId } = params
		const parentAwaitingThisChild = parentHistory?.awaitingChildId === childTaskId
		const parentDelegatedToThisChild = parentHistory?.delegatedToId === childTaskId
		return childStatus === "active" || parentAwaitingThisChild || parentDelegatedToThisChild
	}

	/**
	 * Handles the common delegation flow when a subtask completes.
	 * Returns true if delegation was performed and the caller should return early.
	 */
	private async delegateToParent(
		task: Task,
		result: string,
		provider: DelegationProvider,
		askFinishSubTaskApproval: () => Promise<boolean>,
		pushToolResult: (result: string) => void,
	): Promise<boolean> {
		const didApprove = await askFinishSubTaskApproval()

		if (!didApprove) {
			pushToolResult(formatResponse.toolDenied())
			return true
		}

		pushToolResult("")
		await (task as any).markRpiCompletionAccepted?.()

		await provider.reopenParentFromDelegation({
			parentTaskId: task.parentTaskId!,
			childTaskId: task.taskId,
			completionResultSummary: result,
		})

		return true
	}

	override async handlePartial(task: Task, block: ToolUse<"attempt_completion">): Promise<void> {
		const result: string | undefined = block.params.result
		const command: string | undefined = block.params.command

		const lastMessage = task.clineMessages.at(-1)

		if (command) {
			if (lastMessage && lastMessage.ask === "command") {
				await task.ask("command", command ?? "", block.partial).catch(() => {})
			} else {
				await task.say("completion_result", result ?? "", undefined, false)

				// Force final token usage update before emitting TaskCompleted for consistency
				task.emitFinalTokenUsageUpdate()

				TelemetryService.instance.captureTaskCompleted(task.taskId)
				task.emit(RooCodeEventName.TaskCompleted, task.taskId, task.getTokenUsage(), task.toolUsage)

				await task.ask("command", command ?? "", block.partial).catch(() => {})
			}
		} else {
			await task.say("completion_result", result ?? "", undefined, block.partial)
		}
	}
}

export const attemptCompletionTool = new AttemptCompletionTool()
