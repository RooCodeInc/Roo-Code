import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { parseXml } from "../../utils/xml"
import { NotificationType } from "@roo-code/types"
import { CloudService } from "@roo-code/cloud"

export async function askFollowupQuestionTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const question: string | undefined = block.params.question
	const follow_up: string | undefined = block.params.follow_up

	try {
		if (block.partial) {
			await cline.ask("followup", removeClosingTag("question", question), block.partial).catch(() => {})
			return
		} else {
			if (!question) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("ask_followup_question")
				pushToolResult(await cline.sayAndCreateMissingParamError("ask_followup_question", "question"))
				return
			}

			type Suggest = { answer: string; mode?: string }

			let follow_up_json = {
				question,
				suggest: [] as Suggest[],
			}

			if (follow_up) {
				// Define the actual structure returned by the XML parser
				type ParsedSuggestion = string | { "#text": string; "@_mode"?: string }

				let parsedSuggest: {
					suggest: ParsedSuggestion[] | ParsedSuggestion
				}

				try {
					parsedSuggest = parseXml(follow_up, ["suggest"]) as {
						suggest: ParsedSuggestion[] | ParsedSuggestion
					}
				} catch (error) {
					cline.consecutiveMistakeCount++
					cline.recordToolError("ask_followup_question")
					await cline.say("error", `Failed to parse operations: ${error.message}`)
					pushToolResult(formatResponse.toolError("Invalid operations xml format"))
					return
				}

				const rawSuggestions = Array.isArray(parsedSuggest?.suggest)
					? parsedSuggest.suggest
					: [parsedSuggest?.suggest].filter((sug): sug is ParsedSuggestion => sug !== undefined)

				// Transform parsed XML to our Suggest format
				const normalizedSuggest: Suggest[] = rawSuggestions.map((sug) => {
					if (typeof sug === "string") {
						// Simple string suggestion (no mode attribute)
						return { answer: sug }
					} else {
						// XML object with text content and optional mode attribute
						const result: Suggest = { answer: sug["#text"] }
						if (sug["@_mode"]) {
							result.mode = sug["@_mode"]
						}
						return result
					}
				})

				follow_up_json.suggest = normalizedSuggest
			}

			cline.consecutiveMistakeCount = 0

			// Trigger push notification if enabled
			try {
				if (CloudService.hasInstance() && CloudService.instance.isAuthenticated()) {
					const userInfo = CloudService.instance.getUserInfo()
					const taskMode = await cline.getTaskMode()

					// Send notification event
					await CloudService.instance
						.sendNotification({
							type: NotificationType.FollowUpQuestion,
							taskId: cline.taskId,
							userId: userInfo?.id,
							organizationId: userInfo?.organizationId,
							title: "Roo needs your input",
							message: question,
							timestamp: Date.now(),
							metadata: {
								question,
								mode: taskMode,
							},
						})
						.catch((error) => {
							// Log error but don't fail the tool
							console.error("Failed to send notification:", error)
						})
				}
			} catch (error) {
				// Don't fail the tool if notification fails
				console.error("Error checking notification settings:", error)
			}

			const { text, images } = await cline.ask("followup", JSON.stringify(follow_up_json), false)
			await cline.say("user_feedback", text ?? "", images)
			pushToolResult(formatResponse.toolResult(`<answer>\n${text}\n</answer>`, images))

			return
		}
	} catch (error) {
		await handleError("asking question", error)
		return
	}
}
