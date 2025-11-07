import * as path from "path"
import * as os from "os"
import * as vscode from "vscode"
import * as fs from "fs/promises"
import { getWorkspacePath } from "../../utils/path"
import { t } from "../../i18n"
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
import { setImageBase64ForPath } from "./image-cache"

export async function openImage(dataUriOrPath: string, options?: { values?: { action?: string } }) {
	// Minimal handling for VS Code webview CDN URLs:
	// Example: https://file+.vscode-resource.vscode-cdn.net/file/<absolute_path_to_image>
	try {
		const u = vscode.Uri.parse(dataUriOrPath)
		if (
			u.scheme === "https" &&
			u.authority &&
			(u.authority === "vscode-cdn.net" || u.authority.endsWith(".vscode-cdn.net"))
		) {
			let fsPath = decodeURIComponent(u.path || "")
			// Strip the leading "/file/" prefix if present
			if (fsPath.startsWith("/file/")) {
				fsPath = fsPath.slice("/file/".length)
			}
			fsPath = path.normalize(fsPath)
			if (fsPath) {
				if (options?.values?.action === "copy") {
					await vscode.env.clipboard.writeText(fsPath)
					vscode.window.showInformationMessage(t("common:info.path_copied_to_clipboard"))
					return
				}
				const fileUri = vscode.Uri.file(fsPath)
				await vscode.commands.executeCommand("vscode.open", fileUri)
				return
			}
		}
	} catch {
		// fall through
	}

	// Handle file:// URIs directly
	if (dataUriOrPath.startsWith("file://")) {
		try {
			const fileUri = vscode.Uri.parse(dataUriOrPath)
			const filePath = fileUri.fsPath

			if (options?.values?.action === "copy") {
				await vscode.env.clipboard.writeText(filePath)
				vscode.window.showInformationMessage(t("common:info.path_copied_to_clipboard"))
				return
			}

			await vscode.commands.executeCommand("vscode.open", fileUri)
		} catch (error) {
			vscode.window.showErrorMessage(t("common:errors.error_opening_image", { error }))
		}
		return
	}

	// Fallback: treat plain strings (absolute or relative) as file paths
	const isFilePath =
		!dataUriOrPath.startsWith("data:") &&
		!dataUriOrPath.startsWith("http:") &&
		!dataUriOrPath.startsWith("https:") &&
		!dataUriOrPath.startsWith("vscode-resource:") &&
		!dataUriOrPath.startsWith("file+.vscode-resource") &&
		!dataUriOrPath.startsWith("vscode-webview-resource:")

	if (isFilePath) {
		try {
			let filePath = dataUriOrPath
			if (!path.isAbsolute(filePath)) {
				const workspacePath = getWorkspacePath()
				if (workspacePath) {
					filePath = path.join(workspacePath, filePath)
				}
			}

			const fileUri = vscode.Uri.file(filePath)

			if (options?.values?.action === "copy") {
				await vscode.env.clipboard.writeText(filePath)
				vscode.window.showInformationMessage(t("common:info.path_copied_to_clipboard"))
				return
			}

			await vscode.commands.executeCommand("vscode.open", fileUri)
		} catch (error) {
			vscode.window.showErrorMessage(t("common:errors.error_opening_image", { error }))
		}
		return
	}

	// Finally, handle base64 data URIs explicitly
	const matches = dataUriOrPath.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/)
	if (!matches) {
		// Do not show an "invalid data URI" error for non-data URIs; try opening as a generic URI
		try {
			const generic = vscode.Uri.parse(dataUriOrPath)
			await vscode.commands.executeCommand("vscode.open", generic)
		} catch {
			vscode.window.showErrorMessage(t("common:errors.invalid_data_uri"))
		}
		return
	}

	const [, format, base64Data] = matches
	const imageBuffer = Buffer.from(base64Data, "base64")

	const tempFilePath = path.join(os.tmpdir(), `temp_image_${Date.now()}.${format}`)
	try {
		await vscode.workspace.fs.writeFile(vscode.Uri.file(tempFilePath), imageBuffer)

		if (options?.values?.action === "copy") {
			try {
				const imageData = await vscode.workspace.fs.readFile(vscode.Uri.file(tempFilePath))
				const base64Image = Buffer.from(imageData).toString("base64")
				const dataUri = `data:image/${format};base64,${base64Image}`
				await vscode.env.clipboard.writeText(dataUri)
				vscode.window.showInformationMessage(t("common:info.image_copied_to_clipboard"))
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				vscode.window.showErrorMessage(t("common:errors.error_copying_image", { errorMessage }))
			} finally {
				try {
					await vscode.workspace.fs.delete(vscode.Uri.file(tempFilePath))
				} catch {}
			}
			return
		}

		await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(tempFilePath))
	} catch (error) {
		vscode.window.showErrorMessage(t("common:errors.error_opening_image", { error }))
	}
}

/**
 * Save a pasted/dropped image to global storage and return its path and webview URI
 * This uses VSCode's global storage for persistence across sessions
 */
export async function importImageToGlobalStorage(
	imagePath: string,
	provider?: any,
): Promise<{ imagePath: string; imageUri: string } | null> {
	try {
		// Determine storage directory (global storage preferred, fallback to temp)
		let imagesDir: string
		if (provider?.contextProxy?.globalStorageUri) {
			const globalStoragePath = provider.contextProxy.globalStorageUri.fsPath
			const taskId = provider.getCurrentTask?.()?.taskId
			imagesDir = taskId
				? path.join(globalStoragePath, "user-images", `task-${taskId}`)
				: path.join(globalStoragePath, "user-images", "general")
		} else {
			console.warn("Provider context not available, falling back to temp directory")
			imagesDir = path.join(os.tmpdir(), "roo-user-images")
		}

		await fs.mkdir(imagesDir, { recursive: true })

		// Preserve original extension if possible
		const ext = path.extname(imagePath) || ".png"
		const timestamp = Date.now()
		const randomId = Math.random().toString(36).substring(2, 8)
		const destFileName = `imported_image_${timestamp}_${randomId}${ext}`
		const destPath = path.join(imagesDir, destFileName)

		// Copy the original image into global storage
		await fs.copyFile(imagePath, destPath)

		// Convert to webview URI
		let webviewUri = provider?.convertToWebviewUri?.(destPath) ?? vscode.Uri.file(destPath).toString()

		return { imagePath: destPath, imageUri: webviewUri }
	} catch (error) {
		console.error("Failed to import image into global storage:", error)
		return null
	}
}

export async function savePastedImageToTemp(
	dataUri: string,
	provider?: any,
): Promise<{ imagePath: string; imageUri: string } | null> {
	const matches = dataUri.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/)
	if (!matches) {
		return null
	}

	const [, format, base64Data] = matches
	// Enforce a 10MB/image limit (approximate from base64 length)
	{
		const approxBytes = Math.floor((base64Data.replace(/=+$/, "").length * 3) / 4)
		if (approxBytes > MAX_IMAGE_BYTES) {
			console.error("Pasted image exceeds 10MB limit")
			return null
		}
	}
	const imageBuffer = Buffer.from(base64Data, "base64")

	// Determine storage directory
	let imagesDir: string

	// Use global storage if provider context is available
	if (provider?.contextProxy?.globalStorageUri) {
		const globalStoragePath = provider.contextProxy.globalStorageUri.fsPath

		// Organize by task ID if available
		const taskId = provider.getCurrentTask?.()?.taskId
		if (taskId) {
			imagesDir = path.join(globalStoragePath, "pasted-images", `task-${taskId}`)
		} else {
			// Fallback to general pasted-images directory
			imagesDir = path.join(globalStoragePath, "pasted-images", "general")
		}
	} else {
		// Fallback to temp directory if provider context is not available
		console.warn("Provider context not available, falling back to temp directory")
		imagesDir = path.join(os.tmpdir(), "roo-pasted-images")
	}

	// Create directory if it doesn't exist
	await fs.mkdir(imagesDir, { recursive: true })

	// Generate a unique filename
	const timestamp = Date.now()
	const randomId = Math.random().toString(36).substring(2, 8)
	const fileName = `pasted_image_${timestamp}_${randomId}.${format}`
	const imagePath = path.join(imagesDir, fileName)

	try {
		// Write the image to the file
		await fs.writeFile(imagePath, imageBuffer)

		// Since this image originated as base64 from the UI, cache the dataUrl to avoid future re-encoding
		// Reconstruct the full data URL using the original input
		setImageBase64ForPath(imagePath, dataUri)

		// Convert to webview URI if provider is available
		let imageUri = provider?.convertToWebviewUri?.(imagePath) ?? vscode.Uri.file(imagePath).toString()

		// Do not append custom query params to VS Code webview URIs (can break auth token and cause 401)

		return { imagePath, imageUri }
	} catch (error) {
		console.error("Failed to save pasted image:", error)
		return null
	}
}

export async function saveImage(dataUri: string) {
	const matches = dataUri.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/)
	if (!matches) {
		vscode.window.showErrorMessage(t("common:errors.invalid_data_uri"))
		return
	}
	const [, format, base64Data] = matches
	const imageBuffer = Buffer.from(base64Data, "base64")

	// Get workspace path or fallback to home directory
	const workspacePath = getWorkspacePath()
	const defaultPath = workspacePath || os.homedir()
	const defaultFileName = `img_${Date.now()}.${format}`
	const defaultUri = vscode.Uri.file(path.join(defaultPath, defaultFileName))

	// Show save dialog
	const saveUri = await vscode.window.showSaveDialog({
		filters: {
			Images: [format],
			"All Files": ["*"],
		},
		defaultUri: defaultUri,
	})

	if (!saveUri) {
		// User cancelled the save dialog
		return
	}

	try {
		// Write the image to the selected location
		await vscode.workspace.fs.writeFile(saveUri, imageBuffer)
		vscode.window.showInformationMessage(t("common:info.image_saved", { path: saveUri.fsPath }))
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		vscode.window.showErrorMessage(t("common:errors.error_saving_image", { errorMessage }))
	}
}
