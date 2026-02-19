/**
 * index.ts — Public API for the Hook Engine module
 *
 * Re-exports all hook components for clean imports:
 *   import { HookEngine, CommandClassifier, AuthorizationGate } from "../hooks"
 *
 * Phase 1: HookEngine, IntentContextLoader, GatekeeperHook
 * Phase 2: CommandClassifier, AuthorizationGate, AutonomousRecovery,
 *          ScopeEnforcer, PostToolHook
 *
 * @see HookEngine.ts — main orchestrator
 * @see IntentContextLoader.ts — select_active_intent handler
 * @see PreToolHook.ts — gatekeeper validation
 * @see CommandClassifier.ts — risk tier classification
 * @see AuthorizationGate.ts — HITL modal dialog
 * @see AutonomousRecovery.ts — structured rejection errors
 * @see ScopeEnforcer.ts — owned scope validation
 * @see PostToolHook.ts — post-edit formatting/linting
 * @see types.ts — shared types and constants
 */

// ── Phase 1 ──────────────────────────────────────────────────────────────
export { HookEngine } from "./HookEngine"
export { IntentContextLoader } from "./IntentContextLoader"
export { GatekeeperHook } from "./PreToolHook"

// ── Phase 2 ──────────────────────────────────────────────────────────────
export { CommandClassifier, RiskTier } from "./CommandClassifier"
export type { ClassificationResult } from "./CommandClassifier"

export { AuthorizationGate, AuthorizationDecision } from "./AuthorizationGate"
export type { AuthorizationResult } from "./AuthorizationGate"

export { AutonomousRecovery } from "./AutonomousRecovery"
export type { RecoveryError } from "./AutonomousRecovery"

export { ScopeEnforcer } from "./ScopeEnforcer"
export type { ScopeCheckResult } from "./ScopeEnforcer"

export { PostToolHook } from "./PostToolHook"
export type { PostHookResult } from "./PostToolHook"

// ── Shared Types ─────────────────────────────────────────────────────────
export type { HookContext, PreHookResult, IntentEntry, ActiveIntentsFile } from "./types"
export { MUTATING_TOOLS, EXEMPT_TOOLS } from "./types"
