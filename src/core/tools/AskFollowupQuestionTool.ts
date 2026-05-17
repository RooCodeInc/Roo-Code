import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import type { ToolUse } from "../../shared/tools"

import { BaseTool, ToolCallbacks } from "./BaseTool"

interface Suggestion {
	text: string
	mode?: string | null
}

interface AskFollowupQuestionParams {
	question: string
	follow_up: Suggestion[]
}

/**
 * Coerce a follow_up value from various formats into the expected Suggestion array.
 * Some models (e.g. smaller Qwen models) output follow_up as a string instead of an array.
 * This helper normalizes the value so the tool works regardless of the model's output format.
 *
 * Supported coercions:
 * - Already an array: returned as-is
 * - A JSON string that parses to an array: parsed and returned
 * - A plain string: wrapped as a single suggestion `[{ text: value }]`
 * - Anything else (null, undefined, number, etc.): returns undefined so callers can error
 */
export function coerceFollowUp(value: unknown): Suggestion[] | undefined {
	if (Array.isArray(value)) {
		return normalizeSuggestions(value)
	}

	if (typeof value === "string" && value.trim().length > 0) {
		// Try parsing as JSON first (model may have serialized the array as a string)
		try {
			const parsed = JSON.parse(value)
			if (Array.isArray(parsed)) {
				return normalizeSuggestions(parsed)
			}
		} catch {
			// Not valid JSON -- fall through to plain-string wrapping
		}

		// Wrap plain string as a single suggestion
		return [{ text: value, mode: null }]
	}

	return undefined
}

/**
 * Ensure every suggestion has an explicit `mode` field (defaulting to `null`).
 * The tool schema requires `mode` on each item (`required: ["text", "mode"]`),
 * and some model Jinja templates fail if a required field is absent.
 */
function normalizeSuggestions(items: Suggestion[]): Suggestion[] {
	return items.map((s) => ({
		text: s.text,
		mode: s.mode ?? null,
	}))
}

export class AskFollowupQuestionTool extends BaseTool<"ask_followup_question"> {
	readonly name = "ask_followup_question" as const

	async execute(params: AskFollowupQuestionParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { question } = params
		const follow_up = coerceFollowUp(params.follow_up)
		const { handleError, pushToolResult } = callbacks

		const recordMissingParamError = async (paramName: string): Promise<void> => {
			task.consecutiveMistakeCount++
			task.recordToolError("ask_followup_question")
			task.didToolFailInCurrentTurn = true
			pushToolResult(await task.sayAndCreateMissingParamError("ask_followup_question", paramName))
		}

		try {
			if (!question) {
				await recordMissingParamError("question")
				return
			}

			if (!follow_up || !Array.isArray(follow_up)) {
				await recordMissingParamError("follow_up")
				return
			}

			// Transform follow_up suggestions to the format expected by task.ask
			const follow_up_json = {
				question,
				suggest: follow_up.map((s) => ({ answer: s.text, mode: s.mode })),
			}

			task.consecutiveMistakeCount = 0
			const { text, images } = await task.ask("followup", JSON.stringify(follow_up_json), false)
			await task.say("user_feedback", text ?? "", images)
			pushToolResult(formatResponse.toolResult(`<user_message>\n${text}\n</user_message>`, images))
		} catch (error) {
			await handleError("asking question", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"ask_followup_question">): Promise<void> {
		const question: string | undefined = block.nativeArgs?.question ?? block.params.question

		// During partial streaming, only show the question to avoid displaying raw JSON
		// The full JSON with suggestions will be sent when the tool call is complete (!block.partial)
		await task.ask("followup", question ?? "", block.partial).catch(() => {})
	}
}

export const askFollowupQuestionTool = new AskFollowupQuestionTool()
