import { IntentManager } from "./IntentManager"
import { TraceLogger } from "./TraceLogger"

export class HookEngine {
	private intentManager = new IntentManager()
	private traceLogger = new TraceLogger()

	/**
	 * Intercepts the Thinking-Acting loop at the Extension Host level (VS Code, 2026).
	 */
	async preToolUse(toolName: string, args: any): Promise<string | void> {
		// Classification: Mediation depends on the risk level of the tool (TRACE, 2026)
		const isDestructive = ["write_to_file", "execute_command", "apply_diff"].includes(toolName)

		if (toolName === "select_active_intent") {
			return await this.intentManager.loadIntentContext(args.intent_id)
		}

		// Enforcement: Fail-Closed halting if no intent is active (TRACE, 2026)
		if (isDestructive && !this.intentManager.getActiveIntent()) {
			throw new Error(
				`Governance Violation: Mutation tool '${toolName}' blocked. You must call 'select_active_intent' first.`,
			)
		}

		if (toolName === "write_to_file") {
			this.intentManager.verifyScope(args.path)
		}
	}

	async postToolUse(toolName: string, args: any, result: string): Promise<void> {
		const activeIntentId = this.intentManager.getActiveIntent()

		if (toolName === "write_to_file" && activeIntentId) {
			await this.traceLogger.logMutation(activeIntentId, args.path, args.content)
		}
	}
}
