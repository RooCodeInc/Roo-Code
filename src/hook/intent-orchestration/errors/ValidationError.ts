/**
 * Validation Error - Thrown when intent or tool validation fails
 */

export class ValidationError extends Error {
	constructor(
		message: string,
		public readonly intent_id?: string,
		public readonly tool_name?: string,
	) {
		super(message)
		this.name = "ValidationError"
	}
}
