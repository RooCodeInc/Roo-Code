import path from "path"

import * as vscode from "vscode"

import { Task } from "../task/Task"
import { getReadablePath } from "../../utils/path"
import type { ToolUse } from "../../shared/tools"

import { BaseTool, ToolCallbacks } from "./BaseTool"

interface FindReferencesParams {
	path: string
	line: number
	character: number
}

const MAX_RESULTS = 50

export class FindReferencesTool extends BaseTool<"find_references"> {
	readonly name = "find_references" as const

	async execute(params: FindReferencesParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		const relPath = params.path
		const line = params.line
		const character = params.character

		if (!relPath) {
			task.consecutiveMistakeCount++
			task.recordToolError("find_references")
			task.didToolFailInCurrentTurn = true
			pushToolResult(await task.sayAndCreateMissingParamError("find_references", "path"))
			return
		}

		if (line === undefined || line === null) {
			task.consecutiveMistakeCount++
			task.recordToolError("find_references")
			task.didToolFailInCurrentTurn = true
			pushToolResult(await task.sayAndCreateMissingParamError("find_references", "line"))
			return
		}

		if (character === undefined || character === null) {
			task.consecutiveMistakeCount++
			task.recordToolError("find_references")
			task.didToolFailInCurrentTurn = true
			pushToolResult(await task.sayAndCreateMissingParamError("find_references", "character"))
			return
		}

		task.consecutiveMistakeCount = 0

		const absolutePath = path.resolve(task.cwd, relPath)
		const uri = vscode.Uri.file(absolutePath)
		const position = new vscode.Position(line - 1, character) // Convert 1-based line to 0-based

		try {
			const locations = await vscode.commands.executeCommand<vscode.Location[]>(
				"vscode.executeReferenceProvider",
				uri,
				position,
			)

			if (!locations || locations.length === 0) {
				const message = `No references found for symbol at ${getReadablePath(task.cwd, relPath)}:${line}:${character}`
				const didApprove = await askApproval(
					"tool",
					JSON.stringify({
						tool: "findReferences",
						path: getReadablePath(task.cwd, relPath),
						content: message,
					}),
				)
				if (!didApprove) {
					return
				}
				pushToolResult(message)
				return
			}

			const truncated = locations.length > MAX_RESULTS
			const results = locations.slice(0, MAX_RESULTS).map((loc) => {
				const targetPath = vscode.workspace.asRelativePath(loc.uri)
				return {
					path: targetPath,
					line: loc.range.start.line + 1, // Convert 0-based to 1-based
					character: loc.range.start.character,
					endLine: loc.range.end.line + 1,
					endCharacter: loc.range.end.character,
				}
			})

			const output: { results: typeof results; totalCount: number; truncated?: boolean } = {
				results,
				totalCount: locations.length,
			}
			if (truncated) {
				output.truncated = true
			}

			const content = JSON.stringify(output, null, 2)
			const didApprove = await askApproval(
				"tool",
				JSON.stringify({ tool: "findReferences", path: getReadablePath(task.cwd, relPath), content }),
			)

			if (!didApprove) {
				return
			}

			pushToolResult(content)
		} catch (error) {
			await handleError("finding references", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"find_references">): Promise<void> {
		const relPath = block.params.path
		if (!this.hasPathStabilized(relPath)) {
			return
		}
		const partialMessage = JSON.stringify({
			tool: "findReferences",
			path: getReadablePath(task.cwd, relPath ?? ""),
			content: "",
		})
		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}
}

export const findReferencesTool = new FindReferencesTool()
