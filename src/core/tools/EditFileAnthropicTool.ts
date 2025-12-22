import fs from "fs/promises"
import path from "path"

import { getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { fileExistsAtPath } from "../../utils/fs"
import { DEFAULT_WRITE_DELAY_MS } from "@roo-code/types"
import { EXPERIMENT_IDS, experiments } from "../../shared/experiments"
import { sanitizeUnifiedDiff, computeDiffStats } from "../diff/stats"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"

interface EditOperation {
	old_text: string
	new_text: string
}

interface SearchAndReplaceParams {
	path: string
	edits: EditOperation[]
}

export class SearchAndReplaceTool extends BaseTool<"edit_file_anthropic"> {
	readonly name = "edit_file_anthropic" as const

	parseLegacy(params: Partial<Record<string, string>>): SearchAndReplaceParams {
		// Parse edits from JSON string if provided
		let edits: EditOperation[] = []
		if (params.edits) {
			try {
				edits = JSON.parse(params.edits)
			} catch {
				edits = []
			}
		}

		return {
			path: params.path || "",
			edits,
		}
	}

	async execute(params: SearchAndReplaceParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { path: relPath, edits } = params
		const { askApproval, handleError, pushToolResult, toolProtocol } = callbacks

		try {
			// Validate required parameters
			if (!relPath) {
				task.consecutiveMistakeCount++
				task.recordToolError("edit_file_anthropic")
				pushToolResult(await task.sayAndCreateMissingParamError("edit_file_anthropic", "path"))
				return
			}

			if (!edits || !Array.isArray(edits) || edits.length === 0) {
				task.consecutiveMistakeCount++
				task.recordToolError("edit_file_anthropic")
				pushToolResult(
					formatResponse.toolError(
						"Missing or empty 'edits' parameter. At least one edit operation is required.",
					),
				)
				return
			}

			// Validate each edit has old_text and new_text fields
			for (let i = 0; i < edits.length; i++) {
				const op = edits[i]
				if (!op.old_text) {
					task.consecutiveMistakeCount++
					task.recordToolError("edit_file_anthropic")
					pushToolResult(formatResponse.toolError(`Edit ${i + 1} is missing the 'old_text' field.`))
					return
				}
				if (op.new_text === undefined) {
					task.consecutiveMistakeCount++
					task.recordToolError("edit_file_anthropic")
					pushToolResult(formatResponse.toolError(`Edit ${i + 1} is missing the 'new_text' field.`))
					return
				}
			}

			const accessAllowed = task.rooIgnoreController?.validateAccess(relPath)

			if (!accessAllowed) {
				await task.say("rooignore_error", relPath)
				pushToolResult(formatResponse.rooIgnoreError(relPath, toolProtocol))
				return
			}

			// Check if file is write-protected
			const isWriteProtected = task.rooProtectedController?.isWriteProtected(relPath) || false

			const absolutePath = path.resolve(task.cwd, relPath)

			const fileExists = await fileExistsAtPath(absolutePath)
			if (!fileExists) {
				task.consecutiveMistakeCount++
				task.recordToolError("edit_file_anthropic")
				const errorMessage = `File not found: ${relPath}. Cannot perform search and replace on a non-existent file.`
				await task.say("error", errorMessage)
				pushToolResult(formatResponse.toolError(errorMessage))
				return
			}

			let fileContent: string
			try {
				fileContent = await fs.readFile(absolutePath, "utf8")
				// Normalize line endings to LF for consistent matching
				fileContent = fileContent.replace(/\r\n/g, "\n")
			} catch (error) {
				task.consecutiveMistakeCount++
				task.recordToolError("edit_file_anthropic")
				const errorMessage = `Failed to read file '${relPath}'. Please verify file permissions and try again.`
				await task.say("error", errorMessage)
				pushToolResult(formatResponse.toolError(errorMessage))
				return
			}

			// Apply all edits sequentially
			let newContent = fileContent
			const errors: string[] = []

		for (let i = 0; i < edits.length; i++) {
			// Normalize line endings in search/replace strings to match file content
			const old_text = edits[i].old_text.replace(/\r\n/g, "\n")
			const new_text = edits[i].new_text.replace(/\r\n/g, "\n")
			const searchPattern = new RegExp(escapeRegExp(old_text), "g")

				const matchCount = newContent.match(searchPattern)?.length ?? 0
				if (matchCount === 0) {
					errors.push(`Edit ${i + 1}: No match found for old_text.`)
					continue
				}

				if (matchCount > 1) {
					errors.push(
						`Edit ${i + 1}: Found ${matchCount} matches. Please provide more context to make a unique match.`,
					)
					continue
				}

				// Apply the replacement
				newContent = newContent.replace(searchPattern, new_text)
			}

			// If all edits failed, return error
			if (errors.length === edits.length) {
				task.consecutiveMistakeCount++
				task.recordToolError("edit_file_anthropic", "no_match")
				pushToolResult(formatResponse.toolError(`All edits failed:\n${errors.join("\n")}`))
				return
			}

			// Check if any changes were made
			if (newContent === fileContent) {
				pushToolResult(`No changes needed for '${relPath}'`)
				return
			}

			task.consecutiveMistakeCount = 0

			// Initialize diff view
			task.diffViewProvider.editType = "modify"
			task.diffViewProvider.originalContent = fileContent

			// Generate and validate diff
			const diff = formatResponse.createPrettyPatch(relPath, fileContent, newContent)
			if (!diff) {
				pushToolResult(`No changes needed for '${relPath}'`)
				await task.diffViewProvider.reset()
				return
			}

			// Check if preventFocusDisruption experiment is enabled
			const provider = task.providerRef.deref()
			const state = await provider?.getState()
			const diagnosticsEnabled = state?.diagnosticsEnabled ?? true
			const writeDelayMs = state?.writeDelayMs ?? DEFAULT_WRITE_DELAY_MS
			const isPreventFocusDisruptionEnabled = experiments.isEnabled(
				state?.experiments ?? {},
				EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION,
			)

			const sanitizedDiff = sanitizeUnifiedDiff(diff)
			const diffStats = computeDiffStats(sanitizedDiff) || undefined
			const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

			const sharedMessageProps: ClineSayTool = {
				tool: "appliedDiff",
				path: getReadablePath(task.cwd, relPath),
				diff: sanitizedDiff,
				isOutsideWorkspace,
			}

			// Include any partial errors in the message
			let resultMessage = ""
			if (errors.length > 0) {
				resultMessage = `Some edits failed:\n${errors.join("\n")}\n\n`
			}

			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				content: sanitizedDiff,
				isProtected: isWriteProtected,
				diffStats,
			} satisfies ClineSayTool)

			// Show diff view if focus disruption prevention is disabled
			if (!isPreventFocusDisruptionEnabled) {
				await task.diffViewProvider.open(relPath)
				await task.diffViewProvider.update(newContent, true)
				task.diffViewProvider.scrollToFirstDiff()
			}

			const didApprove = await askApproval("tool", completeMessage, undefined, isWriteProtected)

			if (!didApprove) {
				// Revert changes if diff view was shown
				if (!isPreventFocusDisruptionEnabled) {
					await task.diffViewProvider.revertChanges()
				}
				pushToolResult("Changes were rejected by the user.")
				await task.diffViewProvider.reset()
				return
			}

			// Save the changes
			if (isPreventFocusDisruptionEnabled) {
				// Direct file write without diff view or opening the file
				await task.diffViewProvider.saveDirectly(relPath, newContent, false, diagnosticsEnabled, writeDelayMs)
			} else {
				// Call saveChanges to update the DiffViewProvider properties
				await task.diffViewProvider.saveChanges(diagnosticsEnabled, writeDelayMs)
			}

			// Track file edit operation
			if (relPath) {
				await task.fileContextTracker.trackFileContext(relPath, "roo_edited" as RecordSource)
			}

			task.didEditFile = true

			// Get the formatted response message
			const message = await task.diffViewProvider.pushToolWriteResult(task, task.cwd, false)

			// Add error info if some operations failed
			if (errors.length > 0) {
				pushToolResult(`${resultMessage}${message}`)
			} else {
				pushToolResult(message)
			}

			await task.diffViewProvider.reset()

			// Process any queued messages after file edit completes
			task.processQueuedMessages()
		} catch (error) {
			await handleError("search and replace", error as Error)
			await task.diffViewProvider.reset()
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"edit_file_anthropic">): Promise<void> {
		const relPath: string | undefined = block.params.path
		const editsStr: string | undefined = block.params.edits

		let editsPreview: string | undefined
		if (editsStr) {
			try {
				const ops = JSON.parse(editsStr)
				if (Array.isArray(ops) && ops.length > 0) {
					editsPreview = `${ops.length} edit(s)`
				}
			} catch {
				editsPreview = "parsing..."
			}
		}

		const absolutePath = relPath ? path.resolve(task.cwd, relPath) : ""
		const isOutsideWorkspace = absolutePath ? isPathOutsideWorkspace(absolutePath) : false

		const sharedMessageProps: ClineSayTool = {
			tool: "appliedDiff",
			path: getReadablePath(task.cwd, relPath || ""),
			diff: editsPreview,
			isOutsideWorkspace,
		}

		await task.ask("tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
	}
}

/**
 * Escapes special regex characters in a string
 * @param input String to escape regex characters in
 * @returns Escaped string safe for regex pattern matching
 */
function escapeRegExp(input: string): string {
	return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export const searchAndReplaceTool = new SearchAndReplaceTool()
// Alias for new naming convention
export const editFileAnthropicTool = searchAndReplaceTool
