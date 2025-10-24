/**
 * Code Review Service
 *
 * Core business logic service for code review functionality.
 * Manages the complete lifecycle of code review tasks.
 * Features:
 * - Review task management
 * - Result polling and caching
 * - Issue status synchronization
 * - WebView communication
 * - Comment service coordination
 */

import * as vscode from "vscode"
import path from "node:path"
import type { AxiosRequestConfig } from "axios"
import { v7 as uuidv7 } from "uuid"
import { RooCodeEventName } from "@roo-code/types"

import { ReviewTask } from "./types"
import {
	createReviewTaskAPI,
	getReviewResultsAPI,
	updateIssueStatusAPI,
	cancelReviewTaskAPI,
	getPrompt,
	reportIssue,
} from "./api"
import { ReviewComment } from "./reviewComment"
import { ZgsmAuthConfig, ZgsmAuthService } from "../auth"

import {
	ReviewIssue,
	IssueStatus,
	TaskStatus,
	ReviewTarget,
	TaskData,
	ReviewTargetType,
} from "../../../shared/codeReview"
import { ExtensionMessage } from "../../../shared/ExtensionMessage"
import { Package } from "../../../shared/package"

import { createLogger, ILogger } from "../../../utils/logger"
import { getClientId } from "../../../utils/getClientId"
import { t } from "../../../i18n"
import { CommentService, type CommentThreadInfo } from "../../../integrations/comment"
import type { ClineProvider } from "../../webview/ClineProvider"
import { TelemetryService } from "@roo-code/telemetry"
import { CodeReviewErrorType, type TelemetryErrorType } from "../telemetry"
import { COSTRICT_DEFAULT_HEADERS } from "../../../shared/headers"
import { zgsmCodebaseIndexManager } from "../codebase-index"
import { fileExistsAtPath } from "../../../utils/fs"
/**
 * Code Review Service - Singleton
 *
 * Manages code review tasks, polling, caching, and status synchronization.
 * Coordinates with ClineProvider for WebView communication and CommentService for UI integration.
 */
export class CodeReviewService {
	// Singleton pattern
	private static instance: CodeReviewService | null = null

	// Dependencies
	private clineProvider: ClineProvider | null = null
	private commentService: CommentService | null = null // TODO: Change to CommentService when implemented

	// Task management
	private currentTask: ReviewTask | null = null
	private taskAbortController: AbortController | null = null

	// Issue management and caching
	private cachedIssues: Map<string, ReviewIssue> = new Map()
	private currentActiveIssueId: string | null = null
	private logger: ILogger
	private taskList: Map<string, string> = new Map()
	/**
	 * Private constructor for singleton pattern
	 */
	private constructor() {
		this.logger = createLogger(Package.outputChannel)
	}

	/**
	 * Get singleton instance
	 *
	 * @param clineProvider - ClineProvider instance for WebView communication
	 * @returns CodeReviewService singleton instance
	 */
	static getInstance(): CodeReviewService {
		if (CodeReviewService.instance === null) {
			CodeReviewService.instance = new CodeReviewService()
		}
		return CodeReviewService.instance
	}

	/**
	 * Set ClineProvider dependency
	 *
	 * @param clineProvider - ClineProvider instance
	 */
	setProvider(clineProvider: ClineProvider): void {
		this.clineProvider = clineProvider
	}

	getProvider(): ClineProvider | null {
		return this.clineProvider
	}

	/**
	 * Set CommentService dependency
	 *
	 * @param commentService - CommentService instance or null
	 */
	setCommentService(commentService: CommentService | null): void {
		this.commentService = commentService
	}
	private async getClientId(): Promise<string> {
		return getClientId()
	}

	private async getRequestOptions(): Promise<AxiosRequestConfig> {
		if (!this.clineProvider) {
			return {}
		}
		const { apiConfiguration, language } = await this.clineProvider.getState()
		const apiKey = apiConfiguration.zgsmAccessToken
		const baseURL = apiConfiguration.zgsmBaseUrl || ZgsmAuthConfig.getInstance().getDefaultApiBaseUrl()
		return {
			baseURL,
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Accept-Language": language,
				"X-Request-ID": uuidv7(),
				...COSTRICT_DEFAULT_HEADERS,
			},
		}
	}

	public async handleAuthError() {
		if (!this.clineProvider) return
		this.sendReviewTaskUpdateMessage(TaskStatus.ERROR, {
			issues: [],
			progress: 0,
			error: t("common:review.tip.login_expired"),
		})
		await ZgsmAuthService.openStatusBarLoginTip({
			errorTitle: t("common:review.statusbar.login_expired"),
		})
		this.recordReviewError(CodeReviewErrorType.AuthError as TelemetryErrorType)
	}

	public async startReview(targets: ReviewTarget[]) {
		const visibleProvider = this.getProvider()
		if (visibleProvider) {
			const { apiConfiguration } = await visibleProvider.getState()
			if (apiConfiguration.apiProvider !== "zgsm") {
				vscode.window.showInformationMessage(t("common:review.tip.api_provider_not_support"))
				return
			}
			const chatMessage = targets
				.map((item) => {
					const { type, file_path } = item
					if (type === ReviewTargetType.FILE) {
						return `@/${file_path}`
					} else if (type === ReviewTargetType.FOLDER) {
						return `@/${file_path}/`
					}
					return ""
				})
				.join(" ")
			this.createReviewTask(chatMessage, targets)
		}
	}

	public async createReviewTask(message: string, targets: ReviewTarget[]) {
		const provider = this.getProvider()
		if (provider) {
			this.reset()
			let isCompleted = false
			const task = await provider.createTask(message, undefined, undefined, undefined, { mode: "review" })
			provider.postMessageToWebview({
				type: "action",
				action: "codeReviewButtonClicked",
			})
			task.on(RooCodeEventName.TaskStarted, () => {
				this.sendReviewTaskUpdateMessage(TaskStatus.RUNNING, {
					issues: [],
					progress: 0,
				})
			})
			task.on(RooCodeEventName.TaskToolFailed, () => {
				this.sendReviewTaskUpdateMessage(TaskStatus.ERROR, {
					issues: [],
					progress: 0,
					error: t("common:review.tip.service_unavailable"),
				})
			})
			task.on(RooCodeEventName.TaskAskResponded, () => {
				if (!isCompleted) {
					const messageCount = task.clineMessages.length
					console.log("TaskAskResponded", task.clineMessages)
					let progress = 0
					if (messageCount <= 10) {
						progress = messageCount * 0.05
					} else {
						progress = Math.min(0.5 + (messageCount - 10) * 0.02, 0.95)
					}
					this.sendReviewTaskUpdateMessage(TaskStatus.RUNNING, {
						issues: [],
						progress: Math.round(progress * 100) / 100,
					})
				}
			})
			task.on(RooCodeEventName.TaskCompleted, async () => {
				try {
					this.logger.info("[CodeReview] Review Task completed")
					isCompleted = true
					console.log("TaskCompleted", task.clineMessages)
					const message = task.clineMessages.find(
						(msg) => msg.type === "say" && msg.text?.includes("I-AM-CODE-REVIEW-REPORT-V1"),
					)
					if (message?.text) {
						const { issues, review_task_id } = await this.getIssues(message.text, targets)
						if (issues) {
							this.currentTask = {
								...this.currentTask,
								taskId: review_task_id,
								isCompleted: true,
								progress: 1,
								review_progress: "",
								total: issues?.length ?? 0,
							}
							this.updateCachedIssues(
								issues.filter((issue) => fileExistsAtPath(path.resolve(provider.cwd, issue.file_path))),
							)
						}
					}
				} finally {
					this.completeTask()
					await provider.removeClineFromStack()
					await provider.refreshWorkspace()
				}
			})
		}
	}
	// ===== Task Management Methods =====

	/**
	 * Start a new review task
	 *
	 * @param targets - Review targets array
	 */
	async startReviewTask(targets: ReviewTarget[]): Promise<void> {
		// Validate input
		if (!targets || targets.length === 0) {
			throw new Error("At least one review target is required")
		}

		// Abort current task if exists
		this.abortCurrentTask()
		this.commentService?.clearAllCommentThreads()

		// Create new AbortController for this task
		this.taskAbortController = new AbortController()

		// Get workspace information from ClineProvider
		const workspace = this.clineProvider?.cwd || ""
		const clientId = await this.getClientId()
		const requestOptions = await this.getRequestOptions()
		try {
			// Call API to create review task
			const requestParams = {
				client_id: clientId,
				workspace,
				targets,
			}
			this.logger.info("Starting code review task")
			// Send task started message with unified event
			this.sendReviewTaskUpdateMessage(TaskStatus.RUNNING, {
				issues: [],
				progress: 0,
			})
			const taskResponse = await createReviewTaskAPI(requestParams, {
				...requestOptions,
				signal: this.taskAbortController.signal,
			})

			// Create ReviewTask object
			this.currentTask = {
				taskId: taskResponse.data.review_task_id,
				isCompleted: false,
				progress: 0,
				review_progress: "",
				total: targets.length,
			}

			this.logger.info(`Code Review task created,taskId: ${taskResponse.data.review_task_id}`)
			// Start polling for results
			this.startPolling(this.currentTask.taskId, clientId)
		} catch (error) {
			// Clean up on error
			this.taskAbortController = null
			this.currentTask = null
			this.logger.error(error)
			if (error.name === "AuthError") {
				await this.handleAuthError()
				return
			}
			this.pushErrorToWebview(new Error(t("common:review.tip.service_unavailable")))
			this.recordReviewError(CodeReviewErrorType.StartReviewError as TelemetryErrorType)
		}
	}
	public reset() {
		this.abortCurrentTask()
		this.currentTask = {
			taskId: "",
			isCompleted: false,
			progress: 0,
			review_progress: "",
			total: 0,
		}
		this.commentService?.clearAllCommentThreads()
		this.sendReviewTaskUpdateMessage(TaskStatus.INITIAL, {
			issues: [],
			progress: 0,
		})
	}

	public async getIssues(report: string, targets: ReviewTarget[]) {
		const clientId = await this.getClientId()
		const workspace = this.clineProvider?.cwd || ""
		const requestOptions = await this.getRequestOptions()
		try {
			const { data } = await reportIssue(
				{
					review_report: report,
					client_id: clientId,
					workspace,
					review_code: targets,
				},
				requestOptions,
			)
			return (
				data ?? {
					issues: [],
					review_task_id: "",
					count: 0,
				}
			)
		} catch (error) {
			return {
				issues: [],
				review_task_id: "",
				count: 0,
			}
		}
	}
	/**
	 * Abort current running task
	 */
	abortCurrentTask(): void {
		// Clear cache
		this.clearCache()

		// Reset state
		this.currentTask = null
		this.currentActiveIssueId = null

		// Note: No longer sending taskAborted message as per requirements
	}

	/**
	 * Cancel current running task
	 *
	 * Stops polling for new results but keeps current results and marks task as completed
	 */
	async cancelCurrentTask(): Promise<void> {
		// Check if there's a current task
		if (!this.currentTask) {
			throw new Error("No active task to cancel")
		}
		this.completeTask()
		const provider = this.getProvider()
		await provider?.removeClineFromStack()
		await provider?.refreshWorkspace()
	}

	// ===== Issue Management Methods =====

	/**
	 * Set active issue for comment thread creation
	 *
	 * @param issueId - Issue ID to set as active
	 */
	async setActiveIssue(issueId: string): Promise<void> {
		// Check if the issue exists in cache
		const issue = this.getCachedIssue(issueId)
		if (!issue) {
			throw new Error(`Issue ${issueId} not found`)
		}
		// Auto-ignore current active issue if it exists and is different
		if (this.currentActiveIssueId && this.currentActiveIssueId !== issueId) {
			const currentIssue = this.getCachedIssue(this.currentActiveIssueId)
			if (currentIssue?.status === IssueStatus.INITIAL) {
				await this.autoIgnoreCurrentIssue()
			}
			// Note: No longer disposing comment thread to preserve comments
		}

		// Set new active issue
		this.currentActiveIssueId = issueId

		// Create comment thread info for CommentService integration
		const commentInfo = this.createCommentThreadInfo(issue)

		// Create or focus comment thread if CommentService is available
		if (this.commentService) {
			await this.commentService.focusOrCreateCommentThread(commentInfo)
		}
	}

	/**
	 * Update issue status both locally and on server
	 *
	 * @param issueId - Issue ID to update
	 * @param status - New status to set
	 */
	async updateIssueStatus(issueId: string, status: IssueStatus): Promise<void> {
		this.logger.info(`Updating issue status: issueId=${issueId}, status=${status}`)
		// Check if the issue exists in cache
		const issue = this.getCachedIssue(issueId)
		if (!issue) {
			this.logger.error(`Issue not found in cache: ${issueId}`)
			throw new Error(`Issue ${issueId} not found`)
		}

		// Check if task is active
		if (!this.currentTask) {
			this.logger.error("No active task found when updating issue status")
			throw new Error("No active task")
		}

		const requestOptions = await this.getRequestOptions()

		try {
			// Call API to update issue status on server
			this.logger.info(
				`Calling API to update issue status: issueId=${issueId}, taskId=${this.currentTask.taskId}`,
			)
			const result = await updateIssueStatusAPI(issueId, this.currentTask.taskId, status, {
				...requestOptions,
				signal: this.taskAbortController?.signal,
			})

			// Check if API call was successful
			if (!result.success) {
				this.logger.error(`API call failed to update issue status: ${result.message}`)
				throw new Error(`Failed to update issue status: ${result.message}`)
			}
			this.logger.info(`Successfully updated issue status on server: issueId=${issueId}, status=${status}`)

			// Create updated issue copy and update cache only after successful API call
			const updatedIssue = { ...issue, status }
			this.updateCachedIssues([updatedIssue])
			this.commentService?.collapseCommentThread(issueId)

			// Update current active issue if this was the active one and status changed
			if (this.currentActiveIssueId === issueId && status !== IssueStatus.INITIAL) {
				this.currentActiveIssueId = null
			}
			if (status === IssueStatus.ACCEPT) {
				this.fixWithAI(issue, result.data.slide_line)
			}

			// Send status update message to WebView
			this.sendMessageToWebview({
				type: "issueStatusUpdated",
				values: {
					issueId,
					status,
					issue: updatedIssue,
				},
			})
		} catch (error) {
			this.logger.error(`Failed to update issue status: issueId=${issueId}, error=${error}`)
			if (error.name === "AuthError") {
				await this.handleAuthError()
				return
			}
			this.recordReviewError(CodeReviewErrorType.UpdateIssueError as TelemetryErrorType)
			throw error
		}
	}

	private async fixWithAI(issue: ReviewIssue, slideLine: number) {
		const workspaceEdit = new vscode.WorkspaceEdit()
		const { file_path, start_line, end_line, fix_code } = issue
		if (fix_code) {
			const startLine = start_line - 1 + slideLine
			const endLine = end_line - 1 + slideLine
			const absolutePath = path.resolve(this.clineProvider!.cwd, file_path)
			workspaceEdit.replace(vscode.Uri.file(absolutePath), new vscode.Range(startLine, 0, endLine, 0), fix_code)
			await vscode.workspace.applyEdit(workspaceEdit)
		}
	}

	// ===== State Query Methods =====

	/**
	 * Get current active task
	 *
	 * @returns Current task or null if none
	 */
	getCurrentTask(): ReviewTask | null {
		return this.currentTask
	}

	/**
	 * Get current active issue ID
	 *
	 * @returns Current active issue ID or null
	 */
	getCurrentActiveIssueId(): string | null {
		return this.currentActiveIssueId
	}

	/**
	 * Get cached issue by ID
	 *
	 * @param issueId - Issue ID to retrieve
	 * @returns Cached issue or null if not found
	 */
	getCachedIssue(issueId: string): ReviewIssue | null {
		return this.cachedIssues.get(issueId) || null
	}

	// ===== Cache Management Methods =====

	/**
	 * Update cached issues with new issues
	 *
	 * @param issues - Issues array to add to cache
	 */
	private updateCachedIssues(issues: ReviewIssue[]): void {
		for (const issue of issues) {
			this.cachedIssues.set(issue.id, issue)
		}
	}

	/**
	 * Clear all cached issues
	 */
	private clearCache(): void {
		this.cachedIssues.clear()
	}

	/**
	 * Get all cached issues as array
	 *
	 * @returns Array of all cached issues
	 */
	public getAllCachedIssues(): ReviewIssue[] {
		return Array.from(this.cachedIssues.values())
	}

	/**
	 * Get task progress information
	 *
	 * @returns Progress object or null if no task
	 */
	public getTaskProgress(): { current: number; total: number } | null {
		if (!this.currentTask) {
			return null
		}
		return {
			current: this.currentTask.progress,
			total: this.currentTask.total,
		}
	}

	/**
	 * Check if task is currently running
	 *
	 * @returns True if task is running
	 */
	public isTaskRunning(): boolean {
		return this.currentTask !== null && !this.currentTask.isCompleted
	}

	public async askWithAI(id: string) {
		const provider = this.getProvider()
		if (!provider) {
			return
		}
		const requestOptions = await this.getRequestOptions()
		const { data } = await getPrompt(id, requestOptions)

		const task = await provider.createTask(data.prompt, undefined, undefined, undefined, { mode: "code" })
		await provider.postMessageToWebview({
			type: "action",
			action: "switchTab",
			tab: "chat",
		})
		this.taskList.set(task.taskId, id)
	}

	public async checkAndAcceptIssueByTaskId(taskId: string) {
		if (!taskId && !this.taskList.has(taskId)) {
			return
		}
		const issueId = this.taskList.get(taskId)!
		await this.updateIssueStatus(issueId, IssueStatus.ACCEPT)
		this.taskList.delete(taskId)
	}

	// ===== Polling Methods =====

	/**
	 * Start polling for review results
	 *
	 * @param taskId - Task ID to poll for
	 */
	private async startPolling(taskId: string, clientId: string): Promise<void> {
		let offset = 0
		const pollInterval = 2000 // 2 seconds
		const requestOptions = await this.getRequestOptions()
		this.logger.info("Starting polling for review results")
		while (this.currentTask && !this.currentTask.isCompleted) {
			// Check if task was aborted
			if (this.taskAbortController?.signal.aborted) {
				this.logger.info("Polling aborted")
				break
			}

			try {
				// Call API to get incremental results
				const { data } = await getReviewResultsAPI(taskId, offset, clientId, {
					...requestOptions,
					signal: this.taskAbortController?.signal,
				})
				const { issues, is_done, progress, review_progress, total, next_offset, is_task_failed, error_msg } =
					data

				// Process new issues if any
				let shouldUpdateMessage = false
				if (issues.length > 0) {
					this.updateCachedIssues(issues)
					shouldUpdateMessage = true
				}
				// Update task progress
				if (this.currentTask) {
					this.currentTask.progress = progress
					this.currentTask.total = total
					this.currentTask.review_progress = review_progress
					shouldUpdateMessage = true
				}
				// Check if task is completed
				if (is_done) {
					if (is_task_failed) {
						throw new Error(error_msg)
					}
					this.completeTask()
					break
				}

				// Send unified update message if needed (only once)
				if (shouldUpdateMessage) {
					this.sendReviewTaskUpdateMessage(TaskStatus.RUNNING, {
						issues: this.getAllCachedIssues(),
						progress,
						reviewProgress: review_progress,
					})
				}

				// Update offset for next iteration
				offset = next_offset

				// Wait before next poll
				await this.delay(pollInterval)
			} catch (error: any) {
				// Handle AbortError silently
				if (error.name === "AbortError") {
					break
				}
				if (error.name === "AuthError") {
					await this.handleAuthError()
					break
				}
				this.recordReviewError(CodeReviewErrorType.FetchResultError as TelemetryErrorType)
				// Send error message to webview with unified event
				this.sendReviewTaskUpdateMessage(TaskStatus.ERROR, {
					issues: this.getAllCachedIssues(),
					progress: this.currentTask?.progress || 0,
					error: error.message,
				})

				this.handlePollingError(error)
				break
			}
		}
	}

	/**
	 * Complete current task
	 */
	private completeTask(): void {
		if (!this.currentTask) {
			return
		}

		this.currentTask.isCompleted = true

		// Send task completed message with unified event
		this.sendReviewTaskUpdateMessage(TaskStatus.COMPLETED, {
			issues: this.getAllCachedIssues(),
			progress: this.currentTask.progress,
		})
	}

	/**
	 * Handle polling errors
	 *
	 * @param error - Error that occurred during polling
	 */
	private handlePollingError(error: any): void {
		this.logger.error("Polling error:", error)
		// TODO: Implement retry logic or error recovery if needed
	}

	/**
	 * Delay execution for specified milliseconds
	 *
	 * @param ms - Milliseconds to delay
	 * @returns Promise that resolves after delay
	 */
	private async delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	// ===== Private Helper Methods =====

	/**
	 * Send message to WebView through ClineProvider
	 *
	 * @param message - Message object to send
	 */
	private sendMessageToWebview(message: ExtensionMessage): void {
		if (!this.clineProvider) {
			console.warn("ClineProvider not available, cannot send message to webview")
			return
		}
		this.clineProvider.postMessageToWebview(message)
	}

	/**
	 * Auto-ignore current active issue
	 */
	private async autoIgnoreCurrentIssue(): Promise<void> {
		if (!this.currentActiveIssueId) {
			return
		}

		try {
			await this.updateIssueStatus(this.currentActiveIssueId, IssueStatus.IGNORE)
		} catch (error) {
			this.logger.error("Failed to auto-ignore current issue:", error)
			// Don't throw error to prevent blocking the main flow
		}
	}

	/**
	 * Create comment thread info object for CommentService integration
	 *
	 * @param issue - Review issue to create comment info for
	 * @returns CommentThreadInfo object
	 */
	private createCommentThreadInfo(issue: ReviewIssue): CommentThreadInfo {
		const iconPath = vscode.Uri.joinPath(
			this.clineProvider!.contextProxy.extensionUri,
			"assets",
			"costrict",
			"logo.svg",
		)
		const cwd = this.clineProvider!.cwd
		let message = issue.message.replace(/\\n/g, "\n").replace(/\\t/g, "\t")
		return {
			issueId: issue.id,
			fileUri: vscode.Uri.file(path.resolve(cwd, issue.file_path)),
			range: new vscode.Range(issue.start_line - 1, 0, issue.end_line - 1, Number.MAX_SAFE_INTEGER),
			comment: new ReviewComment(
				issue.id,
				new vscode.MarkdownString(`${issue.title ? `### ${issue.title}\n\n` : ""}${message}`),
				vscode.CommentMode.Preview,
				{ name: "Costrict", iconPath },
				undefined,
				"Intial",
			),
		}
	}

	/**
	 * Send task update message
	 *
	 * @param status - Task status
	 * @param data - Task data
	 */
	public sendReviewTaskUpdateMessage(status: TaskStatus, data: TaskData): void {
		this.sendMessageToWebview({
			type: "reviewTaskUpdate",
			values: {
				status,
				data,
			},
		})
	}

	public pushErrorToWebview(error: any): void {
		this.sendReviewTaskUpdateMessage(TaskStatus.ERROR, {
			issues: [],
			progress: 0,
			error: error.message,
		})
	}

	private recordReviewError(type: TelemetryErrorType) {
		TelemetryService.instance.captureError(`CodeReviewError_${type}`)
	}

	public dispose(): void {
		this.currentTask = null
		this.taskAbortController = null
		this.cachedIssues.clear()
		this.currentActiveIssueId = null
		this.commentService?.dispose()
	}
}
