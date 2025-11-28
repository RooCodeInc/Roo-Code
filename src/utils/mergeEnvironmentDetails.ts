import { Anthropic } from "@anthropic-ai/sdk"

/**
 * Checks if a model needs environment details merged into user content
 * rather than added as a separate text block.
 *
 * Some models have limitations with multiple text blocks in a single message,
 * so environment details need to be merged into existing content.
 *
 * @param modelId - The model identifier string (can be undefined)
 * @returns true if environment details should be merged, false otherwise
 */
export function isMergeEnvironmentDetailsMergeNeeded(modelId: string | undefined): boolean {
	// Currently no models require this special handling
	// This function exists to allow easy addition of model-specific behavior
	// without modifying the main Task.ts logic
	return false
}

/**
 * Merges environment details into user content by appending to the last text block
 * or adding as a new text block if no text block exists.
 *
 * This is used for models that have issues with multiple separate text blocks
 * in a single user message.
 *
 * @param content - The existing user content blocks
 * @param environmentDetails - The environment details string to merge
 * @returns The merged content blocks
 */
export function mergeEnvironmentDetailsIntoUserContent(
	content: Anthropic.Messages.ContentBlockParam[],
	environmentDetails: string,
): Anthropic.Messages.ContentBlockParam[] {
	if (content.length === 0) {
		return [{ type: "text" as const, text: environmentDetails }]
	}

	// Find the last text block to append to (using reverse iteration for ES2020 compatibility)
	let lastTextBlockIndex = -1
	for (let i = content.length - 1; i >= 0; i--) {
		if (content[i].type === "text") {
			lastTextBlockIndex = i
			break
		}
	}

	if (lastTextBlockIndex === -1) {
		// No text blocks, add environment details as a new text block
		return [...content, { type: "text" as const, text: environmentDetails }]
	}

	// Clone the content array to avoid mutation
	const result = [...content]

	// Append environment details to the last text block
	const lastTextBlock = result[lastTextBlockIndex] as Anthropic.Messages.TextBlockParam
	result[lastTextBlockIndex] = {
		type: "text" as const,
		text: `${lastTextBlock.text}\n\n${environmentDetails}`,
	}

	return result
}
