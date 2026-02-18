/**
 * Hook Engine - Central middleware orchestrator
 * Wraps all tool execution requests to enforce governance and traceability
 */

import { HookContext, HookResult } from "./types"
import { PreToolUseHook } from "./PreToolUseHook"
import { PostToolUseHook } from "./PostToolUseHook"
import { OptimisticLockManager } from "./OptimisticLockManager"
import { CircuitBreaker } from "./CircuitBreaker"

export class HookEngine {
	private static instance: HookEngine | null = null
	private preHook: PreToolUseHook
	private postHook: PostToolUseHook
	private lockManager: OptimisticLockManager
	private circuitBreaker: CircuitBreaker
	private workspaceRoot: string

	private constructor(workspaceRoot: string) {
		this.workspaceRoot = workspaceRoot
		this.lockManager = new OptimisticLockManager()
		this.circuitBreaker = new CircuitBreaker()
		this.preHook = new PreToolUseHook(workspaceRoot, this.lockManager)
		this.postHook = new PostToolUseHook(workspaceRoot, this.lockManager)
	}

	/**
	 * Get singleton instance of Hook Engine
	 * @param workspaceRoot Root directory of the workspace
	 * @returns HookEngine instance
	 */
	static getInstance(workspaceRoot: string): HookEngine {
		if (!this.instance || this.instance.workspaceRoot !== workspaceRoot) {
			this.instance = new HookEngine(workspaceRoot)
		}
		return this.instance
	}

	/**
	 * Intercept BEFORE tool execution
	 * @param context Hook context with tool info
	 * @returns Hook result (allow/block)
	 */
	async preToolUse(context: HookContext): Promise<HookResult> {
		// Check circuit breaker first
		if (this.circuitBreaker.isOpen()) {
			return {
				allow: false,
				error: `Circuit Breaker is OPEN. ${this.circuitBreaker.getFailureCount()} consecutive failures.`,
			}
		}

		try {
			return await this.preHook.execute(context)
		} catch (error) {
			console.error("HookEngine PreToolUse error:", error)
			return {
				allow: true, // Fail safe - allow tool even if hook fails
				error: `Hook Error: ${error instanceof Error ? error.message : String(error)}`,
			}
		}
	}

	/**
	 * Intercept AFTER tool execution
	 * @param context Hook context
	 * @param result Tool execution result
	 * @param error Error if tool failed
	 */
	async postToolUse(context: HookContext, result: any, error?: any): Promise<void> {
		if (error) {
			this.circuitBreaker.recordFailure()
			return
		}

		// Record success to reset circuit breaker
		this.circuitBreaker.recordSuccess()

		try {
			await this.postHook.execute(context, result)
		} catch (hookError) {
			console.error("HookEngine PostToolUse error:", hookError)
		}
	}

	/**
	 * Get the lock manager instance
	 */
	getLockManager(): OptimisticLockManager {
		return this.lockManager
	}

	/**
	 * Get the circuit breaker instance
	 */
	getCircuitBreaker(): CircuitBreaker {
		return this.circuitBreaker
	}

	/**
	 * Reset the engine state (e.g. on task restart)
	 */
	reset(): void {
		this.lockManager.clearAll()
		this.circuitBreaker.reset()
	}
}
