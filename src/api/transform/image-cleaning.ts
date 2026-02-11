import { type RooMessage } from "../../core/task-persistence/rooMessage"

import { ApiHandler } from "../index"

/* Removes image blocks from messages if they are not supported by the Api Handler */
export function maybeRemoveImageBlocks(messages: RooMessage[], apiHandler: ApiHandler): RooMessage[] {
	// Check model capability ONCE instead of for every message
	const supportsImages = apiHandler.getModel().info.supportsImages

	if (supportsImages) {
		return messages
	}

	return messages.map((message) => {
		// Only process messages with a role and array content
		if (!("role" in message) || !Array.isArray(message.content)) {
			return message
		}

		const content = message.content.map((block: any) => {
			if (block.type === "image") {
				return {
					type: "text" as const,
					text: "[Referenced image in conversation]",
				}
			}
			return block
		})

		return { ...message, content } as typeof message
	})
}
