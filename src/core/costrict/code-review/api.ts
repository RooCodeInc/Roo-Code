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
	UpdateIssueStatusRequest,
	UpdateIssueStatusResponse,
	IReviewPrompt,
	ReportIssueReuqest,
	ReportIssueResponse,
} from "./types"
import { IssueStatus } from "../../../shared/codeReview"
import type { AxiosRequestConfig } from "axios"

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
): Promise<UpdateIssueStatusResponse> {
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

export async function getPrompt(id: string, options: AxiosRequestConfig = {}) {
	if (!id) {
		throw new Error("Issue ID is required")
	}
	const response = await axiosInstance.get<IReviewPrompt>(`issue-manager/api/v1/issues/${id}/fix`, options)
	return response.data
}

export async function reportIssue(params: ReportIssueReuqest, options: AxiosRequestConfig = {}) {
	const response = await axiosInstance.post<ReportIssueResponse>(
		`/issue-manager/api/v1/issues/report`,
		params,
		options,
	)
	return response.data
}
