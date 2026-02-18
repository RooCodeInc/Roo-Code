import type { ToolParamName } from "../shared/tools"
import { TraceLogger } from "./TraceLogger"

export interface PostToolUseContext {
	taskId: string
	cwd: string
	toolName: string
	params: Partial<Record<ToolParamName, string>>
	status: "success" | "denied" | "error"
	reason?: string
	intentId?: string
	toolUseId?: string
}

export class PostToolUse {
	constructor(private readonly traceLogger = new TraceLogger()) {}

	async record(context: PostToolUseContext): Promise<void> {
		await this.traceLogger.append(context.cwd, {
			ts: new Date().toISOString(),
			task_id: context.taskId,
			intent_id: context.intentId,
			tool_use_id: context.toolUseId,
			tool_name: context.toolName,
			params: context.params,
			status: context.status,
			reason: context.reason,
		})
	}
}
