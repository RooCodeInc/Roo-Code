/**
 * Approval Rejected Error - Thrown when user rejects an operation
 */

export class ApprovalRejectedError extends Error {
	constructor(
		message: string = "Operation was rejected by user approval",
		public readonly intent_id?: string,
		public readonly tool_name?: string,
	) {
		super(message)
		this.name = "ApprovalRejectedError"
	}
}
