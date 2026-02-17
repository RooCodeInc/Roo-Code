/**
 * Prompt-based hooks configuration and types.
 *
 * Hooks allow a smaller/different model to step in at specific agent lifecycle
 * events and provide read-only advisory output that gets injected into the
 * conversation context.
 *
 * Configuration lives in `.roo/hooks.json` (project) and `~/.roo/hooks.json`
 * (global user settings). The format is intentionally compatible with Claude
 * Code's hooks format for interoperability.
 */

/**
 * Hook event names that map to agent lifecycle points.
 *
 * - PreToolUse:  Fires after a tool call is validated but before execution.
 * - PostToolUse: Fires after a tool call completes and its result is available.
 * - Stop:        Fires when `attempt_completion` is invoked, before the task ends.
 */
export type HookEventName = "PreToolUse" | "PostToolUse" | "Stop"

/**
 * A single hook definition inside a hooks.json file.
 */
export interface HookDefinition {
	/**
	 * Optional regex pattern to match against the tool name (for PreToolUse / PostToolUse).
	 * If omitted the hook fires for every tool. Ignored for Stop events.
	 */
	matcher?: string

	/**
	 * The prompt to send to the hook model. The system will prepend relevant
	 * conversation context automatically.
	 */
	prompt: string
}

/**
 * Top-level structure of a hooks.json configuration file.
 */
export interface HooksConfig {
	hooks: Partial<Record<HookEventName, HookDefinition[]>>
}

/**
 * Context passed to a hook prompt so the model has enough information
 * to produce a useful advisory response.
 */
export interface HookContext {
	/** The event that triggered this hook. */
	event: HookEventName

	/** Name of the tool involved (PreToolUse / PostToolUse only). */
	toolName?: string

	/** The tool's input parameters (PreToolUse only). */
	toolInput?: Record<string, unknown>

	/** The tool's result text (PostToolUse only). */
	toolResult?: string

	/** The completion result text (Stop only). */
	completionResult?: string

	/** Recent conversation messages (trimmed for context window). */
	conversationSummary?: string
}

/**
 * Result returned after executing a hook prompt.
 */
export interface HookResult {
	/** The hook's advisory output text. */
	output: string

	/** The event that produced this result. */
	event: HookEventName

	/** Which hook definition (by index) produced this result. */
	hookIndex: number
}

/**
 * Validates a parsed object against the expected HooksConfig shape.
 * Returns the validated config or null if invalid.
 */
export function validateHooksConfig(obj: unknown): HooksConfig | null {
	if (!obj || typeof obj !== "object") {
		return null
	}

	const candidate = obj as Record<string, unknown>

	if (!candidate.hooks || typeof candidate.hooks !== "object") {
		return null
	}

	const hooks = candidate.hooks as Record<string, unknown>
	const validEvents: HookEventName[] = ["PreToolUse", "PostToolUse", "Stop"]
	const result: HooksConfig = { hooks: {} }

	for (const event of validEvents) {
		const defs = hooks[event]
		if (defs === undefined) {
			continue
		}

		if (!Array.isArray(defs)) {
			return null
		}

		const validDefs: HookDefinition[] = []

		for (const def of defs) {
			if (!def || typeof def !== "object") {
				return null
			}

			const d = def as Record<string, unknown>

			if (typeof d.prompt !== "string" || d.prompt.trim().length === 0) {
				return null
			}

			const hookDef: HookDefinition = { prompt: d.prompt }

			if (d.matcher !== undefined) {
				if (typeof d.matcher !== "string") {
					return null
				}

				// Validate the regex
				try {
					new RegExp(d.matcher)
				} catch {
					return null
				}

				hookDef.matcher = d.matcher
			}

			validDefs.push(hookDef)
		}

		result.hooks[event] = validDefs
	}

	return result
}
