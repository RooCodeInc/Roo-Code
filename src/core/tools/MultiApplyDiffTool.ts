import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult } from "../../shared/tools"
import { applyDiffTool as applyDiffToolClass } from "./ApplyDiffTool"

export async function applyDiffTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
) {
	return applyDiffToolClass.handle(cline, block as ToolUse<"apply_diff">, {
		askApproval,
		handleError,
		pushToolResult,
	})
}
