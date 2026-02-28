import type OpenAI from "openai"
import fs from "fs"
import path from "path"

const APPEND_LESSON_DESCRIPTION = `Append a lesson learned from a verification failure to CLAUDE.md.

This tool is used to record insights when verification steps (linting, testing, etc.) fail. Recording lessons enables the AI to improve decision-making across agent turns.

When a verification failure occurs:
1. Document the context (what was being verified, which files/checks)
2. Describe the failure (what went wrong, specific error messages)
3. Propose the resolution (how to fix or prevent this issue)

Format:
\`\`\`
## Lesson Learned (2026-02-20 14:30:00 UTC)
**Context**: [what was being verified]
**Failure**: [what went wrong]
**Resolution**: [how to fix/prevent]
\`\`\`

Examples:
- "Type checking failed with strict mode. Added proper type annotations to args."
- "Lint warnings in intentHooks.ts exceeded threshold. Enforced stricter typing."
- "Test suite timed out. Optimized async operations to reduce latency."
`

const LESSON_TEXT_DESCRIPTION = `The lesson text to append. Should include context, failure description, and resolution.`

export default {
	type: "function",
	function: {
		name: "append_lesson_to_claude",
		description: APPEND_LESSON_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				lesson_text: {
					type: "string",
					description: LESSON_TEXT_DESCRIPTION,
				},
			},
			required: ["lesson_text"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool

/**
 * Implementation of append_lesson_to_claude tool
 */
export async function appendLessonToClaude(lessonText: string): Promise<{ success: boolean; path: string; message: string }> {
	const claudePath = "CLAUDE.md"

	try {
		// Ensure CLAUDE.md exists
		const dirPath = path.dirname(claudePath)
		if (dirPath !== "." && !fs.existsSync(dirPath)) {
			fs.mkdirSync(dirPath, { recursive: true })
		}

		// Format the lesson entry with timestamp
		const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC"
		const lessonEntry = `## Lesson Learned (${timestamp})\n${lessonText}\n\n`

		// Append to CLAUDE.md
		if (fs.existsSync(claudePath)) {
			// Append to existing file
			fs.appendFileSync(claudePath, lessonEntry, "utf8")
		} else {
			// Create new file with header
			const header = `# Lessons Learned (Phase 4: Parallel Orchestration)\n\nThis file records insights from verification failures across agent turns.\n\n`
			fs.writeFileSync(claudePath, header + lessonEntry, "utf8")
		}

		return {
			success: true,
			path: claudePath,
			message: `Lesson recorded in ${claudePath}`,
		}
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err)
		return {
			success: false,
			path: claudePath,
			message: `Failed to append lesson: ${errorMessage}`,
		}
	}
}
