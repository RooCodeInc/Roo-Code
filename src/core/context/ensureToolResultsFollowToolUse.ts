import { Anthropic } from "@anthropic-ai/sdk"
import cloneDeep from "clone-deep"

/**
 * Ensures that every tool_use block in assistant messages has a corresponding tool_result in the next user message,
 * and that tool_result blocks immediately follow their corresponding tool_use blocks in the correct order.
 *
 * This is required by the Anthropic API to maintain proper message pairing.
 * When tool_result blocks are missing, they are automatically added with "result missing" content.
 *
 * @param messages - The conversation messages to validate and fix
 */
export function ensureToolResultsFollowToolUse(messages: Anthropic.Messages.MessageParam[]): void {
	for (let i = 0; i < messages.length - 1; i++) {
		const message = messages[i]

		// Only process assistant messages with content
		if (message.role !== "assistant" || !Array.isArray(message.content)) {
			continue
		}

		// Extract tool_use IDs in order
		const toolUseIds: string[] = []
		for (const block of message.content) {
			if (block.type === "tool_use" && block.id) {
				toolUseIds.push(block.id)
			}
		}

		// Skip if no tool_use blocks found
		if (toolUseIds.length === 0) {
			continue
		}

		const nextMessage = messages[i + 1]

		// Skip if next message is not a user message
		if (nextMessage.role !== "user") {
			continue
		}

		// Ensure content is an array
		if (!Array.isArray(nextMessage.content)) {
			nextMessage.content = []
		}

		// Separate tool_results from other blocks in a single pass
		const toolResultMap = new Map<string, Anthropic.Messages.ToolResultBlockParam>()
		const otherBlocks: Anthropic.Messages.ContentBlockParam[] = []
		let needsUpdate = false

		for (const block of nextMessage.content) {
			if (block.type === "tool_result" && block.tool_use_id) {
				toolResultMap.set(block.tool_use_id, block)
			} else {
				otherBlocks.push(block)
			}
		}

		// Check if reordering is needed (tool_results not at start in correct order)
		if (toolResultMap.size > 0) {
			let expectedIndex = 0
			for (let j = 0; j < nextMessage.content.length && expectedIndex < toolUseIds.length; j++) {
				const block = nextMessage.content[j]
				if (block.type === "tool_result" && block.tool_use_id === toolUseIds[expectedIndex]) {
					expectedIndex++
				} else if (block.type === "tool_result" || expectedIndex < toolUseIds.length) {
					needsUpdate = true
					break
				}
			}
			if (!needsUpdate && expectedIndex < toolResultMap.size) {
				needsUpdate = true
			}
		}

		// Add missing tool_results
		for (const toolUseId of toolUseIds) {
			if (!toolResultMap.has(toolUseId)) {
				toolResultMap.set(toolUseId, {
					type: "tool_result",
					tool_use_id: toolUseId,
					content: "result missing",
				})
				needsUpdate = true
			}
		}

		// Only modify if changes are needed
		if (!needsUpdate) {
			continue
		}

		// Build new content: tool_results first (in toolUseIds order), then other blocks
		const newContent: Anthropic.Messages.ContentBlockParam[] = []

		// Add tool_results in the order of toolUseIds
		const processedToolResults = new Set<string>()
		for (const toolUseId of toolUseIds) {
			const toolResult = toolResultMap.get(toolUseId)
			if (toolResult) {
				newContent.push(toolResult)
				processedToolResults.add(toolUseId)
			}
		}

		// Add any orphaned tool_results not in toolUseIds (shouldn't happen, but be safe)
		for (const [toolUseId, toolResult] of toolResultMap) {
			if (!processedToolResults.has(toolUseId)) {
				newContent.push(toolResult)
			}
		}

		// Add all other blocks
		newContent.push(...otherBlocks)

		// Clone and update the message
		const clonedMessage = cloneDeep(nextMessage)
		clonedMessage.content = newContent
		messages[i + 1] = clonedMessage
	}
}
