import * as vscode from "vscode"

let editorType = ""

export const getEditorType = () => {
	if (editorType) return editorType
	const remoteName = vscode.env.remoteName
	if (remoteName) {
		// Remote connection - show the remote type (e.g., "ssh", "wsl", "dev-container", etc.)
		editorType = `Remote (${remoteName})`
	} else {
		// Local editor - show the specific VS Code edition/type, RunVsAgent "IntelliJ IDEA"
		const appName = vscode.env.appName
		editorType = `${appName}`
	}

	return editorType
}
