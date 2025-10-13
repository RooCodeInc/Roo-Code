/**
 * Code review API functions
 *
 * This file contains all API functions for code review service:
 * - createReviewTaskAPI: Create a new code review task
 * - getReviewResultsAPI: Get review task results with pagination
 * - updateIssueStatusAPI: Update the status of a specific issue
 */

import { axiosInstance } from "./axiosInstance"
import {
	ReviewTaskRequest,
	ReviewTaskResponse,
	ReviewTaskResult,
	UpdateIssueStatusRequest,
	UpdateIssueStatusResponse,
	CancelReviewTaskRequest,
	CancelReviewTaskResponse,
	IReviewPrompt,
} from "./types"
import { IssueStatus } from "../../../shared/codeReview"
import type { AxiosRequestConfig } from "axios"

/**
 * Create a new code review task
 *
 * @param requestParams - Object containing clientId, workspace, targets, and signal
 * @param url - URL to send the request
 * @returns Promise resolving to review task response
 *
 * @example
 * ```typescript
 * const targets = [
 *   { type: ReviewTargetType.FILE, file_path: "src/main.ts" },
 *   { type: ReviewTargetType.FOLDER, file_path: "src/components" }
 * ];
 *
 * const response = await createReviewTaskAPI({
 *   clientId: "vscode",
 *   workspace: "/path/to/workspace",
 *   targets: targets,
 * }, "/path/to/custom/endpoint");
 * console.log("Task ID:", response.data.review_task_id);
 * ```
 */
export async function createReviewTaskAPI(
	params: ReviewTaskRequest,
	options: AxiosRequestConfig = {},
): Promise<ReviewTaskResponse> {
	const { client_id: clientId, workspace, targets } = params
	// Validate input parameters
	if (!clientId || clientId.trim() === "") {
		throw new Error("Client ID is required")
	}

	if (!workspace || workspace.trim() === "") {
		throw new Error("Workspace path is required")
	}

	if (!targets || targets.length === 0) {
		throw new Error("At least one review target is required")
	}

	// Validate each target
	for (const target of targets) {
		if (target.file_path === undefined || target.file_path === null) {
			throw new Error("file_path is required for each target")
		}

		if (!target.type) {
			throw new Error("type is required for each target")
		}
		// Validate line_range for CODE type
		if (target.type === "code" && target.line_range) {
			const [start, end] = target.line_range
			if (start < 0 || end < 0 || start > end) {
				throw new Error("Invalid line_range: start and end must be positive numbers and start <= end")
			}
		}
	}

	// Send POST request to create review task
	// Error handling is done by axios interceptors
	const response = await axiosInstance.post<ReviewTaskResponse>(
		`/review-manager/api/v1/review_tasks`,
		params,
		options,
	)

	return response.data
}

/**
 * Get review task results with incremental loading
 *
 * @param reviewTaskId - Review task ID
 * @param offset - Offset for pagination (default: 0)
 * @param signal - Optional AbortSignal for request cancellation
 * @returns Promise resolving to review task result
 *
 * @example
 * ```typescript
 * // Get initial results
 * let result = await getReviewResultsAPI("task-123");
 * console.log("Progress:", result.data.progress, "/", result.data.total);
 *
 * // Get more results if available
 * while (!result.data.is_done && result.data.next_offset > 0) {
 *   result = await getReviewResultsAPI("task-123", result.data.next_offset);
 *   console.log("New issues:", result.data.issues.length);
 * }
 * ```
 */
export async function getReviewResultsAPI(
	reviewTaskId: string,
	offset: number = 0,
	client_id: string = "",
	options: AxiosRequestConfig = {},
): Promise<ReviewTaskResult> {
	// Validate input parameters
	if (!reviewTaskId || reviewTaskId.trim() === "") {
		throw new Error("Review task ID is required")
	}

	if (offset < 0) {
		throw new Error("Offset must be non-negative")
	}

	// Construct query URL with offset parameter
	const url = `/review-manager/api/v1/review_tasks/${encodeURIComponent(reviewTaskId)}/issues/increment`
	const params = offset > 0 ? { offset, client_id } : { client_id }

	// Send GET request to get review results
	// Error handling is done by axios interceptors
	const response = await axiosInstance.get<ReviewTaskResult>(url, {
		params,
		...options,
	})

	return response.data
}

/**
 * Update the status of a specific issue
 *
 * @param issueId - Issue ID to update
 * @param reviewTaskId - Review task ID that contains the issue
 * @param status - New status for the issue
 * @param signal - Optional AbortSignal for request cancellation
 * @returns Promise resolving to operation result
 *
 * @example
 * ```typescript
 * // Accept an issue
 * const result = await updateIssueStatusAPI(
 *   "issue-123",
 *   "task-456",
 *   IssueStatus.ACCEPT
 * );
 *
 * if (result.success) {
 *   console.log("Issue status updated successfully");
 * }
 * ```
 */
export async function updateIssueStatusAPI(
	issueId: string,
	reviewTaskId: string,
	status: IssueStatus,
	options: AxiosRequestConfig = {},
): Promise<{ success: boolean; message?: string }> {
	// Validate input parameters
	if (!issueId || issueId.trim() === "") {
		throw new Error("Issue ID is required")
	}

	if (!reviewTaskId || reviewTaskId.trim() === "") {
		throw new Error("Review task ID is required")
	}

	// Validate status value
	const validStatuses = [IssueStatus.IGNORE, IssueStatus.ACCEPT, IssueStatus.REJECT]
	if (!validStatuses.includes(status)) {
		throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(", ")}`)
	}

	// Construct request body
	const requestBody: UpdateIssueStatusRequest = {
		review_task_id: reviewTaskId,
		status,
	}

	// Send PUT request to update issue status
	const { data } = await axiosInstance.put<UpdateIssueStatusResponse>(
		`/issue-manager/api/v1/issues/${encodeURIComponent(issueId)}/status`,
		requestBody,
		options,
	)

	return data
}

export async function cancelReviewTaskAPI(params: CancelReviewTaskRequest, options: AxiosRequestConfig = {}) {
	const { client_id: clientId, workspace } = params
	if (!clientId || clientId.trim() === "") {
		throw new Error("Client ID is required")
	}

	if (!workspace || workspace.trim() === "") {
		throw new Error("Workspace path is required")
	}
	// Error handling is done by axios interceptors
	const response = await axiosInstance.put<CancelReviewTaskResponse>(
		`/review-manager/api/v1/review_tasks/actions/cancel_in_progress`,
		params,
		options,
	)
	return response.data
}

export async function getPrompt(id: string, options: AxiosRequestConfig = {}) {
	if (!id) {
		throw new Error("Issue ID is required")
	}
	const response = await axiosInstance.get<IReviewPrompt>(`issue-manager/api/v1/issues/${id}/fix`, options)
	return response.data
}
