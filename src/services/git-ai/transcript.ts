import type { ApiMessage } from "../../core/task-persistence/apiMessages"

export interface GitAiMessage {
	type: "user" | "assistant" | "tool_use"
	text?: string
	name?: string
	input?: Record<string, unknown>
	timestamp?: string
}

/**
 * Roo Code injects <environment_details> blocks into user messages containing
 * workspace file listings, VS Code state, timestamps, etc. These are noisy
 * and not useful for git-ai attribution.
 */
function isEnvironmentDetails(text: string): boolean {
	return text.trimStart().startsWith("<environment_details>")
}

/**
 * Convert ApiMessage[] to git-ai transcript format.
 * Per the git-ai spec, only user, assistant, and tool_use messages are included.
 * tool_result blocks are excluded due to size, staleness, and security concerns.
 * Auto-injected environment_details blocks are also filtered out.
 *
 * Truncates to the last 50 messages to keep the payload reasonable.
 */
export function buildTranscript(history: ApiMessage[]): GitAiMessage[] {
	const messages: GitAiMessage[] = []
	const recentHistory = history.slice(-50)

	for (const msg of recentHistory) {
		const timestamp = msg.ts ? new Date(msg.ts).toISOString() : undefined

		if (typeof msg.content === "string") {
			if (msg.role === "user" && isEnvironmentDetails(msg.content)) {
				continue
			}
			messages.push({
				type: msg.role === "user" ? "user" : "assistant",
				text: msg.content,
				timestamp,
			})
			continue
		}

		if (!Array.isArray(msg.content)) {
			continue
		}

		for (const block of msg.content) {
			if (block.type === "text") {
				if (msg.role === "user" && isEnvironmentDetails(block.text)) {
					continue
				}
				messages.push({
					type: msg.role === "user" ? "user" : "assistant",
					text: block.text,
					timestamp,
				})
			} else if (block.type === "tool_use") {
				messages.push({
					type: "tool_use",
					name: block.name,
					input: block.input as Record<string, unknown>,
					timestamp,
				})
			}
			// Skip tool_result, image, and other block types
		}
	}

	return messages
}
