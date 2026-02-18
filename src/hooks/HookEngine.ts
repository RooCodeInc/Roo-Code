import type { ToolParamName } from "../shared/tools"
import { PostToolUse } from "./PostToolUse"
import { PreToolUse } from "./PreToolUse"

export interface HookToolContext {
	taskId: string
	cwd: string
	toolName: string
	params: Partial<Record<ToolParamName, string>>
	toolUseId?: string
}

export interface BeforeToolResult {
	allowed: boolean
	reason: string
	intentId?: string
}

export class HookEngine {
	private readonly selectedIntentByTask = new Map<string, string>()

	constructor(
		private readonly preToolUse = new PreToolUse(),
		private readonly postToolUse = new PostToolUse(),
	) {}

	async beforeToolUse(context: HookToolContext): Promise<BeforeToolResult> {
		if (context.toolName === "select_active_intent") {
			const intentId = context.params.intent_id?.trim()
			if (!intentId) {
				return { allowed: false, reason: "select_active_intent requires intent_id" }
			}
			this.selectedIntentByTask.set(context.taskId, intentId)
			return { allowed: true, reason: "active intent selected", intentId }
		}

		const selectedIntentId = this.selectedIntentByTask.get(context.taskId)
		const params = { ...context.params }
		if (!params.intent_id && selectedIntentId) {
			params.intent_id = selectedIntentId
		}

		return this.preToolUse.evaluate({
			taskId: context.taskId,
			cwd: context.cwd,
			toolName: context.toolName,
			params,
		})
	}

	async afterToolUse(
		context: HookToolContext,
		outcome: { status: "success" | "denied" | "error"; reason?: string; intentId?: string },
	): Promise<void> {
		await this.postToolUse.record({
			taskId: context.taskId,
			cwd: context.cwd,
			toolName: context.toolName,
			params: context.params,
			status: outcome.status,
			reason: outcome.reason,
			intentId: outcome.intentId,
			toolUseId: context.toolUseId,
		})
	}
}

export const hookEngine = new HookEngine()
