import Anthropic from "@anthropic-ai/sdk"
import * as vscode from "vscode"

import { RooCodeEventName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { Task } from "../task/Task"
import { JudgeResult } from "../judge"
import {
	ToolResponse,
	ToolUse,
	AskApproval,
	HandleError,
	PushToolResult,
	RemoveClosingTag,
	ToolDescription,
	AskFinishSubTaskApproval,
} from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { Package } from "../../shared/package"

export async function attemptCompletionTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
	toolDescription: ToolDescription,
	askFinishSubTaskApproval: AskFinishSubTaskApproval,
) {
	const result: string | undefined = block.params.result
	const command: string | undefined = block.params.command

	// Get the setting for preventing completion with open todos from VSCode configuration
	const preventCompletionWithOpenTodos = vscode.workspace
		.getConfiguration(Package.name)
		.get<boolean>("preventCompletionWithOpenTodos", false)

	// Check if there are incomplete todos (only if the setting is enabled)
	const hasIncompleteTodos = cline.todoList && cline.todoList.some((todo) => todo.status !== "completed")

	if (preventCompletionWithOpenTodos && hasIncompleteTodos) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("attempt_completion")

		pushToolResult(
			formatResponse.toolError(
				"Cannot complete task while there are incomplete todos. Please finish all todos before attempting completion.",
			),
		)

		return
	}

	try {
		const lastMessage = cline.clineMessages.at(-1)

		if (block.partial) {
			if (command) {
				// the attempt_completion text is done, now we're getting command
				// remove the previous partial attempt_completion ask, replace with say, post state to webview, then stream command

				// const secondLastMessage = cline.clineMessages.at(-2)
				if (lastMessage && lastMessage.ask === "command") {
					// update command
					await cline.ask("command", removeClosingTag("command", command), block.partial).catch(() => {})
				} else {
					// last message is completion_result
					// we have command string, which means we have the result as well, so finish it (doesnt have to exist yet)
					await cline.say("completion_result", removeClosingTag("result", result), undefined, false)

					TelemetryService.instance.captureTaskCompleted(cline.taskId)
					cline.emit(RooCodeEventName.TaskCompleted, cline.taskId, cline.getTokenUsage(), cline.toolUsage)

					await cline.ask("command", removeClosingTag("command", command), block.partial).catch(() => {})
				}
			} else {
				// No command, still outputting partial result
				await cline.say("completion_result", removeClosingTag("result", result), undefined, block.partial)
			}
			return
		} else {
			if (!result) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("attempt_completion")
				pushToolResult(await cline.sayAndCreateMissingParamError("attempt_completion", "result"))
				return
			}

			cline.consecutiveMistakeCount = 0

			// Judge mode check: Invoke judge if enabled
			const shouldInvokeJudge = await cline.shouldInvokeJudge()
			if (shouldInvokeJudge) {
				// Show "judging in progress" message before invoking judge
				await cline.say(
					"text",
					"🧑‍⚖️ 裁判正在分析任务完成情况，请稍后...",
					undefined,
					false,
					undefined,
					undefined,
					{
						isNonInteractive: false,
					},
				)

				const judgeResult = await cline.invokeJudge(result)

				if (!judgeResult.approved) {
					// Judge rejected the completion
					const shouldForceComplete = await cline.handleJudgeRejection(judgeResult)

					if (!shouldForceComplete) {
						// User chose to continue working, don't complete the task
						// Build detailed feedback for the AI to understand what needs to be fixed
						let errorMessage = "Task completion rejected by judge. Please address the following issues:\n\n"

						if (judgeResult.hasCriticalIssues && judgeResult.criticalIssues) {
							errorMessage += "🚨 **CRITICAL ISSUES (Must Fix)**:\n"
							judgeResult.criticalIssues.forEach((issue, i) => {
								errorMessage += `${i + 1}. ${issue}\n`
							})
							errorMessage += "\n"
						}

						if (judgeResult.missingItems && judgeResult.missingItems.length > 0) {
							errorMessage += "**Missing Items**:\n"
							judgeResult.missingItems.forEach((item, i) => {
								errorMessage += `${i + 1}. ${item}\n`
							})
							errorMessage += "\n"
						}

						if (judgeResult.suggestions && judgeResult.suggestions.length > 0) {
							errorMessage += "**Suggestions for Improvement**:\n"
							judgeResult.suggestions.forEach((suggestion, i) => {
								errorMessage += `${i + 1}. ${suggestion}\n`
							})
						}

						errorMessage += "\nJudge's Reasoning: " + judgeResult.reasoning

						// Push detailed error to AI
						pushToolResult(formatResponse.toolError(errorMessage))
						return
					}

					// User forced completion despite judge rejection
					const hasCriticalIssues = judgeResult.hasCriticalIssues
					let forceCompleteMessage = hasCriticalIssues
						? `## ⛔ Task Completion Override (With Critical Issues)\n\n`
						: `## ⚠️ Task Completion Override\n\n`

					forceCompleteMessage += `**Decision**: Task completion forced by user (judge rejected)\n\n`

					if (hasCriticalIssues && judgeResult.criticalIssues) {
						forceCompleteMessage += `**⚠️ Warning**: The following critical issues were detected but overridden:\n`
						judgeResult.criticalIssues.forEach((issue, i) => {
							forceCompleteMessage += `${i + 1}. ${issue}\n`
						})
						forceCompleteMessage += `\n`
					}

					forceCompleteMessage += `**Judge's Reasoning**: ${judgeResult.reasoning}\n\n`

					if (judgeResult.overallScore !== undefined) {
						forceCompleteMessage += `**Judge's Overall Score**: ${judgeResult.overallScore}/10\n\n`
					}

					// Display forced completion message
					await cline.say("text", forceCompleteMessage, undefined, false, undefined, undefined, {
						isNonInteractive: true,
					})
				} else {
					// Judge approved - show approval message
					let approvalMessage = `## ✅ Judge Approval\n\n`
					approvalMessage += `**Decision**: Task completion approved\n\n`
					approvalMessage += `**Reasoning**: ${judgeResult.reasoning}\n\n`

					if (judgeResult.overallScore !== undefined) {
						approvalMessage += `**Overall Score**: ${judgeResult.overallScore}/10\n\n`
					}

					if (judgeResult.suggestions && judgeResult.suggestions.length > 0) {
						approvalMessage += `**Optional Suggestions for Future Improvements**:\n`
						judgeResult.suggestions.forEach((suggestion: string, i: number) => {
							approvalMessage += `${i + 1}. ${suggestion}\n`
						})
						approvalMessage += `\n`
					}

					// Display judge approval message
					await cline.say("text", approvalMessage, undefined, false, undefined, undefined, {
						isNonInteractive: true,
					})
				}
			}

			// Command execution is permanently disabled in attempt_completion
			// Users must use execute_command tool separately before attempt_completion
			await cline.say("completion_result", result, undefined, false)
			TelemetryService.instance.captureTaskCompleted(cline.taskId)
			cline.emit(RooCodeEventName.TaskCompleted, cline.taskId, cline.getTokenUsage(), cline.toolUsage)

			if (cline.parentTask) {
				const didApprove = await askFinishSubTaskApproval()

				if (!didApprove) {
					return
				}

				// tell the provider to remove the current subtask and resume the previous task in the stack
				await cline.providerRef.deref()?.finishSubTask(result)
				return
			}

			// We already sent completion_result says, an
			// empty string asks relinquishes control over
			// button and field.
			const { response, text, images } = await cline.ask("completion_result", "", false)

			// Signals to recursive loop to stop (for now
			// cline never happens since yesButtonClicked
			// will trigger a new task).
			if (response === "yesButtonClicked") {
				pushToolResult("")
				return
			}

			await cline.say("user_feedback", text ?? "", images)
			const toolResults: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []

			toolResults.push({
				type: "text",
				text: `The user has provided feedback on the results. Consider their input to continue the task, and then attempt completion again.\n<feedback>\n${text}\n</feedback>`,
			})

			toolResults.push(...formatResponse.imageBlocks(images))
			cline.userMessageContent.push({ type: "text", text: `${toolDescription()} Result:` })
			cline.userMessageContent.push(...toolResults)

			return
		}
	} catch (error) {
		await handleError("inspecting site", error)
		return
	}
}
