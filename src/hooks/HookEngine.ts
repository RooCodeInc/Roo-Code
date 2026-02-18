/**
 * HookEngine.ts — Central Middleware Orchestrator for Intent-Driven Architecture
 *
 * This module acts as the strict middleware boundary between the AI agent's tool
 * execution requests and the actual tool handlers. It implements a composable
 * hook pipeline that intercepts every tool call at two lifecycle phases:
 *
 *   1. PreToolUse  — Before the tool executes (validation, context injection)
 *   2. PostToolUse — After the tool executes (tracing, logging)  [Phase 3]
 *
 * Architecture:
 * ┌────────────────┐     ┌─────────────┐     ┌──────────────┐
 * │ AI Model       │────▷│ HookEngine  │────▷│ Tool Handler │
 * │ (tool_use)     │     │ PreToolUse  │     │ .handle()    │
 * └────────────────┘     │ Gatekeeper  │     └──────────────┘
 *                        │ ContextLoad │            │
 *                        └─────────────┘            ▼
 *                                            ┌──────────────┐
 *                                            │ PostToolUse  │
 *                                            │ (Phase 3)    │
 *                                            └──────────────┘
 *
 * Design Principles:
 * - Composable: Hooks are registered as ordered arrays; new hooks can be added
 *   without modifying existing ones.
 * - Non-intrusive: The engine wraps existing tool execution — it does not replace
 *   or patch the tool handlers themselves.
 * - Fail-safe: If a hook throws, the error is captured and returned as a
 *   tool_result error, preventing the extension from crashing.
 *
 * @see IntentContextLoader.ts — Pre-hook for loading intent context
 * @see PreToolHook.ts — Gatekeeper pre-hook for intent validation
 * @see TRP1 Challenge Week 1, Phase 1: The Handshake
 */

import { IntentContextLoader } from "./IntentContextLoader"
import { GatekeeperHook } from "./PreToolHook"
import type { HookContext, PreHookResult } from "./types"

/**
 * The HookEngine manages all registered pre-hooks and post-hooks,
 * executing them in order for every tool call.
 */
export class HookEngine {
	/** Ordered list of pre-tool execution hooks */
	private readonly preHooks: Array<(ctx: HookContext) => Promise<PreHookResult>>

	/** The currently active intent ID for this session (set by select_active_intent) */
	private _activeIntentId: string | null = null

	/** Cached intent context XML block (populated after successful select_active_intent) */
	private _intentContextXml: string | null = null

	/** Workspace root path (cwd) */
	private readonly cwd: string

	constructor(cwd: string) {
		this.cwd = cwd

		// Register pre-hooks in priority order:
		// 1. Gatekeeper — blocks all mutating tools unless an intent is active
		// 2. IntentContextLoader — handles select_active_intent to load context
		this.preHooks = [(ctx) => GatekeeperHook.execute(ctx, this), (ctx) => IntentContextLoader.execute(ctx, this)]
	}

	/**
	 * Execute all registered pre-hooks sequentially.
	 * Returns the result of interception — either allowed or blocked.
	 *
	 * @param toolName - The canonical name of the tool being called
	 * @param params   - The tool parameters as provided by the AI
	 * @returns PreHookResult indicating whether execution should proceed
	 */
	async runPreHooks(toolName: string, params: Record<string, unknown>): Promise<PreHookResult> {
		const context: HookContext = {
			toolName,
			params,
			cwd: this.cwd,
			activeIntentId: this._activeIntentId,
		}

		for (const hook of this.preHooks) {
			try {
				const result = await hook(context)

				// If any hook blocks execution or provides a custom result, stop the chain
				if (result.action === "block" || result.action === "inject") {
					return result
				}
			} catch (error) {
				// Fail-safe: capture hook errors gracefully
				const errorMessage = error instanceof Error ? error.message : "Unknown hook error"
				console.error(`[HookEngine] Pre-hook error: ${errorMessage}`)
				return {
					action: "block",
					toolResult: `[HookEngine Error] A pre-hook failed: ${errorMessage}. Please try again.`,
				}
			}
		}

		// All hooks passed — allow execution
		return { action: "allow" }
	}

	// ── Accessors for session state ──────────────────────────────────────

	/** Get the currently active intent ID */
	get activeIntentId(): string | null {
		return this._activeIntentId
	}

	/** Set the active intent ID (called by IntentContextLoader) */
	setActiveIntentId(intentId: string): void {
		this._activeIntentId = intentId
	}

	/** Get the cached intent context XML */
	get intentContextXml(): string | null {
		return this._intentContextXml
	}

	/** Cache the intent context XML (called by IntentContextLoader) */
	setIntentContextXml(xml: string): void {
		this._intentContextXml = xml
	}

	/** Clear the active intent (e.g., on session reset) */
	clearActiveIntent(): void {
		this._activeIntentId = null
		this._intentContextXml = null
	}

	/** Check whether a valid intent is currently active */
	hasActiveIntent(): boolean {
		return this._activeIntentId !== null && this._activeIntentId.length > 0
	}
}
