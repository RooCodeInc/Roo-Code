import * as vscode from "vscode"

export async function showHITLApproval(toolName: string, payloadPreview?: unknown): Promise<boolean> {
	const detail = payloadPreview
		? `\n\nPayload Preview:\n${JSON.stringify(payloadPreview, null, 2).slice(0, 500)}`
		: ""
	const message = `Destructive operation requested: ${toolName}.${detail}`

	const approval = await vscode.window.showWarningMessage(message, { modal: true }, "Approve", "Reject")
	return approval === "Approve"
}
