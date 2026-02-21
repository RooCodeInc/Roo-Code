import type OpenAI from "openai"

const APPEND_LESSON_LEARNED_DESCRIPTION = `Append a "Lesson Learned" entry to CLAUDE.md (or another file). Use this when a verification step (linter, test, or build) fails so that future sessions can avoid the same mistake.

Call this after a failed verification: record what went wrong and how to fix or avoid it. The lesson is appended under a "## Lessons Learned" section.`

const LESSON_PARAMETER_DESCRIPTION = `The lesson text to record (e.g. what failed, why, and how to fix or avoid it).`

const FILE_PATH_PARAMETER_DESCRIPTION = `Optional. File to append to. Defaults to CLAUDE.md. Use a path relative to the workspace.`

export default {
	type: "function",
	function: {
		name: "append_lesson_learned",
		description: APPEND_LESSON_LEARNED_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				lesson: {
					type: "string",
					description: LESSON_PARAMETER_DESCRIPTION,
				},
				file_path: {
					type: "string",
					description: FILE_PATH_PARAMETER_DESCRIPTION,
				},
			},
			required: ["lesson"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
