import * as vscode from "vscode"

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
	const apiResponseRenderMode = vscode.workspace
		.getConfiguration("zgsm")
		.get<string>("apiResponseRenderMode", "medium") as "fast" | "medium" | "slow" | "noLimit"

	return renderModes[apiResponseRenderMode] || renderModes["fast"]
}
