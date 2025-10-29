import * as vscode from "vscode"
export function isJetbrainsPlatform(): boolean {
	return ["intellij-machine", "development-machine"].includes(vscode?.env?.machineId)
}
