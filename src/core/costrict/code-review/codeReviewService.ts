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
import { RooCodeEventName, type TaskEvents } from "@roo-code/types"

import { ReviewTask } from "./types"
import { updateIssueStatusAPI, getPrompt, reportIssue } from "./api"
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
import { fileExistsAtPath } from "../../../utils/fs"
import { isJetbrainsPlatform } from "../../../utils/platform"
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
	 * Update task state uniformly
	 */
	private updateTaskState(updates: Partial<ReviewTask>): void {
		if (!this.currentTask) {
			this.currentTask = {
				taskId: "",
				isCompleted: false,
				progress: 0,
				review_progress: "",
				total: 0,
			}
		}

		if (updates.isCompleted === true && updates.error === undefined) {
			this.currentTask = { ...this.currentTask, ...updates, error: undefined }
		} else {
			this.currentTask = { ...this.currentTask, ...updates }
		}

		// Send unified status update message
		this.sendReviewTaskUpdateMessage(this.getTaskStatusFromState(), {
			issues: this.getAllCachedIssues(),
			progress: this.currentTask.progress,
			error: this.currentTask.error?.message,
		})
	}

	/**
	 * Get task status from current task state
	 */
	private getTaskStatusFromState(): TaskStatus {
		if (!this.currentTask) return TaskStatus.INITIAL
		if (this.currentTask.error) return TaskStatus.ERROR
		if (this.currentTask.isCompleted) return TaskStatus.COMPLETED
		if (this.currentTask.progress > 0) return TaskStatus.RUNNING
		return TaskStatus.INITIAL
	}

	/**
	 * Handle task timeout
	 */
	private handleTaskTimeout(): void {
		this.logger.info("[CodeReview] Task timeout")
		this.updateTaskState({
			error: new Error(t("common:review.tip.task_timeout")),
			isCompleted: true,
		})
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
	 * Check if API provider supports code review
	 *
	 * @returns boolean - true if provider supports code review, false otherwise
	 */
	async checkApiProviderSupport(): Promise<boolean> {
		const provider = this.getProvider()!
		const { apiConfiguration } = await provider.getState()
		if (apiConfiguration.apiProvider !== "zgsm") {
			vscode.window.showInformationMessage(t("common:review.tip.api_provider_not_support"))
			return false
		}
		return true
	}

	/**
	 * Set CommentService dependency
	 *
	 * @param commentService - CommentService instance or null
	 */
	setCommentService(commentService: CommentService | null): void {
		this.commentService = commentService
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
		if (!provider) {
			return
		}

		this.reset()

		this.updateTaskState({
			isCompleted: false,
			progress: 0.001, // use 0.001 to indicate running
			total: 0,
		})

		const task = await provider.createTask(message, undefined, undefined, undefined, { mode: "review" })
		provider.postMessageToWebview({
			type: "action",
			action: "codeReviewButtonClicked",
		})

		const timeoutId = setTimeout(
			() => {
				this.handleTaskTimeout()
			},
			15 * 60 * 1000,
		)

		this.updateTaskState({ timeoutId })

		const registerHandler = <K extends keyof TaskEvents>(
			event: K,
			handler: (...args: TaskEvents[K]) => void | Promise<void>,
		) => {
			task.on(event, handler as any)
		}

		registerHandler(RooCodeEventName.TaskStarted, () => {
			this.updateTaskState({
				isCompleted: false,
				progress: 0.001, // use 0.001 to indicate running
			})
		})

		registerHandler(RooCodeEventName.TaskAskResponded, () => {
			const messageCount = task.clineMessages.length
			let progress = 0
			if (messageCount <= 10) {
				progress = messageCount * 0.05
			} else {
				progress = Math.min(0.5 + (messageCount - 10) * 0.02, 0.95)
			}
			this.updateTaskState({
				progress: Math.round(progress * 100) / 100,
			})
		})

		registerHandler(RooCodeEventName.TaskCompleted, async () => {
			try {
				this.logger.info("[CodeReview] Review Task completed")

				const message = [...task.clineMessages]
					.reverse()
					.find((msg) => msg.type === "say" && msg.text?.includes("I-AM-CODE-REVIEW-REPORT-V1"))

				if (message?.text) {
					const { issues, review_task_id } = await this.getIssues(message.text, targets)
					if (issues) {
						this.updateCachedIssues(
							issues.filter((issue) => fileExistsAtPath(path.resolve(provider.cwd, issue.file_path))),
						)
						this.updateTaskState({
							taskId: review_task_id,
							isCompleted: true,
							progress: 1,
							total: issues.length,
							error: undefined,
						})
					}
				}
			} catch (error) {
				this.logger.error("[CodeReview] Failed to complete task:", error)
				this.updateTaskState({
					error: error as Error,
					isCompleted: true,
				})
			} finally {
				clearTimeout(timeoutId)
				await provider.removeClineFromStack()
				await provider.refreshWorkspace()
			}
		})

		registerHandler(RooCodeEventName.TaskResumable, () => {
			this.updateTaskState({
				error: new Error(t("common:review.tip.service_unavailable")),
				isCompleted: true,
			})
		})

		registerHandler(RooCodeEventName.TaskIdle, () => {
			this.updateTaskState({
				error: new Error(t("common:review.tip.service_unavailable")),
				isCompleted: true,
			})
		})
	}
	// ===== Task Management Methods =====

	public reset() {
		if (this.currentTask) {
			if (this.currentTask.timeoutId) {
				clearTimeout(this.currentTask.timeoutId)
			}
		}

		this.updateTaskState({
			taskId: "",
			isCompleted: false,
			progress: 0,
			review_progress: "",
			total: 0,
			error: undefined,
			timeoutId: undefined,
		})

		this.clearCache()
		this.currentActiveIssueId = null
		this.commentService?.clearAllCommentThreads()
	}

	public async getIssues(report: string, targets: ReviewTarget[]) {
		const clientId = getClientId()
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
	 * Complete current task
	 */
	private completeTask(): void {
		if (!this.currentTask) {
			return
		}

		this.currentTask.isCompleted = true
		this.currentTask.error = undefined

		// Send task completed message with unified event
		this.sendReviewTaskUpdateMessage(TaskStatus.COMPLETED, {
			issues: this.getAllCachedIssues(),
			progress: this.currentTask.progress,
		})
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
		return {
			issueId: issue.id,
			fileUri: vscode.Uri.file(path.resolve(cwd, issue.file_path)),
			range: new vscode.Range(issue.start_line - 1, 0, issue.end_line - 1, Number.MAX_SAFE_INTEGER),
			comment: new ReviewComment(
				issue.id,
				new vscode.MarkdownString(`${issue.title ? `### ${issue.title}\n\n` : ""}${issue.message}`),
				vscode.CommentMode.Preview,
				{ name: "CoStrict", iconPath },
				undefined,
				isJetbrainsPlatform() ? issue.id : "Intial",
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
		this.cachedIssues.clear()
		this.currentActiveIssueId = null
		this.commentService?.dispose()
	}
}
