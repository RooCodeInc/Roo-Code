import path from "path"
import fs from "fs/promises"
import * as vscode from "vscode"
import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"
import { t } from "../../i18n"

interface SaveImageParams {
	path: string
	data: string
}

export class SaveImageTool extends BaseTool<"save_image"> {
	readonly name = "save_image" as const

	async execute(params: SaveImageParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { path: relPath, data } = params
		const { handleError, pushToolResult, askApproval } = callbacks

		// Validate required parameters
		if (!relPath) {
			task.consecutiveMistakeCount++
			task.recordToolError("save_image")
			pushToolResult(await task.sayAndCreateMissingParamError("save_image", "path"))
			return
		}

		if (!data) {
			task.consecutiveMistakeCount++
			task.recordToolError("save_image")
			pushToolResult(await task.sayAndCreateMissingParamError("save_image", "data"))
			return
		}

		// Validate the image data format first (to determine finalPath)
		const base64Match = data.match(/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,(.+)$/)
		if (!base64Match) {
			await task.say("error", t("tools:saveImage.invalidDataFormat"))
			task.didToolFailInCurrentTurn = true
			pushToolResult(
				formatResponse.toolError(
					"Invalid image data format. Expected a base64 data URL (e.g., 'data:image/png;base64,...').",
				),
			)
			return
		}

		const imageFormat = base64Match[1]
		const base64Data = base64Match[2]

		// Ensure the path has a valid image extension
		let finalPath = relPath
		if (!finalPath.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
			// Add extension based on the data format
			const ext = imageFormat === "jpeg" ? "jpg" : imageFormat === "svg+xml" ? "svg" : imageFormat
			finalPath = `${finalPath}.${ext}`
		}

		// Validate access via .rooignore (using finalPath after extension is added)
		const accessAllowed = task.rooIgnoreController?.validateAccess(finalPath)
		if (!accessAllowed) {
			await task.say("rooignore_error", finalPath)
			pushToolResult(formatResponse.rooIgnoreError(finalPath))
			return
		}

		// Check write protection (using finalPath after extension is added)
		const isWriteProtected = task.rooProtectedController?.isWriteProtected(finalPath) || false

		const fullPath = path.resolve(task.cwd, finalPath)
		const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

		const sharedMessageProps = {
			tool: "saveImage" as const,
			path: getReadablePath(task.cwd, finalPath),
			isOutsideWorkspace,
			isProtected: isWriteProtected,
		}

		try {
			task.consecutiveMistakeCount = 0

			const approvalMessage = JSON.stringify({
				...sharedMessageProps,
				content: `Save image to ${getReadablePath(task.cwd, finalPath)}`,
			})

			const didApprove = await askApproval("tool", approvalMessage, undefined, isWriteProtected)

			if (!didApprove) {
				return
			}

			// Convert base64 to buffer and save
			const imageBuffer = Buffer.from(base64Data, "base64")

			const absolutePath = path.resolve(task.cwd, finalPath)
			const directory = path.dirname(absolutePath)
			await fs.mkdir(directory, { recursive: true })

			await fs.writeFile(absolutePath, imageBuffer)

			// Track the file context
			if (finalPath) {
				await task.fileContextTracker.trackFileContext(finalPath, "roo_edited")
			}

			task.didEditFile = true

			task.recordToolUsage("save_image")

			const provider = task.providerRef.deref()
			const fullImagePath = path.join(task.cwd, finalPath)

			let imageUri = provider?.convertToWebviewUri?.(fullImagePath) ?? vscode.Uri.file(fullImagePath).toString()

			// Add cache buster to force refresh
			const cacheBuster = Date.now()
			imageUri = imageUri.includes("?") ? `${imageUri}&t=${cacheBuster}` : `${imageUri}?t=${cacheBuster}`

			await task.say("image", JSON.stringify({ imageUri, imagePath: fullImagePath }))
			pushToolResult(formatResponse.toolResult(`Image saved to ${getReadablePath(task.cwd, finalPath)}`))
		} catch (error) {
			await handleError("saving image", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"save_image">): Promise<void> {
		return
	}
}

export const saveImageTool = new SaveImageTool()
