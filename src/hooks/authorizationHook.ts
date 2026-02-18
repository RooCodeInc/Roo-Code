/**
 * Phase 2 — UI-Blocking Authorization Hook
 *
 * Requirement 2: Pause the Promise chain and trigger
 * `vscode.window.showWarningMessage` with "Approve" / "Reject" buttons.
 *
 * If the user rejects, the hook returns `proceed: false` with a
 * standardised JSON tool-error (Requirement 3) so the LLM can
 * self-correct without crashing.
 */

import * as vscode from "vscode"
import type { HookContext, HookResult } from "./types"
import { buildAuthorizationRejectedError } from "./toolError"

// ---------------------------------------------------------------------------
// Authorization Hook
// ---------------------------------------------------------------------------

/**
 * UI-Blocking Authorization pre-hook.
 *
 * Shows a VS Code modal warning dialog asking the user to Approve or
 * Reject the destructive tool call. The Promise chain is paused until
 * the user responds.
 *
 * @param ctx - Hook context containing tool name and intent info
 * @returns HookResult with `proceed: true` on approval, `proceed: false` on rejection
 */
export async function authorizationHook(ctx: HookContext): Promise<HookResult> {
	// Build descriptive message for the dialog
	const intentLabel = ctx.activeIntentId ? ` under intent "${ctx.activeIntentId}"` : ""

	const message =
		`[Intent Governance] The agent wants to execute "${ctx.toolName}"${intentLabel}.\n\n` +
		`Tool parameters:\n${formatParams(ctx.params)}\n\n` +
		`Do you approve this action?`

	// Show modal warning — this BLOCKS the Promise chain until the user responds
	const choice = await vscode.window.showWarningMessage(message, { modal: true }, "Approve", "Reject")

	if (choice === "Approve") {
		return { proceed: true }
	}

	// Rejected or dismissed (Escape / close) → treat as rejection
	const errorPayload = buildAuthorizationRejectedError(ctx.toolName, ctx.activeIntentId)

	return {
		proceed: false,
		error: errorPayload,
		reason: `User rejected execution of "${ctx.toolName}"`,
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format tool parameters for display in the warning dialog.
 * Truncates long values to keep the dialog readable.
 */
function formatParams(params: Record<string, unknown>): string {
	const MAX_VALUE_LEN = 120
	const entries = Object.entries(params)

	if (entries.length === 0) {
		return "  (no parameters)"
	}

	return entries
		.map(([key, value]) => {
			let display: string
			if (typeof value === "string") {
				display = value.length > MAX_VALUE_LEN ? value.slice(0, MAX_VALUE_LEN) + "…" : value
			} else {
				const json = JSON.stringify(value)
				display = json.length > MAX_VALUE_LEN ? json.slice(0, MAX_VALUE_LEN) + "…" : json
			}
			return `  ${key}: ${display}`
		})
		.join("\n")
}
