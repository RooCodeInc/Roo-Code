import {
	SUBAGENT_CANCELLED_MODEL_MESSAGE,
	SUBAGENT_FAILED_MODEL_MESSAGE,
	SUBAGENT_STATUS_STARTING,
	SUBAGENT_TOOL_NAMES,
	type RunSubagentInBackgroundParams,
	type SubagentCompletedPayload,
	type SubagentRunningPayload,
	type SubagentStructuredResult,
	isSubagentRunner,
} from "../../shared/subagent"
import type { ToolUse } from "../../shared/tools"
import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"

interface SubagentParams {
	description: string
	prompt: string
	subagent_type: "general" | "explore"
}

export class SubagentTool extends BaseTool<"subagent"> {
	readonly name = "subagent" as const

	parseLegacy(params: Partial<Record<string, string>>): SubagentParams {
		return {
			description: params.description ?? "",
			prompt: params.prompt ?? "",
			subagent_type: (params.subagent_type === "general" || params.subagent_type === "explore"
				? params.subagent_type
				: "general") as "general" | "explore",
		}
	}

	/**
	 * Starts a subagent and returns its Promise without awaiting. Used for parallel subagent batches.
	 * Caller must await the Promise then call finish() with the result.
	 */
	async startAndReturnPromise(
		task: Task,
		params: SubagentParams,
		callbacks: ToolCallbacks,
	): Promise<string | SubagentStructuredResult> {
		const { description, prompt, subagent_type } = params
		const toolCallId = callbacks.toolCallId ?? `subagent-${Date.now()}-${Math.random().toString(36).slice(2)}`

		const provider = task.providerRef.deref()
		if (!provider || !isSubagentRunner(provider)) {
			callbacks.pushToolResult(formatResponse.toolError("Provider reference lost"))
			return Promise.reject(new Error("Provider reference lost"))
		}

		if (!description?.trim()) {
			task.consecutiveMistakeCount++
			task.recordToolError("subagent")
			task.didToolFailInCurrentTurn = true
			task.sayAndCreateMissingParamError("subagent", "description").then((msg) => callbacks.pushToolResult(msg))
			return Promise.reject(new Error("Missing description"))
		}
		if (!prompt?.trim()) {
			task.consecutiveMistakeCount++
			task.recordToolError("subagent")
			task.didToolFailInCurrentTurn = true
			task.sayAndCreateMissingParamError("subagent", "prompt").then((msg) => callbacks.pushToolResult(msg))
			return Promise.reject(new Error("Missing prompt"))
		}

		task.consecutiveMistakeCount = 0

		const runningPayload: SubagentRunningPayload = {
			tool: SUBAGENT_TOOL_NAMES.running,
			description,
			currentTask: SUBAGENT_STATUS_STARTING,
			runId: toolCallId,
		}
		const runningText = JSON.stringify(runningPayload)
		const progressStatus = { icon: "sync", spin: true }

		await task.say("tool", runningText, undefined, undefined, undefined, progressStatus, {
			isNonInteractive: true,
		})

		const runParams: RunSubagentInBackgroundParams = {
			parentTaskId: task.taskId,
			prompt,
			subagentType: subagent_type,
			onProgress: (currentTask) => task.reportSubagentProgress(currentTask, toolCallId),
			toolCallId,
		}
		return provider.runSubagentInBackground(runParams)
	}

	/**
	 * Emits subagentCompleted and pushes the tool result. Call after startAndReturnPromise's Promise resolves.
	 */
	async finish(
		task: Task,
		params: SubagentParams,
		result: string | SubagentStructuredResult,
		callbacks: ToolCallbacks,
	): Promise<void> {
		const { description } = params
		const { pushToolResult } = callbacks
		const toolCallId = callbacks.toolCallId

		const isStructured = (r: string | SubagentStructuredResult): r is SubagentStructuredResult =>
			typeof r === "object" && r !== null && "code" in r && "messageKey" in r

		// Stop the spinner on the "Running subagent" row
		task.finalizeSubagentRunning(toolCallId)

		let completedPayload: SubagentCompletedPayload
		let toolResult: string
		if (isStructured(result)) {
			completedPayload = {
				tool: SUBAGENT_TOOL_NAMES.completed,
				description,
				result: SUBAGENT_CANCELLED_MODEL_MESSAGE,
				resultCode: result.code,
				messageKey: result.messageKey,
			}
			toolResult = SUBAGENT_CANCELLED_MODEL_MESSAGE
		} else {
			completedPayload = {
				tool: SUBAGENT_TOOL_NAMES.completed,
				description,
				result,
			}
			toolResult = result
		}
		const completedText = JSON.stringify(completedPayload)
		await task.say("tool", completedText, undefined, undefined, undefined, undefined, {
			isNonInteractive: true,
		})
		pushToolResult(formatResponse.toolResult(toolResult))
	}

	async execute(params: SubagentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult } = callbacks

		const provider = task.providerRef.deref()
		if (!provider || !isSubagentRunner(provider)) {
			pushToolResult(formatResponse.toolError("Provider reference lost"))
			return
		}

		if (!params.description?.trim()) {
			task.consecutiveMistakeCount++
			task.recordToolError("subagent")
			task.didToolFailInCurrentTurn = true
			pushToolResult(await task.sayAndCreateMissingParamError("subagent", "description"))
			return
		}
		if (!params.prompt?.trim()) {
			task.consecutiveMistakeCount++
			task.recordToolError("subagent")
			task.didToolFailInCurrentTurn = true
			pushToolResult(await task.sayAndCreateMissingParamError("subagent", "prompt"))
			return
		}

		try {
			const result = await this.startAndReturnPromise(task, params, callbacks)
			await this.finish(task, params, result, callbacks)
		} catch (error) {
			if (
				error instanceof Error &&
				(error.message === "Missing description" ||
					error.message === "Missing prompt" ||
					error.message === "Provider reference lost")
			) {
				return
			}
			console.error("Subagent failed:", error)
			task.finalizeSubagentRunning(callbacks.toolCallId)
			task.recordToolError("subagent")
			const errorPayload: SubagentCompletedPayload = {
				tool: SUBAGENT_TOOL_NAMES.completed,
				description: params.description,
				error: SUBAGENT_FAILED_MODEL_MESSAGE,
			}
			const errorPayloadStr = JSON.stringify(errorPayload)
			await task.say("tool", errorPayloadStr, undefined, undefined, undefined, undefined, {
				isNonInteractive: true,
			})
			pushToolResult(formatResponse.toolError(SUBAGENT_FAILED_MODEL_MESSAGE))
		}
	}
}

export const subagentTool = new SubagentTool()
