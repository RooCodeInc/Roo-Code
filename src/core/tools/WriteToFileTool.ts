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

import { BaseTool, ToolCallbacks } from "./BaseTool"
import { classifyTool, isInScope, isIntentIgnored } from "./intent-middleware"
import { sha256 } from "../utils/hash"
import fsSync from "fs"

interface WriteToFileParams {
	path: string
	content: string
	intent_id: string
	mutation_class: "AST_REFACTOR" | "INTENT_EVOLUTION"
	original_content_hash: string // SHA-256 hash of file as read by agent
}

export class WriteToFileTool extends BaseTool<"write_to_file"> {
	readonly name = "write_to_file" as const

	async execute(params: WriteToFileParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, handleError, askApproval } = callbacks
		const relPath = params.path
		let newContent = params.content
		const intentId = params.intent_id
		const mutationClass = params.mutation_class
		const originalContentHash = params.original_content_hash
		// === PHASE 4: OPTIMISTIC LOCKING ===
		const absolutePath = path.resolve(task.cwd, relPath)
		let currentContent = ""
		let fileExists = false
		try {
			fileExists = await fileExistsAtPath(absolutePath)
			if (fileExists) {
				currentContent = await fs.readFile(absolutePath, "utf-8")
			}
		} catch {}
		const currentContentHash = sha256(currentContent)
		if (fileExists && originalContentHash && originalContentHash !== currentContentHash) {
			pushToolResult(
				`Stale File: The file [${relPath}] has changed since you last read it. Your write was blocked to prevent overwriting concurrent changes. Please re-read the file and try again.`,
			)
			return
		}

		// === INTENT-AWARE PRE-HOOK (Phase 2) ===
		// 1. Load active intent
		let activeIntentId = intentId
		let ownedScope: string[] = []
		try {
			const orchestrationPath = path.join(task.cwd, ".orchestration", "active_intents.yaml")
			if (fsSync.existsSync(orchestrationPath)) {
				const yamlRaw = fsSync.readFileSync(orchestrationPath, "utf-8")
				const match = new RegExp(`- id: "${intentId}"([\s\S]*?)(?=\n\s*- id:|$)`, "m").exec(yamlRaw)
				if (match) {
					const block = match[1]
					ownedScope =
						/owned_scope:\n([\s\S]*?)\n\s*constraints:/m
							.exec(block)?.[1]
							?.trim()
							.split("\n")
							.map((l) => l.replace(/^- /, "").trim()) || []
				}
			}
		} catch {}

		// 2. Scope enforcement
		if (activeIntentId && ownedScope.length > 0) {
			if (!isInScope(relPath, ownedScope)) {
				pushToolResult(
					`Scope Violation: ${activeIntentId} is not authorized to edit [${relPath}]. Request scope expansion.`,
				)
				return
			}
		}

		// 3. .intentignore enforcement
		const ignored = await isIntentIgnored(task.cwd, relPath)
		if (ignored) {
			// Allow without approval
		} else {
			// 4. UI-blocking authorization for destructive tools
			if (classifyTool(this.name) === "destructive") {
				const approved = await askApproval(
					"tool",
					`Approve write to ${relPath} for intent ${activeIntentId || "(none)"}?`,
					undefined,
					false,
				)
				if (!approved) {
					pushToolResult("Action rejected by user. Autonomous recovery: self-correct or request approval.")
					return
				}
			}
		}

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

		const accessAllowed = task.rooIgnoreController?.validateAccess(relPath)

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
			const diagnosticsEnabled = state?.diagnosticsEnabled ?? true
			const writeDelayMs = state?.writeDelayMs ?? DEFAULT_WRITE_DELAY_MS
			const isPreventFocusDisruptionEnabled = experiments.isEnabled(
				state?.experiments ?? {},
				EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION,
			)

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

				await task.diffViewProvider.saveChanges(diagnosticsEnabled, writeDelayMs)
			}

			if (relPath) {
				await task.fileContextTracker.trackFileContext(relPath, "roo_edited" as RecordSource)
			}

			task.didEditFile = true

			const message = await task.diffViewProvider.pushToolWriteResult(task, task.cwd, !fileExists)

			// === PHASE 3: POST-HOOK TRACE SERIALIZATION ===
			try {
				const tracePath = path.join(task.cwd, ".orchestration", "agent_trace.jsonl")
				const vcsSha = null // Optionally, get git SHA here
				const now = new Date().toISOString()
				const fileContent = newContent
				const contentHash = sha256(fileContent)
				const trace = {
					id: require("crypto").randomUUID ? require("crypto").randomUUID() : now,
					timestamp: now,
					vcs: { revision_id: vcsSha },
					files: [
						{
							relative_path: relPath,
							conversations: [
								{
									url: "session_log_id",
									contributor: {
										entity_type: "AI",
										model_identifier: "unknown",
									},
									ranges: [
										{
											start_line: 1,
											end_line: fileContent.split("\n").length,
											content_hash: `sha256:${contentHash}`,
										},
									],
									related: [
										{
											type: "specification",
											value: intentId,
										},
									],
								},
							],
						},
					],
					mutation_class: mutationClass,
				}
				fsSync.appendFileSync(tracePath, JSON.stringify(trace) + "\n")
			} catch (e) {
				// fail silently
			}

			pushToolResult(message)

			await task.diffViewProvider.reset()
			this.resetPartialState()

			task.processQueuedMessages()

			return
		} catch (error) {
			await handleError("writing file", error as Error)
			await task.diffViewProvider.reset()
			this.resetPartialState()
			return
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
