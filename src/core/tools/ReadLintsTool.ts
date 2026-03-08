import * as path from "path"
import * as vscode from "vscode"

import { Task } from "../task/Task"
import { diagnosticsToProblemsString } from "../../integrations/diagnostics"
import type { ToolUse } from "../../shared/tools"

import { BaseTool, ToolCallbacks } from "./BaseTool"

const NO_EDITS_MESSAGE =
	"No files have been edited in this task yet. Edit a file, then use read_lints to see errors and warnings."
const NO_PROBLEMS_MESSAGE = "No errors or warnings detected."

interface ReadLintsParams {
	paths?: string[]
}

/**
 * Normalize a path to POSIX relative form for comparison with editedFilePaths.
 */
function toRelativePosix(cwd: string, absolutePath: string): string {
	return path.relative(cwd, absolutePath).toPosix()
}

/**
 * Check if a file URI is under a directory (both relative to cwd).
 */
function isUnderDir(fileRelPosix: string, dirRelPosix: string): boolean {
	if (dirRelPosix === "." || dirRelPosix === "") {
		return true
	}
	const norm = dirRelPosix.endsWith("/") ? dirRelPosix : dirRelPosix + "/"
	return fileRelPosix === dirRelPosix || fileRelPosix.startsWith(norm)
}

export class ReadLintsTool extends BaseTool<"read_lints"> {
	readonly name = "read_lints" as const

	async execute(params: ReadLintsParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, handleError } = callbacks
		const { paths } = params
		const cwd = task.cwd

		try {
			const state = await task.providerRef.deref()?.getState()
			const includeDiagnosticMessages = state?.includeDiagnosticMessages ?? true
			const maxDiagnosticMessages = state?.maxDiagnosticMessages ?? 50

			if (!includeDiagnosticMessages) {
				pushToolResult(NO_PROBLEMS_MESSAGE)
				return
			}

			let diagnosticsTuples: [vscode.Uri, vscode.Diagnostic[]][] = []

			if (paths === undefined || paths.length === 0) {
				// No paths: return diagnostics only for files edited in this task
				if (task.editedFilePaths.size === 0) {
					pushToolResult(NO_EDITS_MESSAGE)
					return
				}
				const allDiagnostics = vscode.languages.getDiagnostics()
				const editedSet = task.editedFilePaths
				for (const [uri, diags] of allDiagnostics) {
					const relPosix = toRelativePosix(cwd, uri.fsPath)
					if (editedSet.has(relPosix)) {
						diagnosticsTuples.push([uri, diags])
					}
				}
			} else {
				// Paths provided: return diagnostics for those files/directories
				const allDiagnostics = vscode.languages.getDiagnostics()
				const dirPaths: string[] = []
				const fileUris: vscode.Uri[] = []

				for (const relPath of paths) {
					if (!relPath || typeof relPath !== "string") continue
					const absolutePath = path.resolve(cwd, relPath)
					const uri = vscode.Uri.file(absolutePath)
					try {
						const stat = await vscode.workspace.fs.stat(uri)
						if (stat.type === vscode.FileType.Directory) {
							dirPaths.push(toRelativePosix(cwd, absolutePath))
						} else {
							fileUris.push(uri)
						}
					} catch {
						// Path may not exist; treat as file and try getDiagnostics(uri)
						fileUris.push(uri)
					}
				}

				const seenUri = new Set<string>()
				for (const uri of fileUris) {
					const diags = vscode.languages.getDiagnostics(uri)
					if (diags.length > 0) {
						diagnosticsTuples.push([uri, diags])
						seenUri.add(uri.toString())
					}
				}
				for (const [uri, diags] of allDiagnostics) {
					if (diags.length === 0 || seenUri.has(uri.toString())) continue
					const fileRelPosix = toRelativePosix(cwd, uri.fsPath)
					const included = dirPaths.some((dirRelPosix) => isUnderDir(fileRelPosix, dirRelPosix))
					if (included) {
						diagnosticsTuples.push([uri, diags])
					}
				}
			}

			const result = await diagnosticsToProblemsString(
				diagnosticsTuples,
				[vscode.DiagnosticSeverity.Error, vscode.DiagnosticSeverity.Warning],
				cwd,
				true,
				maxDiagnosticMessages,
			)

			pushToolResult(result.trim() ? result.trim() : NO_PROBLEMS_MESSAGE)
		} catch (error) {
			await handleError("reading lints", error instanceof Error ? error : new Error(String(error)))
		}
	}
}

export const readLintsTool = new ReadLintsTool()
