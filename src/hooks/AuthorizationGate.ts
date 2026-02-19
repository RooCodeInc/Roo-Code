/**
 * AuthorizationGate.ts — Phase 2: UI-Blocking Human-in-the-Loop Authorization
 *
 * Implements the HITL boundary for destructive and critical operations.
 * When the CommandClassifier identifies a tool call as DESTRUCTIVE or CRITICAL,
 * this module pauses the async execution loop and shows a native VS Code
 * warning dialog requiring explicit human approval.
 *
 * The Promise chain is PAUSED INDEFINITELY until the user clicks Approve or Reject.
 * This is the "impenetrable defense against runaway execution loops" described
 * in the research paper.
 *
 * Features:
 *   - Native vscode.window.showWarningMessage modal
 *   - Risk tier displayed in the dialog
 *   - Matched critical pattern shown for CRITICAL commands
 *   - .intentignore support for bypassing checks on specific intents
 *   - Returns structured result for HookEngine to handle
 *
 * @see CommandClassifier.ts — provides the risk classification
 * @see HookEngine.ts — orchestrates the authorization flow
 * @see TRP1 Challenge Week 1, Phase 2: UI-Blocking Authorization
 */

import * as vscode from "vscode"
import * as fs from "node:fs"
import * as path from "node:path"

import { RiskTier, type ClassificationResult } from "./CommandClassifier"

// ── Authorization Result ─────────────────────────────────────────────────

export enum AuthorizationDecision {
	/** User approved the operation */
	APPROVED = "APPROVED",

	/** User rejected the operation */
	REJECTED = "REJECTED",

	/** Operation was auto-approved (safe tier or .intentignore bypass) */
	AUTO_APPROVED = "AUTO_APPROVED",
}

export interface AuthorizationResult {
	decision: AuthorizationDecision
	reason: string
}

// ── .intentignore Loader ─────────────────────────────────────────────────

/**
 * The .intentignore file allows users to bypass HITL authorization for
 * specific intents. This mirrors .gitignore semantics — if an intent ID
 * is listed in .intentignore, its destructive operations are auto-approved.
 *
 * File format (.orchestration/.intentignore):
 *   # Comment lines start with #
 *   INT-001          # Bypass checks for this intent
 *   INT-003          # Draft intents might be safe to auto-approve
 *
 * Philosophy: A codebase is a collection of intents as much as it is a
 * collection of organized code files. Some intents may be low-risk enough
 * to not require manual approval for every write operation.
 *
 * @see TRP1 Challenge, Phase 2: .intentignore
 * @see AISpec (https://github.com/cbora/aispec) — intent formalization
 */
class IntentIgnoreLoader {
	private static readonly cache: Map<string, Set<string>> = new Map()

	/**
	 * Load the .intentignore file from the workspace .orchestration/ directory.
	 * Returns a set of intent IDs that should bypass authorization checks.
	 *
	 * @param cwd - Workspace root path
	 * @returns Set of bypassed intent IDs
	 */
	static load(cwd: string): Set<string> {
		// Check cache first
		if (IntentIgnoreLoader.cache.has(cwd)) {
			return IntentIgnoreLoader.cache.get(cwd)!
		}

		const ignorePath = path.join(cwd, ".orchestration", ".intentignore")
		const ignoredIntents = new Set<string>()

		try {
			if (fs.existsSync(ignorePath)) {
				const content = fs.readFileSync(ignorePath, "utf-8")
				const lines = content.split("\n")

				for (const line of lines) {
					const trimmed = line.trim()
					// Skip empty lines and comments
					if (trimmed.length === 0 || trimmed.startsWith("#")) {
						continue
					}
					ignoredIntents.add(trimmed)
				}

				console.log(
					`[IntentIgnore] Loaded ${ignoredIntents.size} bypassed intents: ${Array.from(ignoredIntents).join(", ")}`,
				)
			}
		} catch (error) {
			console.warn(`[IntentIgnore] Failed to load .intentignore: ${error}`)
		}

		IntentIgnoreLoader.cache.set(cwd, ignoredIntents)
		return ignoredIntents
	}

	/**
	 * Clear the cache (call when .intentignore is modified).
	 */
	static clearCache(): void {
		IntentIgnoreLoader.cache.clear()
	}

	/**
	 * Check if a specific intent is in the ignore list.
	 */
	static isIgnored(cwd: string, intentId: string): boolean {
		const ignored = IntentIgnoreLoader.load(cwd)
		return ignored.has(intentId)
	}
}

// ── Authorization Gate ───────────────────────────────────────────────────

export class AuthorizationGate {
	/**
	 * Evaluate whether a tool call requires human authorization and,
	 * if so, pause the execution loop to show the approval dialog.
	 *
	 * Decision flow:
	 * 1. SAFE/META → auto-approve (no dialog)
	 * 2. Check .intentignore → auto-approve if intent is bypassed
	 * 3. CRITICAL → ALWAYS show warning dialog (never auto-approve)
	 * 4. DESTRUCTIVE → show warning dialog
	 *
	 * The Promise chain is PAUSED until the user responds to the dialog.
	 * This is by design — the agent cannot proceed without human consent.
	 *
	 * @param classification - The risk classification from CommandClassifier
	 * @param toolName       - The tool being called
	 * @param params         - Tool parameters (for display in the dialog)
	 * @param activeIntentId - The currently active intent ID
	 * @param cwd            - Workspace root path
	 * @returns AuthorizationResult indicating Approved, Rejected, or AutoApproved
	 */
	static async evaluate(
		classification: ClassificationResult,
		toolName: string,
		params: Record<string, unknown>,
		activeIntentId: string | null,
		cwd: string,
	): Promise<AuthorizationResult> {
		// 1. SAFE and META tiers — auto-approve without dialog
		if (classification.tier === RiskTier.SAFE || classification.tier === RiskTier.META) {
			return {
				decision: AuthorizationDecision.AUTO_APPROVED,
				reason: `Auto-approved: ${classification.reason}`,
			}
		}

		// 2. Check .intentignore bypass (except for CRITICAL commands)
		if (
			classification.tier !== RiskTier.CRITICAL &&
			activeIntentId &&
			IntentIgnoreLoader.isIgnored(cwd, activeIntentId)
		) {
			return {
				decision: AuthorizationDecision.AUTO_APPROVED,
				reason: `Auto-approved: Intent "${activeIntentId}" is listed in .intentignore.`,
			}
		}

		// 3. Show UI-blocking authorization dialog
		return AuthorizationGate.showAuthorizationDialog(classification, toolName, params, activeIntentId)
	}

	/**
	 * Show the VS Code warning modal that blocks the execution loop.
	 *
	 * The dialog displays:
	 *   - Risk tier (DESTRUCTIVE or CRITICAL)
	 *   - Tool name and relevant parameters
	 *   - For CRITICAL: the specific dangerous pattern detected
	 *   - Active intent context
	 *
	 * Uses vscode.window.showWarningMessage with modal: true,
	 * which pauses the Promise chain until the user responds.
	 */
	private static async showAuthorizationDialog(
		classification: ClassificationResult,
		toolName: string,
		params: Record<string, unknown>,
		activeIntentId: string | null,
	): Promise<AuthorizationResult> {
		// Build the warning message
		const tierLabel = classification.tier === RiskTier.CRITICAL ? "⛔ CRITICAL" : "⚠️ DESTRUCTIVE"
		const intentLabel = activeIntentId ? `Intent: ${activeIntentId}` : "No active intent"

		let message = `[Hook Engine — ${tierLabel}]\n\n`
		message += `Tool: ${toolName}\n`
		message += `${intentLabel}\n`
		message += `Reason: ${classification.reason}\n`

		// Add specific details based on tool type
		if (toolName === "execute_command" && params.command) {
			message += `Command: ${typeof params.command === "string" ? params.command.substring(0, 200) : "unknown"}\n`
		} else if (params.path || params.file_path) {
			message += `File: ${String(params.path ?? params.file_path)}\n`
		}

		if (classification.matchedPattern) {
			message += `\n⛔ Critical pattern: ${classification.matchedPattern}`
		}

		message += `\n\nApprove this operation?`

		// Show the modal dialog - BLOCKS until user responds
		const approve = "✅ Approve"
		const reject = "❌ Reject"

		const selection = await vscode.window.showWarningMessage(
			message,
			{
				modal: true,
				detail: `The AI agent is requesting permission to perform a ${classification.tier} operation.`,
			},
			approve,
			reject,
		)

		if (selection === approve) {
			console.log(`[AuthorizationGate] APPROVED: ${toolName} (${classification.tier})`)
			return {
				decision: AuthorizationDecision.APPROVED,
				reason: `User approved ${classification.tier} operation: ${toolName}`,
			}
		}

		// User clicked Reject or closed the dialog (treat both as rejection)
		console.log(`[AuthorizationGate] REJECTED: ${toolName} (${classification.tier})`)
		return {
			decision: AuthorizationDecision.REJECTED,
			reason: `User rejected ${classification.tier} operation: ${toolName}. ${classification.reason}`,
		}
	}

	/**
	 * Clear the .intentignore cache. Call this when the file may have changed.
	 */
	static clearIgnoreCache(): void {
		IntentIgnoreLoader.clearCache()
	}
}
