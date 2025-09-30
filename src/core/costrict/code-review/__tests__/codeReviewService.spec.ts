/**
 * Unit tests for CodeReviewService
 *
 * Test coverage:
 * - Singleton pattern functionality
 * - Dependency injection
 * - Message sending to WebView
 * - Basic state management
 * - Task lifecycle management
 * - Cache management
 * - Polling mechanism
 */

import { CodeReviewService } from "../codeReviewService"
import { ClineProvider } from "../../../webview/ClineProvider"
import { CommentService } from "../../../../integrations/comment"
import { createReviewTaskAPI, getReviewResultsAPI, updateIssueStatusAPI, cancelReviewTaskAPI } from "../api"
import {
	ReviewIssue,
	IssueStatus,
	TaskStatus,
	SeverityLevel,
	ReviewTarget,
	ReviewTargetType,
} from "../../../../shared/codeReview"

// Mock vscode
vi.mock("vscode", () => ({
	Uri: {
		joinPath: vi.fn().mockReturnValue({
			scheme: "file",
			authority: "",
			path: "/test/extension/assets/costrict/logo.svg",
			query: "",
			fragment: "",
			fsPath: "/test/extension/assets/costrict/logo.svg",
		}),
		file: vi.fn().mockImplementation((path) => ({
			scheme: "file",
			authority: "",
			path,
			query: "",
			fragment: "",
			fsPath: path,
		})),
	},
	Range: vi.fn().mockImplementation((startLine, startChar, endLine, endChar) => ({
		start: { line: startLine, character: startChar },
		end: { line: endLine, character: endChar },
	})),
	MarkdownString: vi.fn().mockImplementation((value) => ({ value })),
	CommentMode: {
		Editing: 0,
		Preview: 1,
	},
	window: {
		createOutputChannel: vi.fn().mockReturnValue({
			appendLine: vi.fn(),
			dispose: vi.fn(),
		}),
	},
	workspace: {
		createFileSystemWatcher: vi.fn().mockReturnValue({
			onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			dispose: vi.fn(),
		}),
	},
	RelativePattern: vi.fn().mockImplementation((base, pattern) => ({ base, pattern })),
	env: {
		machineId: "mock-machine-id",
		remoteName: undefined,
	},
}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureError: vi.fn(),
		},
	},
}))

// Mock API functions
vi.mock("../api", () => ({
	createReviewTaskAPI: vi.fn(),
	getReviewResultsAPI: vi.fn(),
	updateIssueStatusAPI: vi.fn(),
	cancelReviewTaskAPI: vi.fn(),
}))

// Get properly typed mock functions
const mockCreateReviewTaskAPI = vi.mocked(createReviewTaskAPI)
const mockGetReviewResultsAPI = vi.mocked(getReviewResultsAPI)
const mockUpdateIssueStatusAPI = vi.mocked(updateIssueStatusAPI)
const mockCancelReviewTaskAPI = vi.mocked(cancelReviewTaskAPI)

// Mock ClineProvider
const mockClineProvider = {
	postMessageToWebview: vi.fn(),
	cwd: "/test/workspace",
	contextProxy: {
		extensionUri: {
			scheme: "file",
			authority: "",
			path: "/test/extension",
			query: "",
			fragment: "",
			fsPath: "/test/extension",
			with: vi.fn(),
			toJSON: vi.fn(),
		},
	},
	getState: vi.fn().mockResolvedValue({
		apiConfiguration: {
			zgsmAccessToken: "mockapikey",
			zgsmBaseUrl: "https://zgsm.sangfor.com",
		},
		language: "zh-CN",
	}),
} as unknown as ClineProvider

// Test data
const mockReviewTarget: ReviewTarget = { file_path: "test/file.ts", type: ReviewTargetType.FILE }
const mockIssue: ReviewIssue = {
	id: "test-issue-1",
	file_path: "test/file.ts",
	start_line: 10,
	end_line: 10,
	message: "Test issue",
	title: "Test Issue Title",
	issue_types: ["test"],
	severity: SeverityLevel.MIDDLE,
	status: IssueStatus.INITIAL,
	confidence: 0.8,
	created_at: "2024-01-01T00:00:00Z",
	updated_at: "2024-01-01T00:00:00Z",
}

describe("CodeReviewService", () => {
	beforeEach(() => {
		// Reset singleton instance before each test
		;(CodeReviewService as any).instance = null
		vi.clearAllMocks()
	})

	afterEach(() => {
		// Clear all mocks but keep mock implementations
		vi.clearAllMocks()
	})

	describe("Singleton Pattern", () => {
		it("should create a single instance", () => {
			const instance1 = CodeReviewService.getInstance()
			const instance2 = CodeReviewService.getInstance()

			expect(instance1).toBe(instance2)
			expect(instance1).toBeInstanceOf(CodeReviewService)
		})

		it("should not require parameters for getInstance", () => {
			expect(() => CodeReviewService.getInstance()).not.toThrow()
		})

		it("should allow setting provider after getting instance", () => {
			const instance = CodeReviewService.getInstance()
			expect(() => instance.setProvider(mockClineProvider)).not.toThrow()
			expect(instance.getProvider()).toBe(mockClineProvider)
		})
	})

	describe("Dependency Injection", () => {
		let service: CodeReviewService

		beforeEach(() => {
			service = CodeReviewService.getInstance()
			service.setProvider(mockClineProvider)
		})

		it("should set ClineProvider correctly", () => {
			const newProvider = { ...mockClineProvider } as ClineProvider
			service.setProvider(newProvider)

			// Access private property for testing
			expect((service as any).clineProvider).toBe(newProvider)
		})

		it("should set CommentService correctly", () => {
			const mockCommentService = {
				focusOrCreateCommentThread: vi.fn(),
				disposeCommentThread: vi.fn(),
				collapseCommentThread: vi.fn(),
				expandCommentThread: vi.fn(),
				clearAllCommentThreads: vi.fn(),
			} as Partial<CommentService>
			service.setCommentService(mockCommentService as CommentService)

			// Access private property for testing
			expect((service as any).commentService).toBe(mockCommentService)
		})
	})

	describe("Message Sending", () => {
		let service: CodeReviewService

		beforeEach(() => {
			service = CodeReviewService.getInstance()
			service.setProvider(mockClineProvider)
		})

		it("should send message to webview when ClineProvider is available", () => {
			const testMessage = { type: "test", payload: { data: "test" } }

			// Access private method for testing
			;(service as any).sendMessageToWebview(testMessage)

			expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith(testMessage)
		})

		it("should handle case when ClineProvider is null", () => {
			// Set ClineProvider to null
			;(service as any).clineProvider = null

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const testMessage = { type: "test", payload: { data: "test" } }

			// Should not throw error
			expect(() => (service as any).sendMessageToWebview(testMessage)).not.toThrow()

			// Should log warning
			expect(consoleSpy).toHaveBeenCalledWith("ClineProvider not available, cannot send message to webview")
		})
	})

	describe("State Query Methods", () => {
		let service: CodeReviewService

		beforeEach(() => {
			service = CodeReviewService.getInstance()
			service.setProvider(mockClineProvider)
		})

		it("should return null for getCurrentTask when no task is running", () => {
			expect(service.getCurrentTask()).toBeNull()
		})

		it("should return null for getCurrentActiveIssueId when no issue is active", () => {
			expect(service.getCurrentActiveIssueId()).toBeNull()
		})

		it("should return null for getCachedIssue when issue not found", () => {
			expect(service.getCachedIssue("non-existent-id")).toBeNull()
		})
	})

	describe("Task Lifecycle Management", () => {
		let service: CodeReviewService

		beforeEach(() => {
			service = CodeReviewService.getInstance()
			service.setProvider(mockClineProvider)
		})

		it("should validate targets for startReviewTask", async () => {
			// Empty targets should throw error
			await expect(service.startReviewTask([])).rejects.toThrow("At least one review target is required")
		})

		it("should not throw error for abortCurrentTask when no task is running", async () => {
			// Should not throw error when no current task
			await expect(service.abortCurrentTask()).resolves.not.toThrow()
		})

		it("should throw error for setActiveIssue when issue not found", async () => {
			await expect(service.setActiveIssue("non-existent-id")).rejects.toThrow("Issue non-existent-id not found")
		})

		it("should throw error for updateIssueStatus when issue not found", async () => {
			await expect(service.updateIssueStatus("non-existent-id", IssueStatus.ACCEPT)).rejects.toThrow(
				"Issue non-existent-id not found",
			)
		})
	})

	describe("Task Lifecycle Management - Extended", () => {
		let service: CodeReviewService

		beforeEach(() => {
			service = CodeReviewService.getInstance()
			service.setProvider(mockClineProvider)
			mockCreateReviewTaskAPI.mockReset()
			mockGetReviewResultsAPI.mockReset()
			mockCancelReviewTaskAPI.mockReset()
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it("should validate targets for startReviewTask", async () => {
			// Mock API to ensure it's not the API causing the error
			mockCreateReviewTaskAPI.mockResolvedValue({
				code: 200,
				message: "Success",
				data: { review_task_id: "test-task" },
			})

			// Empty targets should throw error
			await expect(service.startReviewTask([])).rejects.toThrow("At least one review target is required")

			// Valid target should not throw
			await expect(service.startReviewTask([mockReviewTarget])).resolves.not.toThrow()
		})

		it("should handle normal task startup flow", async () => {
			// Mock API responses
			mockCreateReviewTaskAPI.mockResolvedValue({
				code: 200,
				message: "Success",
				data: { review_task_id: "test-task-1" },
			})

			// Start review task
			await service.startReviewTask([mockReviewTarget])

			// Verify API call
			expect(mockCreateReviewTaskAPI).toHaveBeenCalledWith(
				expect.objectContaining({
					client_id: expect.any(String),
					workspace: "/test/workspace",
					targets: [mockReviewTarget],
				}),
				expect.any(Object),
			)

			// Verify task state
			const currentTask = service.getCurrentTask()
			expect(currentTask).toBeTruthy()
			expect(currentTask?.taskId).toBe("test-task-1")
			expect(currentTask?.isCompleted).toBe(false)

			// Verify WebView messages
			expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "reviewTaskUpdate",
					values: expect.objectContaining({
						status: TaskStatus.RUNNING,
						data: expect.objectContaining({
							issues: [],
							progress: 0,
						}),
					}),
				}),
			)
		})

		it("should enforce task mutual exclusion", async () => {
			// Start first task
			mockCreateReviewTaskAPI.mockResolvedValueOnce({
				code: 200,
				message: "Success",
				data: { review_task_id: "task-1" },
			})
			await service.startReviewTask([mockReviewTarget])

			// Verify first task is running
			expect(service.isTaskRunning()).toBe(true)

			// Mock second task creation
			mockCreateReviewTaskAPI.mockResolvedValueOnce({
				code: 200,
				message: "Success",
				data: { review_task_id: "task-2" },
			})

			// Start second task
			await service.startReviewTask([mockReviewTarget])

			// Verify second task is now running
			const currentTask = service.getCurrentTask()
			expect(currentTask?.taskId).toBe("task-2")
		})

		it("should properly abort and clean up task", async () => {
			// Setup running task
			mockCreateReviewTaskAPI.mockResolvedValue({
				code: 200,
				message: "Success",
				data: { review_task_id: "test-task" },
			})
			await service.startReviewTask([mockReviewTarget])

			// Abort task
			await service.abortCurrentTask()

			// Verify cleanup
			expect(service.getCurrentTask()).toBeNull()
			expect(service.isTaskRunning()).toBe(false)
			expect(service.getAllCachedIssues()).toEqual([])
			expect(service.getCurrentActiveIssueId()).toBeNull()
		})

		it("should handle API errors during task creation", async () => {
			// Mock API error
			const error = new Error("API Error")
			mockCreateReviewTaskAPI.mockRejectedValue(error)

			// Attempt to start task
			await expect(service.startReviewTask([mockReviewTarget])).resolves.not.toThrow()

			// Verify cleanup after error
			expect(service.getCurrentTask()).toBeNull()
			expect(service.isTaskRunning()).toBe(false)
		})

		it("should throw error when canceling with no active task", async () => {
			// Attempt to cancel when no task is running
			await expect(service.cancelCurrentTask()).rejects.toThrow("No active task to cancel")
		})

		it("should successfully cancel current task", async () => {
			// Setup running task
			mockCreateReviewTaskAPI.mockResolvedValue({
				code: 200,
				message: "Success",
				data: { review_task_id: "test-task" },
			})
			mockCancelReviewTaskAPI.mockResolvedValue({
				success: true,
				message: "Task canceled successfully",
			})
			await service.startReviewTask([mockReviewTarget])

			// Verify task is running
			expect(service.isTaskRunning()).toBe(true)
			expect(service.getCurrentTask()?.isCompleted).toBe(false)

			// Cancel task
			await service.cancelCurrentTask()

			// Verify cancelReviewTaskAPI was called
			expect(mockCancelReviewTaskAPI).toHaveBeenCalledWith(
				{
					client_id: expect.any(String),
					workspace: "/test/workspace",
				},
				expect.any(Object),
			)

			// Verify task is marked as completed
			expect(service.getCurrentTask()?.isCompleted).toBe(true)
			expect(service.isTaskRunning()).toBe(false)

			// Verify completion message was sent
			expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "reviewTaskUpdate",
					values: expect.objectContaining({
						status: TaskStatus.COMPLETED,
						data: expect.objectContaining({
							progress: 0,
						}),
					}),
				}),
			)
		})

		it("should stop polling when task is canceled", async () => {
			// Setup task creation
			mockCreateReviewTaskAPI.mockResolvedValue({
				code: 200,
				message: "Success",
				data: { review_task_id: "test-task" },
			})
			mockCancelReviewTaskAPI.mockResolvedValue({
				success: true,
				message: "Task canceled successfully",
			})

			// Setup polling response
			mockGetReviewResultsAPI.mockResolvedValue({
				code: 200,
				message: "Success",
				data: {
					issues: [],
					progress: 0,
					review_progress: "Starting review...",
					total: 1,
					is_done: false,
					next_offset: 0,
				},
			})

			// Start task
			await service.startReviewTask([mockReviewTarget])

			// Wait for first polling call
			await Promise.resolve()
			vi.runOnlyPendingTimers()
			await Promise.resolve()
			expect(mockGetReviewResultsAPI).toHaveBeenCalledTimes(1)

			// Reset mock to track new calls
			mockGetReviewResultsAPI.mockClear()

			// Cancel task
			await service.cancelCurrentTask()

			// Advance time to trigger next polling cycle
			vi.runOnlyPendingTimers()
			await Promise.resolve()

			// Verify no more polling calls after cancel
			expect(mockGetReviewResultsAPI).not.toHaveBeenCalled()
		})

		it("should preserve cached issues when canceling task", async () => {
			// Setup task with issues
			mockCreateReviewTaskAPI.mockResolvedValue({
				code: 200,
				message: "Success",
				data: { review_task_id: "test-task" },
			})
			mockCancelReviewTaskAPI.mockResolvedValue({
				success: true,
				message: "Task canceled successfully",
			})
			mockGetReviewResultsAPI.mockResolvedValue({
				code: 200,
				message: "Success",
				data: {
					issues: [mockIssue],
					progress: 1,
					review_progress: "Analyzing issues...",
					total: 1,
					is_done: false,
					next_offset: 1,
				},
			})

			// Start task
			await service.startReviewTask([mockReviewTarget])

			// Wait for polling to add issues to cache
			await Promise.resolve()
			vi.runOnlyPendingTimers()
			await Promise.resolve()

			// Verify issues are cached
			expect(service.getAllCachedIssues()).toHaveLength(1)
			expect(service.getCachedIssue(mockIssue.id)).toBeTruthy()

			// Cancel task
			await service.cancelCurrentTask()

			// Verify issues are preserved (unlike abortCurrentTask which clears cache)
			expect(service.getAllCachedIssues()).toHaveLength(1)
			expect(service.getCachedIssue(mockIssue.id)).toBeTruthy()
		})

		it("should mark task as completed with current progress when canceled", async () => {
			// Setup task creation
			mockCreateReviewTaskAPI.mockResolvedValue({
				code: 200,
				message: "Success",
				data: { review_task_id: "test-task" },
			})
			mockCancelReviewTaskAPI.mockResolvedValue({
				success: true,
				message: "Task canceled successfully",
			})

			// Setup polling response with progress
			mockGetReviewResultsAPI.mockResolvedValue({
				code: 200,
				message: "Success",
				data: {
					issues: [mockIssue],
					progress: 2,
					review_progress: "Analyzing file 2/5...",
					total: 5,
					is_done: false,
					next_offset: 2,
				},
			})

			// Start task
			await service.startReviewTask([mockReviewTarget])

			// Wait for polling to update progress
			await Promise.resolve()
			vi.runOnlyPendingTimers()
			await Promise.resolve()

			// Verify progress is updated
			expect(service.getTaskProgress()).toEqual({ current: 2, total: 5 })

			// Cancel task
			await service.cancelCurrentTask()

			// Verify task is completed with current progress
			const currentTask = service.getCurrentTask()
			expect(currentTask?.isCompleted).toBe(true)
			expect(currentTask?.progress).toBe(2)
			expect(currentTask?.total).toBe(5)

			// Verify completion message includes current progress
			expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "reviewTaskUpdate",
					values: expect.objectContaining({
						status: TaskStatus.COMPLETED,
						data: expect.objectContaining({
							progress: 2,
						}),
					}),
				}),
			)
		})

		it("should handle API error when canceling task", async () => {
			// Setup running task
			mockCreateReviewTaskAPI.mockResolvedValue({
				code: 200,
				message: "Success",
				data: { review_task_id: "test-task" },
			})
			mockCancelReviewTaskAPI.mockRejectedValue(new Error("Cancel API Error"))
			await service.startReviewTask([mockReviewTarget])

			// Verify task is running
			expect(service.isTaskRunning()).toBe(true)

			// Cancel task should throw error
			await expect(service.cancelCurrentTask()).rejects.toThrow("Cancel API Error")

			// Verify cancelReviewTaskAPI was called
			expect(mockCancelReviewTaskAPI).toHaveBeenCalledWith(
				{
					client_id: expect.any(String),
					workspace: "/test/workspace",
				},
				expect.any(Object),
			)
		})
	})

	describe("Cache Management", () => {
		let service: CodeReviewService

		beforeEach(() => {
			service = CodeReviewService.getInstance()
			service.setProvider(mockClineProvider)
		})

		it("should return empty array for getAllCachedIssues initially", () => {
			expect(service.getAllCachedIssues()).toEqual([])
		})

		it("should return null for getTaskProgress when no task", () => {
			expect(service.getTaskProgress()).toBeNull()
		})

		it("should return false for isTaskRunning when no task", () => {
			expect(service.isTaskRunning()).toBe(false)
		})
	})

	describe("Cache Management - Extended", () => {
		let service: CodeReviewService

		beforeEach(() => {
			service = CodeReviewService.getInstance()
			service.setProvider(mockClineProvider)
		})

		it("should properly update cached issues incrementally", () => {
			// Access private method for testing
			const updateCachedIssues = (issues: any[]) => {
				;(service as any).updateCachedIssues(issues)
			}

			// Add first batch of issues
			const firstBatch = [
				{ ...mockIssue, id: "issue-1" },
				{ ...mockIssue, id: "issue-2" },
			]
			updateCachedIssues(firstBatch)
			expect(service.getAllCachedIssues()).toHaveLength(2)

			// Add second batch with one duplicate
			const secondBatch = [
				{ ...mockIssue, id: "issue-2", message: "Updated message" },
				{ ...mockIssue, id: "issue-3" },
			]
			updateCachedIssues(secondBatch)

			// Verify cache state
			const allIssues = service.getAllCachedIssues()
			expect(allIssues).toHaveLength(3)
			expect(allIssues.find((i: any) => i.id === "issue-2")?.message).toBe("Updated message")
		})

		it("should properly clear cache", async () => {
			// Setup initial cache state
			;(service as any).updateCachedIssues([
				{ ...mockIssue, id: "issue-1" },
				{ ...mockIssue, id: "issue-2" },
			])
			expect(service.getAllCachedIssues()).toHaveLength(2)

			// Clear cache through task abort
			await service.abortCurrentTask()

			// Verify cache is cleared
			expect(service.getAllCachedIssues()).toHaveLength(0)
			expect(service.getCachedIssue("issue-1")).toBeNull()
		})

		it("should handle active issue status changes", async () => {
			// Setup initial state
			;(service as any).updateCachedIssues([mockIssue])
			;(service as any).currentActiveIssueId = mockIssue.id

			// Verify initial state
			expect(service.getCurrentActiveIssueId()).toBe(mockIssue.id)

			// Clear through abort
			await service.abortCurrentTask()

			// Verify active issue is cleared
			expect(service.getCurrentActiveIssueId()).toBeNull()
		})
	})
})

describe("Polling Mechanism", () => {
	let service: CodeReviewService

	beforeEach(() => {
		service = CodeReviewService.getInstance()
		service.setProvider(mockClineProvider)
		mockCreateReviewTaskAPI.mockReset()
		mockGetReviewResultsAPI.mockReset()
		mockCancelReviewTaskAPI.mockReset()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("should start and stop polling correctly", async () => {
		// Setup task creation
		mockCreateReviewTaskAPI.mockResolvedValue({
			code: 200,
			message: "Success",
			data: { review_task_id: "test-task" },
		})

		// Setup initial polling response
		mockGetReviewResultsAPI.mockResolvedValue({
			code: 200,
			message: "Success",
			data: {
				issues: [],
				progress: 0,
				review_progress: "Initializing review...",
				total: 1,
				is_done: false,
				next_offset: 0,
			},
		})

		// Start task
		await service.startReviewTask([mockReviewTarget])

		// Wait for polling to start
		await Promise.resolve()
		vi.runOnlyPendingTimers()
		await Promise.resolve()

		// Verify polling started
		expect(mockGetReviewResultsAPI).toHaveBeenCalledWith("test-task", 0, expect.any(String), expect.any(Object))

		// Abort task
		await service.abortCurrentTask()

		// Reset mock to track new calls
		mockGetReviewResultsAPI.mockClear()

		// Advance time
		vi.runOnlyPendingTimers()
		await Promise.resolve()

		// Verify no more polling calls after abort
		expect(mockGetReviewResultsAPI).not.toHaveBeenCalled()
	})

	it("should handle incremental data correctly", async () => {
		// Setup task creation
		mockCreateReviewTaskAPI.mockResolvedValue({
			code: 200,
			message: "Success",
			data: { review_task_id: "test-task" },
		})

		// Setup polling responses
		mockGetReviewResultsAPI
			.mockResolvedValueOnce({
				code: 200,
				message: "Success",
				data: {
					issues: [{ ...mockIssue, id: "issue-1" }],
					progress: 1,
					review_progress: "Analyzing file 1/3...",
					total: 3,
					is_done: false,
					next_offset: 1,
				},
			})
			.mockResolvedValueOnce({
				code: 200,
				message: "Success",
				data: {
					issues: [{ ...mockIssue, id: "issue-2" }],
					progress: 2,
					review_progress: "Analyzing file 2/3...",
					total: 3,
					is_done: false,
					next_offset: 2,
				},
			})
			.mockResolvedValueOnce({
				code: 200,
				message: "Success",
				data: {
					issues: [{ ...mockIssue, id: "issue-3" }],
					progress: 3,
					review_progress: "Review completed",
					total: 3,
					is_done: true,
					next_offset: 3,
				},
			})

		// Start task
		await service.startReviewTask([mockReviewTarget])

		// Wait for first polling call to start and complete
		await Promise.resolve() // Let startPolling start
		await Promise.resolve() // Let the first API call resolve
		await Promise.resolve() // Let updateCachedIssues complete

		// Verify first batch
		expect(service.getAllCachedIssues()).toHaveLength(1)
		expect(service.getTaskProgress()).toEqual({ current: 1, total: 3 })

		// Advance timer to trigger second polling call
		vi.advanceTimersByTime(2000)
		await Promise.resolve() // Let setTimeout callback execute
		await Promise.resolve() // Let the second API call resolve
		await Promise.resolve() // Let updateCachedIssues complete

		// Verify second batch
		expect(service.getAllCachedIssues()).toHaveLength(2)
		expect(service.getTaskProgress()).toEqual({ current: 2, total: 3 })

		// Advance timer to trigger final polling call
		vi.advanceTimersByTime(2000)
		await Promise.resolve() // Let setTimeout callback execute
		await Promise.resolve() // Let the final API call resolve
		await Promise.resolve() // Let updateCachedIssues complete
		await Promise.resolve() // Let completeTask complete

		// Verify final state
		expect(service.getAllCachedIssues()).toHaveLength(3)
		expect(service.getTaskProgress()).toEqual({ current: 3, total: 3 })
		expect(service.getCurrentTask()?.isCompleted).toBe(true)
	})

	it("should handle polling errors correctly", async () => {
		// Setup task creation
		mockCreateReviewTaskAPI.mockResolvedValue({
			code: 200,
			message: "Success",
			data: { review_task_id: "test-task" },
		})

		// Setup polling to throw error
		const error = new Error("Polling failed")
		mockGetReviewResultsAPI.mockRejectedValue(error)

		// Start task
		await service.startReviewTask([mockReviewTarget])

		// Wait for polling to fail
		await Promise.resolve()
		vi.runOnlyPendingTimers()
		await Promise.resolve()

		// Verify error message sent to webview
		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "reviewTaskUpdate",
				values: expect.objectContaining({
					status: TaskStatus.ERROR,
					data: expect.objectContaining({
						issues: [],
						progress: 0,
						error: "Polling failed",
					}),
				}),
			}),
		)
	})

	it("should maintain polling interval correctly", async () => {
		// Setup task creation
		mockCreateReviewTaskAPI.mockResolvedValue({
			code: 200,
			message: "Success",
			data: { review_task_id: "test-task" },
		})

		// Setup polling responses
		mockGetReviewResultsAPI.mockResolvedValue({
			code: 200,
			message: "Success",
			data: {
				issues: [],
				progress: 0,
				review_progress: "Starting polling interval test...",
				total: 1,
				is_done: false,
				next_offset: 0,
			},
		})

		// Start task
		await service.startReviewTask([mockReviewTarget])

		// Wait for first polling call to complete
		await Promise.resolve() // Let startPolling start
		await Promise.resolve() // Let the first API call resolve
		await Promise.resolve() // Let updateCachedIssues complete
		expect(mockGetReviewResultsAPI).toHaveBeenCalledTimes(1)

		// Wait for second polling call
		vi.advanceTimersByTime(2000)
		await Promise.resolve() // Let setTimeout callback execute
		await Promise.resolve() // Let the second API call resolve
		await Promise.resolve() // Let updateCachedIssues complete
		expect(mockGetReviewResultsAPI).toHaveBeenCalledTimes(2)

		// Wait for third polling call
		vi.advanceTimersByTime(2000)
		await Promise.resolve() // Let setTimeout callback execute
		await Promise.resolve() // Let the third API call resolve
		await Promise.resolve() // Let updateCachedIssues complete
		expect(mockGetReviewResultsAPI).toHaveBeenCalledTimes(3)
	})

	it("should handle abort signal correctly", async () => {
		// Setup task creation
		mockCreateReviewTaskAPI.mockResolvedValue({
			code: 200,
			message: "Success",
			data: { review_task_id: "test-task" },
		})

		// Setup polling response
		mockGetReviewResultsAPI.mockResolvedValue({
			code: 200,
			message: "Success",
			data: {
				issues: [],
				progress: 0,
				review_progress: "Handling abort signal test...",
				total: 1,
				is_done: false,
				next_offset: 0,
			},
		})

		// Start task
		await service.startReviewTask([mockReviewTarget])

		// Reset mock to track new calls
		mockGetReviewResultsAPI.mockClear()

		// Abort task
		await service.abortCurrentTask()

		// Advance time
		vi.runOnlyPendingTimers()
		await Promise.resolve()

		// Verify no polling calls after abort
		expect(mockGetReviewResultsAPI).not.toHaveBeenCalled()

		// Verify abort signal was passed to API call
		expect(service.getCurrentTask()).toBeNull()
		expect(service.isTaskRunning()).toBe(false)
	})

	it("should break polling loop when abort signal is detected", async () => {
		// Setup task creation
		mockCreateReviewTaskAPI.mockResolvedValue({
			code: 200,
			message: "Success",
			data: { review_task_id: "test-task" },
		})

		let callCount = 0
		// Setup polling response - first call succeeds, then we abort
		mockGetReviewResultsAPI.mockImplementation(() => {
			callCount++
			return Promise.resolve({
				code: 200,
				message: "Success",
				data: {
					issues: [],
					progress: callCount,
					review_progress: `Processing item ${callCount}/10...`,
					total: 10,
					is_done: false,
					next_offset: callCount,
				},
			})
		})

		// Start task
		await service.startReviewTask([mockReviewTarget])

		// Wait for first polling call to complete
		await Promise.resolve()
		await Promise.resolve()
		expect(mockGetReviewResultsAPI).toHaveBeenCalledTimes(1)

		// Get the abort controller and abort it
		const abortController = (service as any).taskAbortController
		abortController.abort("Test abort")

		// Now advance timer to trigger next polling iteration
		// The polling loop should check abort signal and break
		vi.advanceTimersByTime(2000)
		await Promise.resolve()
		await Promise.resolve()

		// Verify that no additional API calls were made after abort
		expect(mockGetReviewResultsAPI).toHaveBeenCalledTimes(1)
		expect(abortController.signal.aborted).toBe(true)
	})

	it("should handle AbortError during polling gracefully", async () => {
		// Clear previous mock calls
		mockClineProvider.postMessageToWebview = vi.fn()

		// Setup task creation
		mockCreateReviewTaskAPI.mockResolvedValue({
			code: 200,
			message: "Success",
			data: { review_task_id: "test-task-abort" },
		})

		// Setup API to throw AbortError immediately
		mockGetReviewResultsAPI.mockRejectedValue(
			(() => {
				const error = new Error("Request aborted")
				error.name = "AbortError"
				return error
			})(),
		)

		// Start task
		await service.startReviewTask([mockReviewTarget])

		// Wait for polling to start and handle the AbortError
		await Promise.resolve()
		vi.runOnlyPendingTimers()
		await Promise.resolve()

		// Verify AbortError was handled silently (no error message to webview)
		expect(mockClineProvider.postMessageToWebview).not.toHaveBeenCalledWith(
			expect.objectContaining({
				type: "reviewTaskUpdate",
				values: expect.objectContaining({
					status: TaskStatus.ERROR,
					data: expect.objectContaining({
						issues: [],
						progress: 0,
						error: "Request aborted",
					}),
				}),
			}),
		)

		// Task should still exist since AbortError doesn't clear it
		expect(service.getCurrentTask()).toBeTruthy()
	})
})

describe("CodeReviewService - setActiveIssue and updateIssueStatus", () => {
	let codeReviewService: CodeReviewService
	let mockClineProvider: Partial<ClineProvider>
	let mockCommentService: any

	const mockIssue1: ReviewIssue = {
		id: "issue-1",
		file_path: "src/test.ts",
		start_line: 10,
		end_line: 12,
		title: "Test Issue 1",
		message: "This is a test issue",
		issue_types: ["code-quality"],
		severity: SeverityLevel.MIDDLE,
		status: IssueStatus.INITIAL,
		confidence: 0.9,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
	}

	const mockIssue2: ReviewIssue = {
		id: "issue-2",
		file_path: "src/another.ts",
		start_line: 5,
		end_line: 7,
		title: "Test Issue 2",
		message: "Another test issue",
		issue_types: ["performance"],
		severity: SeverityLevel.HIGH,
		status: IssueStatus.INITIAL,
		confidence: 0.8,
		created_at: "2024-01-01T01:00:00Z",
		updated_at: "2024-01-01T01:00:00Z",
	}

	const mockTask = {
		taskId: "task-123",
		targets: [{ type: ReviewTargetType.FILE, file_path: "src/test.ts" }],
		isCompleted: false,
		createdAt: new Date(),
		progress: 1,
		review_progress: "Analyzing code patterns...",
		total: 2,
	}

	beforeEach(() => {
		// Create mock ClineProvider
		mockClineProvider = {
			postMessageToWebview: vi.fn(),
			cwd: "/test/workspace",
			contextProxy: {
				extensionUri: {
					scheme: "file",
					authority: "",
					path: "/test/extension",
					query: "",
					fragment: "",
					fsPath: "/test/extension",
					with: vi.fn(),
					toJSON: vi.fn(),
				},
			},
			getState: vi.fn().mockResolvedValue({
				apiConfiguration: {
					zgsmAccessToken: "mockapikey",
					zgsmBaseUrl: "https://zgsm.sangfor.com",
				},
				language: "zh-CN",
			}),
		} as unknown as ClineProvider

		// Create mock CommentService
		mockCommentService = {
			focusOrCreateCommentThread: vi.fn().mockResolvedValue(undefined),
			disposeCommentThread: vi.fn().mockResolvedValue(undefined),
			collapseCommentThread: vi.fn().mockResolvedValue(true),
			expandCommentThread: vi.fn().mockResolvedValue(true),
			clearAllCommentThreads: vi.fn(),
		}

		// Get service instance
		codeReviewService = CodeReviewService.getInstance()
		codeReviewService.setProvider(mockClineProvider as ClineProvider)
		codeReviewService.setCommentService(mockCommentService)

		// Add mock issues to cache
		;(codeReviewService as any).updateCachedIssues([mockIssue1, mockIssue2])
		;(codeReviewService as any).currentTask = mockTask
	})

	afterEach(() => {
		vi.clearAllMocks()
		// Reset service state
		;(codeReviewService as any).clearCache()
		;(codeReviewService as any).currentTask = null
		;(codeReviewService as any).currentActiveIssueId = null
	})

	describe("setActiveIssue", () => {
		it("should successfully set active issue when issue exists in cache", async () => {
			await codeReviewService.setActiveIssue("issue-1")

			expect(codeReviewService.getCurrentActiveIssueId()).toBe("issue-1")
			// Note: activeIssueChanged event no longer sent as per requirements
		})

		it("should throw error when issue does not exist in cache", async () => {
			await expect(codeReviewService.setActiveIssue("non-existent-issue")).rejects.toThrow(
				"Issue non-existent-issue not found",
			)

			expect(codeReviewService.getCurrentActiveIssueId()).toBeNull()
			expect(mockCommentService.focusOrCreateCommentThread).not.toHaveBeenCalled()
			expect(mockClineProvider.postMessageToWebview).not.toHaveBeenCalled()
		})

		it("should auto-ignore current active issue when setting different issue", async () => {
			// Mock updateIssueStatusAPI to succeed
			mockUpdateIssueStatusAPI.mockResolvedValue({ success: true })

			// Set up task abort controller
			;(codeReviewService as any).taskAbortController = new AbortController()

			// Set first issue as active
			await codeReviewService.setActiveIssue("issue-1")
			expect(codeReviewService.getCurrentActiveIssueId()).toBe("issue-1")

			// Set second issue as active (should auto-ignore first issue)
			await codeReviewService.setActiveIssue("issue-2")

			expect(mockUpdateIssueStatusAPI).toHaveBeenCalledWith(
				"issue-1",
				"task-123",
				IssueStatus.IGNORE,
				expect.objectContaining({
					baseURL: "https://zgsm.sangfor.com",
					headers: expect.objectContaining({
						Authorization: "Bearer mockapikey",
						"Accept-Language": "zh-CN",
						"X-Request-ID": expect.any(String),
					}),
					signal: expect.any(AbortSignal),
				}),
			)
			expect(codeReviewService.getCurrentActiveIssueId()).toBe("issue-2")
		})

		it("should not auto-ignore when setting same issue as active", async () => {
			// Set issue as active
			await codeReviewService.setActiveIssue("issue-1")
			vi.clearAllMocks()

			// Set same issue as active again
			await codeReviewService.setActiveIssue("issue-1")

			expect(mockUpdateIssueStatusAPI).not.toHaveBeenCalled()
			expect(codeReviewService.getCurrentActiveIssueId()).toBe("issue-1")
		})

		it("should continue setting new active issue even if auto-ignore fails", async () => {
			// Mock updateIssueStatusAPI to fail
			mockUpdateIssueStatusAPI.mockRejectedValue(new Error("API Error"))

			// Set first issue as active
			await codeReviewService.setActiveIssue("issue-1")

			// Set second issue as active (auto-ignore should fail but continue)
			await codeReviewService.setActiveIssue("issue-2")

			// The error is logged via logger, not console, and doesn't prevent setting new active issue
			expect(codeReviewService.getCurrentActiveIssueId()).toBe("issue-2")
		})

		it("should not auto-ignore current issue when its status is not INITIAL", async () => {
			// Mock updateIssueStatusAPI to succeed
			mockUpdateIssueStatusAPI.mockResolvedValue({ success: true })

			// Set first issue as active
			await codeReviewService.setActiveIssue("issue-1")
			expect(codeReviewService.getCurrentActiveIssueId()).toBe("issue-1")

			// Update first issue status to ACCEPT (not INITIAL anymore)
			await codeReviewService.updateIssueStatus("issue-1", IssueStatus.ACCEPT)

			// Reset mock to track new calls
			mockUpdateIssueStatusAPI.mockClear()

			// Add a new issue with ACCEPT status to cache
			const acceptedIssue = { ...mockIssue1, id: "issue-3", status: IssueStatus.ACCEPT }
			;(codeReviewService as any).updateCachedIssues([acceptedIssue])

			// Set the accepted issue as active
			;(codeReviewService as any).currentActiveIssueId = "issue-3"

			// Set second issue as active (should NOT auto-ignore the accepted issue)
			await codeReviewService.setActiveIssue("issue-2")

			// Verify that no auto-ignore API call was made
			expect(mockUpdateIssueStatusAPI).not.toHaveBeenCalled()
			expect(codeReviewService.getCurrentActiveIssueId()).toBe("issue-2")

			// Verify the accepted issue still has ACCEPT status
			const cachedAcceptedIssue = codeReviewService.getCachedIssue("issue-3")
			expect(cachedAcceptedIssue?.status).toBe(IssueStatus.ACCEPT)
		})

		it("should not auto-ignore current issue when its status is REJECT", async () => {
			// Mock updateIssueStatusAPI to succeed for initial setup
			mockUpdateIssueStatusAPI.mockResolvedValue({ success: true })

			// Set first issue as active and update to REJECT status
			await codeReviewService.setActiveIssue("issue-1")
			await codeReviewService.updateIssueStatus("issue-1", IssueStatus.REJECT)

			// Reset mock to track new calls
			mockUpdateIssueStatusAPI.mockClear()

			// Add a rejected issue to cache and set as active
			const rejectedIssue = { ...mockIssue1, id: "issue-3", status: IssueStatus.REJECT }
			;(codeReviewService as any).updateCachedIssues([rejectedIssue])
			;(codeReviewService as any).currentActiveIssueId = "issue-3"

			// Set second issue as active (should NOT auto-ignore the rejected issue)
			await codeReviewService.setActiveIssue("issue-2")

			// Verify that no auto-ignore API call was made
			expect(mockUpdateIssueStatusAPI).not.toHaveBeenCalled()
			expect(codeReviewService.getCurrentActiveIssueId()).toBe("issue-2")

			// Verify the rejected issue still has REJECT status
			const cachedRejectedIssue = codeReviewService.getCachedIssue("issue-3")
			expect(cachedRejectedIssue?.status).toBe(IssueStatus.REJECT)
		})

		it("should not auto-ignore current issue when its status is already IGNORE", async () => {
			// Mock updateIssueStatusAPI to succeed for initial setup
			mockUpdateIssueStatusAPI.mockResolvedValue({ success: true })

			// Set first issue as active and update to IGNORE status
			await codeReviewService.setActiveIssue("issue-1")
			await codeReviewService.updateIssueStatus("issue-1", IssueStatus.IGNORE)

			// Reset mock to track new calls
			mockUpdateIssueStatusAPI.mockClear()

			// Add an ignored issue to cache and set as active
			const ignoredIssue = { ...mockIssue1, id: "issue-3", status: IssueStatus.IGNORE }
			;(codeReviewService as any).updateCachedIssues([ignoredIssue])
			;(codeReviewService as any).currentActiveIssueId = "issue-3"

			// Set second issue as active (should NOT auto-ignore the already ignored issue)
			await codeReviewService.setActiveIssue("issue-2")

			// Verify that no auto-ignore API call was made
			expect(mockUpdateIssueStatusAPI).not.toHaveBeenCalled()
			expect(codeReviewService.getCurrentActiveIssueId()).toBe("issue-2")

			// Verify the ignored issue still has IGNORE status
			const cachedIgnoredIssue = codeReviewService.getCachedIssue("issue-3")
			expect(cachedIgnoredIssue?.status).toBe(IssueStatus.IGNORE)
		})

		it("should work without CommentService", async () => {
			codeReviewService.setCommentService(null)

			await codeReviewService.setActiveIssue("issue-1")

			expect(codeReviewService.getCurrentActiveIssueId()).toBe("issue-1")
		})

		it("should use message as comment body when title is not available", async () => {
			const issueWithoutTitle = { ...mockIssue1, title: undefined }
			;(codeReviewService as any).updateCachedIssues([issueWithoutTitle])

			await codeReviewService.setActiveIssue("issue-1")

			expect(mockCommentService.focusOrCreateCommentThread).toHaveBeenCalledWith(
				expect.objectContaining({
					issueId: "issue-1",
					fileUri: expect.any(Object),
					range: expect.any(Object),
					comment: expect.any(Object),
				}),
			)
		})
	})

	describe("updateIssueStatus", () => {
		beforeEach(() => {
			// Set up task abort controller
			;(codeReviewService as any).taskAbortController = new AbortController()
		})

		it("should successfully update issue status to ACCEPT", async () => {
			mockUpdateIssueStatusAPI.mockResolvedValue({ success: true })

			await codeReviewService.updateIssueStatus("issue-1", IssueStatus.ACCEPT)

			expect(mockUpdateIssueStatusAPI).toHaveBeenCalledWith(
				"issue-1",
				"task-123",
				IssueStatus.ACCEPT,
				expect.objectContaining({
					baseURL: "https://zgsm.sangfor.com",
					headers: expect.objectContaining({
						Authorization: "Bearer mockapikey",
						"Accept-Language": "zh-CN",
						"X-Request-ID": expect.any(String),
					}),
					signal: expect.any(AbortSignal),
				}),
			)

			const updatedIssue = codeReviewService.getCachedIssue("issue-1")
			expect(updatedIssue?.status).toBe(IssueStatus.ACCEPT)

			expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "issueStatusUpdated",
				values: {
					issueId: "issue-1",
					status: IssueStatus.ACCEPT,
					issue: expect.objectContaining({
						id: "issue-1",
						status: IssueStatus.ACCEPT,
					}),
				},
			})
		})

		it("should successfully update issue status to IGNORE", async () => {
			mockUpdateIssueStatusAPI.mockResolvedValue({ success: true })

			await codeReviewService.updateIssueStatus("issue-1", IssueStatus.IGNORE)

			expect(mockUpdateIssueStatusAPI).toHaveBeenCalledWith(
				"issue-1",
				"task-123",
				IssueStatus.IGNORE,
				expect.objectContaining({
					baseURL: "https://zgsm.sangfor.com",
					headers: expect.objectContaining({
						Authorization: "Bearer mockapikey",
						"Accept-Language": "zh-CN",
						"X-Request-ID": expect.any(String),
					}),
					signal: expect.any(AbortSignal),
				}),
			)

			const updatedIssue = codeReviewService.getCachedIssue("issue-1")
			expect(updatedIssue?.status).toBe(IssueStatus.IGNORE)
		})

		it("should successfully update issue status to REJECT", async () => {
			mockUpdateIssueStatusAPI.mockResolvedValue({ success: true })

			await codeReviewService.updateIssueStatus("issue-1", IssueStatus.REJECT)

			expect(mockUpdateIssueStatusAPI).toHaveBeenCalledWith(
				"issue-1",
				"task-123",
				IssueStatus.REJECT,
				expect.objectContaining({
					baseURL: "https://zgsm.sangfor.com",
					headers: expect.objectContaining({
						Authorization: "Bearer mockapikey",
						"Accept-Language": "zh-CN",
						"X-Request-ID": expect.any(String),
					}),
					signal: expect.any(AbortSignal),
				}),
			)

			const updatedIssue = codeReviewService.getCachedIssue("issue-1")
			expect(updatedIssue?.status).toBe(IssueStatus.REJECT)
		})

		it("should collapse comment thread when updating status from INITIAL and issue is active", async () => {
			mockUpdateIssueStatusAPI.mockResolvedValue({ success: true })

			// Set issue as active first
			await codeReviewService.setActiveIssue("issue-1")
			vi.clearAllMocks()

			await codeReviewService.updateIssueStatus("issue-1", IssueStatus.ACCEPT)

			expect(mockCommentService.collapseCommentThread).toHaveBeenCalledWith("issue-1")
			expect(codeReviewService.getCurrentActiveIssueId()).toBeNull()
		})

		it("should collapse comment thread when updating status to INITIAL", async () => {
			mockUpdateIssueStatusAPI.mockResolvedValue({ success: true })

			// Set issue as active first
			await codeReviewService.setActiveIssue("issue-1")
			vi.clearAllMocks()

			await codeReviewService.updateIssueStatus("issue-1", IssueStatus.INITIAL)

			expect(mockCommentService.collapseCommentThread).toHaveBeenCalledWith("issue-1")
			expect(codeReviewService.getCurrentActiveIssueId()).toBe("issue-1")
		})

		it("should collapse comment thread for non-active issue", async () => {
			mockUpdateIssueStatusAPI.mockResolvedValue({ success: true })

			// Set different issue as active
			await codeReviewService.setActiveIssue("issue-2")
			vi.clearAllMocks()

			await codeReviewService.updateIssueStatus("issue-1", IssueStatus.ACCEPT)

			expect(mockCommentService.collapseCommentThread).toHaveBeenCalledWith("issue-1")
			expect(codeReviewService.getCurrentActiveIssueId()).toBe("issue-2")
		})

		it("should throw error when issue does not exist in cache", async () => {
			await expect(codeReviewService.updateIssueStatus("non-existent-issue", IssueStatus.ACCEPT)).rejects.toThrow(
				"Issue non-existent-issue not found",
			)

			expect(mockUpdateIssueStatusAPI).not.toHaveBeenCalled()
			expect(mockClineProvider.postMessageToWebview).not.toHaveBeenCalled()
		})

		it("should throw error when no active task", async () => {
			;(codeReviewService as any).currentTask = null

			await expect(codeReviewService.updateIssueStatus("issue-1", IssueStatus.ACCEPT)).rejects.toThrow(
				"No active task",
			)

			expect(mockUpdateIssueStatusAPI).not.toHaveBeenCalled()
			expect(mockClineProvider.postMessageToWebview).not.toHaveBeenCalled()
		})

		it("should throw error when API call fails", async () => {
			mockUpdateIssueStatusAPI.mockResolvedValue({
				success: false,
				message: "Server error",
			})

			await expect(codeReviewService.updateIssueStatus("issue-1", IssueStatus.ACCEPT)).rejects.toThrow(
				"Failed to update issue status: Server error",
			)

			// Issue status should not be updated in cache
			const issue = codeReviewService.getCachedIssue("issue-1")
			expect(issue?.status).toBe(IssueStatus.INITIAL)

			expect(mockClineProvider.postMessageToWebview).not.toHaveBeenCalled()
		})

		it("should throw error when API throws exception", async () => {
			const apiError = new Error("Network error")
			mockUpdateIssueStatusAPI.mockRejectedValue(apiError)

			await expect(codeReviewService.updateIssueStatus("issue-1", IssueStatus.ACCEPT)).rejects.toThrow(
				"Network error",
			)

			// Issue status should not be updated in cache
			const issue = codeReviewService.getCachedIssue("issue-1")
			expect(issue?.status).toBe(IssueStatus.INITIAL)

			expect(mockClineProvider.postMessageToWebview).not.toHaveBeenCalled()
		})

		it("should work without CommentService", async () => {
			mockUpdateIssueStatusAPI.mockResolvedValue({ success: true })
			codeReviewService.setCommentService(null)

			await codeReviewService.updateIssueStatus("issue-1", IssueStatus.ACCEPT)

			expect(mockUpdateIssueStatusAPI).toHaveBeenCalled()

			const updatedIssue = codeReviewService.getCachedIssue("issue-1")
			expect(updatedIssue?.status).toBe(IssueStatus.ACCEPT)

			expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "issueStatusUpdated",
				values: {
					issueId: "issue-1",
					status: IssueStatus.ACCEPT,
					issue: expect.objectContaining({
						id: "issue-1",
						status: IssueStatus.ACCEPT,
					}),
				},
			})
		})

		it("should pass abort signal from task controller", async () => {
			mockUpdateIssueStatusAPI.mockResolvedValue({ success: true })
			const mockAbortController = new AbortController()
			;(codeReviewService as any).taskAbortController = mockAbortController

			await codeReviewService.updateIssueStatus("issue-1", IssueStatus.ACCEPT)

			expect(mockUpdateIssueStatusAPI).toHaveBeenCalledWith(
				"issue-1",
				"task-123",
				IssueStatus.ACCEPT,
				expect.objectContaining({
					baseURL: "https://zgsm.sangfor.com",
					headers: expect.objectContaining({
						Authorization: "Bearer mockapikey",
						"Accept-Language": "zh-CN",
						"X-Request-ID": expect.any(String),
					}),
					signal: mockAbortController.signal,
				}),
			)
		})

		it("should pass undefined signal when no task controller", async () => {
			mockUpdateIssueStatusAPI.mockResolvedValue({ success: true })
			;(codeReviewService as any).taskAbortController = null

			await codeReviewService.updateIssueStatus("issue-1", IssueStatus.ACCEPT)

			expect(mockUpdateIssueStatusAPI).toHaveBeenCalledWith(
				"issue-1",
				"task-123",
				IssueStatus.ACCEPT,
				expect.objectContaining({
					baseURL: "https://zgsm.sangfor.com",
					headers: expect.objectContaining({
						Authorization: "Bearer mockapikey",
						"Accept-Language": "zh-CN",
						"X-Request-ID": expect.any(String),
					}),
					signal: undefined,
				}),
			)
		})
	})

	describe("Integration tests", () => {
		it("should handle complete workflow: set active issue -> update status -> set new active issue", async () => {
			mockUpdateIssueStatusAPI.mockResolvedValue({ success: true })

			// Set first issue as active
			await codeReviewService.setActiveIssue("issue-1")
			expect(codeReviewService.getCurrentActiveIssueId()).toBe("issue-1")

			// Update its status to ACCEPT
			await codeReviewService.updateIssueStatus("issue-1", IssueStatus.ACCEPT)
			expect(codeReviewService.getCurrentActiveIssueId()).toBeNull()
			expect(codeReviewService.getCachedIssue("issue-1")?.status).toBe(IssueStatus.ACCEPT)

			// Set second issue as active
			await codeReviewService.setActiveIssue("issue-2")
			expect(codeReviewService.getCurrentActiveIssueId()).toBe("issue-2")

			// Verify CommentService interactions
			expect(mockCommentService.focusOrCreateCommentThread).toHaveBeenCalledTimes(2)
			expect(mockCommentService.collapseCommentThread).toHaveBeenCalledWith("issue-1")
		})

		it("should handle switching active issues with auto-ignore", async () => {
			mockUpdateIssueStatusAPI.mockResolvedValue({ success: true })

			// Set first issue as active
			await codeReviewService.setActiveIssue("issue-1")
			expect(codeReviewService.getCurrentActiveIssueId()).toBe("issue-1")

			// Set second issue as active (should auto-ignore first)
			await codeReviewService.setActiveIssue("issue-2")

			expect(codeReviewService.getCurrentActiveIssueId()).toBe("issue-2")
			expect(codeReviewService.getCachedIssue("issue-1")?.status).toBe(IssueStatus.IGNORE)
			expect(codeReviewService.getCachedIssue("issue-2")?.status).toBe(IssueStatus.INITIAL)

			// Verify API calls
			expect(mockUpdateIssueStatusAPI).toHaveBeenCalledTimes(1) // One for auto-ignore of issue-1
		})
	})
})
