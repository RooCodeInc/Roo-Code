import * as vscode from "vscode"

export let isJetbrains: boolean | undefined

export function isJetbrainsPlatform(): boolean {
	if (isJetbrains !== undefined) return isJetbrains

	isJetbrains = ["intellij-machine", "development-machine"].includes(vscode?.env?.machineId)

	return isJetbrains
}
