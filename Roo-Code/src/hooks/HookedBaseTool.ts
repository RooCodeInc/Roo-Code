import { BaseTool, ToolCallbacks } from "../core/tools/BaseTool"
import { Task } from "../core/task/Task"
import type { ToolUse } from "../shared/tools"
import type { ToolName } from "@roo-code/types"
import { HookEngine } from "./HookEngine"

/**
 * HookedBaseTool wraps the BaseTool.handle() method with Pre and Post hooks.
 *
 * INJECTION STRATEGY:
 * Instead of modifying BaseTool directly (which would require touching Roo Code core),
 * we override handle() here. The task runner should use HookedBaseTool subclasses
 * OR the HookEngine can be invoked from a central dispatch point.
 *
 * The override pattern:
 *   handle() → preHook() → execute() → postHook()
 *                ↓ blocked                ↓ trace logged
 *          returns error             returns normally
 */
export abstract class HookedBaseTool<TName extends ToolName> extends BaseTool<TName> {
	constructor(protected readonly hookEngine: HookEngine) {
		super()
	}

	/**
	 * Override handle() to inject pre/post hooks around execute().
	 */
	override async handle(task: Task, block: ToolUse<TName>, callbacks: ToolCallbacks): Promise<void> {
		// Delegate partial handling to parent (no hooks needed for streaming)
		if (block.partial) {
			return super.handle(task, block, callbacks)
		}

		const params = (block.nativeArgs ?? {}) as Record<string, any>
		const startTime = Date.now()

		// ── PRE-HOOK ─────────────────────────────────────────────
		const preResult = await this.hookEngine.preHook({
			toolName: this.name as string,
			params,
			activeIntentId: this.hookEngine.getActiveIntentId(),
			cwd: task.cwd,
		})

		if (!preResult.allowed) {
			// Block execution, return structured error to LLM so it can self-correct
			await callbacks.pushToolResult(
				JSON.stringify({
					error: preResult.reason,
					type: "HOOK_BLOCKED",
					tool: this.name,
				}),
			)
			return
		}

		// ── EXECUTE ───────────────────────────────────────────────
		await super.handle(task, block, callbacks)

		// ── POST-HOOK ─────────────────────────────────────────────
		await this.hookEngine.postHook({
			toolName: this.name as string,
			params,
			activeIntentId: this.hookEngine.getActiveIntentId(),
			cwd: task.cwd,
			result: null, // result is pushed via callbacks, not returned
			elapsedMs: Date.now() - startTime,
		})
	}
}
