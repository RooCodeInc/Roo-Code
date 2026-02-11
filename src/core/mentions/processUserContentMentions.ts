import type { TextPart, ImagePart, LegacyToolResultBlock } from "../task-persistence/rooMessage"
import { parseMentions, ParseMentionsResult, MentionContentBlock } from "./index"
import { FileContextTracker } from "../context-tracking/FileContextTracker"

export interface ProcessUserContentMentionsResult {
	content: Array<TextPart | ImagePart | LegacyToolResultBlock>
	mode?: string // Mode from the first slash command that has one
}

/**
 * Converts MentionContentBlocks to TextPart blocks.
 * Each file/folder mention becomes a separate text block formatted
 * to look like a read_file tool result.
 */
function contentBlocksToTextParts(contentBlocks: MentionContentBlock[]): TextPart[] {
	return contentBlocks.map((block) => ({
		type: "text" as const,
		text: block.content,
	}))
}

/**
 * Process mentions in user content, specifically within task and feedback tags.
 *
 * File/folder @ mentions are now returned as separate text blocks that
 * look like read_file tool results, making it clear to the model that
 * the file has already been read.
 */
export async function processUserContentMentions({
	userContent,
	cwd,
	fileContextTracker,
	rooIgnoreController,
	showRooIgnoredFiles = false,
	includeDiagnosticMessages = true,
	maxDiagnosticMessages = 50,
}: {
	userContent: Array<TextPart | ImagePart | LegacyToolResultBlock>
	cwd: string
	fileContextTracker: FileContextTracker
	rooIgnoreController?: any
	showRooIgnoredFiles?: boolean
	includeDiagnosticMessages?: boolean
	maxDiagnosticMessages?: number
}): Promise<ProcessUserContentMentionsResult> {
	// Track the first mode found from slash commands
	let commandMode: string | undefined

	// Process userContent array, which contains text and image parts.
	// We need to apply parseMentions() to TextPart's text that contains "<user_message>".
	const content = (
		await Promise.all(
			userContent.map(async (block) => {
				const shouldProcessMentions = (text: string) => text.includes("<user_message>")

				if (block.type === "text") {
					if (shouldProcessMentions(block.text)) {
						const result = await parseMentions(
							block.text,
							cwd,
							fileContextTracker,
							rooIgnoreController,
							showRooIgnoredFiles,
							includeDiagnosticMessages,
							maxDiagnosticMessages,
						)
						// Capture the first mode found
						if (!commandMode && result.mode) {
							commandMode = result.mode
						}

						// Build the blocks array:
						// 1. User's text (with @ mentions replaced by clean paths)
						// 2. File/folder content blocks (formatted like read_file results)
						// 3. Slash command help (if any)
						const blocks: Array<TextPart | ImagePart> = [
							{
								...block,
								text: result.text,
							},
						]

						// Add file/folder content as separate blocks
						if (result.contentBlocks.length > 0) {
							blocks.push(...contentBlocksToTextParts(result.contentBlocks))
						}

						if (result.slashCommandHelp) {
							blocks.push({
								type: "text" as const,
								text: result.slashCommandHelp,
							})
						}
						return blocks
					}

					return block
				} else if (block.type === "tool_result") {
					if (typeof block.content === "string") {
						if (shouldProcessMentions(block.content)) {
							const result = await parseMentions(
								block.content,
								cwd,
								fileContextTracker,
								rooIgnoreController,
								showRooIgnoredFiles,
								includeDiagnosticMessages,
								maxDiagnosticMessages,
							)
							// Capture the first mode found
							if (!commandMode && result.mode) {
								commandMode = result.mode
							}

							// Build content array with file blocks included
							const contentParts: Array<{ type: "text"; text: string }> = [
								{
									type: "text" as const,
									text: result.text,
								},
							]

							// Add file/folder content blocks
							for (const contentBlock of result.contentBlocks) {
								contentParts.push({
									type: "text" as const,
									text: contentBlock.content,
								})
							}

							if (result.slashCommandHelp) {
								contentParts.push({
									type: "text" as const,
									text: result.slashCommandHelp,
								})
							}

							return {
								...block,
								content: contentParts,
							}
						}

						return block
					} else if (Array.isArray(block.content)) {
						const parsedContent = (
							await Promise.all(
								block.content.map(async (contentBlock) => {
									if (contentBlock.type === "text" && shouldProcessMentions(contentBlock.text)) {
										const result = await parseMentions(
											contentBlock.text,
											cwd,
											fileContextTracker,
											rooIgnoreController,
											showRooIgnoredFiles,
											includeDiagnosticMessages,
											maxDiagnosticMessages,
										)
										// Capture the first mode found
										if (!commandMode && result.mode) {
											commandMode = result.mode
										}

										// Build blocks array with file content
										const blocks: Array<{ type: "text"; text: string }> = [
											{
												...contentBlock,
												text: result.text,
											},
										]

										// Add file/folder content blocks
										for (const cb of result.contentBlocks) {
											blocks.push({
												type: "text" as const,
												text: cb.content,
											})
										}

										if (result.slashCommandHelp) {
											blocks.push({
												type: "text" as const,
												text: result.slashCommandHelp,
											})
										}
										return blocks
									}

									return contentBlock
								}),
							)
						).flat()

						return { ...block, content: parsedContent }
					}

					return block
				}

				// Legacy backward compat: tool_result / tool-result blocks from older formats
				// are passed through unchanged (tool results are now in separate RooToolMessages).
				return block
			}),
		)
	).flat()

	return { content: content as Array<TextPart | ImagePart | LegacyToolResultBlock>, mode: commandMode }
}
