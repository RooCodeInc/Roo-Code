import * as vscode from "vscode"
import path from "path"

import { Task } from "../task/Task"
import { CodeIndexManager } from "../../services/code-index/manager"
import { getWorkspacePath } from "../../utils/path"
import { formatResponse } from "../prompts/responses"
import { VectorStoreSearchResult } from "../../services/code-index/interfaces"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"
import { SymbolMetadata, ParameterInfo } from "../../services/code-index/types/metadata"

interface CodebaseSearchParams {
	query: string
	path?: string
}

export class CodebaseSearchTool extends BaseTool<"codebase_search"> {
	readonly name = "codebase_search" as const

	parseLegacy(params: Partial<Record<string, string>>): CodebaseSearchParams {
		let query = params.query
		let directoryPrefix = params.path

		if (directoryPrefix) {
			directoryPrefix = path.normalize(directoryPrefix)
		}

		return {
			query: query || "",
			path: directoryPrefix,
		}
	}

	async execute(params: CodebaseSearchParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks
		const { query, path: directoryPrefix } = params

		const workspacePath = task.cwd && task.cwd.trim() !== "" ? task.cwd : getWorkspacePath()

		if (!workspacePath) {
			await handleError("codebase_search", new Error("Could not determine workspace path."))
			return
		}

		if (!query) {
			task.consecutiveMistakeCount++
			pushToolResult(await task.sayAndCreateMissingParamError("codebase_search", "query"))
			return
		}

		const sharedMessageProps = {
			tool: "codebaseSearch",
			query: query,
			path: directoryPrefix,
			isOutsideWorkspace: false,
		}

		const didApprove = await askApproval("tool", JSON.stringify(sharedMessageProps))
		if (!didApprove) {
			pushToolResult(formatResponse.toolDenied())
			return
		}

		task.consecutiveMistakeCount = 0

		try {
			const context = task.providerRef.deref()?.context
			if (!context) {
				throw new Error("Extension context is not available.")
			}

			const manager = CodeIndexManager.getInstance(context)

			if (!manager) {
				throw new Error("CodeIndexManager is not available.")
			}

			if (!manager.isFeatureEnabled) {
				throw new Error("Code Indexing is disabled in the settings.")
			}
			if (!manager.isFeatureConfigured) {
				throw new Error("Code Indexing is not configured (Missing OpenAI Key or Qdrant URL).")
			}

			const searchResults: VectorStoreSearchResult[] = await manager.searchIndex(query, directoryPrefix)

			if (!searchResults || searchResults.length === 0) {
				pushToolResult(`No relevant code snippets found for the query: "${query}"`)
				return
			}

			const jsonResult = {
				query,
				results: [],
			} as {
				query: string
				results: Array<{
					filePath: string
					score: number
					startLine: number
					endLine: number
					codeChunk: string
					identifier: string | null
					type: string | null
					language: string | null
					// Phase 2: Enhanced metadata
					symbolMetadata?: {
						name: string
						type: string
						visibility?: string
						isExported?: boolean
						parameters?: Array<{
							name: string
							type?: string
							optional: boolean
							defaultValue?: string
						}>
						returnType?: string
						decorators?: string[]
						extends?: string
						implements?: string[]
					}
					documentation?: string
				}>
			}

			searchResults.forEach((result) => {
				if (!result.payload) return
				if (!("filePath" in result.payload)) return

				const relativePath = vscode.workspace.asRelativePath(result.payload.filePath, false)

				// Extract language from file extension
				const fileExt = path.extname(result.payload.filePath).toLowerCase()
				const languageMap: Record<string, string> = {
					'.ts': 'TypeScript',
					'.tsx': 'TypeScript React',
					'.js': 'JavaScript',
					'.jsx': 'JavaScript React',
					'.py': 'Python',
					'.java': 'Java',
					'.cpp': 'C++',
					'.c': 'C',
					'.cs': 'C#',
					'.go': 'Go',
					'.rs': 'Rust',
					'.rb': 'Ruby',
					'.php': 'PHP',
					'.swift': 'Swift',
					'.kt': 'Kotlin',
					'.scala': 'Scala',
					'.md': 'Markdown',
					'.json': 'JSON',
					'.yaml': 'YAML',
					'.yml': 'YAML',
				}
				const language = languageMap[fileExt] || null

				// Phase 2: Build enhanced result with metadata
				const enhancedResult: any = {
					filePath: relativePath,
					score: result.score,
					startLine: result.payload.startLine,
					endLine: result.payload.endLine,
					codeChunk: result.payload.codeChunk.trim(),
					identifier: result.payload.identifier || null,
					type: result.payload.type || null,
					language: language,
				}

				// Add symbolMetadata if available
				if (result.payload.symbolMetadata) {
					const metadata = result.payload.symbolMetadata
					enhancedResult.symbolMetadata = {
						name: metadata.name,
						type: metadata.type,
						...(metadata.visibility && { visibility: metadata.visibility }),
						...(metadata.isExported !== undefined && { isExported: metadata.isExported }),
						...(metadata.parameters && {
							parameters: metadata.parameters.map((p) => ({
								name: p.name,
								...(p.type && { type: p.type }),
								optional: p.optional,
								...(p.defaultValue && { defaultValue: p.defaultValue }),
							})),
						}),
						...(metadata.returnType && { returnType: metadata.returnType }),
						...(metadata.decorators && { decorators: metadata.decorators }),
						...(metadata.extends && { extends: metadata.extends }),
						...(metadata.implements && { implements: metadata.implements }),
					}
				}

				// Add documentation if available
				if (result.payload.documentation) {
					enhancedResult.documentation = result.payload.documentation
				}

				jsonResult.results.push(enhancedResult)
			})

			const payload = { tool: "codebaseSearch", content: jsonResult }
			await task.say("codebase_search_result", JSON.stringify(payload))

			const output = `Query: ${query}
Results:

${jsonResult.results
	.map(
		(result) => {
			const parts = [`File path: ${result.filePath}`]
			if (result.identifier) {
				parts.push(`Symbol: ${result.identifier}`)
			}
			if (result.type) {
				parts.push(`Type: ${result.type}`)
			}
			if (result.language) {
				parts.push(`Language: ${result.language}`)
			}
			parts.push(`Score: ${result.score}`)
			parts.push(`Lines: ${result.startLine}-${result.endLine}`)
			parts.push(`Code Chunk: ${result.codeChunk}`)
			return parts.join("\n")
		},
	)
	.join("\n\n")}`

			pushToolResult(output)
		} catch (error: any) {
			await handleError("codebase_search", error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"codebase_search">): Promise<void> {
		const query: string | undefined = block.params.query
		const directoryPrefix: string | undefined = block.params.path

		const sharedMessageProps = {
			tool: "codebaseSearch",
			query: query,
			path: directoryPrefix,
			isOutsideWorkspace: false,
		}

		await task.ask("tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
	}
}

export const codebaseSearchTool = new CodebaseSearchTool()
