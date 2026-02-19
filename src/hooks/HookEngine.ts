/**
 * HookEngine.ts — Central Middleware Orchestrator for Intent-Driven Architecture
 *
 * This module acts as the strict middleware boundary between the AI agent's tool
 * execution requests and the actual tool handlers. It implements a composable
 * hook pipeline that intercepts every tool call at two lifecycle phases:
 *
 *   1. PreToolUse  — Before the tool executes (validation, context injection,
 *                    command classification, HITL authorization, scope enforcement)
 *   2. PostToolUse — After the tool executes (auto-format, lint, tracing)
 *
 * Architecture (Phase 2):
 * ┌────────────────┐     ┌──────────────────────────────────┐     ┌──────────────┐
 * │ AI Model       │────▷│ HookEngine — PreToolUse          │────▷│ Tool Handler │
 * │ (tool_use)     │     │  1. Gatekeeper (intent check)    │     │ .handle()    │
 * └────────────────┘     │  2. IntentContextLoader          │     └──────────────┘
 *                        │  3. CommandClassifier             │            │
 *                        │  4. ScopeEnforcer                 │            ▼
 *                        │  5. AuthorizationGate (HITL)      │     ┌──────────────┐
 *                        └──────────────────────────────────┘     │ PostToolUse  │
 *                                                                 │  1. Prettier  │
 *                               ┌────────────────┐               │  2. ESLint    │
 *                               │ On Rejection:  │               └──────────────┘
 *                               │ Autonomous     │
 *                               │ Recovery       │
 *                               └────────────────┘
 *
 * Design Principles:
 * - Composable: Hooks are registered as ordered arrays; new hooks can be added
 *   without modifying existing ones.
 * - Non-intrusive: The engine wraps existing tool execution — it does not replace
 *   or patch the tool handlers themselves.
 * - Fail-safe: If a hook throws, the error is captured and returned as a
 *   tool_result error, preventing the extension from crashing.
 *
 * Phase 2 Additions:
 * - Command Classification (Safe / Destructive / Critical / Meta)
 * - UI-Blocking Authorization via vscode.window.showWarningMessage
 * - Autonomous Recovery on rejection (structured JSON tool-error)
 * - Scope Enforcement (write path vs. owned_scope validation)
 * - Post-Edit Automation (Prettier + ESLint on modified files)
 * - .intentignore support for bypassing authorization on select intents
 *
 * @see IntentContextLoader.ts — Pre-hook for loading intent context
 * @see PreToolHook.ts — Gatekeeper pre-hook for intent validation
 * @see CommandClassifier.ts — Risk tier classification
 * @see AuthorizationGate.ts — HITL modal dialog
 * @see AutonomousRecovery.ts — Structured rejection errors
 * @see ScopeEnforcer.ts — Owned scope validation
 * @see PostToolHook.ts — Post-edit formatting/linting
 * @see TRP1 Challenge Week 1, Phase 1 & Phase 2
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { parse as parseYaml } from "yaml"

import { IntentContextLoader } from "./IntentContextLoader"
import { GatekeeperHook } from "./PreToolHook"
import { CommandClassifier, RiskTier } from "./CommandClassifier"
import type { ClassificationResult } from "./CommandClassifier"
import { AuthorizationGate, AuthorizationDecision } from "./AuthorizationGate"
import { AutonomousRecovery } from "./AutonomousRecovery"
import { ScopeEnforcer } from "./ScopeEnforcer"
import { PostToolHook } from "./PostToolHook"
import type { HookContext, PreHookResult, IntentEntry, ActiveIntentsFile } from "./types"

/**
 * The HookEngine manages all registered pre-hooks and post-hooks,
 * executing them in order for every tool call.
 *
 * Phase 1: Gatekeeper + IntentContextLoader
 * Phase 2: CommandClassifier + AuthorizationGate + ScopeEnforcer + PostToolHook
 */
export class HookEngine {
	/** Ordered list of pre-tool execution hooks (Phase 1) */
	private readonly preHooks: Array<(ctx: HookContext) => Promise<PreHookResult>>

	/** The currently active intent ID for this session (set by select_active_intent) */
	private _activeIntentId: string | null = null

	/** Cached intent context XML block (populated after successful select_active_intent) */
	private _intentContextXml: string | null = null

	/** Cached active intent entry (populated after successful select_active_intent) */
	private _activeIntent: IntentEntry | null = null

	/** Workspace root path (cwd) */
	private readonly cwd: string

	constructor(cwd: string) {
		this.cwd = cwd

		// Register Phase 1 pre-hooks in priority order:
		// 1. Gatekeeper — blocks all mutating tools unless an intent is active
		// 2. IntentContextLoader — handles select_active_intent to load context
		this.preHooks = [(ctx) => GatekeeperHook.execute(ctx, this), (ctx) => IntentContextLoader.execute(ctx, this)]
	}

	/**
	 * Execute the full pre-tool middleware pipeline.
	 *
	 * Pipeline order (Phase 1 + Phase 2):
	 *   1. Phase 1 pre-hooks (Gatekeeper → IntentContextLoader)
	 *   2. Phase 2 security boundary (classify → scope → authorize)
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

		// ── Phase 1 Pre-Hooks ────────────────────────────────────────────
		const phase1Result = await this.runPhase1Hooks(context)
		if (phase1Result.action !== "allow") {
			return phase1Result
		}

		// ── Phase 2: Security Boundary ───────────────────────────────────
		return this.runPhase2SecurityBoundary(toolName, params)
	}

	/**
	 * Run Phase 1 pre-hooks (Gatekeeper + IntentContextLoader).
	 */
	private async runPhase1Hooks(context: HookContext): Promise<PreHookResult> {
		for (const hook of this.preHooks) {
			try {
				const result = await hook(context)
				if (result.action === "block" || result.action === "inject") {
					return result
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : "Unknown hook error"
				console.error(`[HookEngine] Pre-hook error: ${errorMessage}`)
				return {
					action: "block",
					toolResult: AutonomousRecovery.formatHookError(
						context.toolName,
						errorMessage,
						this._activeIntentId,
					),
				}
			}
		}
		return { action: "allow" }
	}

	/**
	 * Run Phase 2 security boundary: classification → scope → authorization.
	 */
	private async runPhase2SecurityBoundary(toolName: string, params: Record<string, unknown>): Promise<PreHookResult> {
		// Command Classification
		const classification = CommandClassifier.classify(toolName, params)
		console.log(`[HookEngine] Classification: ${toolName} → ${classification.tier} (${classification.reason})`)

		// META and SAFE tools pass through without further checks
		if (classification.tier === RiskTier.META || classification.tier === RiskTier.SAFE) {
			return { action: "allow" }
		}

		// Scope Enforcement (file-write tools only)
		const scopeResult = this.enforceScopeIfNeeded(toolName, params)
		if (scopeResult) {
			return scopeResult
		}

		// UI-Blocking Authorization
		return this.runAuthorization(toolName, params, classification)
	}

	/**
	 * Check scope enforcement for file-write operations.
	 * Returns a block result if scope is violated, null otherwise.
	 */
	private enforceScopeIfNeeded(toolName: string, params: Record<string, unknown>): PreHookResult | null {
		if (!CommandClassifier.isFileWriteOperation(toolName) || !this._activeIntent) {
			return null
		}

		const targetPath = ScopeEnforcer.extractTargetPath(toolName, params)
		if (!targetPath) {
			return null
		}

		const scopeCheck = ScopeEnforcer.check(targetPath, this._activeIntent.owned_scope, this.cwd)
		if (scopeCheck.allowed) {
			console.log(`[HookEngine] Scope check passed: ${scopeCheck.reason}`)
			return null
		}

		console.warn(`[HookEngine] SCOPE VIOLATION: ${scopeCheck.reason}`)
		return {
			action: "block",
			toolResult: AutonomousRecovery.formatScopeViolation(
				toolName,
				targetPath,
				this._activeIntent.owned_scope,
				this._activeIntentId,
			),
		}
	}

	/**
	 * Run UI-blocking authorization and handle rejection with autonomous recovery.
	 */
	private async runAuthorization(
		toolName: string,
		params: Record<string, unknown>,
		classification: ClassificationResult,
	): Promise<PreHookResult> {
		try {
			const authResult = await AuthorizationGate.evaluate(
				classification,
				toolName,
				params,
				this._activeIntentId,
				this.cwd,
			)

			if (authResult.decision === AuthorizationDecision.REJECTED) {
				console.warn(`[HookEngine] REJECTED by user: ${toolName}`)
				return {
					action: "block",
					toolResult: AutonomousRecovery.formatRejection(
						toolName,
						classification,
						authResult.reason,
						this._activeIntentId,
					),
				}
			}

			console.log(`[HookEngine] Authorization: ${authResult.decision} — ${authResult.reason}`)
			return { action: "allow" }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown authorization error"
			console.error(`[HookEngine] Authorization error: ${errorMessage}`)
			return {
				action: "block",
				toolResult: AutonomousRecovery.formatHookError(toolName, errorMessage, this._activeIntentId),
			}
		}
	}

	/**
	 * Execute post-tool hooks after successful tool execution.
	 *
	 * Phase 2: Post-Edit Automation
	 *   - Run Prettier on modified files
	 *   - Run ESLint on modified files
	 *   - Return error feedback for AI self-correction
	 *
	 * @param toolName - The tool that just executed
	 * @param params   - The tool parameters
	 * @returns Supplementary feedback string, or null if no issues
	 */
	async runPostHooks(toolName: string, params: Record<string, unknown>): Promise<string | null> {
		try {
			const result = await PostToolHook.execute(toolName, params, this.cwd)

			if (result.hasErrors && result.feedback) {
				console.warn(`[HookEngine] Post-hook errors for ${toolName}: ${result.feedback}`)
				return result.feedback
			}

			if (result.feedback) {
				console.log(`[HookEngine] Post-hook feedback for ${toolName}: ${result.feedback}`)
			}

			return result.feedback
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown post-hook error"
			console.error(`[HookEngine] Post-hook error: ${errorMessage}`)
			// Post-hooks are non-blocking — don't fail the tool execution
			return null
		}
	}

	// ── Accessors for session state ──────────────────────────────────────

	/** Get the currently active intent ID */
	get activeIntentId(): string | null {
		return this._activeIntentId
	}

	/** Set the active intent ID (called by IntentContextLoader) */
	setActiveIntentId(intentId: string): void {
		this._activeIntentId = intentId
		// Also load the full intent entry for scope enforcement
		this.loadActiveIntentEntry(intentId)
	}

	/** Get the cached intent context XML */
	get intentContextXml(): string | null {
		return this._intentContextXml
	}

	/** Cache the intent context XML (called by IntentContextLoader) */
	setIntentContextXml(xml: string): void {
		this._intentContextXml = xml
	}

	/** Get the cached active intent entry (for scope enforcement) */
	get activeIntent(): IntentEntry | null {
		return this._activeIntent
	}

	/** Clear the active intent (e.g., on session reset) */
	clearActiveIntent(): void {
		this._activeIntentId = null
		this._intentContextXml = null
		this._activeIntent = null
	}

	/** Check whether a valid intent is currently active */
	hasActiveIntent(): boolean {
		return this._activeIntentId !== null && this._activeIntentId.length > 0
	}

	// ── Private Helpers ──────────────────────────────────────────────────

	/**
	 * Load the full IntentEntry from active_intents.yaml for the given ID.
	 * This populates _activeIntent for scope enforcement.
	 */
	private loadActiveIntentEntry(intentId: string): void {
		try {
			const intentsFilePath = path.join(this.cwd, ".orchestration", "active_intents.yaml")
			const raw = fs.readFileSync(intentsFilePath, "utf-8")
			const parsed = parseYaml(raw) as ActiveIntentsFile

			if (parsed && Array.isArray(parsed.active_intents)) {
				const entry = parsed.active_intents.find((i) => i.id === intentId)
				if (entry) {
					this._activeIntent = entry
					console.log(
						`[HookEngine] Loaded intent entry for scope enforcement: ${entry.id} ` +
							`(scope: ${entry.owned_scope.join(", ")})`,
					)
				}
			}
		} catch (error) {
			console.warn(`[HookEngine] Failed to load intent entry for ${intentId}: ${error}`)
		}
	}
}
