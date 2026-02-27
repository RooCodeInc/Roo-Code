import path from "path"
import fs from "fs/promises"

import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { getReadablePath } from "../../utils/path"
import type { ToolUse } from "../../shared/tools"

import { BaseTool, ToolCallbacks } from "./BaseTool"

const DEFAULT_LESSONS_FILE = "CLAUDE.md"
const LESSONS_HEADER = "## Lessons Learned"

interface AppendLessonLearnedParams {
	lesson: string
	file_path?: string
}

/**
 * Appends a "Lesson Learned" entry to CLAUDE.md (or file_path).
 * Used when a verification step (linter/test) fails so the agent can record what went wrong.
 */
export class AppendLessonLearnedTool extends BaseTool<"append_lesson_learned"> {
	readonly name = "append_lesson_learned" as const

	async execute(params: AppendLessonLearnedParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, handleError } = callbacks
		const relPath = params.file_path ?? DEFAULT_LESSONS_FILE
		const lesson = params.lesson?.trim()

		if (!lesson) {
			task.consecutiveMistakeCount++
			task.recordToolError("append_lesson_learned")
			pushToolResult(await task.sayAndCreateMissingParamError("append_lesson_learned", "lesson"))
			return
		}

		const absolutePath = path.resolve(task.cwd, relPath)

		try {
			let content: string
			try {
				content = await fs.readFile(absolutePath, "utf-8")
			} catch (err: unknown) {
				if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
					content = ""
				} else {
					throw err
				}
			}

			const timestamp = new Date().toISOString().slice(0, 10)
			const entry = `\n- **${timestamp}**: ${lesson.replace(/\n/g, " ")}\n`

			if (!content.includes(LESSONS_HEADER)) {
				content = content.trimEnd()
				if (content) content += "\n\n"
				content += `${LESSONS_HEADER}\n${entry}`
			} else {
				const headerIndex = content.indexOf(LESSONS_HEADER)
				const afterHeader = content.indexOf("\n", headerIndex) + 1
				content = content.slice(0, afterHeader) + entry + content.slice(afterHeader)
			}

			await fs.writeFile(absolutePath, content, "utf-8")

			const readablePath = getReadablePath(task.cwd, relPath)
			pushToolResult(`Appended lesson to ${readablePath}.`)
		} catch (error) {
			await handleError("append_lesson_learned", error as Error)
			pushToolResult(
				formatResponse.toolError(
					`Failed to append lesson to ${getReadablePath(task.cwd, relPath)}: ${(error as Error).message}`,
				),
			)
		}
	}
}

export const appendLessonLearnedTool = new AppendLessonLearnedTool()
