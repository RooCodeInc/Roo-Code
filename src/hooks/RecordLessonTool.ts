import { BaseTool, ToolCallbacks } from "../core/tools/BaseTool"
import type { ToolUse } from "../shared/tools"
import { Task } from "../core/task/Task"
import { OrchestrationDataModel } from "./OrchestrationDataModel"

interface RecordLessonParams {
	lesson: string
	context?: {
		tool?: string
		error?: string
		file?: string
	}
}

/**
 * Tool for recording lessons learned to AGENT.md (Phase 4 requirement)
 * This tool allows the agent to append lessons learned when verification steps fail
 * or when important insights are discovered during development.
 */
export class RecordLessonTool extends BaseTool<"record_lesson"> {
	readonly name = "record_lesson" as const

	async execute(params: RecordLessonParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, handleError } = callbacks

		if (!params.lesson || params.lesson.trim() === "") {
			task.consecutiveMistakeCount++
			task.recordToolError("record_lesson")
			pushToolResult("Error: lesson parameter is required and cannot be empty.")
			return
		}

		try {
			const dataModel = new OrchestrationDataModel(task.cwd)
			await dataModel.initialize()
			await dataModel.appendLesson(params.lesson.trim(), params.context)

			pushToolResult(`Lesson recorded successfully to .orchestration/AGENT.md`)
			task.consecutiveMistakeCount = 0
		} catch (error) {
			await handleError("recording lesson", error as Error)
		}
	}
}

export const recordLessonTool = new RecordLessonTool()
