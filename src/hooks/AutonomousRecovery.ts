/**
 * AutonomousRecovery.ts — Phase 2: Self-Correction on Rejection
 *
 * When the AuthorizationGate rejects a destructive operation, the agent must
 * NOT crash or enter an infinite retry loop. Instead, this module formats
 * a standardized JSON tool-error and returns it as the tool_result so the
 * AI model can:
 *
 *   1. Acknowledge the rejection
 *   2. Analyze what constraint was violated
 *   3. Propose a safe alternative approach
 *
 * The error format follows the tool_result convention used by Anthropic's
 * tool_use protocol — the LLM receives it as a structured error and can
 * reason about it.
 *
 * Recovery Flow:
 *   User Rejects → AutonomousRecovery.formatRejection() →
 *     JSON tool-error → appended to message history →
 *       LLM self-corrects → proposes alternative
 *
 * @see AuthorizationGate.ts — triggers rejection events
 * @see HookEngine.ts — returns the formatted error as tool_result
 * @see TRP1 Challenge Week 1, Phase 2: Autonomous Recovery
 * @see Research Paper, Phase 2: Autonomous Recovery Loop
 */

import { RiskTier, type ClassificationResult } from "./CommandClassifier"

// ── Recovery Error Structure ─────────────────────────────────────────────

/**
 * Structured error returned to the AI when an operation is rejected.
 * The AI model receives this in the tool_result and should:
 *   1. Apologize for attempting the unauthorized operation
 *   2. Analyze the rejection reason
 *   3. Propose a safe alternative
 */
export interface RecoveryError {
	/** Error type identifier for the AI to recognize */
	type: "AUTHORIZATION_REJECTED" | "SCOPE_VIOLATION" | "HOOK_ERROR"

	/** Human-readable error message */
	message: string

	/** The tool that was blocked */
	blockedTool: string

	/** The risk tier that triggered the block */
	riskTier: RiskTier

	/** Specific constraint or reason for the rejection */
	constraint: string

	/** Guidance for the AI on how to recover */
	recovery_guidance: string[]

	/** The active intent ID at time of rejection (for context) */
	activeIntentId: string | null

	/** Timestamp of the rejection event */
	timestamp: string
}

// ── Autonomous Recovery ──────────────────────────────────────────────────

export class AutonomousRecovery {
	/**
	 * Format a rejection from the AuthorizationGate into a structured
	 * JSON tool-error that the AI model can reason about.
	 *
	 * The error is returned as a string (tool_result format) containing
	 * the JSON structure, wrapped in XML tags for clear parsing.
	 *
	 * @param toolName       - The tool that was rejected
	 * @param classification - The risk classification result
	 * @param reason         - The rejection reason from AuthorizationGate
	 * @param activeIntentId - The active intent at time of rejection
	 * @returns Formatted tool_result error string
	 */
	static formatRejection(
		toolName: string,
		classification: ClassificationResult,
		reason: string,
		activeIntentId: string | null,
	): string {
		const error: RecoveryError = {
			type: "AUTHORIZATION_REJECTED",
			message: `The user REJECTED your "${toolName}" operation. You must NOT retry this exact operation.`,
			blockedTool: toolName,
			riskTier: classification.tier,
			constraint: reason,
			recovery_guidance: AutonomousRecovery.getRecoveryGuidance(toolName, classification),
			activeIntentId,
			timestamp: new Date().toISOString(),
		}

		return AutonomousRecovery.formatAsToolResult(error)
	}

	/**
	 * Format a scope violation error when the agent tries to write outside
	 * the active intent's owned_scope.
	 *
	 * @param toolName       - The tool that was blocked
	 * @param targetPath     - The file path the agent tried to write
	 * @param ownedScope     - The intent's allowed file patterns
	 * @param activeIntentId - The active intent ID
	 * @returns Formatted tool_result error string
	 */
	static formatScopeViolation(
		toolName: string,
		targetPath: string,
		ownedScope: string[],
		activeIntentId: string | null,
	): string {
		const error: RecoveryError = {
			type: "SCOPE_VIOLATION",
			message:
				`Scope Violation: Intent "${activeIntentId}" is NOT authorized to modify "${targetPath}". ` +
				`This file is outside the intent's owned_scope. Request scope expansion or choose a different approach.`,
			blockedTool: toolName,
			riskTier: RiskTier.DESTRUCTIVE,
			constraint: `File "${targetPath}" does not match any pattern in owned_scope: [${ownedScope.join(", ")}]`,
			recovery_guidance: [
				"DO NOT retry writing to this file path.",
				`You may only modify files matching these patterns: ${ownedScope.join(", ")}`,
				"If you need to modify this file, ask the user to expand the intent's owned_scope.",
				"Alternatively, ask the user to select a different intent that covers this file.",
				"Consider if your task can be completed within the current scope.",
			],
			activeIntentId,
			timestamp: new Date().toISOString(),
		}

		return AutonomousRecovery.formatAsToolResult(error)
	}

	/**
	 * Format a generic hook error for unexpected failures.
	 */
	static formatHookError(toolName: string, errorMessage: string, activeIntentId: string | null): string {
		const error: RecoveryError = {
			type: "HOOK_ERROR",
			message: `Hook system error while processing "${toolName}": ${errorMessage}`,
			blockedTool: toolName,
			riskTier: RiskTier.DESTRUCTIVE,
			constraint: errorMessage,
			recovery_guidance: [
				"An internal error occurred in the hook system.",
				"Try a different approach or ask the user for guidance.",
				"If this persists, the hook system may need debugging.",
			],
			activeIntentId,
			timestamp: new Date().toISOString(),
		}

		return AutonomousRecovery.formatAsToolResult(error)
	}

	// ── Private Helpers ──────────────────────────────────────────────────

	/**
	 * Generate context-specific recovery guidance based on the tool
	 * and its risk classification.
	 */
	private static getRecoveryGuidance(toolName: string, classification: ClassificationResult): string[] {
		const base = [
			"Apologize for attempting the unauthorized operation.",
			"Analyze WHY the user rejected this action.",
			"DO NOT retry the same operation.",
		]

		if (classification.tier === RiskTier.CRITICAL) {
			return [
				...base,
				`The command was classified as CRITICAL: ${classification.matchedPattern ?? "unknown pattern"}.`,
				"Propose a SAFE alternative that achieves the same goal.",
				"If using execute_command, consider using a read-only variant.",
				"Ask the user what approach they would prefer instead.",
			]
		}

		if (toolName === "execute_command") {
			return [
				...base,
				"Consider if a read-only command would suffice.",
				"Break the command into smaller, safer steps.",
				"Ask the user to manually run the dangerous part.",
			]
		}

		if (toolName === "write_to_file" || toolName === "apply_diff" || toolName === "edit") {
			return [
				...base,
				"Review the changes you proposed — were they too invasive?",
				"Consider making smaller, incremental changes.",
				"Ask the user what specific changes they would approve.",
			]
		}

		return [
			...base,
			"Propose an alternative approach that the user might approve.",
			"Consider using read-only tools to gather more information first.",
		]
	}

	/**
	 * Format a RecoveryError as a tool_result string.
	 * Uses XML wrapping for reliable LLM parsing + JSON for structure.
	 */
	private static formatAsToolResult(error: RecoveryError): string {
		const jsonStr = JSON.stringify(error, null, 2)

		return `<hook_rejection>
${jsonStr}
</hook_rejection>

[Hook Engine — ${error.type}]
${error.message}

Recovery guidance:
${error.recovery_guidance.map((g, i) => `  ${i + 1}. ${g}`).join("\n")}

You MUST acknowledge this error and propose a safe alternative. Do NOT retry the blocked operation.`
	}
}
