import { ReviewIssue, IssueStatus, ReviewTarget } from "../../../shared/codeReview"
/**
 * Type definitions for code review service
 *
 * This file contains all type definitions required for code review functionality, including:
 * - Enum types: issue status, review target type, severity level
 * - Interface definitions: request/response data structures
 * - Error types: API error response structure
 */

/**
 * Update issue status request interface
 *
 * @description Request data sent when updating code review issue status
 * @example
 * ```typescript
 * const request: UpdateIssueStatusRequest = {
 *   review_task_id: "task-uuid-123",
 *   status: IssueStatus.ACCEPT
 * };
 * ```
 */
export interface UpdateIssueStatusRequest {
	/** Review task ID */
	review_task_id: string
	/** New issue status */
	status: IssueStatus
}

/**
 * Update issue status response interface
 *
 * @description Response data returned by server after updating code review issue status
 * @example
 * ```typescript
 * const response: UpdateIssueStatusResponse = {
 *   code: 200,
 *   message: "Status updated successfully"
 * };
 * ```
 */
export interface UpdateIssueStatusResponse {
	/** Response status code, 200 indicates success */
	code: string
	success: boolean
	/** Response message */
	message: string
	data: {
		slide_line: number
	}
}

/**
 * API error response interface
 *
 * @description Error response structure returned by server when API call fails
 * @example
 * ```typescript
 * const error: APIErrorResponse = {
 *   code: 400,
 *   message: "Invalid request parameters"
 * };
 * ```
 */
export interface APIErrorResponse {
	/** Error status code */
	code: number
	/** Error message */
	message: string
}

/**
 * Review task interface
 *
 * @description Internal representation of a review task
 * @example
 * ```typescript
 * const task: ReviewTask = {
 *   taskId: "rt_1234567890",
 *   targets: [{ type: ReviewTargetType.FILE, file_path: "src/main.ts" }],
 *   isCompleted: false,
 *   createdAt: new Date(),
 *   progress: 5,
 *   total: 10
 * };
 * ```
 */
export interface ReviewTask {
	/** Task ID from server response */
	taskId: string
	/** Task completion status */
	isCompleted: boolean
	/** Current progress */
	progress: number
	review_progress: string
	/** Total items to process */
	total: number
	/** Timeout ID for cleanup */
	timeoutId?: NodeJS.Timeout
	/** Error information */
	error?: Error
}

export interface IReviewPrompt {
	data: {
		prompt: string
	}
}

export interface ReportIssueReuqest {
	review_report: string
	client_id: string
	workspace: string
	review_code: ReviewTarget[]
}

export interface ReportIssueResponse {
	code: string
	success: boolean
	data: {
		review_task_id: string
		count: number
		issues: ReviewIssue[]
	}
}
