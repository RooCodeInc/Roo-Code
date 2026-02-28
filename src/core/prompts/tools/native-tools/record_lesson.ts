import type OpenAI from "openai"

/**
 * Tool for recording lessons learned to AGENT.md (Phase 4 requirement).
 * This tool allows the agent to append lessons learned when verification steps fail
 * or when important insights are discovered during development.
 */
const recordLesson: OpenAI.Chat.ChatCompletionFunctionTool = {
	type: "function",
	function: {
		name: "record_lesson",
		description:
			"Record a lesson learned to .orchestration/AGENT.md. Use this tool when verification steps (linter/test) fail, when architectural decisions are made, or when important insights are discovered. Lessons are appended with timestamps and context information.",
		parameters: {
			type: "object",
			properties: {
				lesson: {
					type: "string",
					description:
						"The lesson learned or insight to record. Should be clear and actionable for future reference.",
				},
				context: {
					type: "object",
					properties: {
						tool: {
							type: "string",
							description: "Optional: The tool that was being used when the lesson was learned.",
						},
						error: {
							type: "string",
							description: "Optional: The error message or issue that led to this lesson.",
						},
						file: {
							type: "string",
							description: "Optional: The file path related to this lesson.",
						},
					},
					description: "Optional context information about when/where this lesson was learned.",
				},
			},
			required: ["lesson"],
		},
	},
}

export default recordLesson
