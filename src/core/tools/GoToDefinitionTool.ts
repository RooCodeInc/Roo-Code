import path from "path"

import * as vscode from "vscode"

import { Task } from "../task/Task"
import { getReadablePath } from "../../utils/path"
import type { ToolUse } from "../../shared/tools"

import { BaseTool, ToolCallbacks } from "./BaseTool"

interface GoToDefinitionParams {
	path: string
	line: number
	character: number
}

const MAX_RESULTS = 50

export class GoToDefinitionTool extends BaseTool<"go_to_definition"> {
	readonly name = "go_to_definition" as const

	async execute(params: GoToDefinitionParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		const relPath = params.path
		const line = params.line
		const character = params.character

		if (!relPath) {
			task.consecutiveMistakeCount++
			task.recordToolError("go_to_definition")
			task.didToolFailInCurrentTurn = true
			pushToolResult(await task.sayAndCreateMissingParamError("go_to_definition", "path"))
			return
		}

		if (line === undefined || line === null) {
			task.consecutiveMistakeCount++
			task.recordToolError("go_to_definition")
			task.didToolFailInCurrentTurn = true
			pushToolResult(await task.sayAndCreateMissingParamError("go_to_definition", "line"))
			return
		}

		if (character === undefined || character === null) {
			task.consecutiveMistakeCount++
			task.recordToolError("go_to_definition")
			task.didToolFailInCurrentTurn = true
			pushToolResult(await task.sayAndCreateMissingParamError("go_to_definition", "character"))
			return
		}

		task.consecutiveMistakeCount = 0

		const absolutePath = path.resolve(task.cwd, relPath)
		const uri = vscode.Uri.file(absolutePath)
		const position = new vscode.Position(line - 1, character) // Convert 1-based line to 0-based

		try {
			const locations = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
				"vscode.executeDefinitionProvider",
				uri,
				position,
			)

			if (!locations || locations.length === 0) {
				const message = `No definition found for symbol at ${getReadablePath(task.cwd, relPath)}:${line}:${character}`
				const didApprove = await askApproval(
					"tool",
					JSON.stringify({
						tool: "goToDefinition",
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

			const results = locations.slice(0, MAX_RESULTS).map((loc) => {
				if ("targetUri" in loc) {
					// LocationLink
					const targetPath = vscode.workspace.asRelativePath(loc.targetUri)
					return {
						path: targetPath,
						line: loc.targetRange.start.line + 1, // Convert 0-based to 1-based
						character: loc.targetRange.start.character,
						endLine: loc.targetRange.end.line + 1,
						endCharacter: loc.targetRange.end.character,
					}
				} else {
					// Location
					const targetPath = vscode.workspace.asRelativePath(loc.uri)
					return {
						path: targetPath,
						line: loc.range.start.line + 1,
						character: loc.range.start.character,
						endLine: loc.range.end.line + 1,
						endCharacter: loc.range.end.character,
					}
				}
			})

			const content = JSON.stringify(results, null, 2)
			const didApprove = await askApproval(
				"tool",
				JSON.stringify({ tool: "goToDefinition", path: getReadablePath(task.cwd, relPath), content }),
			)

			if (!didApprove) {
				return
			}

			pushToolResult(content)
		} catch (error) {
			await handleError("finding definition", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"go_to_definition">): Promise<void> {
		const relPath = block.params.path
		if (!this.hasPathStabilized(relPath)) {
			return
		}
		const partialMessage = JSON.stringify({
			tool: "goToDefinition",
			path: getReadablePath(task.cwd, relPath ?? ""),
			content: "",
		})
		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}
}

export const goToDefinitionTool = new GoToDefinitionTool()
