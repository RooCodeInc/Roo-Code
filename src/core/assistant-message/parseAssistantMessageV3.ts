const { PartialXMLStreamParser, xmlObjectToString } = require("partial-xml-stream-parser")
import { ToolParamName, toolParamNames } from "../../shared/tools"
import { AssistantMessageContent } from "./parseAssistantMessage"
import { ToolName, toolNames } from "@roo-code/types"

export function parseAssistantMessageV3(assistantMessage: string): AssistantMessageContent[] {
	const textNodeNameKey = "#text"
	const attributeNamePrefixKey = "@"
	const parser = new PartialXMLStreamParser({
		textNodeName: textNodeNameKey,
		attributeNamePrefix: attributeNamePrefixKey,
		alwaysCreateTextNode: true,
		parsePrimitives: false,
		maxDepth: 1, // this for backward compatible with old version (old version only support 2 levels (1 level depth)) 
		// TODO:  follow up to remove parseXml on all tool, then we will remove this, and use stopNodes
		stopNodes: [
			"thinking",
		// 	"execute_command.command",
		// 	"execute_command.cwd",
		// 	"read_file.args",
		// 	"read_file.path",
		// 	"fetch_instructions.task",
		// 	"search_files.path",
		// 	"search_files.regex",
		// 	"search_files.file_pattern",
		// 	"apply_diff.diff",
		// 	"apply_diff.args",
		// 	"insert_content.path",
		// 	"insert_content.content",
		// 	"insert_content.line",
		// 	// Note: write_to_file.content removed to support CDATA sections
		// 	"write_to_file.path",
		// 	"write_to_file.line_count",
		// 	"search_and_replace.path",
		// 	"search_and_replace.search",
		// 	"search_and_replace.replace",
		// 	"search_and_replace.start_line",
		// 	"search_and_replace.end_line",
		// 	"search_and_replace.use_regex",
		// 	"search_and_replace.ignore_case",
		// 	"attempt_completion.result",
		// 	"attempt_completion.command",
		// 	"ask_followup_question.question",
		// 	"ask_followup_question.follow_up",
		// 	"codebase_search.query",
		// 	"codebase_search.path",
		// 	"use_mcp_tool.arguments",
		// 	"use_mcp_tool.server_name",
		// 	"use_mcp_tool.tool_name",
		// 	"access_mcp_resource.uri",
		// 	"access_mcp_resource.server_name",
		// 	"new_task.mode",
		// 	"new_task.message",
		// 	"switch_mode.mode_slug",
		// 	"switch_mode.reason",
		// 	"browser_action.action",
		// 	"browser_action.text",
		// 	"browser_action.url",
		// 	"browser_action.coordinate",
		// 	"browser_action.size",
		// 	"list_files.path",
		// 	"list_files.recursive",
		// 	"list_code_definition_names.path",
		],
		allowedRootNodes: ["thinking", ...toolNames],
	})

	const contentBlocks: AssistantMessageContent[] = []
	let isPartial = false

	// Process the message and capture intermediate results
	const parseResult = parser.parseStream(assistantMessage)
	const finalResult = parser.parseStream(null)

	// Use the final result if available, otherwise use the parse result
	const result = finalResult || parseResult
	isPartial = result?.metadata?.partial || false

	// Helper function to simplify objects with only #text key
	function simplifyTextOnlyObject(value: any): any {
		if (typeof value === "object" && value !== null && !Array.isArray(value)) {
			const keys = Object.keys(value)
			// If object has only #text key, return its value
			if (keys.length === 1 && keys[0] === textNodeNameKey) {
				return value[textNodeNameKey]
			}
			// Otherwise, recursively process all properties
			const simplified: any = {}
			for (const key in value) {
				simplified[key] = simplifyTextOnlyObject(value[key])
			}
			return simplified
		} else if (Array.isArray(value)) {
			return value.map((item) => simplifyTextOnlyObject(item))
		}
		return value
	}

	// Helper function to extract text content from various value types
	function extractTextContent(value: any): string {
		// First simplify any text-only objects
		const simplified = simplifyTextOnlyObject(value)

		if (typeof simplified === "string") {
			// Handle CDATA sections - strip CDATA markers if present
			if (simplified.startsWith("<![CDATA[") && simplified.includes("]]>")) {
				// Find the actual end of CDATA content
				const cdataStart = 9 // length of "<![CDATA["
				const cdataEndIndex = simplified.indexOf("]]>")
				if (cdataEndIndex !== -1) {
					return simplified.substring(cdataStart, cdataEndIndex)
				}
			}
			return simplified
		} else if (typeof simplified === "number" || typeof simplified === "boolean") {
			return String(simplified)
		} else if (simplified === null || simplified === undefined) {
			return ""
		} else if (typeof simplified === "object") {
			// If it's an array, concatenate all text content
			if (Array.isArray(simplified)) {
				return simplified.map((item) => extractTextContent(item)).join("")
			}
			// If it's still an object after simplification, reconstruct as XML
			return xmlObjectToString(simplified, {
				attributeNamePrefix: attributeNamePrefixKey,
				textNodeName: textNodeNameKey,
			})
		}
		return ""
	}

	// Helper function to extract parameters from tool data
	function extractToolParams(toolData: any): { [key in ToolParamName]?: string } {
		const params: { [key in ToolParamName]?: string } = {}

		if (typeof toolData === "object" && toolData !== null) {
			// Extract all parameters directly from the tool data
			for (const key in toolData) {
				// Use extractTextContent which internally handles simplification
				params[key as ToolParamName] = extractTextContent(toolData[key])
			}
		}

		return params
	}

	if (result && result.xml) {
		for (const item of result.xml) {
			if (typeof item === "string") {
				// Plain text content
				contentBlocks.push({
					type: "text",
					content: item,
					partial: isPartial,
				})
			} else if (typeof item === "object" && item !== null) {
				// Get the root tag name
				const rootTagName = Object.keys(item)[0]

				if (rootTagName === "thinking") {
					// Handle thinking tags as text content
					const thinkingContent = extractTextContent(item[rootTagName])
					const reconstructed = `<thinking>${thinkingContent}</thinking>`

					// Append to last text block or create new
					const lastBlock = contentBlocks.length > 0 ? contentBlocks[contentBlocks.length - 1] : null
					if (lastBlock && lastBlock.type === "text") {
						lastBlock.content += reconstructed
					} else {
						contentBlocks.push({ type: "text", content: reconstructed, partial: isPartial })
					}
				} else if (toolNames.includes(rootTagName as ToolName)) {
					// This is a tool call
					const toolName = rootTagName as ToolName
					const toolData = item[toolName]
					const params = extractToolParams(toolData)

					contentBlocks.push({
						type: "tool_use",
						name: toolName,
						params: params as { [key in ToolParamName]: string },
						partial: isPartial,
					})
				} else {
					// Unknown tag, reconstruct using xmlObjectToString
					const reconstructed = xmlObjectToString(item, {
						attributeNamePrefix: attributeNamePrefixKey,
						textNodeName: textNodeNameKey,
					})

					// Append to last text block or create new
					const lastBlock = contentBlocks.length > 0 ? contentBlocks[contentBlocks.length - 1] : null
					if (lastBlock && lastBlock.type === "text") {
						lastBlock.content += reconstructed
					} else {
						contentBlocks.push({ type: "text", content: reconstructed, partial: isPartial })
					}
				}
			}
		}
	}

	// Final pass to trim content and parameter values, and filter out empty text blocks
	const processedBlocks = contentBlocks
		.map((block) => {
			if (block.type === "text") {
				return { ...block, content: block.content.trim() }
			}
			if (block.type === "tool_use") {
				const trimmedParams: { [key in ToolParamName]?: string } = {}
				for (const key in block.params) {
					const value = block.params[key as ToolParamName]
					if (value !== undefined) {
						trimmedParams[key as ToolParamName] = value.trim()
					}
				}
				return { ...block, params: trimmedParams as { [key in ToolParamName]: string } }
			}
			return block
		})
		.filter((block) => {
			if (block.type === "text" && block.content.length === 0) {
				return false // Remove empty text blocks
			}
			return true
		})

	// Update partial status based on parser result and content analysis
	if (processedBlocks.length > 0) {
		const lastBlock = processedBlocks[processedBlocks.length - 1]

		if (isPartial) {
			// If parser indicates partial, mark the last block as partial
			lastBlock.partial = true
		} else if (lastBlock.type === "text") {
			// For text blocks, always mark the last one as partial
			// (matches original parser behavior)
			lastBlock.partial = true
		} else if (lastBlock.type === "tool_use") {
			// Check if the tool tag is properly closed
			const toolClosingTag = `</${lastBlock.name}>`
			const trimmedMessage = assistantMessage.trimEnd()

			// If message doesn't end with closing tag, it's partial
			if (!trimmedMessage.endsWith(toolClosingTag)) {
				lastBlock.partial = true
			} else {
				// Additional check: see if any parameter might be incomplete
				// by checking if the message ends with a parameter closing tag
				const paramTags = Object.keys(lastBlock.params).map((param) => `</${param}>`)
				const endsWithParamTag = paramTags.some((tag) => trimmedMessage.endsWith(tag))

				// If it ends with the tool closing tag but not a param tag,
				// the last param might be incomplete
				if (!endsWithParamTag && Object.keys(lastBlock.params).length > 0) {
					// Check if there's an unclosed parameter tag
					const lastParamKey = Object.keys(lastBlock.params).pop()
					if (lastParamKey) {
						const lastParamOpenTag = `<${lastParamKey}>`
						const lastParamCloseTag = `</${lastParamKey}>`
						const lastOpenIndex = trimmedMessage.lastIndexOf(lastParamOpenTag)
						const lastCloseIndex = trimmedMessage.lastIndexOf(lastParamCloseTag)

						if (lastOpenIndex > lastCloseIndex) {
							lastBlock.partial = true
						}
					}
				}
			}
		}
	}

	return processedBlocks
}
