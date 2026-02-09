import { parseMentions, ParseMentionsResult, MentionContentBlock } from "./index"
import { UrlContentFetcher } from "../../services/browser/UrlContentFetcher"
import { FileContextTracker } from "../context-tracking/FileContextTracker"
import type { NeutralContentBlock, NeutralTextBlock } from "../task-persistence"

export interface ProcessUserContentMentionsResult {
	content: NeutralContentBlock[]
	mode?: string // Mode from the first slash command that has one
}

/**
 * Converts MentionContentBlocks to Anthropic text blocks.
 * Each file/folder mention becomes a separate text block formatted
 * to look like a read_file tool result.
 */
function contentBlocksToAnthropicBlocks(contentBlocks: MentionContentBlock[]): NeutralTextBlock[] {
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
	urlContentFetcher,
	fileContextTracker,
	rooIgnoreController,
	showRooIgnoredFiles = false,
	includeDiagnosticMessages = true,
	maxDiagnosticMessages = 50,
}: {
	userContent: NeutralContentBlock[]
	cwd: string
	urlContentFetcher: UrlContentFetcher
	fileContextTracker: FileContextTracker
	rooIgnoreController?: any
	showRooIgnoredFiles?: boolean
	includeDiagnosticMessages?: boolean
	maxDiagnosticMessages?: number
}): Promise<ProcessUserContentMentionsResult> {
	// Track the first mode found from slash commands
	let commandMode: string | undefined

	// Process userContent array, which contains various block types:
	// TextBlockParam, ImageBlockParam, ToolUseBlockParam, and ToolResultBlockParam.
	// We need to apply parseMentions() to:
	// 1. All TextBlockParam's text (first user message)
	// 2. ToolResultBlockParam's content/context text arrays if it contains
	// "<user_message>" - we place all user generated content in this tag
	// so it can effectively be used as a marker for when we should parse mentions.
	const content = (
		await Promise.all(
			userContent.map(async (block) => {
				const shouldProcessMentions = (text: string) => text.includes("<user_message>")

				if (block.type === "text") {
					if (shouldProcessMentions(block.text)) {
						const result = await parseMentions(
							block.text,
							cwd,
							urlContentFetcher,
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
						const blocks: NeutralContentBlock[] = [
							{
								...block,
								text: result.text,
							},
						]

						// Add file/folder content as separate blocks
						if (result.contentBlocks.length > 0) {
							blocks.push(...contentBlocksToAnthropicBlocks(result.contentBlocks))
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
				} else if (block.type === "tool-result") {
					if (block.output?.type === "text") {
						if (shouldProcessMentions(block.output.value)) {
							const result = await parseMentions(
								block.output.value,
								cwd,
								urlContentFetcher,
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
							const outputParts: Array<{ type: "text"; text: string }> = [
								{
									type: "text" as const,
									text: result.text,
								},
							]

							// Add file/folder content blocks
							for (const contentBlock of result.contentBlocks) {
								outputParts.push({
									type: "text" as const,
									text: contentBlock.content,
								})
							}

							if (result.slashCommandHelp) {
								outputParts.push({
									type: "text" as const,
									text: result.slashCommandHelp,
								})
							}

							return {
								...block,
								output: { type: "content" as const, value: outputParts },
							}
						}

						return block
					} else if (block.output?.type === "content") {
						const parsedContent = (
							await Promise.all(
								(block.output.value as Array<any>).map(async (contentBlock: any) => {
									if (contentBlock.type === "text" && shouldProcessMentions(contentBlock.text)) {
										const result = await parseMentions(
											contentBlock.text,
											cwd,
											urlContentFetcher,
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

						return { ...block, output: { type: "content" as const, value: parsedContent } }
					}

					return block
				}

				return block
			}),
		)
	).flat()

	return { content, mode: commandMode }
}
