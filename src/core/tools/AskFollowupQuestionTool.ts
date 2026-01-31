import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import type { ToolUse } from "../../shared/tools"

import { BaseTool, ToolCallbacks } from "./BaseTool"

interface Suggestion {
	text: string
	mode?: string
}

interface Question {
	text: string
	options?: string[]
}

interface AskFollowupQuestionParams {
	questions: Array<string | Question>
	follow_up: Suggestion[]
}

export class AskFollowupQuestionTool extends BaseTool<"ask_followup_question"> {
	readonly name = "ask_followup_question" as const

	async execute(params: AskFollowupQuestionParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { questions, follow_up } = params
		const { handleError, pushToolResult } = callbacks

		try {
			if (!questions || questions.length === 0) {
				task.consecutiveMistakeCount++
				task.recordToolError("ask_followup_question")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("ask_followup_question", "questions"))
				return
			}

			// Transform follow_up suggestions to the format expected by task.ask
			const followup_json = {
				questions,
				suggest: follow_up.map((s) => ({ answer: s.text, mode: s.mode })),
			}

			task.consecutiveMistakeCount = 0
			const { text, images } = await task.ask("followup", JSON.stringify(followup_json), false)
			await task.say("user_feedback", text ?? "", images)
			pushToolResult(formatResponse.toolResult(`<user_message>\n${text}\n</user_message>`, images))
		} catch (error) {
			await handleError("asking question", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"ask_followup_question">): Promise<void> {
		// Get question from params or nativeArgs
		const questions = block.nativeArgs?.questions ?? []
		const firstQuestion = questions[0]
		const multiQuestionText = typeof firstQuestion === "string" ? firstQuestion : firstQuestion?.text
		const singleQuestionText = (block.nativeArgs as any)?.question ?? block.params.question

		const questionText = multiQuestionText ?? singleQuestionText

		// During partial streaming, only show the question to avoid displaying raw JSON
		// The full JSON with suggestions will be sent when the tool call is complete
		await task.ask("followup", questionText ?? "", block.partial).catch(() => {})
	}
}

export const askFollowupQuestionTool = new AskFollowupQuestionTool()
