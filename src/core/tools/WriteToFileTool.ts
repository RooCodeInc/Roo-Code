import path from "path"
import delay from "delay"
import * as vscode from "vscode"
import fs from "fs/promises"

import { Task } from "../task/Task"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { fileExistsAtPath } from "../../utils/fs"
import { stripLineNumbers, everyLineHasLineNumbers } from "../../integrations/misc/extract-text"
import { getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { detectCodeOmission } from "../../integrations/editor/detect-omission"
import { unescapeHtmlEntities } from "../../utils/text-normalization"
import { DEFAULT_WRITE_DELAY_MS } from "@roo-code/types"
import { EXPERIMENT_IDS, experiments } from "../../shared/experiments"
import { convertNewFileToUnifiedDiff, computeDiffStats, sanitizeUnifiedDiff } from "../diff/stats"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"
import { resolveToolProtocol } from "../../utils/resolveToolProtocol"
import { writeTaskScopedFile } from "../task-persistence/taskScopedFiles"

interface WriteToFileParams {
	path: string
	content: string
	line_count: number
	task_scoped?: boolean
}

export class WriteToFileTool extends BaseTool<"write_to_file"> {
	readonly name = "write_to_file" as const

	parseLegacy(params: Partial<Record<string, string>>): WriteToFileParams {
		return {
			path: params.path || "",
			content: params.content || "",
			line_count: parseInt(params.line_count ?? "0", 10),
			task_scoped: params.task_scoped === "true",
		}
	}

	async execute(params: WriteToFileParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, handleError, askApproval, removeClosingTag, toolProtocol } = callbacks
		const relPath = params.path
		let newContent = params.content
		const predictedLineCount = params.line_count
		const isTaskScoped = params.task_scoped || false

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

		// Handle task-scoped files specially
		if (isTaskScoped) {
			try {
				// For task-scoped files, only allow markdown files
				if (!relPath.endsWith(".md") && !relPath.endsWith(".markdown")) {
					pushToolResult(
						formatResponse.toolError("Task-scoped files must be markdown files (.md or .markdown)"),
					)
					return
				}

				const provider = task.providerRef.deref()
				if (!provider) {
					pushToolResult(formatResponse.toolError("Unable to access provider for task-scoped file"))
					return
				}

				const globalStoragePath = provider.context.globalStorageUri.fsPath
				const filePath = await writeTaskScopedFile(globalStoragePath, task.taskId, relPath, newContent)

				// Notify that we created a task-scoped file
				await task.say(
					"text",
					`📝 Created task-scoped markdown file: ${relPath}\nThis file exists only within this task and won't appear in your project directory.`,
				)

				pushToolResult(
					formatResponse.toolResult(
						`Task-scoped file created: ${relPath}\n\nThis markdown file is stored within the task context and won't appear in your project directory.`,
					),
				)
				task.consecutiveMistakeCount = 0
				return
			} catch (error) {
				await handleError("writing task-scoped file", error as Error)
				return
			}
		}

		const accessAllowed = task.rooIgnoreController?.validateAccess(relPath)

		if (!accessAllowed) {
			await task.say("rooignore_error", relPath)
			pushToolResult(formatResponse.rooIgnoreError(relPath, toolProtocol))
			return
		}

		const isWriteProtected = task.rooProtectedController?.isWriteProtected(relPath) || false

		let fileExists: boolean

		if (task.diffViewProvider.editType !== undefined) {
			fileExists = task.diffViewProvider.editType === "modify"
		} else {
			const absolutePath = path.resolve(task.cwd, relPath)
			fileExists = await fileExistsAtPath(absolutePath)
			task.diffViewProvider.editType = fileExists ? "modify" : "create"
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

		const fullPath = relPath ? path.resolve(task.cwd, removeClosingTag("path", relPath)) : ""
		const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

		const sharedMessageProps: ClineSayTool = {
			tool: fileExists ? "editedExistingFile" : "newFileCreated",
			path: getReadablePath(task.cwd, removeClosingTag("path", relPath)),
			content: newContent,
			isOutsideWorkspace,
			isProtected: isWriteProtected,
		}

		try {
			if (predictedLineCount === undefined || predictedLineCount === 0) {
				task.consecutiveMistakeCount++
				task.recordToolError("write_to_file")

				const actualLineCount = newContent.split("\n").length
				const isNewFile = !fileExists
				const diffStrategyEnabled = !!task.diffStrategy
				const modelInfo = task.api.getModel().info
				const toolProtocol = resolveToolProtocol(task.apiConfiguration, modelInfo)

				await task.say(
					"error",
					`Roo tried to use write_to_file${
						relPath ? ` for '${relPath.toPosix()}'` : ""
					} but the required parameter 'line_count' was missing or truncated after ${actualLineCount} lines of content were written. Retrying...`,
				)

				pushToolResult(
					formatResponse.toolError(
						formatResponse.lineCountTruncationError(
							actualLineCount,
							isNewFile,
							diffStrategyEnabled,
							toolProtocol,
						),
					),
				)
				await task.diffViewProvider.revertChanges()
				return
			}

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

				if (detectCodeOmission(task.diffViewProvider.originalContent || "", newContent, predictedLineCount)) {
					if (task.diffStrategy) {
						pushToolResult(
							formatResponse.toolError(
								`Content appears to be truncated (file has ${
									newContent.split("\n").length
								} lines but was predicted to have ${predictedLineCount} lines), and found comments indicating omitted code (e.g., '// rest of code unchanged', '/* previous code */'). Please provide the complete file content without any omissions if possible, or otherwise use the 'apply_diff' tool to apply the diff to the original file.`,
							),
						)
						return
					} else {
						vscode.window
							.showWarningMessage(
								"Potential code truncation detected. cline happens when the AI reaches its max output limit.",
								"Follow cline guide to fix the issue",
							)
							.then((selection) => {
								if (selection === "Follow cline guide to fix the issue") {
									vscode.env.openExternal(
										vscode.Uri.parse(
											"https://github.com/cline/cline/wiki/Troubleshooting-%E2%80%90-Cline-Deleting-Code-with-%22Rest-of-Code-Here%22-Comments",
										),
									)
								}
							})
					}
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

				if (detectCodeOmission(task.diffViewProvider.originalContent || "", newContent, predictedLineCount)) {
					if (task.diffStrategy) {
						await task.diffViewProvider.revertChanges()

						pushToolResult(
							formatResponse.toolError(
								`Content appears to be truncated (file has ${
									newContent.split("\n").length
								} lines but was predicted to have ${predictedLineCount} lines), and found comments indicating omitted code (e.g., '// rest of code unchanged', '/* previous code */'). Please provide the complete file content without any omissions if possible, or otherwise use the 'apply_diff' tool to apply the diff to the original file.`,
							),
						)
						return
					} else {
						vscode.window
							.showWarningMessage(
								"Potential code truncation detected. cline happens when the AI reaches its max output limit.",
								"Follow cline guide to fix the issue",
							)
							.then((selection) => {
								if (selection === "Follow cline guide to fix the issue") {
									vscode.env.openExternal(
										vscode.Uri.parse(
											"https://github.com/cline/cline/wiki/Troubleshooting-%E2%80%90-Cline-Deleting-Code-with-%22Rest-of-Code-Here%22-Comments",
										),
									)
								}
							})
					}
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

			pushToolResult(message)

			await task.diffViewProvider.reset()

			task.processQueuedMessages()

			return
		} catch (error) {
			await handleError("writing file", error as Error)
			await task.diffViewProvider.reset()
			return
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"write_to_file">): Promise<void> {
		const relPath: string | undefined = block.params.path
		let newContent: string | undefined = block.params.content

		if (!relPath || newContent === undefined) {
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

		let fileExists: boolean
		if (task.diffViewProvider.editType !== undefined) {
			fileExists = task.diffViewProvider.editType === "modify"
		} else {
			const absolutePath = path.resolve(task.cwd, relPath)
			fileExists = await fileExistsAtPath(absolutePath)
			task.diffViewProvider.editType = fileExists ? "modify" : "create"
		}

		const isWriteProtected = task.rooProtectedController?.isWriteProtected(relPath) || false
		const fullPath = path.resolve(task.cwd, relPath)
		const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

		const sharedMessageProps: ClineSayTool = {
			tool: fileExists ? "editedExistingFile" : "newFileCreated",
			path: getReadablePath(task.cwd, relPath),
			content: newContent,
			isOutsideWorkspace,
			isProtected: isWriteProtected,
		}

		const partialMessage = JSON.stringify(sharedMessageProps)
		await task.ask("tool", partialMessage, block.partial).catch(() => {})

		if (!task.diffViewProvider.isEditing) {
			await task.diffViewProvider.open(relPath)
		}

		await task.diffViewProvider.update(
			everyLineHasLineNumbers(newContent) ? stripLineNumbers(newContent) : newContent,
			false,
		)
	}
}

export const writeToFileTool = new WriteToFileTool()
