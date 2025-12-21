import * as vscode from "vscode"
import { isJetbrainsPlatform } from "../../../utils/platform"

export const renderModes = {
	noLimit: {
		limit: 0,
		interval: 16,
	},
	fast: {
		limit: 1,
		interval: 50,
	},
	medium: {
		limit: 5,
		interval: 100,
	},
	slow: {
		limit: 10,
		interval: 150,
	},
}

export function getApiResponseRenderMode() {
	if (isJetbrainsPlatform()) {
		return renderModes.fast
	}
	const apiResponseRenderMode = vscode.workspace
		.getConfiguration("zgsm")
		.get<string>("apiResponseRenderMode", "medium") as "fast" | "medium" | "slow" | "noLimit"

	return renderModes[apiResponseRenderMode] || renderModes["fast"]
}
