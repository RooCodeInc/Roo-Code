/**
 * Intent Not Selected Error - Thrown when tool is called without selecting an intent first
 */

export class IntentNotSelectedError extends Error {
	constructor(
		message: string = "No active intent. Call select_active_intent first.",
		public readonly tool_name?: string,
	) {
		super(message)
		this.name = "IntentNotSelectedError"
	}
}
