import fs from "fs/promises"
import path from "path"

import { type ClineSayTool, DEFAULT_WRITE_DELAY_MS } from "@roo-code/types"

import { getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { fileExistsAtPath } from "../../utils/fs"
import { EXPERIMENT_IDS, experiments } from "../../shared/experiments"
import { sanitizeUnifiedDiff, computeDiffStats } from "../diff/stats"
import type { ToolUse } from "../../shared/tools"

import { BaseTool, ToolCallbacks } from "./BaseTool"

interface EditParams {
	file_path: string
	old_string: string
	new_string: string
	replace_all?: boolean
}

export class EditTool extends BaseTool<"edit"> {
	readonly name = "edit" as const

	async execute(params: EditParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { file_path: relPath, old_string: oldString, new_string: newString, replace_all: replaceAll } = params
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			// Validate required parameters
			if (!relPath) {
				task.consecutiveMistakeCount++
				task.recordToolError("edit")
				pushToolResult(await task.sayAndCreateMissingParamError("edit", "file_path"))
				return
			}

			if (!oldString) {
				task.consecutiveMistakeCount++
				task.recordToolError("edit")
				pushToolResult(await task.sayAndCreateMissingParamError("edit", "old_string"))
				return
			}

			if (newString === undefined) {
				task.consecutiveMistakeCount++
				task.recordToolError("edit")
				pushToolResult(await task.sayAndCreateMissingParamError("edit", "new_string"))
				return
			}

			// Check old_string !== new_string
			if (oldString === newString) {
				task.consecutiveMistakeCount++
				task.recordToolError("edit")
				pushToolResult(
					formatResponse.toolError(
						"'old_string' and 'new_string' are identical. No changes needed. If you want to make a change, ensure 'old_string' and 'new_string' are different.",
					),
				)
				return
			}

			const accessAllowed = task.rooIgnoreController?.validateAccess(relPath)

			if (!accessAllowed) {
				await task.say("rooignore_error", relPath)
				pushToolResult(formatResponse.rooIgnoreError(relPath))
				return
			}

			// Check if file is write-protected
			const isWriteProtected = task.rooProtectedController?.isWriteProtected(relPath) || false

			const absolutePath = path.resolve(task.cwd, relPath)

			const fileExists = await fileExistsAtPath(absolutePath)
			if (!fileExists) {
				task.consecutiveMistakeCount++
				task.recordToolError("edit")
				const errorMessage = `File not found: ${relPath}. Cannot perform edit on a non-existent file.`
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
				task.recordToolError("edit")
				const errorMessage = `Failed to read file '${relPath}'. Please verify file permissions and try again.`
				await task.say("error", errorMessage)
				pushToolResult(formatResponse.toolError(errorMessage))
				return
			}

			// Normalize line endings in old_string/new_string to match file content
			const normalizedOld = oldString.replace(/\r\n/g, "\n")
			const normalizedNew = newString.replace(/\r\n/g, "\n")

			// Count occurrences of old_string in file content
			const matchCount = fileContent.split(normalizedOld).length - 1

			if (matchCount === 0) {
				task.consecutiveMistakeCount++
				task.recordToolError("edit", "no_match")
				pushToolResult(
					formatResponse.toolError(
						`No match found for 'old_string' in ${relPath}. Make sure the text to find appears exactly in the file, including whitespace and indentation.`,
					),
				)
				return
			}

			// Uniqueness check when replace_all is not enabled
			if (!replaceAll && matchCount > 1) {
				task.consecutiveMistakeCount++
				task.recordToolError("edit")
				pushToolResult(
					formatResponse.toolError(
						`Found ${matchCount} matches of 'old_string' in the file. Use 'replace_all: true' to replace all occurrences, or provide more context in 'old_string' to make it unique.`,
					),
				)
				return
			}

			// Apply the replacement
			let newContent: string
			if (replaceAll) {
				// Replace all occurrences
				const searchPattern = new RegExp(escapeRegExp(normalizedOld), "g")
				newContent = fileContent.replace(searchPattern, () => normalizedNew)
			} else {
				// Replace single occurrence (already verified uniqueness above)
				newContent = fileContent.replace(normalizedOld, () => normalizedNew)
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
			pushToolResult(message)

			// Record successful tool usage and cleanup
			task.recordToolUsage("edit")
			await task.diffViewProvider.reset()
			this.resetPartialState()

			// Process any queued messages after file edit completes
			task.processQueuedMessages()
		} catch (error) {
			await handleError("edit", error as Error)
			await task.diffViewProvider.reset()
			this.resetPartialState()
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"edit">): Promise<void> {
		const relPath: string | undefined = block.params.file_path

		// Wait for path to stabilize before showing UI (prevents truncated paths)
		if (!this.hasPathStabilized(relPath)) {
			return
		}

		// relPath is guaranteed non-null after hasPathStabilized
		const absolutePath = path.resolve(task.cwd, relPath!)
		const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

		const sharedMessageProps: ClineSayTool = {
			tool: "appliedDiff",
			path: getReadablePath(task.cwd, relPath!),
			diff: block.params.old_string ? "1 edit operation" : undefined,
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

export const editTool = new EditTool()
export const searchAndReplaceTool = editTool // alias for backward compat
