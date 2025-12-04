import * as vscode from "vscode"
import { isJetbrainsPlatform } from "./platform"

export function getAppName() {
	if (isJetbrainsPlatform()) {
		return vscode.env.appName.split("[shell]")[0]
	}

	return vscode.env.appName
}
