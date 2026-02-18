/**
 * PreToolHook.ts — Gatekeeper Pre-Hook for Intent Validation
 *
 * This module implements the Gatekeeper — a mandatory pre-hook that runs
 * BEFORE every tool call in the execution pipeline. Its single responsibility
 * is to enforce the Intent-Driven Architecture's cardinal rule:
 *
 *   "No mutating tool may execute unless the agent has first declared
 *    a valid active intent via select_active_intent(intent_id)."
 *
 * Classification:
 * - MUTATING tools (write_to_file, apply_diff, execute_command, etc.)
 *   → BLOCKED unless a valid intent is active
 * - READ-ONLY tools (read_file, list_files, search_files, etc.)
 *   → ALLOWED without an intent (the agent needs to read to reason)
 * - META tools (ask_followup_question, attempt_completion, switch_mode, etc.)
 *   → ALWAYS ALLOWED (conversation control)
 * - select_active_intent itself → ALWAYS ALLOWED (breaks circular dependency)
 *
 * When the gatekeeper blocks a tool, it returns a descriptive error message
 * as the tool_result, guiding the AI to call select_active_intent first.
 *
 * @see HookEngine.ts — registers this hook at priority 0 (runs first)
 * @see types.ts — MUTATING_TOOLS, EXEMPT_TOOLS constants
 * @see TRP1 Challenge Week 1, Phase 1: The Gatekeeper
 */

import type { HookContext, PreHookResult } from "./types"
import { EXEMPT_TOOLS } from "./types"
import type { HookEngine } from "./HookEngine"

export class GatekeeperHook {
	/**
	 * Execute the gatekeeper validation.
	 *
	 * Decision tree:
	 * 1. Is the tool exempt? → Allow (read-only, meta, or select_active_intent)
	 * 2. Is there an active intent? → Allow (handshake completed)
	 * 3. Otherwise → Block with guidance error
	 *
	 * @param ctx    - Hook context containing tool name and params
	 * @param engine - HookEngine instance for session state access
	 * @returns PreHookResult — "allow" or "block" with error message
	 */
	static async execute(ctx: HookContext, engine: HookEngine): Promise<PreHookResult> {
		// Step 1: Check if this tool is exempt from intent requirements
		if (GatekeeperHook.isExempt(ctx.toolName)) {
			return { action: "allow" }
		}

		// Step 2: Check if a valid intent has been declared
		if (engine.hasActiveIntent()) {
			return { action: "allow" }
		}

		// Step 3: Block execution — no intent declared for a mutating tool
		console.warn(
			`[Gatekeeper] BLOCKED: Tool "${ctx.toolName}" requires an active intent. ` +
				`No intent has been declared via select_active_intent().`,
		)

		return {
			action: "block",
			toolResult:
				`[Gatekeeper Violation] You must cite a valid active Intent ID before any tool use.\n\n` +
				`The tool "${ctx.toolName}" is a mutating operation that requires an active business intent.\n` +
				`Before proceeding, you MUST:\n` +
				`  1. Analyze the user's request\n` +
				`  2. Identify the relevant intent from .orchestration/active_intents.yaml\n` +
				`  3. Call select_active_intent(intent_id) to load the intent context\n\n` +
				`Only after the handshake is complete can you use "${ctx.toolName}" or any other mutating tool.`,
		}
	}

	// ── Private Classification ───────────────────────────────────────────

	/**
	 * Check if a tool is exempt from the gatekeeper requirement.
	 * Exempt tools include read-only tools, meta tools, and
	 * select_active_intent itself.
	 *
	 * Also exempts native MCP tools (prefixed with "mcp_") as they
	 * have their own governance model.
	 *
	 * @param toolName - The canonical tool name
	 * @returns true if the tool can execute without an active intent
	 */
	private static isExempt(toolName: string): boolean {
		// Direct match against exempt list
		if (EXEMPT_TOOLS.includes(toolName)) {
			return true
		}

		// Native MCP tools are governed separately
		if (toolName.startsWith("mcp_")) {
			return true
		}

		return false
	}
}
