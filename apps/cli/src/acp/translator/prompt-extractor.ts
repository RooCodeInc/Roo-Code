/**
 * Prompt Extractor
 *
 * Extracts text and images from ACP prompt content blocks.
 * Handles various content block types including text, resources, and media.
 */

import type * as acp from "@agentclientprotocol/sdk"

// =============================================================================
// Text Extraction
// =============================================================================

/**
 * Extract text content from ACP prompt content blocks.
 *
 * Handles these content block types:
 * - text: Direct text content
 * - resource_link: Reference to a file or resource (converted to @uri format)
 * - resource: Embedded resource with text content
 * - image/audio: Noted as placeholders
 *
 * @param prompt - Array of ACP content blocks
 * @returns Combined text from all blocks
 */
export function extractPromptText(prompt: acp.ContentBlock[]): string {
	const textParts: string[] = []

	for (const block of prompt) {
		switch (block.type) {
			case "text":
				textParts.push(block.text)
				break
			case "resource_link":
				// Reference to a file or resource
				textParts.push(`@${block.uri}`)
				break
			case "resource":
				// Embedded resource content
				if (block.resource && "text" in block.resource) {
					textParts.push(`Content from ${block.resource.uri}:\n${block.resource.text}`)
				}
				break
			case "image":
			case "audio":
				// Binary content - note it but don't include
				textParts.push(`[${block.type} content]`)
				break
		}
	}

	return textParts.join("\n")
}

// =============================================================================
// Image Extraction
// =============================================================================

/**
 * Extract images from ACP prompt content blocks.
 *
 * Extracts base64-encoded image data from image content blocks.
 *
 * @param prompt - Array of ACP content blocks
 * @returns Array of base64-encoded image data strings
 */
export function extractPromptImages(prompt: acp.ContentBlock[]): string[] {
	const images: string[] = []

	for (const block of prompt) {
		if (block.type === "image" && block.data) {
			images.push(block.data)
		}
	}

	return images
}

// =============================================================================
// Resource Extraction
// =============================================================================

/**
 * Extract resource URIs from ACP prompt content blocks.
 *
 * @param prompt - Array of ACP content blocks
 * @returns Array of resource URIs
 */
export function extractPromptResources(prompt: acp.ContentBlock[]): string[] {
	const resources: string[] = []

	for (const block of prompt) {
		if (block.type === "resource_link") {
			resources.push(block.uri)
		} else if (block.type === "resource" && block.resource) {
			resources.push(block.resource.uri)
		}
	}

	return resources
}
