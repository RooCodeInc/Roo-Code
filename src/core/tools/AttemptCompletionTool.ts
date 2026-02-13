import * as vscode from "vscode"
import * as path from "path"

import { RooCodeEventName, type HistoryItem } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { Package } from "../../shared/package"
import type { ToolUse } from "../../shared/tools"
import { t } from "../../i18n"
import { diagnosticsToProblemsString } from "../../integrations/diagnostics"

import { BaseTool, ToolCallbacks } from "./BaseTool"
import { ContextDistiller } from "../rpi/ContextDistiller"

const MAX_DISTILLED_RESULT_CHARS = 4000

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
			const eslintBlocker = await this.getEslintCompletionBlocker(task)
			if (eslintBlocker) {
				task.consecutiveMistakeCount++
				task.recordToolError("attempt_completion")
				pushToolResult(formatResponse.toolError(eslintBlocker))
				return
			}

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

		// Apply completion result distillation
		let distilledResult = result
		try {
			const rpiAutopilot = (task as any).rpiAutopilot
			if (rpiAutopilot) {
				const distiller = new ContextDistiller()
				distilledResult = distiller.distillCompletionResult({
					childResult: result,
					childObservations: rpiAutopilot.currentObservations ?? [],
					maxResultChars: MAX_DISTILLED_RESULT_CHARS,
				})
			}
		} catch {
			// Distillation is best-effort
		}

		await provider.reopenParentFromDelegation({
			parentTaskId: task.parentTaskId!,
			childTaskId: task.taskId,
			completionResultSummary: distilledResult,
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

	private async getEslintCompletionBlocker(task: Task): Promise<string | undefined> {
		const provider = task.providerRef?.deref()
		const preventCompletionWithEslintProblems =
			provider?.contextProxy.getValue("preventCompletionWithEslintProblems") ?? true

		if (!preventCompletionWithEslintProblems) {
			return undefined
		}

		const eslintDiagnostics = await this.getEslintDiagnosticsForTask(task)
		if (eslintDiagnostics.length === 0) {
			return undefined
		}

		const cwd = this.getTaskCwd(task)
		const includeDiagnosticMessages = provider?.contextProxy.getValue("includeDiagnosticMessages") ?? true
		const maxDiagnosticMessages = provider?.contextProxy.getValue("maxDiagnosticMessages")

		const problems = await diagnosticsToProblemsString(
			eslintDiagnostics,
			[vscode.DiagnosticSeverity.Error, vscode.DiagnosticSeverity.Warning],
			cwd,
			includeDiagnosticMessages,
			maxDiagnosticMessages,
		)

		const detailSection = problems ? `\n\n${problems}` : ""
		return `Cannot complete task while ESLint diagnostics remain in files edited by Roo. Fix them before completing.${detailSection}`
	}

	private async getEslintDiagnosticsForTask(task: Task): Promise<[vscode.Uri, vscode.Diagnostic[]][]> {
		const editedFiles = await this.getRooEditedFileKeys(task)
		if (editedFiles.size === 0) {
			return []
		}

		const allDiagnostics = vscode.languages.getDiagnostics()
		if (allDiagnostics.length === 0) {
			return []
		}

		const eslintDiagnostics = allDiagnostics
			.map(
				([uri, diagnostics]) =>
					[uri, diagnostics.filter((diagnostic) => this.isEslintDiagnostic(diagnostic))] as [
						vscode.Uri,
						vscode.Diagnostic[],
					],
			)
			.filter(([, diagnostics]) => diagnostics.length > 0)

		if (eslintDiagnostics.length === 0) {
			return []
		}

		return eslintDiagnostics.filter(([uri]) => {
			const relativeKey = this.getRelativePathKey(task, uri.fsPath)
			return editedFiles.has(relativeKey)
		})
	}

	private isEslintDiagnostic(diagnostic: vscode.Diagnostic): boolean {
		if (!(diagnostic.source ?? "").toLowerCase().includes("eslint")) {
			return false
		}
		return (
			diagnostic.severity === vscode.DiagnosticSeverity.Error ||
			diagnostic.severity === vscode.DiagnosticSeverity.Warning
		)
	}

	private async getRooEditedFileKeys(task: Task): Promise<Set<string>> {
		try {
			const metadata = await task.fileContextTracker?.getTaskMetadata(task.taskId)
			const entries = metadata?.files_in_context ?? []
			return new Set(
				entries
					.filter((entry) => entry.record_source === "roo_edited")
					.map((entry) => this.normalizePathKey(entry.path)),
			)
		} catch (error) {
			console.error(
				`[AttemptCompletionTool] Failed to read task metadata for ESLint check: ${
					(error as Error)?.message ?? String(error)
				}`,
			)
			return new Set()
		}
	}

	private getRelativePathKey(task: Task, fsPath: string): string {
		const cwd = this.getTaskCwd(task)
		const relative = path.isAbsolute(fsPath) ? path.relative(cwd, fsPath) : fsPath
		return this.normalizePathKey(relative)
	}

	private normalizePathKey(filePath: string): string {
		const normalized = filePath.replace(/\\/g, "/")
		return process.platform === "win32" ? normalized.toLowerCase() : normalized
	}

	private getTaskCwd(task: Task): string {
		return task.cwd ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd()
	}
}

export const attemptCompletionTool = new AttemptCompletionTool()
