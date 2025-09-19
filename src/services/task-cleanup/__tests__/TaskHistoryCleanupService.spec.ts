import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fs from "fs/promises"
import * as vscode from "vscode"
import type { HistoryItem } from "@roo-code/types"
import { TaskHistoryCleanupService, type TaskHistoryCleanupConfig } from "../TaskHistoryCleanupService"

// Mock the storage utility
vi.mock("../../../utils/storage", () => ({
	getTaskDirectoryPath: vi.fn((globalStoragePath: string, taskId: string) => {
		return Promise.resolve(`${globalStoragePath}/tasks/${taskId}`)
	}),
}))

// Mock fs module
vi.mock("fs/promises", () => ({
	default: {
		readdir: vi.fn(),
		stat: vi.fn(),
		rm: vi.fn(),
	},
	readdir: vi.fn(),
	stat: vi.fn(),
	rm: vi.fn(),
}))

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/workspace" } }],
	},
}))

describe("TaskHistoryCleanupService", () => {
	let service: TaskHistoryCleanupService
	let mockLog: ReturnType<typeof vi.fn>
	let mockUpdateTaskHistory: ReturnType<typeof vi.fn>
	let mockDeleteTaskWithId: ReturnType<typeof vi.fn>
	const globalStoragePath = "/storage"

	beforeEach(() => {
		vi.clearAllMocks()
		mockLog = vi.fn()
		mockUpdateTaskHistory = vi.fn().mockResolvedValue(undefined)
		mockDeleteTaskWithId = vi.fn().mockResolvedValue(undefined)
		service = new TaskHistoryCleanupService(globalStoragePath, mockLog)

		// Reset time-based mocks
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	describe("performCleanup", () => {
		const createHistoryItem = (overrides: Partial<HistoryItem> = {}): HistoryItem => ({
			number: 1,
			id: "task1",
			ts: Date.now(),
			task: "Test task",
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
			workspace: "/other",
			...overrides,
		})

		it("should skip cleanup when disabled", async () => {
			const config: TaskHistoryCleanupConfig = {
				enabled: false,
			}
			const taskHistory: HistoryItem[] = [createHistoryItem({ id: "task1", task: "Test task 1" })]

			const result = await service.performCleanup(
				taskHistory,
				config,
				mockUpdateTaskHistory,
				mockDeleteTaskWithId,
			)

			expect(result.deletedCount).toBe(0)
			expect(result.freedSpaceMB).toBe(0)
			expect(mockDeleteTaskWithId).not.toHaveBeenCalled()
		})

		it("should skip cleanup if running too frequently", async () => {
			const config: TaskHistoryCleanupConfig = {
				enabled: true,
				maxCount: 1,
			}
			const taskHistory: HistoryItem[] = [
				createHistoryItem({ id: "task1", task: "Test task 1" }),
				createHistoryItem({ id: "task2", task: "Test task 2", number: 2 }),
			]

			// First cleanup
			await service.performCleanup(taskHistory, config, mockUpdateTaskHistory, mockDeleteTaskWithId)

			// Try again immediately
			const result = await service.performCleanup(
				taskHistory,
				config,
				mockUpdateTaskHistory,
				mockDeleteTaskWithId,
			)

			expect(result.deletedCount).toBe(0)
			expect(mockLog).toHaveBeenCalledWith(
				"[TaskHistoryCleanupService] Skipping cleanup - too soon since last cleanup",
			)
		})

		it("should not delete tasks from current workspace", async () => {
			const config: TaskHistoryCleanupConfig = {
				enabled: true,
				maxCount: 1,
			}
			const taskHistory: HistoryItem[] = [
				createHistoryItem({ id: "task1", ts: Date.now() - 2000, task: "Old task", workspace: "/workspace" }), // Current workspace
				createHistoryItem({
					id: "task2",
					ts: Date.now() - 1000,
					task: "New task",
					number: 2,
					workspace: "/other",
				}),
			]

			// Mock file system operations
			vi.mocked(fs.readdir).mockResolvedValue([])
			vi.mocked(fs.stat).mockResolvedValue({ size: 1024 * 1024 } as any)

			const result = await service.performCleanup(
				taskHistory,
				config,
				mockUpdateTaskHistory,
				mockDeleteTaskWithId,
			)

			// Should delete task2 (from /other) but not task1 (from current workspace)
			expect(result.deletedCount).toBe(1)
			expect(mockDeleteTaskWithId).toHaveBeenCalledWith("task2")
			expect(mockDeleteTaskWithId).not.toHaveBeenCalledWith("task1")
		})

		it("should delete tasks older than maxAgeDays", async () => {
			const now = Date.now()
			const config: TaskHistoryCleanupConfig = {
				enabled: true,
				maxAgeDays: 7,
			}
			const taskHistory: HistoryItem[] = [
				createHistoryItem({ id: "task1", ts: now - 8 * 24 * 60 * 60 * 1000, task: "Old task" }), // 8 days old
				createHistoryItem({ id: "task2", ts: now - 6 * 24 * 60 * 60 * 1000, task: "Recent task", number: 2 }), // 6 days old
			]

			// Mock file system operations
			vi.mocked(fs.readdir).mockResolvedValue([])
			vi.mocked(fs.stat).mockResolvedValue({ size: 1024 * 1024 } as any) // 1MB

			const result = await service.performCleanup(
				taskHistory,
				config,
				mockUpdateTaskHistory,
				mockDeleteTaskWithId,
			)

			expect(result.deletedCount).toBe(1)
			expect(mockDeleteTaskWithId).toHaveBeenCalledWith("task1")
			expect(mockUpdateTaskHistory).toHaveBeenCalledWith([taskHistory[1]])
		})

		it("should delete oldest tasks when count exceeds maxCount", async () => {
			const now = Date.now()
			const config: TaskHistoryCleanupConfig = {
				enabled: true,
				maxCount: 2,
			}
			const taskHistory: HistoryItem[] = [
				createHistoryItem({ id: "task1", ts: now - 3000, task: "Oldest" }),
				createHistoryItem({ id: "task2", ts: now - 2000, task: "Middle", number: 2 }),
				createHistoryItem({ id: "task3", ts: now - 1000, task: "Newest", number: 3 }),
			]

			// Mock file system operations
			vi.mocked(fs.readdir).mockResolvedValue([])
			vi.mocked(fs.stat).mockResolvedValue({ size: 1024 * 1024 } as any)

			const result = await service.performCleanup(
				taskHistory,
				config,
				mockUpdateTaskHistory,
				mockDeleteTaskWithId,
			)

			expect(result.deletedCount).toBe(1)
			expect(mockDeleteTaskWithId).toHaveBeenCalledWith("task1")
			expect(mockUpdateTaskHistory).toHaveBeenCalledWith([taskHistory[1], taskHistory[2]])
		})

		it("should delete tasks when disk space exceeds maxDiskSpaceMB", async () => {
			const now = Date.now()
			const config: TaskHistoryCleanupConfig = {
				enabled: true,
				maxDiskSpaceMB: 2, // 2MB limit
			}
			const taskHistory: HistoryItem[] = [
				createHistoryItem({ id: "task1", ts: now - 3000, task: "Task 1" }),
				createHistoryItem({ id: "task2", ts: now - 2000, task: "Task 2", number: 2 }),
				createHistoryItem({ id: "task3", ts: now - 1000, task: "Task 3", number: 3 }),
			]

			// Mock file system to return 1MB per task (3MB total)
			vi.mocked(fs.readdir).mockResolvedValue([
				{ name: "file1.txt", isDirectory: () => false, isFile: () => true } as any,
			])
			vi.mocked(fs.stat).mockResolvedValue({ size: 1024 * 1024 } as any) // 1MB per file

			const result = await service.performCleanup(
				taskHistory,
				config,
				mockUpdateTaskHistory,
				mockDeleteTaskWithId,
			)

			// Should delete oldest task to get under 2MB limit
			expect(result.deletedCount).toBe(1)
			expect(result.freedSpaceMB).toBeGreaterThan(0)
			expect(mockDeleteTaskWithId).toHaveBeenCalledWith("task1")
		})

		it("should handle errors gracefully", async () => {
			const config: TaskHistoryCleanupConfig = {
				enabled: true,
				maxCount: 1,
			}
			const taskHistory: HistoryItem[] = [
				createHistoryItem({ id: "task1", ts: Date.now() - 1000, task: "Task 1" }),
				createHistoryItem({ id: "task2", task: "Task 2", number: 2 }),
			]

			// Mock deletion to fail
			mockDeleteTaskWithId.mockRejectedValue(new Error("Delete failed"))

			const result = await service.performCleanup(
				taskHistory,
				config,
				mockUpdateTaskHistory,
				mockDeleteTaskWithId,
			)

			expect(result.deletedCount).toBe(0)
			expect(result.errors).toContain("Failed to delete task task1: Delete failed")
		})

		it("should combine multiple cleanup criteria", async () => {
			const now = Date.now()
			const config: TaskHistoryCleanupConfig = {
				enabled: true,
				maxCount: 2,
				maxAgeDays: 5,
			}
			const taskHistory: HistoryItem[] = [
				createHistoryItem({ id: "task1", ts: now - 10 * 24 * 60 * 60 * 1000, task: "Very old" }), // 10 days
				createHistoryItem({ id: "task2", ts: now - 6 * 24 * 60 * 60 * 1000, task: "Old", number: 2 }), // 6 days
				createHistoryItem({ id: "task3", ts: now - 1000, task: "Recent 1", number: 3 }),
				createHistoryItem({ id: "task4", ts: now, task: "Recent 2", number: 4 }),
			]

			// Mock file system operations
			vi.mocked(fs.readdir).mockResolvedValue([])
			vi.mocked(fs.stat).mockResolvedValue({ size: 1024 * 1024 } as any)

			const result = await service.performCleanup(
				taskHistory,
				config,
				mockUpdateTaskHistory,
				mockDeleteTaskWithId,
			)

			// Should delete task1 (age) and task2 (age + count)
			expect(result.deletedCount).toBe(2)
			expect(mockDeleteTaskWithId).toHaveBeenCalledWith("task1")
			expect(mockDeleteTaskWithId).toHaveBeenCalledWith("task2")
			expect(mockUpdateTaskHistory).toHaveBeenCalledWith([taskHistory[2], taskHistory[3]])
		})
	})

	describe("shouldTriggerCleanup", () => {
		const createHistoryItem = (overrides: Partial<HistoryItem> = {}): HistoryItem => ({
			number: 1,
			id: "task1",
			ts: Date.now(),
			task: "Test task",
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
			workspace: "/other",
			...overrides,
		})

		it("should return false when disabled", () => {
			const config: TaskHistoryCleanupConfig = {
				enabled: false,
				maxCount: 1,
			}
			const taskHistory: HistoryItem[] = [
				createHistoryItem({ id: "task1", task: "Task 1" }),
				createHistoryItem({ id: "task2", task: "Task 2", number: 2 }),
			]

			expect(service.shouldTriggerCleanup(taskHistory, config)).toBe(false)
		})

		it("should return true when count exceeds maxCount", () => {
			const config: TaskHistoryCleanupConfig = {
				enabled: true,
				maxCount: 1,
			}
			const taskHistory: HistoryItem[] = [
				createHistoryItem({ id: "task1", task: "Task 1" }),
				createHistoryItem({ id: "task2", task: "Task 2", number: 2 }),
			]

			// Advance time to bypass the minimum interval check
			vi.advanceTimersByTime(60 * 60 * 1000 + 1)

			expect(service.shouldTriggerCleanup(taskHistory, config)).toBe(true)
		})

		it("should return true when old tasks exist", () => {
			const now = Date.now()
			const config: TaskHistoryCleanupConfig = {
				enabled: true,
				maxAgeDays: 7,
			}
			const taskHistory: HistoryItem[] = [
				createHistoryItem({ id: "task1", ts: now - 8 * 24 * 60 * 60 * 1000, task: "Old task" }),
			]

			// Advance time to bypass the minimum interval check
			vi.advanceTimersByTime(60 * 60 * 1000 + 1)

			expect(service.shouldTriggerCleanup(taskHistory, config)).toBe(true)
		})

		it("should return false when cleanup was run recently", () => {
			const config: TaskHistoryCleanupConfig = {
				enabled: true,
				maxCount: 1,
			}
			const taskHistory: HistoryItem[] = [
				createHistoryItem({ id: "task1", task: "Task 1" }),
				createHistoryItem({ id: "task2", task: "Task 2", number: 2 }),
			]

			// First check should trigger
			vi.advanceTimersByTime(60 * 60 * 1000 + 1)
			expect(service.shouldTriggerCleanup(taskHistory, config)).toBe(true)

			// Simulate a cleanup run
			service["lastCleanupTime"] = Date.now()

			// Second check immediately after should not trigger
			expect(service.shouldTriggerCleanup(taskHistory, config)).toBe(false)
		})
	})
})
