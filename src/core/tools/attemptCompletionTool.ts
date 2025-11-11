import Anthropic from "@anthropic-ai/sdk"
import * as vscode from "vscode"

import { RooCodeEventName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { Package } from "../../shared/package"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"

interface AttemptCompletionParams {
	result: string
	command?: string
}

export interface AttemptCompletionCallbacks extends ToolCallbacks {
	askFinishSubTaskApproval: () => Promise<boolean>
	toolDescription: () => string
}

export class AttemptCompletionTool extends BaseTool<"attempt_completion"> {
	readonly name = "attempt_completion" as const

	parseLegacy(params: Partial<Record<string, string>>): AttemptCompletionParams {
		return {
			result: params.result || "",
			command: params.command,
		}
	}

	async execute(params: AttemptCompletionParams, cline: Task, callbacks: AttemptCompletionCallbacks): Promise<void> {
		const { result } = params
		const { handleError, pushToolResult, askFinishSubTaskApproval, toolDescription } = callbacks

		const preventCompletionWithOpenTodos = vscode.workspace
			.getConfiguration(Package.name)
			.get<boolean>("preventCompletionWithOpenTodos", false)

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
			if (!result) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("attempt_completion")
				pushToolResult(await cline.sayAndCreateMissingParamError("attempt_completion", "result"))
				return
			}

			cline.consecutiveMistakeCount = 0

			await cline.say("completion_result", result, undefined, false)
			TelemetryService.instance.captureTaskCompleted(cline.taskId)
			cline.emit(RooCodeEventName.TaskCompleted, cline.taskId, cline.getTokenUsage(), cline.toolUsage)

			if (cline.parentTask) {
				const didApprove = await askFinishSubTaskApproval()

				if (!didApprove) {
					return
				}

				await cline.providerRef.deref()?.finishSubTask(result)
				return
			}

			const { response, text, images } = await cline.ask("completion_result", "", false)

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
		} catch (error) {
			await handleError("inspecting site", error as Error)
		}
	}

	override async handlePartial(cline: Task, block: ToolUse<"attempt_completion">): Promise<void> {
		const result: string | undefined = block.params.result
		const command: string | undefined = block.params.command

		const lastMessage = cline.clineMessages.at(-1)

		if (command) {
			if (lastMessage && lastMessage.ask === "command") {
				await cline
					.ask("command", this.removeClosingTag("command", command, block.partial), block.partial)
					.catch(() => {})
			} else {
				await cline.say(
					"completion_result",
					this.removeClosingTag("result", result, block.partial),
					undefined,
					false,
				)

				TelemetryService.instance.captureTaskCompleted(cline.taskId)
				cline.emit(RooCodeEventName.TaskCompleted, cline.taskId, cline.getTokenUsage(), cline.toolUsage)

				await cline
					.ask("command", this.removeClosingTag("command", command, block.partial), block.partial)
					.catch(() => {})
			}
		} else {
			await cline.say(
				"completion_result",
				this.removeClosingTag("result", result, block.partial),
				undefined,
				block.partial,
			)
		}
	}

	private removeClosingTag(tag: string, text: string | undefined, isPartial: boolean): string {
		if (!isPartial) {
			return text || ""
		}

		if (!text) {
			return ""
		}

		const tagRegex = new RegExp(
			`\\s?<\/?${tag
				.split("")
				.map((char) => `(?:${char})?`)
				.join("")}$`,
			"g",
		)

		return text.replace(tagRegex, "")
	}
}

export const attemptCompletionTool = new AttemptCompletionTool()
