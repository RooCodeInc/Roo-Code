import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { parseXml } from "../../utils/xml"
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

	parseLegacy(params: Partial<Record<string, string>>): AskFollowupQuestionParams {
		const question = params.question || ""
		const questions_xml = params.questions
		const follow_up_xml = params.follow_up

		const suggestions: Suggestion[] = []
		const questions: Array<string | Question> = []

		if (questions_xml) {
			try {
				// Handle both simple <question> tags and more complex <question> tags with options
				const parsedQuestions = parseXml(questions_xml, ["question"]) as {
					question: any[] | any
				}

				const rawQuestions = Array.isArray(parsedQuestions?.question)
					? parsedQuestions.question
					: [parsedQuestions?.question].filter((q): q is any => q !== undefined)

				for (const q of rawQuestions) {
					if (typeof q === "string") {
						questions.push(q)
					} else if (typeof q === "object" && q !== null) {
						const text = q["#text"] || ""
						const optionsStr = q["@_options"]
						if (optionsStr) {
							questions.push({
								text,
								options: optionsStr.split(",").map((o: string) => o.trim()),
							})
						} else {
							questions.push(text)
						}
					}
				}
			} catch (error) {
				throw new Error(
					`Failed to parse questions XML: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		// If no questions array but we have a single question, use that
		if (questions.length === 0 && question) {
			questions.push(question)
		}

		if (follow_up_xml) {
			type ParsedSuggestion = string | { "#text": string; "@_mode"?: string }

			try {
				const parsedSuggest = parseXml(follow_up_xml, ["suggest"]) as {
					suggest: ParsedSuggestion[] | ParsedSuggestion
				}

				const rawSuggestions = Array.isArray(parsedSuggest?.suggest)
					? parsedSuggest.suggest
					: [parsedSuggest?.suggest].filter((sug): sug is ParsedSuggestion => sug !== undefined)

				for (const sug of rawSuggestions) {
					if (typeof sug === "string") {
						suggestions.push({ text: sug })
					} else {
						const suggestion: Suggestion = { text: sug["#text"] }
						if (sug["@_mode"]) {
							suggestion.mode = sug["@_mode"]
						}
						suggestions.push(suggestion)
					}
				}
			} catch (error) {
				throw new Error(
					`Failed to parse follow_up XML: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		return {
			questions,
			follow_up: suggestions,
		}
	}

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
			pushToolResult(formatResponse.toolResult(`<answer>\n${text}\n</answer>`, images))
		} catch (error) {
			await handleError("asking question", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"ask_followup_question">): Promise<void> {
		// Get first question from questions array for streaming display
		const questions = block.nativeArgs?.questions ?? []
		const firstQuestion = questions[0]
		const questionText = typeof firstQuestion === "string" ? firstQuestion : firstQuestion?.text

		// During partial streaming, only show the first question to avoid displaying raw JSON
		// The full JSON with all questions and suggestions will be sent when the tool call is complete
		await task
			.ask("followup", this.removeClosingTag("question", questionText, block.partial), block.partial)
			.catch(() => {})
	}
}

export const askFollowupQuestionTool = new AskFollowupQuestionTool()
