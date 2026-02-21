import path from "path"
import delay from "delay"
import fs from "fs/promises"

import { type ClineSayTool, DEFAULT_WRITE_DELAY_MS } from "@roo-code/types"

import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { fileExistsAtPath, createDirectoriesForFile } from "../../utils/fs"
import { stripLineNumbers, everyLineHasLineNumbers } from "../../integrations/misc/extract-text"
import { getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { unescapeHtmlEntities } from "../../utils/text-normalization"
import { EXPERIMENT_IDS, experiments } from "../../shared/experiments"
import { convertNewFileToUnifiedDiff, computeDiffStats, sanitizeUnifiedDiff } from "../diff/stats"
import type { ToolUse } from "../../shared/tools"
import { INVALID_ACTIVE_INTENT_ERROR } from "../intent/IntentContextLoader"
import { appendAgentTrace } from "../trace/AgentTraceSerializer"

import { BaseTool, ToolCallbacks } from "./BaseTool"

interface WriteToFileParams {
	path: string
	content: string
}

export class WriteToFileTool extends BaseTool<"write_to_file"> {
	readonly name = "write_to_file" as const
	private initialFileHash: string | undefined

	async execute(params: WriteToFileParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		try {
			const tracePath = path.join(task.cwd, ".roo-tool-trace.log")
			await fs.appendFile(tracePath, `[${new Date().toISOString()}] TOOL EXECUTED: ${this.name}\n`, "utf8")
		} catch {}
		const { pushToolResult, handleError, askApproval } = callbacks
		const relPath = params.path
		const accessAllowed = task.rooIgnoreController?.validateAccess(relPath || "")

		let newContent = params.content

		if (!relPath) {
			task.consecutiveMistakeCount++
			task.recordToolError("write_to_file")
			pushToolResult(await task.sayAndCreateMissingParamError("write_to_file", "path"))
			await task.diffViewProvider.reset()
			return
		}

		if (newContent === undefined) {
			task.consecutiveMistakeCount++
			task.recordToolError("write_to_file")
			pushToolResult(await task.sayAndCreateMissingParamError("write_to_file", "content"))
			await task.diffViewProvider.reset()
			return
		}

		const hasSelectedActiveIntent = (task.toolUsage.select_active_intent?.attempts ?? 0) > 0
		const provider = task.providerRef.deref()
		const state = await provider?.getState()
		const hasActiveIntentState = !!(state as any)?.activeIntentId

		if (!hasSelectedActiveIntent && !hasActiveIntentState) {
			const governanceError = `GOVERNANCE ERROR: ${INVALID_ACTIVE_INTENT_ERROR} before modifying files.`
			task.consecutiveMistakeCount++
			task.recordToolError("write_to_file", governanceError)
			task.didToolFailInCurrentTurn = true
			pushToolResult(formatResponse.toolError(governanceError))
			await task.diffViewProvider.reset()
			return
		}

		if (!accessAllowed) {
			await task.say("rooignore_error", relPath)
			pushToolResult(formatResponse.rooIgnoreError(relPath))
			return
		}

		const isWriteProtected = task.rooProtectedController?.isWriteProtected(relPath) || false

		let fileExists: boolean
		const absolutePath = path.resolve(task.cwd, relPath)

		if (task.diffViewProvider.editType !== undefined) {
			fileExists = task.diffViewProvider.editType === "modify"
		} else {
			fileExists = await fileExistsAtPath(absolutePath)
			task.diffViewProvider.editType = fileExists ? "modify" : "create"
		}

		this.initialFileHash = undefined
		if (fileExists) {
			try {
				const { getCurrentHash } = await import("../concurrency/OptimisticLock")
				this.initialFileHash = await getCurrentHash(absolutePath)
			} catch {
				this.initialFileHash = undefined
			}
		}

		// Create parent directories early for new files to prevent ENOENT errors
		// in subsequent operations (e.g., diffViewProvider.open, fs.readFile)
		if (!fileExists) {
			await createDirectoriesForFile(absolutePath)
		}

		if (newContent.startsWith("```")) {
			newContent = newContent.split("\n").slice(1).join("\n")
		}

		if (newContent.endsWith("```")) {
			newContent = newContent.split("\n").slice(0, -1).join("\n")
		}

		if (!task.api.getModel().id.includes("claude")) {
			newContent = unescapeHtmlEntities(newContent)
		}

		const fullPath = relPath ? path.resolve(task.cwd, relPath) : ""
		const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

		const sharedMessageProps: ClineSayTool = {
			tool: fileExists ? "editedExistingFile" : "newFileCreated",
			path: getReadablePath(task.cwd, relPath),
			content: newContent,
			isOutsideWorkspace,
			isProtected: isWriteProtected,
		}

		try {
			task.consecutiveMistakeCount = 0

			const provider = task.providerRef.deref()
			const state = await provider?.getState()
			const activeIntentId = String((state as any)?.activeIntentId ?? "").trim()
			const diagnosticsEnabled = state?.diagnosticsEnabled ?? true
			const writeDelayMs = state?.writeDelayMs ?? DEFAULT_WRITE_DELAY_MS
			const isPreventFocusDisruptionEnabled = experiments.isEnabled(
				state?.experiments ?? {},
				EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION,
			)

			const validateOptimisticLockOrThrow = async () => {
				if (!fileExists || !this.initialFileHash) {
					return
				}

				try {
					const { validateLock, getCurrentHash, StaleFileError } = await import(
						"../concurrency/OptimisticLock"
					)
					const isLockValid = await validateLock(this.initialFileHash, absolutePath)
					if (!isLockValid) {
						const currentHash = await getCurrentHash(absolutePath).catch(() => "unavailable")
						throw new StaleFileError(relPath, this.initialFileHash, currentHash)
					}
				} catch (error) {
					const { StaleFileError } = await import("../concurrency/OptimisticLock").catch(() => ({
						StaleFileError: undefined,
					}))
					if (StaleFileError && error instanceof StaleFileError) {
						throw error
					}
				}
			}

			if (isPreventFocusDisruptionEnabled) {
				task.diffViewProvider.editType = fileExists ? "modify" : "create"
				if (fileExists) {
					const absolutePath = path.resolve(task.cwd, relPath)
					task.diffViewProvider.originalContent = await fs.readFile(absolutePath, "utf-8")
				} else {
					task.diffViewProvider.originalContent = ""
				}

				let unified = fileExists
					? formatResponse.createPrettyPatch(relPath, task.diffViewProvider.originalContent, newContent)
					: convertNewFileToUnifiedDiff(newContent, relPath)
				unified = sanitizeUnifiedDiff(unified)
				const completeMessage = JSON.stringify({
					...sharedMessageProps,
					content: unified,
					diffStats: computeDiffStats(unified) || undefined,
				} satisfies ClineSayTool)

				const didApprove = await askApproval("tool", completeMessage, undefined, isWriteProtected)

				if (!didApprove) {
					return
				}

				try {
					await validateOptimisticLockOrThrow()
				} catch (error) {
					const staleErrorMessage =
						error instanceof Error
							? error.message
							: "STALE_FILE_ERROR: File changed since it was last read. Re-read the file before applying changes."
					task.consecutiveMistakeCount++
					task.recordToolError("write_to_file", staleErrorMessage)
					task.didToolFailInCurrentTurn = true
					pushToolResult(formatResponse.toolError(staleErrorMessage))
					await task.diffViewProvider.reset()
					this.resetPartialState()
					return
				}

				await task.diffViewProvider.saveDirectly(relPath, newContent, false, diagnosticsEnabled, writeDelayMs)
			} else {
				if (!task.diffViewProvider.isEditing) {
					const partialMessage = JSON.stringify(sharedMessageProps)
					await task.ask("tool", partialMessage, true).catch(() => {})
					await task.diffViewProvider.open(relPath)
				}

				await task.diffViewProvider.update(
					everyLineHasLineNumbers(newContent) ? stripLineNumbers(newContent) : newContent,
					true,
				)

				await delay(300)
				task.diffViewProvider.scrollToFirstDiff()

				let unified = fileExists
					? formatResponse.createPrettyPatch(relPath, task.diffViewProvider.originalContent, newContent)
					: convertNewFileToUnifiedDiff(newContent, relPath)
				unified = sanitizeUnifiedDiff(unified)
				const completeMessage = JSON.stringify({
					...sharedMessageProps,
					content: unified,
					diffStats: computeDiffStats(unified) || undefined,
				} satisfies ClineSayTool)

				const didApprove = await askApproval("tool", completeMessage, undefined, isWriteProtected)

				if (!didApprove) {
					await task.diffViewProvider.revertChanges()
					return
				}

				try {
					await validateOptimisticLockOrThrow()
				} catch (error) {
					const staleErrorMessage =
						error instanceof Error
							? error.message
							: "STALE_FILE_ERROR: File changed since it was last read. Re-read the file before applying changes."
					task.consecutiveMistakeCount++
					task.recordToolError("write_to_file", staleErrorMessage)
					task.didToolFailInCurrentTurn = true
					pushToolResult(formatResponse.toolError(staleErrorMessage))
					await task.diffViewProvider.revertChanges()
					await task.diffViewProvider.reset()
					this.resetPartialState()
					return
				}

				await task.diffViewProvider.saveChanges(diagnosticsEnabled, writeDelayMs)
			}

			this.initialFileHash = undefined

			if (relPath) {
				await task.fileContextTracker.trackFileContext(relPath, "roo_edited" as RecordSource)
			}

			task.didEditFile = true

			const message = await task.diffViewProvider.pushToolWriteResult(task, task.cwd, !fileExists)

			pushToolResult(message)

			if (activeIntentId && relPath) {
				await appendAgentTrace({
					workspaceRoot: task.cwd,
					activeIntentId,
					filePath: relPath,
					content: newContent,
					toolName: this.name,
				}).catch(() => {})
			}

			await task.diffViewProvider.reset()
			this.resetPartialState()

			task.processQueuedMessages()

			return
		} catch (error) {
			await handleError("writing file", error as Error)
			await task.diffViewProvider.reset()
			this.resetPartialState()
			return
		} finally {
			this.initialFileHash = undefined
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"write_to_file">): Promise<void> {
		const relPath: string | undefined = block.params.path
		let newContent: string | undefined = block.params.content

		// Wait for path to stabilize before showing UI (prevents truncated paths)
		if (!this.hasPathStabilized(relPath) || newContent === undefined) {
			return
		}

		const provider = task.providerRef.deref()
		const state = await provider?.getState()
		const isPreventFocusDisruptionEnabled = experiments.isEnabled(
			state?.experiments ?? {},
			EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION,
		)

		if (isPreventFocusDisruptionEnabled) {
			return
		}

		// relPath is guaranteed non-null after hasPathStabilized
		let fileExists: boolean
		const absolutePath = path.resolve(task.cwd, relPath!)

		if (task.diffViewProvider.editType !== undefined) {
			fileExists = task.diffViewProvider.editType === "modify"
		} else {
			fileExists = await fileExistsAtPath(absolutePath)
			task.diffViewProvider.editType = fileExists ? "modify" : "create"
		}

		// Create parent directories early for new files to prevent ENOENT errors
		// in subsequent operations (e.g., diffViewProvider.open)
		if (!fileExists) {
			await createDirectoriesForFile(absolutePath)
		}

		const isWriteProtected = task.rooProtectedController?.isWriteProtected(relPath!) || false
		const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

		const sharedMessageProps: ClineSayTool = {
			tool: fileExists ? "editedExistingFile" : "newFileCreated",
			path: getReadablePath(task.cwd, relPath!),
			content: newContent || "",
			isOutsideWorkspace,
			isProtected: isWriteProtected,
		}

		const partialMessage = JSON.stringify(sharedMessageProps)
		await task.ask("tool", partialMessage, block.partial).catch(() => {})

		if (newContent) {
			if (!task.diffViewProvider.isEditing) {
				await task.diffViewProvider.open(relPath!)
			}

			await task.diffViewProvider.update(
				everyLineHasLineNumbers(newContent) ? stripLineNumbers(newContent) : newContent,
				false,
			)
		}
	}
}

export const writeToFileTool = new WriteToFileTool()
