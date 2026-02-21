import { Task } from "../core/task/Task"
import { formatResponse } from "../core/prompts/responses"
import { BaseTool, ToolCallbacks } from "../core/tools/BaseTool"
import type { ToolUse } from "../shared/tools"
import { OrchestrationDataModel } from "./OrchestrationDataModel"

interface SelectActiveIntentParams {
	intent_id: string
}

/**
 * Tool for selecting an active intent before code changes.
 * This enforces the Reasoning Loop: agents must select an intent before writing code.
 */
export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	async execute(params: SelectActiveIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { intent_id } = params
		const { pushToolResult, handleError } = callbacks

		try {
			if (!intent_id) {
				task.consecutiveMistakeCount++
				task.recordToolError("select_active_intent")
				pushToolResult(await task.sayAndCreateMissingParamError("select_active_intent", "intent_id"))
				return
			}

			// Initialize orchestration data model
			const dataModel = new OrchestrationDataModel(task.cwd)
			await dataModel.initialize()

			// Phase 2: Check if intent is in .intentignore (protected)
			const isIgnored = await dataModel.isIntentIgnored(intent_id)
			if (isIgnored) {
				task.consecutiveMistakeCount++
				task.recordToolError("select_active_intent")
				const errorJson = JSON.stringify(
					{
						error_type: "intent_protected",
						message: `Intent "${intent_id}" is protected and cannot be modified. This intent is listed in .orchestration/.intentignore.`,
						details: {
							intent_id: intent_id,
							reason: "intent_in_ignore_list",
							file: ".orchestration/.intentignore",
						},
						recoverable: false,
						suggested_action:
							"Select a different intent or ask user to remove this intent from .intentignore",
					},
					null,
					2,
				)
				pushToolResult(errorJson)
				return
			}

			// Load the intent from active_intents.yaml
			const intent = await dataModel.getIntent(intent_id)

			if (!intent) {
				task.consecutiveMistakeCount++
				task.recordToolError("select_active_intent")
				const intentsData = await dataModel.readActiveIntents()
				const errorJson = JSON.stringify(
					{
						error_type: "intent_not_found",
						message: `Intent "${intent_id}" not found in active_intents.yaml. Please use a valid intent ID.`,
						details: {
							requested_intent_id: intent_id,
							available_intent_ids: intentsData.active_intents.map((i) => i.id),
							available_intents_count: intentsData.active_intents.length,
						},
						recoverable: true,
						suggested_action: `Use one of the available intent IDs: ${intentsData.active_intents.map((i) => i.id).join(", ")}`,
					},
					null,
					2,
				)
				pushToolResult(errorJson)
				return
			}

			// Get recent trace entries for this intent (Phase 1 requirement: Context Loader)
			// This provides recent history to help the agent understand what has been done
			const traceEntries = await dataModel.getTraceEntriesForIntent(intent_id, 5)

			// Store active intent in task instance
			;(task as any).activeIntentId = intent_id
			;(task as any).activeIntent = intent

			// Build context XML block for injection into prompt (now includes trace entries)
			const contextXml = this.buildIntentContextXml(intent, traceEntries)

			// Reset mistake count on success
			task.consecutiveMistakeCount = 0

			// Return context as tool result (will be injected into next prompt)
			pushToolResult(contextXml)

			return
		} catch (error) {
			await handleError("selecting active intent", error as Error)
			return
		}
	}

	/**
	 * Build XML block containing intent context for prompt injection
	 * Now includes recent trace entries for context (Phase 1: Context Loader)
	 */
	private buildIntentContextXml(intent: any, traceEntries: any[] = []): string {
		const scopeList = intent.owned_scope.map((s: string) => `  - ${s}`).join("\n")
		const constraintsList = intent.constraints.map((c: string) => `  - ${c}`).join("\n")
		const criteriaList = intent.acceptance_criteria.map((c: string) => `  - ${c}`).join("\n")

		// Build recent history section from trace entries
		let recentHistorySection = ""
		if (traceEntries.length > 0) {
			const historyItems = traceEntries.map((entry) => {
				const files = entry.files
					.map((f: any) => {
						const ranges = f.conversations[0]?.ranges?.[0]
						if (ranges) {
							return `    - ${f.relative_path} (lines ${ranges.start_line}-${ranges.end_line})`
						}
						return `    - ${f.relative_path}`
					})
					.join("\n")
				const timestamp = new Date(entry.timestamp).toISOString().split("T")[0]
				return `  - ${timestamp}: Modified files:\n${files}`
			})
			recentHistorySection = `<recent_history>
${historyItems.join("\n")}
</recent_history>`
		} else {
			recentHistorySection = `<recent_history>
  No recent changes found for this intent.
</recent_history>`
		}

		return `<intent_context>
<intent_id>${intent.id}</intent_id>
<intent_name>${intent.name}</intent_name>
<status>${intent.status}</status>
<owned_scope>
${scopeList}
</owned_scope>
<constraints>
${constraintsList}
</constraints>
<acceptance_criteria>
${criteriaList}
</acceptance_criteria>
${recentHistorySection}
</intent_context>`
	}

	override async handlePartial(task: Task, block: ToolUse<"select_active_intent">): Promise<void> {
		// No partial handling needed for intent selection
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
