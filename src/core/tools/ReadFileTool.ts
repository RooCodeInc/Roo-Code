import path from "path"
import * as fs from "fs/promises"
import { isBinaryFile } from "isbinaryfile"
import type { FileEntry, ReadMode, IndentationConfig } from "@roo-code/types"
import { isNativeProtocol, ANTHROPIC_DEFAULT_MAX_TOKENS } from "@roo-code/types"

import { Task } from "../task/Task"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { getModelMaxOutputTokens } from "../../shared/api"
import { t } from "../../i18n"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { getReadablePath } from "../../utils/path"
import { countFileLines } from "../../integrations/misc/line-counter"
import { readFileContent } from "../../integrations/misc/read-file-content"
import { extractTextFromFile, addLineNumbers, getSupportedBinaryFormats } from "../../integrations/misc/extract-text"
import { parseXml } from "../../utils/xml"
import { resolveToolProtocol } from "../../utils/resolveToolProtocol"
import {
	DEFAULT_MAX_IMAGE_FILE_SIZE_MB,
	DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB,
	isSupportedImageFormat,
	validateImageForProcessing,
	processImageFile,
	ImageMemoryTracker,
} from "./helpers/imageHelpers"
import { FILE_READ_BUDGET_PERCENT, readFileWithTokenBudget } from "./helpers/fileTokenBudget"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"

interface FileResult {
	path: string
	status: "approved" | "denied" | "blocked" | "error" | "pending"
	content?: string
	error?: string
	notice?: string
	// Slice/indentation mode parameters
	offset?: number
	mode?: ReadMode
	indentation?: IndentationConfig
	xmlContent?: string
	nativeContent?: string
	imageDataUrl?: string
	feedbackText?: string
	feedbackImages?: any[]
}

export class ReadFileTool extends BaseTool<"read_file"> {
	readonly name = "read_file" as const

	parseLegacy(params: Partial<Record<string, string>>): { files: FileEntry[] } {
		const argsXmlTag = params.args

		const fileEntries: FileEntry[] = []

		// XML args format - just parse paths, advanced features are native-only
		if (argsXmlTag) {
			const parsed = parseXml(argsXmlTag) as any
			const files = Array.isArray(parsed.file) ? parsed.file : [parsed.file].filter(Boolean)

			for (const file of files) {
				if (!file.path) continue
				fileEntries.push({ path: file.path })
			}

			return { files: fileEntries }
		}

		return { files: fileEntries }
	}

	async execute(params: { files: FileEntry[] }, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult } = callbacks
		const fileEntries = params.files
		const modelInfo = task.api.getModel().info
		// Use the task's locked protocol for consistent output formatting throughout the task
		const protocol = resolveToolProtocol(task.apiConfiguration, modelInfo, task.taskToolProtocol)
		const useNative = isNativeProtocol(protocol)

		if (!fileEntries || fileEntries.length === 0) {
			task.consecutiveMistakeCount++
			task.recordToolError("read_file")
			const errorMsg = await task.sayAndCreateMissingParamError("read_file", "args (containing valid file paths)")
			const errorResult = useNative ? `Error: ${errorMsg}` : `<files><error>${errorMsg}</error></files>`
			pushToolResult(errorResult)
			return
		}

		// Enforce maxConcurrentFileReads limit
		const { maxConcurrentFileReads = 5 } = (await task.providerRef.deref()?.getState()) ?? {}
		if (fileEntries.length > maxConcurrentFileReads) {
			task.consecutiveMistakeCount++
			task.recordToolError("read_file")
			const errorMsg = `Too many files requested. You attempted to read ${fileEntries.length} files, but the concurrent file reads limit is ${maxConcurrentFileReads}. Please read files in batches of ${maxConcurrentFileReads} or fewer.`
			await task.say("error", errorMsg)
			const errorResult = useNative ? `Error: ${errorMsg}` : `<files><error>${errorMsg}</error></files>`
			pushToolResult(errorResult)
			return
		}

		const supportsImages = modelInfo.supportsImages ?? false

		const fileResults: FileResult[] = fileEntries.map((entry) => ({
			path: entry.path,
			status: "pending",
			// Map slice/indentation mode parameters
			offset: entry.offset,
			mode: entry.mode,
			indentation: entry.indentation,
		}))

		const updateFileResult = (filePath: string, updates: Partial<FileResult>) => {
			const index = fileResults.findIndex((result) => result.path === filePath)
			if (index !== -1) {
				fileResults[index] = { ...fileResults[index], ...updates }
			}
		}

		try {
			const filesToApprove: FileResult[] = []

			for (const fileResult of fileResults) {
				const relPath = fileResult.path

				if (fileResult.status === "pending") {
					const accessAllowed = task.rooIgnoreController?.validateAccess(relPath)
					if (!accessAllowed) {
						await task.say("rooignore_error", relPath)
						const errorMsg = formatResponse.rooIgnoreError(relPath)
						updateFileResult(relPath, {
							status: "blocked",
							error: errorMsg,
							xmlContent: `<file><path>${relPath}</path><error>${errorMsg}</error></file>`,
							nativeContent: `File: ${relPath}\nError: ${errorMsg}`,
						})
						continue
					}

					filesToApprove.push(fileResult)
				}
			}

			if (filesToApprove.length > 1) {
				const { maxReadFileLine = -1 } = (await task.providerRef.deref()?.getState()) ?? {}

				const batchFiles = filesToApprove.map((fileResult) => {
					const relPath = fileResult.path
					const fullPath = path.resolve(task.cwd, relPath)
					const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

					let lineSnippet = ""
					const startLine = fileResult.offset ?? 1
					if (maxReadFileLine > 0) {
						// Show the expected line range (start to start + maxReadFileLine - 1)
						const endLine = startLine + maxReadFileLine - 1
						lineSnippet = t("tools:readFile.linesRange", { start: startLine, end: endLine })
					} else if (startLine > 1) {
						// No line limit but reading from offset
						lineSnippet = t("tools:readFile.startingFromLine", { start: startLine })
					}

					const readablePath = getReadablePath(task.cwd, relPath)
					const key = `${readablePath}${lineSnippet ? ` (${lineSnippet})` : ""}`

					return { path: readablePath, lineSnippet, isOutsideWorkspace, key, content: fullPath }
				})

				const completeMessage = JSON.stringify({ tool: "readFile", batchFiles } satisfies ClineSayTool)
				const { response, text, images } = await task.ask("tool", completeMessage, false)

				if (response === "yesButtonClicked") {
					if (text) await task.say("user_feedback", text, images)
					filesToApprove.forEach((fileResult) => {
						updateFileResult(fileResult.path, {
							status: "approved",
							feedbackText: text,
							feedbackImages: images,
						})
					})
				} else if (response === "noButtonClicked") {
					if (text) await task.say("user_feedback", text, images)
					task.didRejectTool = true
					filesToApprove.forEach((fileResult) => {
						updateFileResult(fileResult.path, {
							status: "denied",
							xmlContent: `<file><path>${fileResult.path}</path><status>Denied by user</status></file>`,
							nativeContent: `File: ${fileResult.path}\nStatus: Denied by user`,
							feedbackText: text,
							feedbackImages: images,
						})
					})
				} else {
					try {
						const individualPermissions = JSON.parse(text || "{}")
						let hasAnyDenial = false

						batchFiles.forEach((batchFile, index) => {
							const fileResult = filesToApprove[index]
							const approved = individualPermissions[batchFile.key] === true

							if (approved) {
								updateFileResult(fileResult.path, { status: "approved" })
							} else {
								hasAnyDenial = true
								updateFileResult(fileResult.path, {
									status: "denied",
									xmlContent: `<file><path>${fileResult.path}</path><status>Denied by user</status></file>`,
									nativeContent: `File: ${fileResult.path}\nStatus: Denied by user`,
								})
							}
						})

						if (hasAnyDenial) task.didRejectTool = true
					} catch (error) {
						console.error("Failed to parse individual permissions:", error)
						task.didRejectTool = true
						filesToApprove.forEach((fileResult) => {
							updateFileResult(fileResult.path, {
								status: "denied",
								xmlContent: `<file><path>${fileResult.path}</path><status>Denied by user</status></file>`,
								nativeContent: `File: ${fileResult.path}\nStatus: Denied by user`,
							})
						})
					}
				}
			} else if (filesToApprove.length === 1) {
				const fileResult = filesToApprove[0]
				const relPath = fileResult.path
				const fullPath = path.resolve(task.cwd, relPath)
				const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)
				const { maxReadFileLine = -1 } = (await task.providerRef.deref()?.getState()) ?? {}

				let lineSnippet = ""
				const startLine = fileResult.offset ?? 1
				if (maxReadFileLine > 0) {
					// Show the expected line range (start to start + maxReadFileLine - 1)
					const endLine = startLine + maxReadFileLine - 1
					lineSnippet = t("tools:readFile.linesRange", { start: startLine, end: endLine })
				} else if (startLine > 1) {
					// No line limit but reading from offset
					lineSnippet = t("tools:readFile.startingFromLine", { start: startLine })
				}

				const completeMessage = JSON.stringify({
					tool: "readFile",
					path: getReadablePath(task.cwd, relPath),
					isOutsideWorkspace,
					content: fullPath,
					reason: lineSnippet,
				} satisfies ClineSayTool)

				const { response, text, images } = await task.ask("tool", completeMessage, false)

				if (response !== "yesButtonClicked") {
					if (text) await task.say("user_feedback", text, images)
					task.didRejectTool = true
					updateFileResult(relPath, {
						status: "denied",
						xmlContent: `<file><path>${relPath}</path><status>Denied by user</status></file>`,
						nativeContent: `File: ${relPath}\nStatus: Denied by user`,
						feedbackText: text,
						feedbackImages: images,
					})
				} else {
					if (text) await task.say("user_feedback", text, images)
					updateFileResult(relPath, { status: "approved", feedbackText: text, feedbackImages: images })
				}
			}

			const imageMemoryTracker = new ImageMemoryTracker()
			const state = await task.providerRef.deref()?.getState()
			const {
				maxReadFileLine = -1,
				maxImageFileSize = DEFAULT_MAX_IMAGE_FILE_SIZE_MB,
				maxTotalImageSize = DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB,
			} = state ?? {}

			for (const fileResult of fileResults) {
				if (fileResult.status !== "approved") continue

				const relPath = fileResult.path
				const fullPath = path.resolve(task.cwd, relPath)

				try {
					// Check if the path is a directory before attempting to read it
					const stats = await fs.stat(fullPath)
					if (stats.isDirectory()) {
						const errorMsg = `Cannot read '${relPath}' because it is a directory. To view the contents of a directory, use the list_files tool instead.`
						updateFileResult(relPath, {
							status: "error",
							error: errorMsg,
							xmlContent: `<file><path>${relPath}</path><error>Error reading file: ${errorMsg}</error></file>`,
							nativeContent: `File: ${relPath}\nError: Error reading file: ${errorMsg}`,
						})
						await task.say("error", `Error reading file ${relPath}: ${errorMsg}`)
						continue
					}

					const [totalLines, isBinary] = await Promise.all([countFileLines(fullPath), isBinaryFile(fullPath)])

					if (isBinary) {
						const fileExtension = path.extname(relPath).toLowerCase()
						const supportedBinaryFormats = getSupportedBinaryFormats()

						if (isSupportedImageFormat(fileExtension)) {
							try {
								const validationResult = await validateImageForProcessing(
									fullPath,
									supportsImages,
									maxImageFileSize,
									maxTotalImageSize,
									imageMemoryTracker.getTotalMemoryUsed(),
								)

								if (!validationResult.isValid) {
									await task.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)
									updateFileResult(relPath, {
										xmlContent: `<file><path>${relPath}</path>\n<notice>${validationResult.notice}</notice>\n</file>`,
										nativeContent: `File: ${relPath}\nNote: ${validationResult.notice}`,
									})
									continue
								}

								const imageResult = await processImageFile(fullPath)
								imageMemoryTracker.addMemoryUsage(imageResult.sizeInMB)
								await task.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)

								updateFileResult(relPath, {
									xmlContent: `<file><path>${relPath}</path>\n<notice>${imageResult.notice}</notice>\n</file>`,
									nativeContent: `File: ${relPath}\nNote: ${imageResult.notice}`,
									imageDataUrl: imageResult.dataUrl,
								})
								continue
							} catch (error) {
								const errorMsg = error instanceof Error ? error.message : String(error)
								updateFileResult(relPath, {
									status: "error",
									error: `Error reading image file: ${errorMsg}`,
									xmlContent: `<file><path>${relPath}</path><error>Error reading image file: ${errorMsg}</error></file>`,
									nativeContent: `File: ${relPath}\nError: Error reading image file: ${errorMsg}`,
								})
								await task.say("error", `Error reading image file ${relPath}: ${errorMsg}`)
								continue
							}
						}

						if (supportedBinaryFormats && supportedBinaryFormats.includes(fileExtension)) {
							// Use extractTextFromFile for supported binary formats (PDF, DOCX, etc.)
							try {
								const content = await extractTextFromFile(fullPath)
								const numberedContent = addLineNumbers(content)
								const lines = content.split("\n")
								const lineCount = lines.length
								const lineRangeAttr = lineCount > 0 ? ` lines="1-${lineCount}"` : ""

								await task.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)

								updateFileResult(relPath, {
									xmlContent:
										lineCount > 0
											? `<file><path>${relPath}</path>\n<content${lineRangeAttr}>\n${numberedContent}</content>\n</file>`
											: `<file><path>${relPath}</path>\n<content/><notice>File is empty</notice>\n</file>`,
									nativeContent:
										lineCount > 0
											? `File: ${relPath}\nLines 1-${lineCount}:\n${numberedContent}`
											: `File: ${relPath}\nNote: File is empty`,
								})
								continue
							} catch (error) {
								const errorMsg = error instanceof Error ? error.message : String(error)
								updateFileResult(relPath, {
									status: "error",
									error: `Error extracting text: ${errorMsg}`,
									xmlContent: `<file><path>${relPath}</path><error>Error extracting text: ${errorMsg}</error></file>`,
									nativeContent: `File: ${relPath}\nError: Error extracting text: ${errorMsg}`,
								})
								await task.say("error", `Error extracting text from ${relPath}: ${errorMsg}`)
								continue
							}
						} else {
							const fileFormat = fileExtension.slice(1) || "bin"
							updateFileResult(relPath, {
								notice: `Binary file format: ${fileFormat}`,
								xmlContent: `<file><path>${relPath}</path>\n<binary_file format="${fileFormat}">Binary file - content not displayed</binary_file>\n</file>`,
								nativeContent: `File: ${relPath}\nBinary file (${fileFormat}) - content not displayed`,
							})
							continue
						}
					}

					// Handle slice/indentation mode when offset or mode is specified
					if (fileResult.offset !== undefined || fileResult.mode !== undefined) {
						try {
							const result = await readFileContent({
								filePath: fullPath,
								offset: fileResult.offset,
								// limit is controlled by maxReadFileLine setting, not model input
								mode: fileResult.mode,
								indentation: fileResult.indentation,
								defaultLimit: maxReadFileLine > 0 ? maxReadFileLine : undefined,
							})

							await task.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)

							const modeLabel = fileResult.mode === "indentation" ? "indentation" : "slice"
							const { metadata } = result
							let xmlInfo = ""
							let nativeInfo = ""

							if (result.lineCount === 0) {
								xmlInfo = `<content/>\n<notice>No content returned (file may be empty or offset exceeds file length)</notice>\n`
								nativeInfo = `Note: No content returned (file may be empty or offset exceeds file length)`
							} else {
								const lineRangeAttr = ` lines="${metadata.startLine}-${metadata.endLine}"`
								xmlInfo = `<content mode="${modeLabel}"${lineRangeAttr}>\n${result.content}</content>\n`
								nativeInfo = `Lines ${metadata.startLine}-${metadata.endLine} (${modeLabel} mode):\n${result.content}`

								// Include structured metadata for LLM pagination awareness
								const metadataJson = JSON.stringify({
									totalLinesInFile: metadata.totalLinesInFile,
									linesReturned: metadata.linesReturned,
									startLine: metadata.startLine,
									endLine: metadata.endLine,
									hasMoreBefore: metadata.hasMoreBefore,
									hasMoreAfter: metadata.hasMoreAfter,
									linesBeforeStart: metadata.linesBeforeStart,
									linesAfterEnd: metadata.linesAfterEnd,
									truncatedByLimit: metadata.truncatedByLimit,
									lineLengthTruncations: metadata.lineLengthTruncations,
								})
								xmlInfo += `<metadata>${metadataJson}</metadata>\n`
								nativeInfo += `\n\n<metadata>${metadataJson}</metadata>`
							}

							updateFileResult(relPath, {
								xmlContent: `<file><path>${relPath}</path>\n${xmlInfo}</file>`,
								nativeContent: `File: ${relPath}\n${nativeInfo}`,
							})
							continue
						} catch (error) {
							const errorMsg = error instanceof Error ? error.message : String(error)
							updateFileResult(relPath, {
								status: "error",
								error: `Error reading file with ${fileResult.mode || "slice"} mode: ${errorMsg}`,
								xmlContent: `<file><path>${relPath}</path><error>Error reading file: ${errorMsg}</error></file>`,
								nativeContent: `File: ${relPath}\nError: Error reading file: ${errorMsg}`,
							})
							await task.say("error", `Error reading file ${relPath}: ${errorMsg}`)
							continue
						}
					}

					// Handle maxReadFileLine partial read
					if (maxReadFileLine > 0 && totalLines > maxReadFileLine) {
						const sliceResult = await readFileContent({
							filePath: fullPath,
							offset: 1,
							limit: maxReadFileLine,
							mode: "slice",
						})
						// readFileContent already includes line numbers
						const content = sliceResult.content
						const { metadata } = sliceResult

						// Build metadata summary for pagination awareness
						const metadataSummary = []
						if (metadata.hasMoreAfter) {
							metadataSummary.push(`${metadata.linesAfterEnd} lines after`)
						}
						if (metadata.lineLengthTruncations.length > 0) {
							metadataSummary.push(`${metadata.lineLengthTruncations.length} lines truncated for length`)
						}

						const lineRangeAttr = ` lines="${metadata.startLine}-${metadata.endLine}"`
						let xmlInfo = `<content${lineRangeAttr}>\n${content}</content>\n`
						let nativeInfo = `Lines ${metadata.startLine}-${metadata.endLine}:\n${content}\n`

						const notice =
							`Showing ${sliceResult.lineCount} of ${metadata.totalLinesInFile} total lines` +
							(metadataSummary.length > 0 ? ` (${metadataSummary.join(", ")})` : "") +
							`. Use offset to read more`
						xmlInfo += `<notice>${notice}</notice>\n`
						nativeInfo += `\nNote: ${notice}`

						await task.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)

						updateFileResult(relPath, {
							xmlContent: `<file><path>${relPath}</path>\n${xmlInfo}</file>`,
							nativeContent: `File: ${relPath}\n${nativeInfo}`,
						})
						continue
					}

					const { id: modelId, info: modelInfo } = task.api.getModel()
					const { contextTokens } = task.getTokenUsage()
					const contextWindow = modelInfo.contextWindow

					const maxOutputTokens =
						getModelMaxOutputTokens({
							modelId,
							model: modelInfo,
							settings: task.apiConfiguration,
						}) ?? ANTHROPIC_DEFAULT_MAX_TOKENS

					// Calculate available token budget (60% of remaining context)
					const remainingTokens = contextWindow - maxOutputTokens - (contextTokens || 0)
					const safeReadBudget = Math.floor(remainingTokens * FILE_READ_BUDGET_PERCENT)

					let content: string
					let xmlInfo = ""
					let nativeInfo = ""

					if (safeReadBudget <= 0) {
						// No budget available
						content = ""
						const notice = "No available context budget for file reading"
						xmlInfo = `<content/>\n<notice>${notice}</notice>\n`
						nativeInfo = `Note: ${notice}`
					} else {
						// Read file with incremental token counting
						const result = await readFileWithTokenBudget(fullPath, {
							budgetTokens: safeReadBudget,
						})

						content = addLineNumbers(result.content)

						if (!result.complete) {
							// File was truncated
							const notice = `File truncated: showing ${result.lineCount} lines (${result.tokenCount} tokens) due to context budget. Use offset to read more.`
							const lineRangeAttr = result.lineCount > 0 ? ` lines="1-${result.lineCount}"` : ""
							xmlInfo =
								result.lineCount > 0
									? `<content${lineRangeAttr}>\n${content}</content>\n<notice>${notice}</notice>\n`
									: `<content/>\n<notice>${notice}</notice>\n`
							nativeInfo =
								result.lineCount > 0
									? `Lines 1-${result.lineCount}:\n${content}\n\nNote: ${notice}`
									: `Note: ${notice}`
						} else {
							// Full file read
							const lineRangeAttr = ` lines="1-${result.lineCount}"`
							xmlInfo =
								result.lineCount > 0
									? `<content${lineRangeAttr}>\n${content}</content>\n`
									: `<content/>`

							if (result.lineCount === 0) {
								xmlInfo += `<notice>File is empty</notice>\n`
								nativeInfo = "Note: File is empty"
							} else {
								nativeInfo = `Lines 1-${result.lineCount}:\n${content}`
							}
						}
					}

					await task.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)

					updateFileResult(relPath, {
						xmlContent: `<file><path>${relPath}</path>\n${xmlInfo}</file>`,
						nativeContent: `File: ${relPath}\n${nativeInfo}`,
					})
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error)
					updateFileResult(relPath, {
						status: "error",
						error: `Error reading file: ${errorMsg}`,
						xmlContent: `<file><path>${relPath}</path><error>Error reading file: ${errorMsg}</error></file>`,
						nativeContent: `File: ${relPath}\nError: Error reading file: ${errorMsg}`,
					})
					await task.say("error", `Error reading file ${relPath}: ${errorMsg}`)
				}
			}

			// Check if any files had errors or were blocked and mark the turn as failed
			const hasErrors = fileResults.some((result) => result.status === "error" || result.status === "blocked")
			if (hasErrors) {
				task.didToolFailInCurrentTurn = true
			}

			// Build final result based on protocol
			let finalResult: string
			if (useNative) {
				const nativeResults = fileResults
					.filter((result) => result.nativeContent)
					.map((result) => result.nativeContent)
				finalResult = nativeResults.join("\n\n---\n\n")
			} else {
				const xmlResults = fileResults.filter((result) => result.xmlContent).map((result) => result.xmlContent)
				finalResult = `<files>\n${xmlResults.join("\n")}\n</files>`
			}

			const fileImageUrls = fileResults
				.filter((result) => result.imageDataUrl)
				.map((result) => result.imageDataUrl as string)

			let statusMessage = ""
			let feedbackImages: any[] = []

			const deniedWithFeedback = fileResults.find((result) => result.status === "denied" && result.feedbackText)

			if (deniedWithFeedback && deniedWithFeedback.feedbackText) {
				statusMessage = formatResponse.toolDeniedWithFeedback(deniedWithFeedback.feedbackText)
				feedbackImages = deniedWithFeedback.feedbackImages || []
			} else if (task.didRejectTool) {
				statusMessage = formatResponse.toolDenied()
			} else {
				const approvedWithFeedback = fileResults.find(
					(result) => result.status === "approved" && result.feedbackText,
				)

				if (approvedWithFeedback && approvedWithFeedback.feedbackText) {
					statusMessage = formatResponse.toolApprovedWithFeedback(approvedWithFeedback.feedbackText)
					feedbackImages = approvedWithFeedback.feedbackImages || []
				}
			}

			const allImages = [...feedbackImages, ...fileImageUrls]

			const finalModelSupportsImages = task.api.getModel().info.supportsImages ?? false
			const imagesToInclude = finalModelSupportsImages ? allImages : []

			if (statusMessage || imagesToInclude.length > 0) {
				const result = formatResponse.toolResult(
					statusMessage || finalResult,
					imagesToInclude.length > 0 ? imagesToInclude : undefined,
				)

				if (typeof result === "string") {
					if (statusMessage) {
						pushToolResult(`${result}\n${finalResult}`)
					} else {
						pushToolResult(result)
					}
				} else {
					if (statusMessage) {
						const textBlock = { type: "text" as const, text: finalResult }
						pushToolResult([...result, textBlock])
					} else {
						pushToolResult(result)
					}
				}
			} else {
				pushToolResult(finalResult)
			}
		} catch (error) {
			const relPath = fileEntries[0]?.path || "unknown"
			const errorMsg = error instanceof Error ? error.message : String(error)

			if (fileResults.length > 0) {
				updateFileResult(relPath, {
					status: "error",
					error: `Error reading file: ${errorMsg}`,
					xmlContent: `<file><path>${relPath}</path><error>Error reading file: ${errorMsg}</error></file>`,
					nativeContent: `File: ${relPath}\nError: Error reading file: ${errorMsg}`,
				})
			}

			await task.say("error", `Error reading file ${relPath}: ${errorMsg}`)

			// Mark that a tool failed in this turn
			task.didToolFailInCurrentTurn = true

			// Build final error result based on protocol
			let errorResult: string
			if (useNative) {
				const nativeResults = fileResults
					.filter((result) => result.nativeContent)
					.map((result) => result.nativeContent)
				errorResult = nativeResults.join("\n\n---\n\n")
			} else {
				const xmlResults = fileResults.filter((result) => result.xmlContent).map((result) => result.xmlContent)
				errorResult = `<files>\n${xmlResults.join("\n")}\n</files>`
			}

			pushToolResult(errorResult)
		}
	}

	getReadFileToolDescription(blockName: string, blockParams: any): string
	getReadFileToolDescription(blockName: string, nativeArgs: { files: FileEntry[] }): string
	getReadFileToolDescription(blockName: string, second: any): string {
		// If native typed args ({ files: FileEntry[] }) were provided
		if (second && typeof second === "object" && "files" in second && Array.isArray(second.files)) {
			const paths = (second.files as FileEntry[]).map((f) => f?.path).filter(Boolean) as string[]
			if (paths.length === 0) {
				return `[${blockName} with no valid paths]`
			} else if (paths.length === 1) {
				return `[${blockName} for '${paths[0]}'. Reading multiple files at once is more efficient for the LLM. If other files are relevant to your current task, please read them simultaneously.]`
			} else if (paths.length <= 3) {
				const pathList = paths.map((p) => `'${p}'`).join(", ")
				return `[${blockName} for ${pathList}]`
			} else {
				return `[${blockName} for ${paths.length} files]`
			}
		}

		// XML args format
		const blockParams = second as any

		if (blockParams?.args) {
			try {
				const parsed = parseXml(blockParams.args) as any
				const files = Array.isArray(parsed.file) ? parsed.file : [parsed.file].filter(Boolean)
				const paths = files.map((f: any) => f?.path).filter(Boolean) as string[]

				if (paths.length === 0) {
					return `[${blockName} with no valid paths]`
				} else if (paths.length === 1) {
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
		}

		return `[${blockName} with missing args]`
	}

	override async handlePartial(task: Task, block: ToolUse<"read_file">): Promise<void> {
		const argsXmlTag = block.params.args

		let filePath = ""
		if (argsXmlTag) {
			const match = argsXmlTag.match(/<file>.*?<path>([^<]+)<\/path>/s)
			if (match) filePath = match[1]
		}

		if (!filePath && block.nativeArgs && "files" in block.nativeArgs && Array.isArray(block.nativeArgs.files)) {
			const files = block.nativeArgs.files
			if (files.length > 0 && files[0]?.path) {
				filePath = files[0].path
			}
		}

		const fullPath = filePath ? path.resolve(task.cwd, filePath) : ""
		const sharedMessageProps: ClineSayTool = {
			tool: "readFile",
			path: getReadablePath(task.cwd, filePath),
			isOutsideWorkspace: filePath ? isPathOutsideWorkspace(fullPath) : false,
		}
		const partialMessage = JSON.stringify({
			...sharedMessageProps,
			content: undefined,
		} satisfies ClineSayTool)
		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}
}

export const readFileTool = new ReadFileTool()
