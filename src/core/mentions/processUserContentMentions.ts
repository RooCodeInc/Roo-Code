import { Anthropic } from "@anthropic-ai/sdk"
import { parseMentions } from "./index"
import { UrlContentFetcher } from "../../services/browser/UrlContentFetcher"
import { FileContextTracker } from "../context-tracking/FileContextTracker"

/**
 * Process mentions in all user content uniformly (text and tool_result text blocks).
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
	maxReadFileLine,
}: {
	userContent: Anthropic.Messages.ContentBlockParam[]
	cwd: string
	urlContentFetcher: UrlContentFetcher
	fileContextTracker: FileContextTracker
	rooIgnoreController?: any
	showRooIgnoredFiles?: boolean
	includeDiagnosticMessages?: boolean
	maxDiagnosticMessages?: number
	maxReadFileLine?: number
}) {
	// Process userContent array, which contains various block types:
	// TextBlockParam, ImageBlockParam, ToolUseBlockParam, and ToolResultBlockParam.
	// We apply parseMentions() to all text content:
	// 1. All TextBlockParam's text
	// 2. ToolResultBlockParam's string content
	// 3. ToolResultBlockParam's array content where blocks are text type
	return Promise.all(
		userContent.map(async (block) => {
			if (block.type === "text") {
				return {
					...block,
					text: await parseMentions(
						block.text,
						cwd,
						urlContentFetcher,
						fileContextTracker,
						rooIgnoreController,
						showRooIgnoredFiles,
						includeDiagnosticMessages,
						maxDiagnosticMessages,
						maxReadFileLine,
					),
				}
			} else if (block.type === "tool_result") {
				if (typeof block.content === "string") {
					return {
						...block,
						content: await parseMentions(
							block.content,
							cwd,
							urlContentFetcher,
							fileContextTracker,
							rooIgnoreController,
							showRooIgnoredFiles,
							includeDiagnosticMessages,
							maxDiagnosticMessages,
							maxReadFileLine,
						),
					}
				} else if (Array.isArray(block.content)) {
					const parsedContent = await Promise.all(
						block.content.map(async (contentBlock) => {
							if (contentBlock.type === "text") {
								return {
									...contentBlock,
									text: await parseMentions(
										contentBlock.text,
										cwd,
										urlContentFetcher,
										fileContextTracker,
										rooIgnoreController,
										showRooIgnoredFiles,
										includeDiagnosticMessages,
										maxDiagnosticMessages,
										maxReadFileLine,
									),
								}
							}

							return contentBlock
						}),
					)

					return { ...block, content: parsedContent }
				}

				return block
			}

			return block
		}),
	)
}
