// npx vitest services/code-index/__tests__/git-branch-watcher.spec.ts

import { GitBranchWatcher, type BranchChangeCallback, type GitBranchWatcherConfig } from "../git-branch-watcher"
import * as vscode from "vscode"

// Mock the git utility
vi.mock("../../../utils/git")

// Import mocked functions
import { getCurrentBranch } from "../../../utils/git"

// Type the mocked function
const mockedGetCurrentBranch = vi.mocked(getCurrentBranch)

// Mock vscode.RelativePattern
class MockRelativePattern {
	constructor(
		public base: string,
		public pattern: string,
	) {}
}

// Add RelativePattern to vscode mock
;(vscode as any).RelativePattern = MockRelativePattern

describe("GitBranchWatcher", () => {
	let watcher: GitBranchWatcher
	let mockCallback: ReturnType<typeof vi.fn<BranchChangeCallback>>
	let mockFileWatcher: vscode.FileSystemWatcher
	let capturedHandlers: {
		onChange?: () => void
		onCreate?: () => void
		onDelete?: () => void
	}
	const testWorkspacePath = "/test/workspace"

	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()

		// Setup mock callback
		mockCallback = vi.fn<BranchChangeCallback>().mockResolvedValue(undefined)

		// Reset captured handlers
		capturedHandlers = {}

		// Setup mock file watcher with handler capture
		mockFileWatcher = {
			onDidChange: vi.fn((handler: () => void) => {
				capturedHandlers.onChange = handler
				return { dispose: vi.fn() }
			}),
			onDidCreate: vi.fn((handler: () => void) => {
				capturedHandlers.onCreate = handler
				return { dispose: vi.fn() }
			}),
			onDidDelete: vi.fn((handler: () => void) => {
				capturedHandlers.onDelete = handler
				return { dispose: vi.fn() }
			}),
			dispose: vi.fn(),
		} as any

		// Mock vscode.workspace.createFileSystemWatcher
		vi.spyOn(vscode.workspace, "createFileSystemWatcher").mockReturnValue(mockFileWatcher)
	})

	afterEach(() => {
		if (watcher) {
			watcher.dispose()
		}
		vi.useRealTimers()
	})

	describe("initialization", () => {
		it("should initialize with current branch when enabled", async () => {
			mockedGetCurrentBranch.mockResolvedValue("main")

			const config: GitBranchWatcherConfig = { enabled: true }
			watcher = new GitBranchWatcher(testWorkspacePath, mockCallback, config)

			await watcher.initialize()

			expect(mockedGetCurrentBranch).toHaveBeenCalledWith(testWorkspacePath)
			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith(
				expect.objectContaining({
					base: testWorkspacePath,
					pattern: ".git/HEAD",
				}),
			)
		})

		it("should not watch when disabled", async () => {
			mockedGetCurrentBranch.mockResolvedValue("main")

			const config: GitBranchWatcherConfig = { enabled: false }
			watcher = new GitBranchWatcher(testWorkspacePath, mockCallback, config)

			await watcher.initialize()

			expect(vscode.workspace.createFileSystemWatcher).not.toHaveBeenCalled()
		})

		it("should propagate initialization errors", async () => {
			mockedGetCurrentBranch.mockRejectedValue(new Error("Git error"))

			const config: GitBranchWatcherConfig = { enabled: true }
			watcher = new GitBranchWatcher(testWorkspacePath, mockCallback, config)

			// Should throw the error
			await expect(watcher.initialize()).rejects.toThrow("Git error")
		})
	})

	describe("branch change detection", () => {
		beforeEach(async () => {
			mockedGetCurrentBranch.mockResolvedValue("main")

			const config: GitBranchWatcherConfig = { enabled: true, debounceMs: 100 }
			watcher = new GitBranchWatcher(testWorkspacePath, mockCallback, config)

			await watcher.initialize()
			vi.clearAllMocks()
		})

		it("should detect branch change and call callback", async () => {
			// Simulate branch change
			mockedGetCurrentBranch.mockResolvedValue("feature-branch")

			// Trigger the file watcher's onDidChange event
			capturedHandlers.onChange!()

			// Fast-forward past debounce
			await vi.advanceTimersByTimeAsync(100)

			expect(mockCallback).toHaveBeenCalledWith("main", "feature-branch")
			expect(mockCallback).toHaveBeenCalledTimes(1)
		})

		it("should not call callback if branch hasn't changed", async () => {
			// Branch stays the same
			mockedGetCurrentBranch.mockResolvedValue("main")

			capturedHandlers.onChange!()

			await vi.advanceTimersByTimeAsync(100)

			expect(mockCallback).not.toHaveBeenCalled()
		})

		it("should debounce rapid branch changes", async () => {
			mockedGetCurrentBranch.mockResolvedValue("feature-1")

			// Trigger multiple times rapidly
			capturedHandlers.onChange!()
			await vi.advanceTimersByTimeAsync(50)
			capturedHandlers.onChange!()
			await vi.advanceTimersByTimeAsync(50)
			capturedHandlers.onChange!()

			// Only the last one should trigger after debounce
			await vi.advanceTimersByTimeAsync(100)

			expect(mockCallback).toHaveBeenCalledTimes(1)
			expect(mockCallback).toHaveBeenCalledWith("main", "feature-1")
		})

		it("should use custom debounce time", async () => {
			watcher.dispose()

			const config: GitBranchWatcherConfig = { enabled: true, debounceMs: 500 }
			watcher = new GitBranchWatcher(testWorkspacePath, mockCallback, config)
			await watcher.initialize()

			mockedGetCurrentBranch.mockResolvedValue("feature-branch")

			capturedHandlers.onChange!()

			// Should not trigger before debounce time
			await vi.advanceTimersByTimeAsync(400)
			expect(mockCallback).not.toHaveBeenCalled()

			// Should trigger after debounce time
			await vi.advanceTimersByTimeAsync(100)
			expect(mockCallback).toHaveBeenCalledTimes(1)
		})
	})

	describe("state consistency (bug fix verification)", () => {
		beforeEach(async () => {
			mockedGetCurrentBranch.mockResolvedValue("main")

			const config: GitBranchWatcherConfig = { enabled: true, debounceMs: 100 }
			watcher = new GitBranchWatcher(testWorkspacePath, mockCallback, config)

			await watcher.initialize()
			vi.clearAllMocks()
		})

		it("should update state only after successful callback", async () => {
			// Make callback succeed
			mockCallback.mockResolvedValue(undefined)
			mockedGetCurrentBranch.mockResolvedValue("feature-branch")

			capturedHandlers.onChange!()

			await vi.advanceTimersByTimeAsync(100)

			// Callback should be called with old branch
			expect(mockCallback).toHaveBeenCalledWith("main", "feature-branch")

			// Verify state was actually updated
			expect(watcher.getCurrentBranch()).toBe("feature-branch")
		})

		it("should NOT update state if callback fails", async () => {
			// Make callback fail
			const error = new Error("Callback failed")
			mockCallback.mockRejectedValue(error)
			mockedGetCurrentBranch.mockResolvedValue("feature-branch")

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			capturedHandlers.onChange!()

			await vi.advanceTimersByTimeAsync(100)

			// Callback should have been called
			expect(mockCallback).toHaveBeenCalledWith("main", "feature-branch")

			// Error should be logged with correct message
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[GitBranchWatcher] Callback failed, state not updated:",
				error,
			)

			// CRITICAL: Verify state was NOT updated
			expect(watcher.getCurrentBranch()).toBe("main")

			consoleErrorSpy.mockRestore()

			// Now if we trigger another change, it should still use "main" as old branch
			// because the state wasn't updated after the failed callback
			vi.clearAllMocks()
			mockCallback.mockResolvedValue(undefined)
			mockedGetCurrentBranch.mockResolvedValue("another-branch")

			capturedHandlers.onChange!()
			await vi.advanceTimersByTimeAsync(100)

			// Should still use "main" as old branch, not "feature-branch"
			expect(mockCallback).toHaveBeenCalledWith("main", "another-branch")

			// Verify state is now updated after successful callback
			expect(watcher.getCurrentBranch()).toBe("another-branch")
		})
	})

	describe("config updates", () => {
		beforeEach(async () => {
			mockedGetCurrentBranch.mockResolvedValue("main")

			const config: GitBranchWatcherConfig = { enabled: true }
			watcher = new GitBranchWatcher(testWorkspacePath, mockCallback, config)

			await watcher.initialize()
			vi.clearAllMocks()
		})

		it("should stop watching when disabled", async () => {
			await watcher.updateConfig({ enabled: false })

			// Trigger change
			mockedGetCurrentBranch.mockResolvedValue("feature-branch")
			capturedHandlers.onChange!()

			await vi.advanceTimersByTimeAsync(100)

			// Callback should not be called
			expect(mockCallback).not.toHaveBeenCalled()
		})

		it("should re-enable watching when config is updated", async () => {
			// First disable
			await watcher.updateConfig({ enabled: false })

			// Verify watcher was disposed
			expect(mockFileWatcher.dispose).toHaveBeenCalled()

			// Then enable - this will re-initialize
			await watcher.updateConfig({ enabled: true })

			// Verify that getCurrentBranch was called again during re-initialization
			expect(mockedGetCurrentBranch).toHaveBeenCalled()

			// Verify the watcher is functional by checking the config
			expect(watcher.getCurrentBranch()).toBe("main")
		})
	})

	describe("error handling", () => {
		beforeEach(async () => {
			mockedGetCurrentBranch.mockResolvedValue("main")

			const config: GitBranchWatcherConfig = { enabled: true, debounceMs: 100 }
			watcher = new GitBranchWatcher(testWorkspacePath, mockCallback, config)

			await watcher.initialize()
			vi.clearAllMocks()
		})

		it("should handle getCurrentBranch errors gracefully", async () => {
			mockedGetCurrentBranch.mockRejectedValue(new Error("Git error"))

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			capturedHandlers.onChange!()

			await vi.advanceTimersByTimeAsync(100)

			// Should log error with correct message
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[GitBranchWatcher] Failed to detect branch change:",
				expect.any(Error),
			)
			expect(mockCallback).not.toHaveBeenCalled()

			// State should remain unchanged
			expect(watcher.getCurrentBranch()).toBe("main")

			consoleErrorSpy.mockRestore()
		})

		it("should handle callback errors gracefully", async () => {
			mockCallback.mockRejectedValue(new Error("Callback error"))
			mockedGetCurrentBranch.mockResolvedValue("feature-branch")

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			capturedHandlers.onChange!()

			await vi.advanceTimersByTimeAsync(100)

			// Should log error with correct message
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[GitBranchWatcher] Callback failed, state not updated:",
				expect.any(Error),
			)

			// State should remain unchanged
			expect(watcher.getCurrentBranch()).toBe("main")

			consoleErrorSpy.mockRestore()
		})

		it("should continue watching after getCurrentBranch error", async () => {
			// First call fails
			mockedGetCurrentBranch.mockRejectedValueOnce(new Error("Git error"))

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			capturedHandlers.onChange!()
			await vi.advanceTimersByTimeAsync(100)

			expect(mockCallback).not.toHaveBeenCalled()

			// Second call succeeds
			vi.clearAllMocks()
			mockedGetCurrentBranch.mockResolvedValue("feature-branch")

			capturedHandlers.onChange!()
			await vi.advanceTimersByTimeAsync(100)

			// Should work normally now
			expect(mockCallback).toHaveBeenCalledWith("main", "feature-branch")
			expect(watcher.getCurrentBranch()).toBe("feature-branch")

			consoleErrorSpy.mockRestore()
		})
	})

	describe("cleanup", () => {
		it("should dispose file watcher on dispose", async () => {
			mockedGetCurrentBranch.mockResolvedValue("main")

			const config: GitBranchWatcherConfig = { enabled: true }
			watcher = new GitBranchWatcher(testWorkspacePath, mockCallback, config)

			await watcher.initialize()

			watcher.dispose()

			expect(mockFileWatcher.dispose).toHaveBeenCalled()
		})

		it("should clear debounce timer on dispose", async () => {
			mockedGetCurrentBranch.mockResolvedValue("main")

			const config: GitBranchWatcherConfig = { enabled: true, debounceMs: 100 }
			watcher = new GitBranchWatcher(testWorkspacePath, mockCallback, config)

			await watcher.initialize()

			// Trigger change but don't wait for debounce
			mockedGetCurrentBranch.mockResolvedValue("feature-branch")
			capturedHandlers.onChange!()

			// Dispose before debounce completes
			watcher.dispose()

			// Advance timers
			await vi.advanceTimersByTimeAsync(100)

			// Callback should not be called because timer was cleared
			expect(mockCallback).not.toHaveBeenCalled()
		})

		it("should handle multiple dispose calls safely", async () => {
			mockedGetCurrentBranch.mockResolvedValue("main")

			const config: GitBranchWatcherConfig = { enabled: true }
			watcher = new GitBranchWatcher(testWorkspacePath, mockCallback, config)

			await watcher.initialize()

			// Should not throw
			watcher.dispose()
			watcher.dispose()

			expect(mockFileWatcher.dispose).toHaveBeenCalledTimes(1)
		})
	})

	describe("edge cases", () => {
		it("should handle undefined branch (detached HEAD)", async () => {
			mockedGetCurrentBranch.mockResolvedValue(undefined)

			const config: GitBranchWatcherConfig = { enabled: true, debounceMs: 100 }
			watcher = new GitBranchWatcher(testWorkspacePath, mockCallback, config)

			await watcher.initialize()
			vi.clearAllMocks()

			// Change to a branch
			mockedGetCurrentBranch.mockResolvedValue("main")

			capturedHandlers.onChange!()

			await vi.advanceTimersByTimeAsync(100)

			expect(mockCallback).toHaveBeenCalledWith(undefined, "main")
		})

		it("should handle branch to undefined transition", async () => {
			mockedGetCurrentBranch.mockResolvedValue("main")

			const config: GitBranchWatcherConfig = { enabled: true, debounceMs: 100 }
			watcher = new GitBranchWatcher(testWorkspacePath, mockCallback, config)

			await watcher.initialize()
			vi.clearAllMocks()

			// Change to detached HEAD
			mockedGetCurrentBranch.mockResolvedValue(undefined)

			capturedHandlers.onChange!()

			await vi.advanceTimersByTimeAsync(100)

			expect(mockCallback).toHaveBeenCalledWith("main", undefined)
		})
	})
})
