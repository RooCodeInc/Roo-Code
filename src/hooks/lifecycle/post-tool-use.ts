import { IHook, ToolCall, HookResult, ToolHookContext } from "../types"
import { TraceSerializer } from "../trace/serializer"

export class PostToolUseHook implements IHook {
	name = "PostToolUseHook"

	async execute(toolCall: ToolCall, context?: ToolHookContext, result?: unknown): Promise<HookResult> {
		if (!context) {
			return { blocked: false }
		}

		const mutableTools = ["write_file", "edit", "edit_file", "search_replace", "apply_patch"]
		if (mutableTools.includes(toolCall.name)) {
			try {
				await TraceSerializer.appendTrace(toolCall, result, context)
			} catch (error) {
				console.error("Failed to append trace:", error)
			}
		}

		return { blocked: false }
	}
}
