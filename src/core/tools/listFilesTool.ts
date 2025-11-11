import * as path from "path"

import { Task } from "../task/Task"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { listFiles } from "../../services/glob/list-files"
import { getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"

interface ListFilesParams {
	path: string
	recursive?: boolean
}

export class ListFilesTool extends BaseTool<"list_files"> {
	readonly name = "list_files" as const

	parseLegacy(params: Partial<Record<string, string>>): ListFilesParams {
		const recursiveRaw: string | undefined = params.recursive
		const recursive = recursiveRaw?.toLowerCase() === "true"

		return {
			path: params.path || "",
			recursive,
		}
	}

	async execute(params: ListFilesParams, cline: Task, callbacks: ToolCallbacks): Promise<void> {
		const { path: relDirPath, recursive } = params
		const { askApproval, handleError, pushToolResult, removeClosingTag } = callbacks

		try {
			if (!relDirPath) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("list_files")
				pushToolResult(await cline.sayAndCreateMissingParamError("list_files", "path"))
				return
			}

			cline.consecutiveMistakeCount = 0

			const absolutePath = path.resolve(cline.cwd, relDirPath)
			const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

			const [files, didHitLimit] = await listFiles(absolutePath, recursive || false, 200)
			const { showRooIgnoredFiles = false } = (await cline.providerRef.deref()?.getState()) ?? {}

			const result = formatResponse.formatFilesList(
				absolutePath,
				files,
				didHitLimit,
				cline.rooIgnoreController,
				showRooIgnoredFiles,
				cline.rooProtectedController,
			)

			const sharedMessageProps: ClineSayTool = {
				tool: !recursive ? "listFilesTopLevel" : "listFilesRecursive",
				path: getReadablePath(cline.cwd, relDirPath),
				isOutsideWorkspace,
			}

			const completeMessage = JSON.stringify({ ...sharedMessageProps, content: result } satisfies ClineSayTool)
			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			pushToolResult(result)
		} catch (error) {
			await handleError("listing files", error)
		}
	}

	override async handlePartial(cline: Task, block: ToolUse<"list_files">): Promise<void> {
		const relDirPath: string | undefined = block.params.path
		const recursiveRaw: string | undefined = block.params.recursive
		const recursive = recursiveRaw?.toLowerCase() === "true"

		const absolutePath = relDirPath ? path.resolve(cline.cwd, relDirPath) : cline.cwd
		const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

		const sharedMessageProps: ClineSayTool = {
			tool: !recursive ? "listFilesTopLevel" : "listFilesRecursive",
			path: getReadablePath(cline.cwd, this.removeClosingTag("path", relDirPath, block.partial)),
			isOutsideWorkspace,
		}

		const partialMessage = JSON.stringify({ ...sharedMessageProps, content: "" } satisfies ClineSayTool)
		await cline.ask("tool", partialMessage, block.partial).catch(() => {})
	}

	private removeClosingTag(tag: string, text: string | undefined, isPartial: boolean): string {
		if (!isPartial) {
			return text || ""
		}

		if (!text) {
			return ""
		}

		const tagRegex = new RegExp(
			`\\s?<\/?${tag
				.split("")
				.map((char) => `(?:${char})?`)
				.join("")}$`,
			"g",
		)

		return text.replace(tagRegex, "")
	}
}

export const listFilesTool = new ListFilesTool()
