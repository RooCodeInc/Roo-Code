export class OrganizationAllowListViolationError extends Error {
	constructor(message: string) {
		super(message)
	}
}

/**
 * Error thrown when a task exists in history but its file is missing.
 * This is a recoverable error - the task metadata is still intact,
 * only the conversation history file is unavailable.
 *
 * Callers should NOT delete the task when this error is thrown,
 * as the file may be temporarily unavailable due to disk I/O latency
 * or race conditions during delegation transitions.
 */
export class TaskFileMissingError extends Error {
	public readonly taskId: string
	public readonly filePath: string
	public readonly hasDelegationMetadata: boolean

	constructor(taskId: string, filePath: string, hasDelegationMetadata: boolean = false) {
		super(
			`Task ${taskId} exists in history but file is missing: ${filePath}` +
				(hasDelegationMetadata ? " (task has delegation metadata - do not delete)" : ""),
		)
		this.name = "TaskFileMissingError"
		this.taskId = taskId
		this.filePath = filePath
		this.hasDelegationMetadata = hasDelegationMetadata
	}
}

/**
 * Error thrown when a task does not exist in history at all.
 * This is different from TaskFileMissingError - the task metadata
 * itself is not found in the task history state.
 */
export class TaskNotFoundError extends Error {
	public readonly taskId: string

	constructor(taskId: string) {
		super(`Task ${taskId} not found in history`)
		this.name = "TaskNotFoundError"
		this.taskId = taskId
	}
}
