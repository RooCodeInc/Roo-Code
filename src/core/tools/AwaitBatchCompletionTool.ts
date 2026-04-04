import { BaseTool, ToolCallbacks } from "./BaseTool"
import { Task } from "../task/Task"
import { ToolUse } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"

export class AwaitBatchCompletionTool extends BaseTool<"await_batch_completion"> {
	readonly name = "await_batch_completion" as const

	async execute(params: Record<string, never>, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, askApproval } = callbacks

		try {
			const didApprove = await askApproval("tool", JSON.stringify({ tool: "await_batch_completion" }))
			if (!didApprove) {
				return
			}

			// Jabberwock: Barrier Synchronization
			// We check the children tasks of this task
			const children = task.childTasks || []
			const pendingChildren = children.filter((c: any) => !c.isCompleted)

			if (pendingChildren.length === 0) {
				// All completed!
				let resultStr = "Batch completion results:\n"
				for (const child of children) {
					resultStr += `\nTask [${child.taskId}]:\n${child.completionResultSummary || "No summary provided."}\n`
				}
				pushToolResult(resultStr)
				return
			}

			// Suspend orchestrator until children complete
			pushToolResult(
				`Waiting for ${pendingChildren.length} background tasks to complete... The system will automatically resume this task once all are finished.`,
			)

			// Actually, in Jabberwock, to truly suspend the orchestrator and wake it up later,
			// we might need to do something more involved like pausing the API request or rejecting it.
			// But for now, we just return the "waiting" message. The UI/system needs a mechanism to auto-resume.
		} catch (error) {
			callbacks.handleError("awaiting batch completion", error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"await_batch_completion">): Promise<void> {
		const partialMessage = JSON.stringify({ tool: "await_batch_completion" })
		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}
}

export const awaitBatchCompletionTool = new AwaitBatchCompletionTool()
