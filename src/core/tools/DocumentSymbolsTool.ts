import path from "path"

import * as vscode from "vscode"

import { Task } from "../task/Task"
import { getReadablePath } from "../../utils/path"
import type { ToolUse } from "../../shared/tools"

import { BaseTool, ToolCallbacks } from "./BaseTool"

interface DocumentSymbolsParams {
	path: string
}

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

interface FlatSymbol {
	name: string
	kind: string
	line: number
	endLine: number
	children?: FlatSymbol[]
}

/**
 * Flatten a DocumentSymbol tree into a simple list with nesting preserved via `children`.
 */
function flattenSymbols(symbols: vscode.DocumentSymbol[]): FlatSymbol[] {
	return symbols.map((sym) => {
		const result: FlatSymbol = {
			name: sym.name,
			kind: symbolKindToString(sym.kind),
			line: sym.range.start.line + 1,
			endLine: sym.range.end.line + 1,
		}
		if (sym.children && sym.children.length > 0) {
			result.children = flattenSymbols(sym.children)
		}
		return result
	})
}

export class DocumentSymbolsTool extends BaseTool<"document_symbols"> {
	readonly name = "document_symbols" as const

	async execute(params: DocumentSymbolsParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		const relPath = params.path

		if (!relPath) {
			task.consecutiveMistakeCount++
			task.recordToolError("document_symbols")
			task.didToolFailInCurrentTurn = true
			pushToolResult(await task.sayAndCreateMissingParamError("document_symbols", "path"))
			return
		}

		task.consecutiveMistakeCount = 0

		const absolutePath = path.resolve(task.cwd, relPath)
		const uri = vscode.Uri.file(absolutePath)

		try {
			const symbols = await vscode.commands.executeCommand<(vscode.DocumentSymbol | vscode.SymbolInformation)[]>(
				"vscode.executeDocumentSymbolProvider",
				uri,
			)

			if (!symbols || symbols.length === 0) {
				const message = `No symbols found in ${getReadablePath(task.cwd, relPath)}`
				const didApprove = await askApproval(
					"tool",
					JSON.stringify({
						tool: "documentSymbols",
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

			// DocumentSymbol has children; SymbolInformation is flat.
			let results: FlatSymbol[]
			if ("range" in symbols[0] && "children" in symbols[0]) {
				// DocumentSymbol[]
				results = flattenSymbols(symbols as vscode.DocumentSymbol[])
			} else {
				// SymbolInformation[] (fallback)
				results = (symbols as vscode.SymbolInformation[]).map((sym) => ({
					name: sym.name,
					kind: symbolKindToString(sym.kind),
					line: sym.location.range.start.line + 1,
					endLine: sym.location.range.end.line + 1,
				}))
			}

			const content = JSON.stringify(results, null, 2)
			const didApprove = await askApproval(
				"tool",
				JSON.stringify({ tool: "documentSymbols", path: getReadablePath(task.cwd, relPath), content }),
			)

			if (!didApprove) {
				return
			}

			pushToolResult(content)
		} catch (error) {
			await handleError("listing document symbols", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"document_symbols">): Promise<void> {
		const relPath = block.params.path
		if (!this.hasPathStabilized(relPath)) {
			return
		}
		const partialMessage = JSON.stringify({
			tool: "documentSymbols",
			path: getReadablePath(task.cwd, relPath ?? ""),
			content: "",
		})
		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}
}

export const documentSymbolsTool = new DocumentSymbolsTool()
