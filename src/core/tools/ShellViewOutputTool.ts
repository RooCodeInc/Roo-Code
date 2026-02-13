import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"

interface ShellViewOutputParams {
	artifact_id: string
	offset?: number
	limit?: number
}

const DEFAULT_LIMIT = 200

export class ShellViewOutputTool extends BaseTool<"shell_view_output"> {
	readonly name = "shell_view_output" as const

	async execute(params: ShellViewOutputParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks
		const { artifact_id, offset = 0, limit = DEFAULT_LIMIT } = params

		try {
			if (!artifact_id) {
				task.consecutiveMistakeCount++
				task.recordToolError("shell_view_output")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("shell_view_output", "artifact_id"))
				return
			}

			task.consecutiveMistakeCount = 0

			const toolMessage = JSON.stringify({
				tool: "shellViewOutput",
				artifact_id,
				offset,
				limit,
			})

			const didApprove = await askApproval("tool", toolMessage)
			if (!didApprove) {
				return
			}

			// Get output from the current terminal process
			const process = task.terminalProcess
			if (!process) {
				pushToolResult(
					formatResponse.toolError(`No active process found. The process may have already completed.`),
				)
				return
			}

			// Get unretrieved output from the process
			const outputBuffer = process.getUnretrievedOutput()
			if (!outputBuffer) {
				pushToolResult("No new output available from the process.")
				return
			}

			const lines = outputBuffer.split("\n")
			const sliced = lines.slice(offset, Math.min(offset + limit, lines.length))
			const output = sliced.join("\n")

			const totalLines = lines.length
			const hasMore = offset + limit < totalLines

			this._rpiObservationExtras = {
				summary: `Viewed process output: ${sliced.length} lines (offset=${offset})`,
			}

			const header = `Process output (lines ${offset + 1}-${offset + sliced.length} of ${totalLines}):`
			const footer = hasMore
				? `\n[${totalLines - offset - limit} more lines available. Use offset=${offset + limit} to see more.]`
				: ""

			pushToolResult(`${header}\n${output}${footer}`)
		} catch (error) {
			await handleError("viewing process output", error as Error)
		}
	}
}

export const shellViewOutputTool = new ShellViewOutputTool()
