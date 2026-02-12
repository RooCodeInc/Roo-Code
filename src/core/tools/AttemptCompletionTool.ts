import * as vscode from "vscode"

import { RooCodeEventName, type HistoryItem } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import type { DelegationMeta } from "../task-persistence/delegationMeta"
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
	updateTaskHistory(item: HistoryItem, options?: { broadcast?: boolean }): Promise<HistoryItem[]>
	persistDelegationMeta(taskId: string, meta: DelegationMeta): Promise<void>
	readDelegationMeta(taskId: string): Promise<DelegationMeta | null>
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
				// Check if this subtask has already completed and returned to parent
				// to prevent duplicate tool_results when user revisits from history
				const provider = task.providerRef.deref() as DelegationProvider | undefined
				if (provider) {
					try {
						const { historyItem } = await provider.getTaskWithId(task.taskId)
						const status = historyItem?.status

						if (status === "completed") {
							// Subtask already completed - skip delegation flow entirely
							// Fall through to normal completion ask flow below (outside this if block)
							// This shows the user the completion result and waits for acceptance
							// without injecting another tool_result to the parent
						} else if (status === "active") {
							// Normal subtask completion - do delegation
							const delegated = await this.delegateToParent(
								task,
								result,
								provider,
								askFinishSubTaskApproval,
								pushToolResult,
							)
							if (delegated) return
						} else {
							// Unexpected status (undefined or "delegated") - log error and skip delegation
							// undefined indicates a bug in status persistence during child creation
							// "delegated" would mean this child has its own grandchild pending (shouldn't reach attempt_completion)
							console.error(
								`[AttemptCompletionTool] Unexpected child task status "${status}" for task ${task.taskId}. ` +
									`Expected "active" or "completed". Skipping delegation to prevent data corruption.`,
							)
							// Fall through to normal completion ask flow
						}
					} catch (err) {
						console.error(
							`[AttemptCompletionTool] Delegation failed for task ${task.taskId}: ${err instanceof Error ? err.message : String(err)}. Falling through to standalone completion.`,
						)
						// Fall through to normal completion ask flow
					}
				}
			}

			const { response, text, images } = await task.ask("completion_result", "", false)

			if (response === "yesButtonClicked") {
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

		const parentTaskId = task.parentTaskId!
		const childTaskId = task.taskId

		const attemptDelegation = async (): Promise<void> => {
			await provider.reopenParentFromDelegation({
				parentTaskId,
				childTaskId,
				completionResultSummary: result,
			})
		}

		try {
			await attemptDelegation()
			pushToolResult("")
			return true
		} catch (error) {
			// Delegation failed — repair parent status so it doesn't stay "delegated"
			console.error(
				`[AttemptCompletionTool] Delegation failed for task ${childTaskId}: ${
					error instanceof Error ? error.message : String(error)
				}. Repairing parent and falling through to standalone completion.`,
			)

			try {
				const { historyItem: parentHistory } = await provider.getTaskWithId(parentTaskId)
				const childIds = Array.from(new Set([...(parentHistory.childIds ?? []), childTaskId]))
				await provider.updateTaskHistory({
					...parentHistory,
					status: "active",
					awaitingChildId: undefined,
					childIds,
				})
				await provider.persistDelegationMeta(parentTaskId, {
					status: "active",
					awaitingChildId: null,
					delegatedToId: parentHistory.delegatedToId,
					childIds,
					completedByChildId: parentHistory.completedByChildId ?? null,
					completionResultSummary: parentHistory.completionResultSummary ?? null,
				})
			} catch (repairError) {
				// Disk-only fallback when parent is missing from globalState.
				// Uses read-merge-write to preserve fields like completedByChildId
				// and completionResultSummary that may exist from prior delegations.
				if (repairError instanceof Error && repairError.message === "Task not found") {
					try {
						const existingMeta = await provider.readDelegationMeta(parentTaskId)
						await provider.persistDelegationMeta(parentTaskId, {
							status: "active",
							awaitingChildId: null,
							delegatedToId: existingMeta?.delegatedToId ?? null,
							childIds: existingMeta?.childIds
								? Array.from(new Set([...existingMeta.childIds, childTaskId]))
								: [childTaskId],
							completedByChildId: existingMeta?.completedByChildId ?? null,
							completionResultSummary: existingMeta?.completionResultSummary ?? null,
						})
						console.warn(
							`[AttemptCompletionTool] Repaired parent ${parentTaskId} via disk fallback (not in globalState)`,
						)
					} catch (diskErr) {
						console.error(
							`[AttemptCompletionTool] Disk fallback repair also failed for ${parentTaskId}: ${
								diskErr instanceof Error ? diskErr.message : String(diskErr)
							}`,
						)
					}
				} else {
					console.error(
						`[AttemptCompletionTool] Failed to repair parent ${parentTaskId} after delegation failure: ${
							repairError instanceof Error ? repairError.message : String(repairError)
						}`,
					)
				}
			}

			pushToolResult(
				formatResponse.toolError(
					`Delegation to parent task failed: ${error instanceof Error ? error.message : String(error)}. Completing as standalone task.`,
				),
			)
			return true
		}
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
