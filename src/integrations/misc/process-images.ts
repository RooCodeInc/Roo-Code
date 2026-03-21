import * as vscode from "vscode"
import fs from "fs/promises"
import * as path from "path"
import { maybeResizeImage, DEFAULT_IMAGE_DOWNSCALE_QUALITY } from "./resize-image"

export interface SelectImagesOptions {
	/** Maximum dimension (width or height) in pixels for downscaling. 0 = disabled. */
	maxDimension?: number
	/** JPEG/WebP quality (1-100) for re-encoding resized images. */
	quality?: number
}

export async function selectImages(options?: SelectImagesOptions): Promise<string[]> {
	const dialogOptions: vscode.OpenDialogOptions = {
		canSelectMany: true,
		openLabel: "Select",
		filters: {
			Images: ["png", "jpg", "jpeg", "webp"], // supported by anthropic and openrouter
		},
	}

	const fileUris = await vscode.window.showOpenDialog(dialogOptions)

	if (!fileUris || fileUris.length === 0) {
		return []
	}

	return await Promise.all(
		fileUris.map(async (uri) => {
			const imagePath = uri.fsPath
			let buffer = await fs.readFile(imagePath)
			const mimeType = getMimeType(imagePath)

			// Downscale if configured
			if (options?.maxDimension && options.maxDimension > 0) {
				const resizeResult = await maybeResizeImage({
					buffer,
					mimeType,
					maxDimension: options.maxDimension,
					quality: options.quality ?? DEFAULT_IMAGE_DOWNSCALE_QUALITY,
				})
				buffer = resizeResult.buffer
			}

			const base64 = buffer.toString("base64")
			const dataUrl = `data:${mimeType};base64,${base64}`
			return dataUrl
		}),
	)
}

function getMimeType(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase()
	switch (ext) {
		case ".png":
			return "image/png"
		case ".jpeg":
		case ".jpg":
			return "image/jpeg"
		case ".webp":
			return "image/webp"
		default:
			throw new Error(`Unsupported file type: ${ext}`)
	}
}
