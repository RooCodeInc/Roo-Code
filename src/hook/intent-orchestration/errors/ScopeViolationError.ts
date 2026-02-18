/**
 * Scope Violation Error - Thrown when a tool operation is outside the intent scope
 */

export class ScopeViolationError extends Error {
	constructor(
		message: string,
		public readonly intent_id: string,
		public readonly file_path: string,
		public readonly operation: string,
	) {
		super(message)
		this.name = "ScopeViolationError"
	}
}
