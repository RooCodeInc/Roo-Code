import path from "path"
import { isBinaryFile } from "isbinaryfile"

import { Task } from "../task/Task"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { getReadablePath } from "../../utils/path"
import { countFileLines } from "../../integrations/misc/line-counter"
import { readLines } from "../../integrations/misc/read-lines"
import { extractTextFromFile, addLineNumbers, getSupportedBinaryFormats } from "../../integrations/misc/extract-text"
import { parseSourceCodeDefinitionsForFile } from "../../services/tree-sitter"
import { ToolProtocol, isNativeProtocol } from "@roo-code/types"
import {
	DEFAULT_MAX_IMAGE_FILE_SIZE_MB,
	DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB,
	isSupportedImageFormat,
	validateImageForProcessing,
	processImageFile,
} from "./helpers/imageHelpers"

/**
 * Helper function to parse line range string (e.g., "1-100" -> {start: 1, end: 100})
 */
function parseLineRange(lineRangeStr: string | undefined): { start: number; end: number } | null {
	if (!lineRangeStr) return null
	const match = lineRangeStr.match(/^(\d+)-(\d+)$/)
	if (!match) return null
	const start = parseInt(match[1], 10)
	const end = parseInt(match[2], 10)
	if (isNaN(start) || isNaN(end) || start < 1 || end < start) return null
	return { start, end }
}

/**
 * Simplified read file tool for models that only support single file reads
 * Uses the format: <read_file><path>file/path.ext</path><line_range>start-end</line_range></read_file>
 *
 * This is a streamlined version of readFileTool that:
 * - Only accepts a single path parameter
 * - Does not support multiple files
 * - Supports a single optional line_range parameter for reading specific portions
 * - Has simpler XML parsing
 */
export async function simpleReadFileTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	_removeClosingTag: RemoveClosingTag,
	toolProtocol?: ToolProtocol,
) {
	const filePath: string | undefined = block.params.path
	const lineRangeStr: string | undefined = block.params.line_range

	// Parse line range if provided
	const lineRange = parseLineRange(lineRangeStr)

	// Check if the current model supports images
	const modelInfo = cline.api.getModel().info
	const supportsImages = modelInfo.supportsImages ?? false

	// Handle partial message
	if (block.partial) {
		const fullPath = filePath ? path.resolve(cline.cwd, filePath) : ""
		const sharedMessageProps: ClineSayTool = {
			tool: "readFile",
			path: getReadablePath(cline.cwd, filePath || ""),
			isOutsideWorkspace: filePath ? isPathOutsideWorkspace(fullPath) : false,
		}
		const partialMessage = JSON.stringify({
			...sharedMessageProps,
			content: undefined,
		} satisfies ClineSayTool)
		await cline.ask("tool", partialMessage, block.partial).catch(() => {})
		return
	}

	// Validate path parameter
	if (!filePath) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("read_file")
		const errorMsg = await cline.sayAndCreateMissingParamError("read_file", "path")
		pushToolResult(`<file><error>${errorMsg}</error></file>`)
		return
	}

	const relPath = filePath
	const fullPath = path.resolve(cline.cwd, relPath)

	try {
		// Check RooIgnore validation
		const accessAllowed = cline.rooIgnoreController?.validateAccess(relPath)
		if (!accessAllowed) {
			await cline.say("rooignore_error", relPath)
			const errorMsg = formatResponse.rooIgnoreError(relPath)
			pushToolResult(`<file><path>${relPath}</path><error>${errorMsg}</error></file>`)
			return
		}

		// Get max read file line setting
		const { maxReadFileLine = -1 } = (await cline.providerRef.deref()?.getState()) ?? {}

		// Create approval message
		const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)
		let lineSnippet = ""
		if (lineRange) {
			lineSnippet = t("tools:readFile.linesRange", { start: lineRange.start, end: lineRange.end })
		} else if (maxReadFileLine === 0) {
			lineSnippet = t("tools:readFile.definitionsOnly")
		} else if (maxReadFileLine > 0) {
			lineSnippet = t("tools:readFile.maxLines", { max: maxReadFileLine })
		}

		const completeMessage = JSON.stringify({
			tool: "readFile",
			path: getReadablePath(cline.cwd, relPath),
			isOutsideWorkspace,
			content: fullPath,
			reason: lineSnippet,
		} satisfies ClineSayTool)

		const { response, text, images } = await cline.ask("tool", completeMessage, false)

		if (response !== "yesButtonClicked") {
			// Handle denial
			if (text) {
				await cline.say("user_feedback", text, images)
			}
			cline.didRejectTool = true

			const statusMessage = text ? formatResponse.toolDeniedWithFeedback(text) : formatResponse.toolDenied()

			pushToolResult(`${statusMessage}\n<file><path>${relPath}</path><status>Denied by user</status></file>`)
			return
		}

		// Handle approval with feedback
		if (text) {
			await cline.say("user_feedback", text, images)
		}

		// Process the file
		const [totalLines, isBinary] = await Promise.all([countFileLines(fullPath), isBinaryFile(fullPath)])

		// Handle binary files
		if (isBinary) {
			const fileExtension = path.extname(relPath).toLowerCase()
			const supportedBinaryFormats = getSupportedBinaryFormats()

			// Check if it's a supported image format
			if (isSupportedImageFormat(fileExtension)) {
				try {
					const {
						maxImageFileSize = DEFAULT_MAX_IMAGE_FILE_SIZE_MB,
						maxTotalImageSize = DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB,
					} = (await cline.providerRef.deref()?.getState()) ?? {}

					// Validate image for processing
					const validationResult = await validateImageForProcessing(
						fullPath,
						supportsImages,
						maxImageFileSize,
						maxTotalImageSize,
						0, // No cumulative memory for single file
					)

					if (!validationResult.isValid) {
						await cline.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)
						pushToolResult(
							`<file><path>${relPath}</path>\n<notice>${validationResult.notice}</notice>\n</file>`,
						)
						return
					}

					// Process the image
					const imageResult = await processImageFile(fullPath)
					await cline.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)

					// Return result with image data
					const result = formatResponse.toolResult(
						`<file><path>${relPath}</path>\n<notice>${imageResult.notice}</notice>\n</file>`,
						supportsImages ? [imageResult.dataUrl] : undefined,
					)

					if (typeof result === "string") {
						pushToolResult(result)
					} else {
						pushToolResult(result)
					}
					return
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error)
					pushToolResult(
						`<file><path>${relPath}</path><error>Error reading image file: ${errorMsg}</error></file>`,
					)
					await handleError(
						`reading image file ${relPath}`,
						error instanceof Error ? error : new Error(errorMsg),
					)
					return
				}
			}

			// Check if it's a supported binary format that can be processed
			if (supportedBinaryFormats && supportedBinaryFormats.includes(fileExtension)) {
				// For supported binary formats (.pdf, .docx, .ipynb), continue to extractTextFromFile
				// Fall through to the normal extractTextFromFile processing below
			} else {
				// Handle unknown binary format
				const fileFormat = fileExtension.slice(1) || "bin"
				pushToolResult(
					`<file><path>${relPath}</path>\n<binary_file format="${fileFormat}">Binary file - content not displayed</binary_file>\n</file>`,
				)
				return
			}
		}

		// Handle specific line range reading (when line_range parameter is provided)
		if (lineRange) {
			// Validate line range against total lines
			if (lineRange.start > totalLines) {
				const errorMsg = `Invalid line range: start line ${lineRange.start} exceeds total lines ${totalLines}`
				pushToolResult(`<file><path>${relPath}</path><error>${errorMsg}</error></file>`)
				return
			}

			// Clamp end line to total lines
			const effectiveEnd = Math.min(lineRange.end, totalLines)
			const content = addLineNumbers(
				await readLines(fullPath, effectiveEnd - 1, lineRange.start - 1),
				lineRange.start,
			)
			const lineRangeAttr = ` lines="${lineRange.start}-${effectiveEnd}"`
			let xmlInfo = `<content${lineRangeAttr}>\n${content}</content>\n`

			// Add notice if there are more lines after this range
			if (effectiveEnd < totalLines) {
				const nextStart = effectiveEnd + 1
				const suggestedEnd = Math.min(effectiveEnd + (effectiveEnd - lineRange.start + 1), totalLines)
				xmlInfo += `<notice>Showing lines ${lineRange.start}-${effectiveEnd} of ${totalLines} total lines. To continue reading, use the read_file tool again with the line_range parameter starting at line ${nextStart} (e.g., <line_range>${nextStart}-${suggestedEnd}</line_range>)</notice>\n`
			}

			// Track file read
			await cline.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)

			// Return the result
			if (text) {
				const statusMessage = formatResponse.toolApprovedWithFeedback(text)
				pushToolResult(`${statusMessage}\n<file><path>${relPath}</path>\n${xmlInfo}</file>`)
			} else {
				pushToolResult(`<file><path>${relPath}</path>\n${xmlInfo}</file>`)
			}
			return
		}

		// Handle definitions-only mode
		if (maxReadFileLine === 0) {
			try {
				const defResult = await parseSourceCodeDefinitionsForFile(fullPath, cline.rooIgnoreController)
				if (defResult) {
					let xmlInfo = `<notice>Showing only definitions. Use standard read_file if you need to read actual content</notice>\n`
					pushToolResult(
						`<file><path>${relPath}</path>\n<list_code_definition_names>${defResult}</list_code_definition_names>\n${xmlInfo}</file>`,
					)
				}
			} catch (error) {
				if (error instanceof Error && error.message.startsWith("Unsupported language:")) {
					console.warn(`[simple_read_file] Warning: ${error.message}`)
				} else {
					console.error(
						`[simple_read_file] Unhandled error: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
			return
		}

		// Handle files exceeding line threshold
		if (maxReadFileLine > 0 && totalLines > maxReadFileLine) {
			const content = addLineNumbers(await readLines(fullPath, maxReadFileLine - 1, 0))
			const lineRangeAttr = ` lines="1-${maxReadFileLine}"`
			let xmlInfo = `<content${lineRangeAttr}>\n${content}</content>\n`

			try {
				const defResult = await parseSourceCodeDefinitionsForFile(fullPath, cline.rooIgnoreController)
				if (defResult) {
					xmlInfo += `<list_code_definition_names>${defResult}</list_code_definition_names>\n`
				}
				const nextStart = maxReadFileLine + 1
				const suggestedEnd = Math.min(maxReadFileLine * 2, totalLines)
				xmlInfo += `<notice>Showing lines 1-${maxReadFileLine} of ${totalLines} total lines. To continue reading, use the read_file tool again with the line_range parameter starting at line ${nextStart} (e.g., <line_range>${nextStart}-${suggestedEnd}</line_range>)</notice>\n`
				pushToolResult(`<file><path>${relPath}</path>\n${xmlInfo}</file>`)
			} catch (error) {
				if (error instanceof Error && error.message.startsWith("Unsupported language:")) {
					console.warn(`[simple_read_file] Warning: ${error.message}`)
				} else {
					console.error(
						`[simple_read_file] Unhandled error: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
			return
		}

		// Handle normal file read
		const content = await extractTextFromFile(fullPath)
		const lineRangeAttr = ` lines="1-${totalLines}"`
		let xmlInfo = totalLines > 0 ? `<content${lineRangeAttr}>\n${content}</content>\n` : `<content/>`

		if (totalLines === 0) {
			xmlInfo += `<notice>File is empty</notice>\n`
		}

		// Track file read
		await cline.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)

		// Return the result
		if (text) {
			const statusMessage = formatResponse.toolApprovedWithFeedback(text)
			pushToolResult(`${statusMessage}\n<file><path>${relPath}</path>\n${xmlInfo}</file>`)
		} else {
			pushToolResult(`<file><path>${relPath}</path>\n${xmlInfo}</file>`)
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error)
		pushToolResult(`<file><path>${relPath}</path><error>Error reading file: ${errorMsg}</error></file>`)
		await handleError(`reading file ${relPath}`, error instanceof Error ? error : new Error(errorMsg))
	}
}

/**
 * Get description for the simple read file tool
 * @param blockName The name of the tool block
 * @param blockParams The parameters passed to the tool
 * @returns A description string for the tool use
 */
export function getSimpleReadFileToolDescription(blockName: string, blockParams: any): string {
	if (blockParams.path) {
		const lineRangeInfo = blockParams.line_range ? ` (lines ${blockParams.line_range})` : ""
		return `[${blockName} for '${blockParams.path}'${lineRangeInfo}]`
	} else {
		return `[${blockName} with missing path]`
	}
}
