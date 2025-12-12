import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { parseXml } from "../../utils/xml"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"
import type { MultipleChoiceData, MultipleChoiceQuestion, MultipleChoiceOption } from "@roo-code/types"
import { t } from "../../i18n"

interface AskMultipleChoiceParams {
	title?: string
	questions: MultipleChoiceQuestion[]
}

interface ParsedOption {
	id: string
	label: string
}

interface ParsedQuestion {
	id: string
	prompt: string
	options: { option: ParsedOption | ParsedOption[] }
	allow_multiple?: string | boolean
}

export class AskMultipleChoiceTool extends BaseTool<"ask_multiple_choice"> {
	readonly name = "ask_multiple_choice" as const

	parseLegacy(params: Partial<Record<string, string>>): AskMultipleChoiceParams {
		const title = params.title
		const questionsXml = params.questions

		if (!questionsXml) {
			throw new Error("Missing required parameter: questions")
		}

		let parsedData: { question?: ParsedQuestion | ParsedQuestion[] }

		try {
			// Don't use stopNodes - we need full parsing to get all fields including IDs
			parsedData = parseXml(questionsXml, []) as { question?: ParsedQuestion | ParsedQuestion[] }
		} catch (error) {
			throw new Error(`Invalid questions XML format: ${error instanceof Error ? error.message : String(error)}`)
		}

		// Normalize to array
		const rawQuestions = Array.isArray(parsedData?.question)
			? parsedData.question
			: parsedData?.question
				? [parsedData.question]
				: []

		if (rawQuestions.length === 0) {
			throw new Error("At least one question is required")
		}

		// Transform parsed XML to MultipleChoiceQuestion format
		const questions: MultipleChoiceQuestion[] = []

		for (let i = 0; i < rawQuestions.length; i++) {
			const q = rawQuestions[i]
			const questionIndex = i + 1

			// Validate required fields: id and prompt
			if (!q.id) {
				throw new Error(
					`Question #${questionIndex} must have a valid id following this exact format: <question>\n<id>question_slug</id>\n<prompt>Question text</prompt></question>`,
				)
			}

			if (!q.prompt) {
				throw new Error(`Question "${q.id}" must have a prompt`)
			}

			// Normalize options to array
			const rawOptions = Array.isArray(q.options?.option)
				? q.options.option
				: q.options?.option
					? [q.options.option]
					: []

			if (rawOptions.length < 2) {
				throw new Error(`Question "${q.id}" must have at least 2 options`)
			}

			// Parse options - validate id and label
			const options: MultipleChoiceOption[] = []
			for (let j = 0; j < rawOptions.length; j++) {
				const opt = rawOptions[j]
				const optionIndex = j + 1

				if (!opt.id) {
					throw new Error(
						`Question "${q.id}", option #${optionIndex} must have a valid id following this exact format: <option>\n<id>option_slug_1</id>\n<label>Option 1 Label</label></option>`,
					)
				}

				if (!opt.label) {
					throw new Error(
						`Question "${q.id}", option "${opt.id}" must have a valid id following this exact format: <option>\n<id>option_slug_1</id>\n<label>Option 1 Label</label></option>`,
					)
				}

				options.push({
					id: opt.id,
					label: opt.label,
				})
			}

			questions.push({
				id: q.id,
				prompt: q.prompt,
				options,
				allow_multiple:
					typeof q.allow_multiple === "string" ? q.allow_multiple === "true" : q.allow_multiple || false,
			})
		}

		return { title, questions }
	}

	async execute(params: AskMultipleChoiceParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { title, questions } = params
		const { handleError, pushToolResult } = callbacks

		try {
			const multipleChoiceData: MultipleChoiceData = {
				title,
				questions,
			}

			task.consecutiveMistakeCount = 0
			const { text, images } = await task.ask("multiple_choice", JSON.stringify(multipleChoiceData), false)

			// Parse user response
			let userResponse: Record<string, string[]> | { __skipped: boolean } = {}
			try {
				userResponse = JSON.parse(text || "{}")
			} catch (error) {
				// If parsing fails, treat as empty response
				await task.say("error", `Failed to parse user response: ${(error as Error).message}`)
			}

			// Check if user skipped the questionnaire
			if ("__skipped" in userResponse && userResponse.__skipped) {
				await task.say("user_feedback", t("tools:multipleChoice.userSkippedMessage"), images)
				pushToolResult(
					formatResponse.toolResult("<answer>User chose to skip this questionnaire</answer>", images),
				)
				return
			}

			// Format response for LLM
			const responseLines: string[] = ["<answers>"]
			for (const question of questions) {
				const selectedOptions = (userResponse as Record<string, string[]>)[question.id] || []
				const selectedLabels = selectedOptions
					.map((optId) => {
						const option = question.options.find((o) => o.id === optId)
						return option ? option.label : optId
					})
					.join(", ")

				responseLines.push(
					`<answer><question_id>${question.id}</question_id><selected_options>${selectedLabels || "No selection"}</selected_options></answer>`,
				)
			}
			responseLines.push("</answers>")

			await task.say("user_feedback", text ?? "", images)
			pushToolResult(formatResponse.toolResult(responseLines.join("\n"), images))
		} catch (error) {
			await handleError("asking multiple choice question", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"ask_multiple_choice">): Promise<void> {
		// Get questions from params (for XML protocol)
		const questionsXml: string | undefined = block.params.questions

		// During partial streaming, show partial progress
		await task
			.ask("multiple_choice", this.removeClosingTag("questions", questionsXml, block.partial), block.partial)
			.catch(() => {})
	}
}

export const askMultipleChoiceTool = new AskMultipleChoiceTool()
