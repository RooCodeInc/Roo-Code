import fs from "fs/promises"
import path from "path"
import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"

interface RecordLessonParams {
	lesson: string
}

export class RecordLessonTool extends BaseTool<"record_lesson_learned"> {
	readonly name = "record_lesson_learned" as const

	async execute(params: RecordLessonParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, handleError } = callbacks
		const { lesson } = params

		try {
			const agentsPath = path.join(task.cwd, "AGENTS.md")

			// Format the lesson entry
			const timestamp = new Date().toISOString()
			const lessonEntry = `\n\n### Lessons Learned (${timestamp})\n- ${lesson}\n`

			// Append to AGENTS.md (create if not exists)
			await fs.appendFile(agentsPath, lessonEntry, "utf8")

			pushToolResult(`Successfully recorded lesson to AGENTS.md`)
		} catch (error) {
			await handleError("recording lesson", error as Error)
		}
	}
}

export const recordLessonTool = new RecordLessonTool()
