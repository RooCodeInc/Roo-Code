import * as vscode from "vscode"

export type HitlDecision = "approve_once" | "approve_always_session" | "deny"

const APPROVE_ONCE = "Approve once"
const APPROVE_ALWAYS = "Approve always (session)"
const DENY = "Deny"

const sessionApprovalCache = new Set<string>()

export async function requestHitlApproval(toolName: string, reason: string): Promise<HitlDecision> {
	if (sessionApprovalCache.has(toolName)) {
		return "approve_always_session"
	}

	const decision = await vscode.window.showWarningMessage(
		`Governance approval required for "${toolName}". ${reason}`,
		{ modal: true, detail: "Select approval scope for this session." },
		APPROVE_ONCE,
		APPROVE_ALWAYS,
		DENY,
	)

	if (decision === APPROVE_ALWAYS) {
		sessionApprovalCache.add(toolName)
		return "approve_always_session"
	}
	if (decision === APPROVE_ONCE) {
		return "approve_once"
	}
	return "deny"
}

