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
import { parseXml } from "../../utils/xml"
import {
	DEFAULT_MAX_IMAGE_FILE_SIZE_MB,
	DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB,
	isSupportedImageFormat,
	validateImageForProcessing,
	processImageFile,
	ImageMemoryTracker,
} from "./helpers/imageHelpers"
import { regexSearchFiles } from "../../services/ripgrep"

/**
 * Escape XML special characters to prevent XML injection and parsing errors
 * @param unsafe - String that may contain XML special characters
 * @returns Escaped string safe for XML embedding
 */
function escapeXml(unsafe: string): string {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;")
}

export function getReadFileToolDescription(blockName: string, blockParams: any): string {
	// Handle both single path and multiple files via args
	if (blockParams.args) {
		try {
			const parsed = parseXml(blockParams.args) as any
			const files = Array.isArray(parsed.file) ? parsed.file : [parsed.file].filter(Boolean)
			const paths = files.map((f: any) => f?.path).filter(Boolean) as string[]

			if (paths.length === 0) {
				return `[${blockName} with no valid paths]`
			} else if (paths.length === 1) {
				// Modified part for single file
				return `[${blockName} for '${paths[0]}'. Reading multiple files at once is more efficient for the LLM. If other files are relevant to your current task, please read them simultaneously.]`
			} else if (paths.length <= 3) {
				const pathList = paths.map((p) => `'${p}'`).join(", ")
				return `[${blockName} for ${pathList}]`
			} else {
				return `[${blockName} for ${paths.length} files]`
			}
		} catch (error) {
			console.error("Failed to parse read_file args XML for description:", error)
			return `[${blockName} with unparsable args]`
		}
	} else if (blockParams.path) {
		// Fallback for legacy single-path usage
		// Modified part for single file (legacy)
		return `[${blockName} for '${blockParams.path}'. Reading multiple files at once is more efficient for the LLM. If other files are relevant to your current task, please read them simultaneously.]`
	} else {
		return `[${blockName} with missing path/args]`
	}
}

/**
 * Pattern 搜索結果介面
 */
interface PatternMatch {
	startLine: number
	endLine: number
	matchLine: number // 實際匹配的行號
	content: string // 帶行號的上下文（前後各 2 行）
}

/**
 * 在單個檔案中搜索 pattern
 * @param filePath - 完整檔案路徑
 * @param cwd - 工作目錄
 * @param pattern - Regex pattern
 * @param rooIgnoreController - Ignore 控制器
 * @returns 匹配結果數組
 */
async function searchPatternInFile(
	filePath: string,
	cwd: string,
	pattern: string,
	rooIgnoreController?: any,
): Promise<PatternMatch[]> {
	try {
		// 使用 ripgrep 搜索單個檔案
		const searchResults = await regexSearchFiles(cwd, filePath, pattern, undefined, rooIgnoreController)

		// 解析 ripgrep 輸出
		// 輸出格式範例：
		// # src/app.ts
		//  45 | export async function fetchData() {
		//  46 |   const response = await fetch(url)
		//  47 |   return response.json()
		// ----

		const matches: PatternMatch[] = []
		const lines = searchResults.split("\n")

		let currentMatchLines: { line: number; text: string }[] = []

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]

			// 跳過檔案名行
			if (line.startsWith("#")) {
				continue
			}

			// 分隔符表示一個匹配塊結束
			if (line.trim() === "----") {
				if (currentMatchLines.length > 0) {
					// 提取行號範圍
					const lineNumbers = currentMatchLines.map((l) => l.line)
					const startLine = Math.min(...lineNumbers)
					const endLine = Math.max(...lineNumbers)

					// 組合內容
					const content = currentMatchLines
						.map((l) => `${String(l.line).padStart(3, " ")} | ${l.text}`)
						.join("\n")

					// 假設匹配行在中間位置
					const matchLine = currentMatchLines[Math.floor(currentMatchLines.length / 2)].line

					matches.push({
						startLine,
						endLine,
						matchLine,
						content,
					})

					currentMatchLines = []
				}
				continue
			}

			// 解析行號和內容
			// 格式: " 45 | export async function fetchData() {"
			const match = line.match(/^\s*(\d+)\s+\|\s+(.*)$/)
			if (match) {
				const lineNumber = parseInt(match[1], 10)
				const lineText = match[2]
				currentMatchLines.push({ line: lineNumber, text: lineText })
			}
		}

		// 處理最後一個匹配塊（如果沒有結尾的分隔符）
		if (currentMatchLines.length > 0) {
			const lineNumbers = currentMatchLines.map((l) => l.line)
			const startLine = Math.min(...lineNumbers)
			const endLine = Math.max(...lineNumbers)
			const content = currentMatchLines.map((l) => `${String(l.line).padStart(3, " ")} | ${l.text}`).join("\n")
			const matchLine = currentMatchLines[Math.floor(currentMatchLines.length / 2)].line

			matches.push({
				startLine,
				endLine,
				matchLine,
				content,
			})
		}

		return matches
	} catch (error) {
		console.error(`[searchPatternInFile] Error searching pattern in ${filePath}:`, error)
		return []
	}
}

// Types
interface LineRange {
	start: number
	end: number
}

interface FileEntry {
	path?: string
	lineRanges?: LineRange[]
	pattern?: string // 新增：用於在檔案中搜索 regex pattern
}

// New interface to track file processing state
interface FileResult {
	path: string
	status: "approved" | "denied" | "blocked" | "error" | "pending"
	content?: string
	error?: string
	notice?: string
	lineRanges?: LineRange[]
	pattern?: string // Pattern for searching within the file
	xmlContent?: string // Final XML content for this file
	imageDataUrl?: string // Image data URL for image files
	feedbackText?: string // User feedback text from approval/denial
	feedbackImages?: any[] // User feedback images from approval/denial
}

export async function readFileTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	_removeClosingTag: RemoveClosingTag,
) {
	const argsXmlTag: string | undefined = block.params.args
	const legacyPath: string | undefined = block.params.path
	const legacyStartLineStr: string | undefined = block.params.start_line
	const legacyEndLineStr: string | undefined = block.params.end_line

	// Check if the current model supports images at the beginning
	const modelInfo = cline.api.getModel().info
	const supportsImages = modelInfo.supportsImages ?? false

	// Handle partial message first
	if (block.partial) {
		let filePath = ""
		// Prioritize args for partial, then legacy path
		if (argsXmlTag) {
			const match = argsXmlTag.match(/<file>.*?<path>([^<]+)<\/path>/s)
			if (match) filePath = match[1]
		}
		if (!filePath && legacyPath) {
			// If args didn't yield a path, try legacy
			filePath = legacyPath
		}

		const fullPath = filePath ? path.resolve(cline.cwd, filePath) : ""
		const sharedMessageProps: ClineSayTool = {
			tool: "readFile",
			path: getReadablePath(cline.cwd, filePath),
			isOutsideWorkspace: filePath ? isPathOutsideWorkspace(fullPath) : false,
		}
		const partialMessage = JSON.stringify({
			...sharedMessageProps,
			content: undefined,
		} satisfies ClineSayTool)
		await cline.ask("tool", partialMessage, block.partial).catch(() => {})
		return
	}

	const fileEntries: FileEntry[] = []

	if (argsXmlTag) {
		// Parse file entries from XML (new multi-file format)
		try {
			const parsed = parseXml(argsXmlTag) as any
			const files = Array.isArray(parsed.file) ? parsed.file : [parsed.file].filter(Boolean)

			for (const file of files) {
				if (!file.path) continue // Skip if no path in a file entry

				const fileEntry: FileEntry = {
					path: file.path,
					lineRanges: [],
					pattern: file.pattern, // 解析 pattern 參數
				}

				if (file.line_range) {
					const ranges = Array.isArray(file.line_range) ? file.line_range : [file.line_range]
					for (const range of ranges) {
						const match = String(range).match(/(\d+)-(\d+)/) // Ensure range is treated as string
						if (match) {
							const [, start, end] = match.map(Number)
							if (!isNaN(start) && !isNaN(end)) {
								fileEntry.lineRanges?.push({ start, end })
							}
						}
					}
				}
				fileEntries.push(fileEntry)
			}
		} catch (error) {
			const errorMessage = `Failed to parse read_file XML args: ${error instanceof Error ? error.message : String(error)}`
			await handleError("parsing read_file args", new Error(errorMessage))
			pushToolResult(`<files><error>${errorMessage}</error></files>`)
			return
		}
	} else if (legacyPath) {
		// Handle legacy single file path as a fallback
		console.warn("[readFileTool] Received legacy 'path' parameter. Consider updating to use 'args' structure.")

		const fileEntry: FileEntry = {
			path: legacyPath,
			lineRanges: [],
		}

		if (legacyStartLineStr && legacyEndLineStr) {
			const start = parseInt(legacyStartLineStr, 10)
			const end = parseInt(legacyEndLineStr, 10)
			if (!isNaN(start) && !isNaN(end) && start > 0 && end > 0) {
				fileEntry.lineRanges?.push({ start, end })
			} else {
				console.warn(
					`[readFileTool] Invalid legacy line range for ${legacyPath}: start='${legacyStartLineStr}', end='${legacyEndLineStr}'`,
				)
			}
		}
		fileEntries.push(fileEntry)
	}

	// If, after trying both new and legacy, no valid file entries are found.
	if (fileEntries.length === 0) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("read_file")
		const errorMsg = await cline.sayAndCreateMissingParamError("read_file", "args (containing valid file paths)")
		pushToolResult(`<files><error>${errorMsg}</error></files>`)
		return
	}

	// Create an array to track the state of each file
	const fileResults: FileResult[] = fileEntries.map((entry) => ({
		path: entry.path || "",
		status: "pending",
		lineRanges: entry.lineRanges,
		pattern: entry.pattern,
	}))

	// Function to update file result status
	const updateFileResult = (path: string, updates: Partial<FileResult>) => {
		const index = fileResults.findIndex((result) => result.path === path)
		if (index !== -1) {
			fileResults[index] = { ...fileResults[index], ...updates }
		}
	}

	try {
		// First validate all files and prepare for batch approval
		const filesToApprove: FileResult[] = []

		for (let i = 0; i < fileResults.length; i++) {
			const fileResult = fileResults[i]
			const relPath = fileResult.path
			const fullPath = path.resolve(cline.cwd, relPath)

			// Validate line ranges first
			if (fileResult.lineRanges) {
				let hasRangeError = false
				for (const range of fileResult.lineRanges) {
					if (range.start > range.end) {
						const errorMsg = "Invalid line range: end line cannot be less than start line"
						updateFileResult(relPath, {
							status: "blocked",
							error: errorMsg,
							xmlContent: `<file><path>${relPath}</path><error>Error reading file: ${errorMsg}</error></file>`,
						})
						await handleError(`reading file ${relPath}`, new Error(errorMsg))
						hasRangeError = true
						break
					}
					if (isNaN(range.start) || isNaN(range.end)) {
						const errorMsg = "Invalid line range values"
						updateFileResult(relPath, {
							status: "blocked",
							error: errorMsg,
							xmlContent: `<file><path>${relPath}</path><error>Error reading file: ${errorMsg}</error></file>`,
						})
						await handleError(`reading file ${relPath}`, new Error(errorMsg))
						hasRangeError = true
						break
					}
				}
				if (hasRangeError) continue
			}

			// Then check RooIgnore validation
			if (fileResult.status === "pending") {
				const accessAllowed = cline.rooIgnoreController?.validateAccess(relPath)
				if (!accessAllowed) {
					await cline.say("rooignore_error", relPath)
					const errorMsg = formatResponse.rooIgnoreError(relPath)
					updateFileResult(relPath, {
						status: "blocked",
						error: errorMsg,
						xmlContent: `<file><path>${relPath}</path><error>${errorMsg}</error></file>`,
					})
					continue
				}

				// Add to files that need approval
				filesToApprove.push(fileResult)
			}
		}

		// Handle batch approval if there are multiple files to approve
		if (filesToApprove.length > 1) {
			const { maxReadFileLine = -1 } = (await cline.providerRef.deref()?.getState()) ?? {}

			// Prepare batch file data
			const batchFiles = filesToApprove.map((fileResult) => {
				const relPath = fileResult.path
				const fullPath = path.resolve(cline.cwd, relPath)
				const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

				// Create line snippet for this file
				let lineSnippet = ""
				if (fileResult.lineRanges && fileResult.lineRanges.length > 0) {
					const ranges = fileResult.lineRanges.map((range) =>
						t("tools:readFile.linesRange", { start: range.start, end: range.end }),
					)
					lineSnippet = ranges.join(", ")
				} else if (maxReadFileLine === 0) {
					lineSnippet = t("tools:readFile.definitionsOnly")
				} else if (maxReadFileLine > 0) {
					lineSnippet = t("tools:readFile.maxLines", { max: maxReadFileLine })
				}

				const readablePath = getReadablePath(cline.cwd, relPath)
				const key = `${readablePath}${lineSnippet ? ` (${lineSnippet})` : ""}`

				return {
					path: readablePath,
					lineSnippet,
					isOutsideWorkspace,
					key,
					content: fullPath, // Include full path for content
				}
			})

			const completeMessage = JSON.stringify({
				tool: "readFile",
				batchFiles,
			} satisfies ClineSayTool)

			const { response, text, images } = await cline.ask("tool", completeMessage, false)

			// Process batch response
			if (response === "yesButtonClicked") {
				// Approve all files
				if (text) {
					await cline.say("user_feedback", text, images)
				}
				filesToApprove.forEach((fileResult) => {
					updateFileResult(fileResult.path, {
						status: "approved",
						feedbackText: text,
						feedbackImages: images,
					})
				})
			} else if (response === "noButtonClicked") {
				// Deny all files
				if (text) {
					await cline.say("user_feedback", text, images)
				}
				cline.didRejectTool = true
				filesToApprove.forEach((fileResult) => {
					updateFileResult(fileResult.path, {
						status: "denied",
						xmlContent: `<file><path>${fileResult.path}</path><status>Denied by user</status></file>`,
						feedbackText: text,
						feedbackImages: images,
					})
				})
			} else {
				// Handle individual permissions from objectResponse
				// if (text) {
				// 	await cline.say("user_feedback", text, images)
				// }

				try {
					const individualPermissions = JSON.parse(text || "{}")
					let hasAnyDenial = false

					batchFiles.forEach((batchFile, index) => {
						const fileResult = filesToApprove[index]
						const approved = individualPermissions[batchFile.key] === true

						if (approved) {
							updateFileResult(fileResult.path, {
								status: "approved",
							})
						} else {
							hasAnyDenial = true
							updateFileResult(fileResult.path, {
								status: "denied",
								xmlContent: `<file><path>${fileResult.path}</path><status>Denied by user</status></file>`,
							})
						}
					})

					if (hasAnyDenial) {
						cline.didRejectTool = true
					}
				} catch (error) {
					// Fallback: if JSON parsing fails, deny all files
					console.error("Failed to parse individual permissions:", error)
					cline.didRejectTool = true
					filesToApprove.forEach((fileResult) => {
						updateFileResult(fileResult.path, {
							status: "denied",
							xmlContent: `<file><path>${fileResult.path}</path><status>Denied by user</status></file>`,
						})
					})
				}
			}
		} else if (filesToApprove.length === 1) {
			// Handle single file approval (existing logic)
			const fileResult = filesToApprove[0]
			const relPath = fileResult.path
			const fullPath = path.resolve(cline.cwd, relPath)
			const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)
			const { maxReadFileLine = -1 } = (await cline.providerRef.deref()?.getState()) ?? {}

			// Create line snippet for approval message
			let lineSnippet = ""
			if (fileResult.lineRanges && fileResult.lineRanges.length > 0) {
				const ranges = fileResult.lineRanges.map((range) =>
					t("tools:readFile.linesRange", { start: range.start, end: range.end }),
				)
				lineSnippet = ranges.join(", ")
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
				// Handle both messageResponse and noButtonClicked with text
				if (text) {
					await cline.say("user_feedback", text, images)
				}
				cline.didRejectTool = true

				updateFileResult(relPath, {
					status: "denied",
					xmlContent: `<file><path>${relPath}</path><status>Denied by user</status></file>`,
					feedbackText: text,
					feedbackImages: images,
				})
			} else {
				// Handle yesButtonClicked with text
				if (text) {
					await cline.say("user_feedback", text, images)
				}

				updateFileResult(relPath, {
					status: "approved",
					feedbackText: text,
					feedbackImages: images,
				})
			}
		}

		// Track total image memory usage across all files
		const imageMemoryTracker = new ImageMemoryTracker()
		const state = await cline.providerRef.deref()?.getState()
		const {
			maxReadFileLine = -1,
			maxImageFileSize = DEFAULT_MAX_IMAGE_FILE_SIZE_MB,
			maxTotalImageSize = DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB,
		} = state ?? {}

		// Then process only approved files
		for (const fileResult of fileResults) {
			// Skip files that weren't approved
			if (fileResult.status !== "approved") {
				continue
			}

			const relPath = fileResult.path
			const fullPath = path.resolve(cline.cwd, relPath)

			// Process approved files
			try {
				const [totalLines, isBinary] = await Promise.all([countFileLines(fullPath), isBinaryFile(fullPath)])

				// Handle binary files (but allow specific file types that extractTextFromFile can handle)
				if (isBinary) {
					const fileExtension = path.extname(relPath).toLowerCase()
					const supportedBinaryFormats = getSupportedBinaryFormats()

					// Check if it's a supported image format
					if (isSupportedImageFormat(fileExtension)) {
						try {
							// Validate image for processing
							const validationResult = await validateImageForProcessing(
								fullPath,
								supportsImages,
								maxImageFileSize,
								maxTotalImageSize,
								imageMemoryTracker.getTotalMemoryUsed(),
							)

							if (!validationResult.isValid) {
								// Track file read
								await cline.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)

								updateFileResult(relPath, {
									xmlContent: `<file><path>${relPath}</path>\n<notice>${validationResult.notice}</notice>\n</file>`,
								})
								continue
							}

							// Process the image
							const imageResult = await processImageFile(fullPath)

							// Track memory usage for this image
							imageMemoryTracker.addMemoryUsage(imageResult.sizeInMB)

							// Track file read
							await cline.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)

							// Store image data URL separately - NOT in XML
							updateFileResult(relPath, {
								xmlContent: `<file><path>${relPath}</path>\n<notice>${imageResult.notice}</notice>\n</file>`,
								imageDataUrl: imageResult.dataUrl,
							})
							continue
						} catch (error) {
							const errorMsg = error instanceof Error ? error.message : String(error)
							updateFileResult(relPath, {
								status: "error",
								error: `Error reading image file: ${errorMsg}`,
								xmlContent: `<file><path>${relPath}</path><error>Error reading image file: ${errorMsg}</error></file>`,
							})
							await handleError(
								`reading image file ${relPath}`,
								error instanceof Error ? error : new Error(errorMsg),
							)
							continue
						}
					}

					// Check if it's a supported binary format that can be processed
					if (supportedBinaryFormats && supportedBinaryFormats.includes(fileExtension)) {
						// For supported binary formats (.pdf, .docx, .ipynb), continue to extractTextFromFile
						// Fall through to the normal extractTextFromFile processing below
					} else {
						// Handle unknown binary format
						const fileFormat = fileExtension.slice(1) || "bin" // Remove the dot, fallback to "bin"
						updateFileResult(relPath, {
							notice: `Binary file format: ${fileFormat}`,
							xmlContent: `<file><path>${relPath}</path>\n<binary_file format="${fileFormat}">Binary file - content not displayed</binary_file>\n</file>`,
						})
						continue
					}
				}

				// Handle pattern + line_range combination
				if (fileResult.pattern && fileResult.lineRanges && fileResult.lineRanges.length > 0) {
					// Search for pattern within specified line ranges
					const matches = await searchPatternInFile(
						fullPath,
						cline.cwd,
						fileResult.pattern,
						cline.rooIgnoreController,
					)

					// Filter matches to only include those within specified line ranges
					const filteredMatches = matches.filter((match) => {
						return fileResult.lineRanges!.some(
							(range) => match.matchLine >= range.start && match.matchLine <= range.end,
						)
					})

					// Track file read
					await cline.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)

					if (filteredMatches.length === 0) {
						const rangesStr = fileResult.lineRanges.map((r) => `${r.start}-${r.end}`).join(", ")
						const xmlInfo = `<metadata>
<total_lines>${totalLines}</total_lines>
<pattern>${escapeXml(fileResult.pattern)}</pattern>
<line_ranges>${rangesStr}</line_ranges>
<matches_count>0</matches_count>
</metadata>
<notice>No matches found for pattern "${escapeXml(fileResult.pattern)}" within line ranges: ${rangesStr}</notice>`

						updateFileResult(relPath, {
							xmlContent: `<file><path>${relPath}</path>\n${xmlInfo}\n</file>`,
						})
						continue
					}

					// Limit results
					const limitedMatches = filteredMatches.slice(0, 20)
					const hasMore = filteredMatches.length > 20
					const rangesStr = fileResult.lineRanges.map((r) => `${r.start}-${r.end}`).join(", ")

					let xmlInfo = `<metadata>
<total_lines>${totalLines}</total_lines>
<pattern>${escapeXml(fileResult.pattern)}</pattern>
<line_ranges>${rangesStr}</line_ranges>
<matches_count>${filteredMatches.length}</matches_count>
${hasMore ? `<showing_matches>20</showing_matches>` : ""}
</metadata>\n`

					// Add match results
					limitedMatches.forEach((match) => {
						const lineAttr = ` lines="${match.startLine}-${match.endLine}"`
						xmlInfo += `<search_result${lineAttr}>\n${match.content}\n</search_result>\n`
					})

					// Add notice
					const firstMatch = limitedMatches[0]
					const exampleStart = Math.max(1, firstMatch.matchLine - 10)
					const exampleEnd = Math.min(totalLines, firstMatch.matchLine + 10)

					let notice = `Found ${filteredMatches.length} match(es) within line ranges: ${rangesStr}${hasMore ? `, showing first 20` : ""}.`
					notice += `\n\nTo read full context around a match, use:\n`
					notice += `<read_file>\n<args>\n  <file>\n    <path>${relPath}</path>\n`
					notice += `    <line_range>${exampleStart}-${exampleEnd}</line_range>\n`
					notice += `  </file>\n</args>\n</read_file>`

					xmlInfo += `<notice>${notice}</notice>`

					updateFileResult(relPath, {
						xmlContent: `<file><path>${relPath}</path>\n${xmlInfo}\n</file>`,
					})
					continue
				}

				// Handle range reads only (no pattern search)
				if (fileResult.lineRanges && fileResult.lineRanges.length > 0) {
					const rangeResults: string[] = []
					for (const range of fileResult.lineRanges) {
						const content = addLineNumbers(
							await readLines(fullPath, range.end - 1, range.start - 1),
							range.start,
						)
						const lineRangeAttr = ` lines="${range.start}-${range.end}"`
						rangeResults.push(`<content${lineRangeAttr}>\n${content}</content>`)
					}
					updateFileResult(relPath, {
						xmlContent: `<file><path>${relPath}</path>\n${rangeResults.join("\n")}\n</file>`,
					})
					continue
				}

				// Handle pattern search only (entire file)
				if (fileResult.pattern) {
					const matches = await searchPatternInFile(
						fullPath,
						cline.cwd,
						fileResult.pattern,
						cline.rooIgnoreController,
					)

					// Track file read
					await cline.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)

					if (matches.length === 0) {
						const xmlInfo = `<metadata>
<total_lines>${totalLines}</total_lines>
<pattern>${escapeXml(fileResult.pattern)}</pattern>
<matches_count>0</matches_count>
</metadata>
<notice>No matches found for pattern "${escapeXml(fileResult.pattern)}"</notice>`

						updateFileResult(relPath, {
							xmlContent: `<file><path>${relPath}</path>\n${xmlInfo}\n</file>`,
						})
						continue
					}

					// 限制返回的匹配數量（最多 20 個）
					const limitedMatches = matches.slice(0, 20)
					const hasMore = matches.length > 20

					let xmlInfo = `<metadata>
<total_lines>${totalLines}</total_lines>
<pattern>${escapeXml(fileResult.pattern)}</pattern>
<matches_count>${matches.length}</matches_count>
${hasMore ? `<showing_matches>20</showing_matches>` : ""}
</metadata>\n`

					// 添加每個匹配的內容
					limitedMatches.forEach((match, idx) => {
						const lineAttr = ` lines="${match.startLine}-${match.endLine}"`
						xmlInfo += `<search_result${lineAttr}>\n${match.content}\n</search_result>\n`
					})

					// 添加提示信息
					const firstMatch = limitedMatches[0]
					const exampleStart = Math.max(1, firstMatch.matchLine - 10)
					const exampleEnd = Math.min(totalLines, firstMatch.matchLine + 10)

					let notice = `Found ${matches.length} match(es)${hasMore ? `, showing first 20` : ""}.`
					notice += `\n\nTo read full context around a match, use line_range:\n`
					notice += `<read_file>\n<args>\n  <file>\n    <path>${relPath}</path>\n`
					notice += `    <line_range>${exampleStart}-${exampleEnd}</line_range>  <!-- Context around first match -->\n`
					notice += `  </file>\n</args>\n</read_file>`

					xmlInfo += `<notice>${notice}</notice>`

					updateFileResult(relPath, {
						xmlContent: `<file><path>${relPath}</path>\n${xmlInfo}\n</file>`,
					})
					continue
				}

				// Auto-limit large files without line_range to protect context (Option G)
				// This helps weak models learn to use line_range by showing them the correct syntax
				if (totalLines > 300 && (!fileResult.lineRanges || fileResult.lineRanges.length === 0)) {
					const autoLimitLines = 100
					const content = addLineNumbers(await readLines(fullPath, autoLimitLines - 1, 0), 1)
					const lineRangeAttr = ` lines="1-${autoLimitLines}"`
					let xmlInfo = `<metadata>\n<total_lines>${totalLines}</total_lines>\n<showing_lines>1-${autoLimitLines}</showing_lines>\n</metadata>\n`
					xmlInfo += `<content${lineRangeAttr}>\n${content}</content>\n`

					// Try to get code definitions to help model locate specific sections
					try {
						const defResult = await parseSourceCodeDefinitionsForFile(fullPath, cline.rooIgnoreController)
						if (defResult) {
							xmlInfo += `<list_code_definition_names>${defResult}</list_code_definition_names>\n`
						}
					} catch (error) {
						// Silently ignore definition parsing errors for non-supported languages
						if (error instanceof Error && !error.message.startsWith("Unsupported language:")) {
							console.warn(`[read_file] Warning parsing definitions: ${error.message}`)
						}
					}

					// Educational notice to teach weak models how to use line_range
					const educationalNotice = `⚠️ This file has ${totalLines} lines (exceeds 300-line threshold).
Showing first ${autoLimitLines} lines only to preserve context.

To read specific sections, use line_range parameter:
<read_file>
<args>
  <file>
    <path>${relPath}</path>
    <line_range>1-100</line_range>      <!-- First 100 lines -->
    <line_range>450-550</line_range>    <!-- Lines around specific function -->
  </file>
</args>
</read_file>

You can specify multiple <line_range> elements to read non-adjacent sections efficiently.`

					xmlInfo += `<notice>${educationalNotice}</notice>\n`

					// Track file read
					await cline.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)

					updateFileResult(relPath, {
						xmlContent: `<file><path>${relPath}</path>\n${xmlInfo}</file>`,
					})
					continue
				}

				// Handle definitions-only mode
				if (maxReadFileLine === 0) {
					try {
						const defResult = await parseSourceCodeDefinitionsForFile(fullPath, cline.rooIgnoreController)
						if (defResult) {
							let xmlInfo = `<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines. Use line_range if you need to read more lines</notice>\n`
							updateFileResult(relPath, {
								xmlContent: `<file><path>${relPath}</path>\n<list_code_definition_names>${defResult}</list_code_definition_names>\n${xmlInfo}</file>`,
							})
						}
					} catch (error) {
						if (error instanceof Error && error.message.startsWith("Unsupported language:")) {
							console.warn(`[read_file] Warning: ${error.message}`)
						} else {
							console.error(
								`[read_file] Unhandled error: ${error instanceof Error ? error.message : String(error)}`,
							)
						}
					}
					continue
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
						xmlInfo += `<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines. Use line_range if you need to read more lines</notice>\n`
						updateFileResult(relPath, {
							xmlContent: `<file><path>${relPath}</path>\n${xmlInfo}</file>`,
						})
					} catch (error) {
						if (error instanceof Error && error.message.startsWith("Unsupported language:")) {
							console.warn(`[read_file] Warning: ${error.message}`)
						} else {
							console.error(
								`[read_file] Unhandled error: ${error instanceof Error ? error.message : String(error)}`,
							)
						}
					}
					continue
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

				updateFileResult(relPath, {
					xmlContent: `<file><path>${relPath}</path>\n${xmlInfo}</file>`,
				})
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error)
				updateFileResult(relPath, {
					status: "error",
					error: `Error reading file: ${errorMsg}`,
					xmlContent: `<file><path>${relPath}</path><error>Error reading file: ${errorMsg}</error></file>`,
				})
				await handleError(`reading file ${relPath}`, error instanceof Error ? error : new Error(errorMsg))
			}
		}

		// Generate final XML result from all file results
		const xmlResults = fileResults.filter((result) => result.xmlContent).map((result) => result.xmlContent)
		const filesXml = `<files>\n${xmlResults.join("\n")}\n</files>`

		// Collect all image data URLs from file results
		const fileImageUrls = fileResults
			.filter((result) => result.imageDataUrl)
			.map((result) => result.imageDataUrl as string)

		// Process all feedback in a unified way without branching
		let statusMessage = ""
		let feedbackImages: any[] = []

		// Handle denial with feedback (highest priority)
		const deniedWithFeedback = fileResults.find((result) => result.status === "denied" && result.feedbackText)

		if (deniedWithFeedback && deniedWithFeedback.feedbackText) {
			statusMessage = formatResponse.toolDeniedWithFeedback(deniedWithFeedback.feedbackText)
			feedbackImages = deniedWithFeedback.feedbackImages || []
		}
		// Handle generic denial
		else if (cline.didRejectTool) {
			statusMessage = formatResponse.toolDenied()
		}
		// Handle approval with feedback
		else {
			const approvedWithFeedback = fileResults.find(
				(result) => result.status === "approved" && result.feedbackText,
			)

			if (approvedWithFeedback && approvedWithFeedback.feedbackText) {
				statusMessage = formatResponse.toolApprovedWithFeedback(approvedWithFeedback.feedbackText)
				feedbackImages = approvedWithFeedback.feedbackImages || []
			}
		}

		// Combine all images: feedback images first, then file images
		const allImages = [...feedbackImages, ...fileImageUrls]

		// Re-check if the model supports images before including them, in case it changed during execution.
		const finalModelSupportsImages = cline.api.getModel().info.supportsImages ?? false
		const imagesToInclude = finalModelSupportsImages ? allImages : []

		// Push the result with appropriate formatting
		if (statusMessage || imagesToInclude.length > 0) {
			// Always use formatResponse.toolResult when we have a status message or images
			const result = formatResponse.toolResult(
				statusMessage || filesXml,
				imagesToInclude.length > 0 ? imagesToInclude : undefined,
			)

			// Handle different return types from toolResult
			if (typeof result === "string") {
				if (statusMessage) {
					pushToolResult(`${result}\n${filesXml}`)
				} else {
					pushToolResult(result)
				}
			} else {
				// For block-based results, append the files XML as a text block if not already included
				if (statusMessage) {
					const textBlock = { type: "text" as const, text: filesXml }
					pushToolResult([...result, textBlock])
				} else {
					pushToolResult(result)
				}
			}
		} else {
			// No images or status message, just push the files XML
			pushToolResult(filesXml)
		}
	} catch (error) {
		// Handle all errors using per-file format for consistency
		const relPath = fileEntries[0]?.path || "unknown"
		const errorMsg = error instanceof Error ? error.message : String(error)

		// If we have file results, update the first one with the error
		if (fileResults.length > 0) {
			updateFileResult(relPath, {
				status: "error",
				error: `Error reading file: ${errorMsg}`,
				xmlContent: `<file><path>${relPath}</path><error>Error reading file: ${errorMsg}</error></file>`,
			})
		}

		await handleError(`reading file ${relPath}`, error instanceof Error ? error : new Error(errorMsg))

		// Generate final XML result from all file results
		const xmlResults = fileResults.filter((result) => result.xmlContent).map((result) => result.xmlContent)

		pushToolResult(`<files>\n${xmlResults.join("\n")}\n</files>`)
	}
}
