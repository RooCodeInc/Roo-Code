import * as vscode from "vscode"

import { Task } from "../task/Task"
import type { ToolUse } from "../../shared/tools"

import { BaseTool, ToolCallbacks } from "./BaseTool"

interface WorkspaceSymbolsParams {
	query: string
}

const MAX_RESULTS = 100

/**
 * Maps VS Code SymbolKind enum values to human-readable strings.
 */
function symbolKindToString(kind: vscode.SymbolKind): string {
	const kindMap: Record<number, string> = {
		[vscode.SymbolKind.File]: "File",
		[vscode.SymbolKind.Module]: "Module",
		[vscode.SymbolKind.Namespace]: "Namespace",
		[vscode.SymbolKind.Package]: "Package",
		[vscode.SymbolKind.Class]: "Class",
		[vscode.SymbolKind.Method]: "Method",
		[vscode.SymbolKind.Property]: "Property",
		[vscode.SymbolKind.Field]: "Field",
		[vscode.SymbolKind.Constructor]: "Constructor",
		[vscode.SymbolKind.Enum]: "Enum",
		[vscode.SymbolKind.Interface]: "Interface",
		[vscode.SymbolKind.Function]: "Function",
		[vscode.SymbolKind.Variable]: "Variable",
		[vscode.SymbolKind.Constant]: "Constant",
		[vscode.SymbolKind.String]: "String",
		[vscode.SymbolKind.Number]: "Number",
		[vscode.SymbolKind.Boolean]: "Boolean",
		[vscode.SymbolKind.Array]: "Array",
		[vscode.SymbolKind.Object]: "Object",
		[vscode.SymbolKind.Key]: "Key",
		[vscode.SymbolKind.Null]: "Null",
		[vscode.SymbolKind.EnumMember]: "EnumMember",
		[vscode.SymbolKind.Struct]: "Struct",
		[vscode.SymbolKind.Event]: "Event",
		[vscode.SymbolKind.Operator]: "Operator",
		[vscode.SymbolKind.TypeParameter]: "TypeParameter",
	}
	return kindMap[kind] ?? "Unknown"
}

export class WorkspaceSymbolsTool extends BaseTool<"workspace_symbols"> {
	readonly name = "workspace_symbols" as const

	async execute(params: WorkspaceSymbolsParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		const query = params.query

		if (!query) {
			task.consecutiveMistakeCount++
			task.recordToolError("workspace_symbols")
			task.didToolFailInCurrentTurn = true
			pushToolResult(await task.sayAndCreateMissingParamError("workspace_symbols", "query"))
			return
		}

		task.consecutiveMistakeCount = 0

		try {
			const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
				"vscode.executeWorkspaceSymbolProvider",
				query,
			)

			if (!symbols || symbols.length === 0) {
				const message = `No workspace symbols found matching "${query}"`
				const didApprove = await askApproval(
					"tool",
					JSON.stringify({ tool: "workspaceSymbols", query, content: message }),
				)
				if (!didApprove) {
					return
				}
				pushToolResult(message)
				return
			}

			const truncated = symbols.length > MAX_RESULTS
			const results = symbols.slice(0, MAX_RESULTS).map((sym) => {
				const symPath = vscode.workspace.asRelativePath(sym.location.uri)
				return {
					name: sym.name,
					kind: symbolKindToString(sym.kind),
					path: symPath,
					line: sym.location.range.start.line + 1,
					character: sym.location.range.start.character,
					containerName: sym.containerName || undefined,
				}
			})

			const output: { results: typeof results; totalCount: number; truncated?: boolean } = {
				results,
				totalCount: symbols.length,
			}
			if (truncated) {
				output.truncated = true
			}

			const content = JSON.stringify(output, null, 2)
			const didApprove = await askApproval("tool", JSON.stringify({ tool: "workspaceSymbols", query, content }))

			if (!didApprove) {
				return
			}

			pushToolResult(content)
		} catch (error) {
			await handleError("searching workspace symbols", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"workspace_symbols">): Promise<void> {
		const query = block.params.query
		const partialMessage = JSON.stringify({
			tool: "workspaceSymbols",
			query: query ?? "",
			content: "",
		})
		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}
}

export const workspaceSymbolsTool = new WorkspaceSymbolsTool()
