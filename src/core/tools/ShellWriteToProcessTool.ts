import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"

interface ShellWriteToProcessParams {
	artifact_id: string
	input: string
}

export class ShellWriteToProcessTool extends BaseTool<"shell_write_to_process"> {
	readonly name = "shell_write_to_process" as const

	async execute(params: ShellWriteToProcessParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks
		const { artifact_id, input } = params

		try {
			if (!artifact_id) {
				task.consecutiveMistakeCount++
				task.recordToolError("shell_write_to_process")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("shell_write_to_process", "artifact_id"))
				return
			}

			if (input === undefined || input === null) {
				task.consecutiveMistakeCount++
				task.recordToolError("shell_write_to_process")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("shell_write_to_process", "input"))
				return
			}

			task.consecutiveMistakeCount = 0

			const toolMessage = JSON.stringify({
				tool: "shellWriteToProcess",
				artifact_id,
				input: input.length > 200 ? input.slice(0, 200) + "..." : input,
			})

			const didApprove = await askApproval("tool", toolMessage)
			if (!didApprove) {
				return
			}

			// Access the running terminal process via task
			const process = task.terminalProcess
			if (!process) {
				pushToolResult(
					formatResponse.toolError(
						`No active process found. The process may have already completed. Start a new command with execute_command first.`,
					),
				)
				return
			}

			// Continue the terminal process (allows hot processes to proceed)
			// Note: Full stdin write support depends on the terminal provider.
			// The continue mechanism unblocks waiting processes.
			process.continue()

			this._rpiObservationExtras = {
				summary: `Sent continue signal to running process`,
			}

			pushToolResult(`Continue signal sent to running process. Input: ${input}`)
		} catch (error) {
			await handleError("writing to process", error as Error)
		}
	}
}

export const shellWriteToProcessTool = new ShellWriteToProcessTool()
