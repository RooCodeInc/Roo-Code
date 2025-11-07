import * as vscode from "vscode"

/**
 * Open a file picker to select images, returning absolute file system paths.
 * Rendering-friendly webview URIs will be produced in the webviewMessageHandler.
 */
export async function selectImages(): Promise<string[]> {
	const options: vscode.OpenDialogOptions = {
		canSelectMany: true,
		openLabel: "Select",
		filters: {
			Images: ["png", "jpg", "jpeg", "webp"], // supported by anthropic and openrouter
		},
	}

	const fileUris = await vscode.window.showOpenDialog(options)
	if (!fileUris || fileUris.length === 0) {
		return []
	}

	// Return fs paths only; do not read/encode files here.
	return fileUris.map((uri) => uri.fsPath)
}
