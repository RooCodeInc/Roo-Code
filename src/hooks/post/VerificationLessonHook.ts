import { IToolHook, HookType, HookContext } from "../types"

/**
 * Automatically records "Lessons Learned" to AGENTS.md when a verification step fails.
 */
export class VerificationLessonHook implements IToolHook {
	name = "VerificationLessonHook"
	type = HookType.POST

	async execute(context: HookContext): Promise<void> {
		const { task, toolName, arguments: toolArgs, result, error } = context

		// We only care about failures
		if (!error) return

		// Identify verification tools
		// Usually execute_command for npm test, etc.
		if (toolName === "execute_command") {
			const command = (toolArgs.command || "").toLowerCase()
			const verificationKeywords = ["test", "lint", "check", "verify", "tsc", "build"]

			const isVerification = verificationKeywords.some((kw) => command.includes(kw))

			if (isVerification) {
				const lesson = `Verification failed for command: '${toolArgs.command}'. Error: ${error.message || error}`

				// Use the tool's logic without a real tool call to avoid loops
				const agentsPath = require("path").join(task.cwd, "AGENTS.md")
				const timestamp = new Date().toISOString()
				const lessonEntry = `\n\n### Lessons Learned (${timestamp})\n- ${lesson}\n`

				try {
					await require("fs/promises").appendFile(agentsPath, lessonEntry, "utf8")
					console.log(`[VerificationLessonHook] Auto-recorded lesson for failed command: ${command}`)
				} catch (err) {
					console.error(`[VerificationLessonHook] Failed to record lesson:`, err)
				}
			}
		}
	}
}
