import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import { Intent } from "../intents/types"
import { formatResponse } from "../prompts/responses"

interface SelectActiveIntentParams {
	intent_id: string
}

export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	async execute(params: SelectActiveIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { intent_id } = params
		const { handleError, pushToolResult } = callbacks

		try {
			if (!intent_id) {
				task.consecutiveMistakeCount++
				task.recordToolError("select_active_intent")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("select_active_intent", "intent_id"))
				return
			}

			const provider = task.providerRef.deref()
			if (!provider) {
				return
			}

			const intentLoader = provider.getIntentLoader()
			await intentLoader.ensureLoaded()

			const intent = intentLoader.getIntent(intent_id)
			if (!intent) {
				task.setSelectedIntent(intent_id)
				pushToolResult(formatResponse.invalidIntentId(intent_id))
				return
			}

			pushToolResult(this.formatIntentContextXml(intent))
		} catch (error) {
			handleError("selecting intents", error)
		}
	}
	/**
	 * Formats the selected intent as an <intent_context> XML block for prompt injection.
	 * Keep this deterministic and safe (escape XML).
	 */
	private formatIntentContextXml(intent: Intent): string {
		const escapeXml = (text: string): string =>
			String(text)
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#39;")

		const ownedScopes = intent.owned_scopes ?? []

		const renderList = (containerTag: string, itemTag: string, items: string[]): string => {
			const inner = (items ?? []).map((x) => `    <${itemTag}>${escapeXml(x)}</${itemTag}>`).join("\n")

			return items && items.length
				? `<${containerTag}>\n${inner}\n  </${containerTag}>`
				: `<${containerTag}></${containerTag}>`
		}

		return [
			`<intent_context>`,
			`  <id>${escapeXml(intent.id)}</id>`,
			`  <name>${escapeXml(intent.name)}</name>`,
			`  <status>${escapeXml(intent.status as unknown as string)}</status>`,
			`  ${renderList("owned_scope", "path", ownedScopes)}`,
			`  ${renderList("constraints", "constraint", intent.constraints ?? [])}`,
			`  ${renderList("acceptance_criteria", "criteria", intent.acceptance_criteria ?? [])}`,
			`</intent_context>`,
		].join("\n")
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
