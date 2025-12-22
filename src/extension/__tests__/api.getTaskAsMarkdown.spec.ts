import { describe, it, expect, vi, beforeEach } from "vitest"
import { API } from "../api"
import type { ClineProvider } from "../../core/webview/ClineProvider"

// Mock the formatTaskAsMarkdown function
vi.mock("../../core/task/formatTaskAsMarkdown", () => ({
	formatTaskAsMarkdown: vi.fn((messages) => {
		if (!messages || messages.length === 0) return ""
		return messages.map((m: any) => `${m.type}: ${m.text}`).join("\n")
	}),
}))

// Mock the readTaskMessages function
vi.mock("../../core/task-persistence/taskMessages", () => ({
	readTaskMessages: vi.fn(),
}))

describe("API.getTaskAsMarkdown", () => {
	let api: API
	let mockProvider: Partial<ClineProvider>
	let mockOutputChannel: any
	let mockReadTaskMessages: any

	beforeEach(async () => {
		// Import and get the mocked function
		const { readTaskMessages } = await import("../../core/task-persistence/taskMessages")
		mockReadTaskMessages = vi.mocked(readTaskMessages)

		mockOutputChannel = {
			appendLine: vi.fn(),
		}

		mockProvider = {
			context: {} as any,
			getCurrentTask: vi.fn(),
			getTaskWithId: vi.fn(),
			contextProxy: {
				globalStorageUri: {
					fsPath: "/mock/storage/path",
				},
			} as any,
			// Mock the event emitter methods that API constructor uses
			on: vi.fn(),
			off: vi.fn(),
		}

		api = new API(mockOutputChannel, mockProvider as ClineProvider)
	})

	it("should return undefined when no taskId provided and no current task", async () => {
		vi.mocked(mockProvider.getCurrentTask!).mockReturnValue(undefined)

		const result = await api.getTaskAsMarkdown()

		expect(result).toBeUndefined()
	})

	it("should return formatted markdown for current task when no taskId provided", async () => {
		const mockMessages = [
			{ ts: 1000, type: "say", say: "user_feedback", text: "Hello" },
			{ ts: 1001, type: "say", say: "text", text: "Hi there" },
		]

		vi.mocked(mockProvider.getCurrentTask!).mockReturnValue({
			clineMessages: mockMessages,
		} as any)

		const result = await api.getTaskAsMarkdown()

		expect(result).toBeDefined()
		expect(result).toContain("say: Hello")
		expect(result).toContain("say: Hi there")
	})

	it("should return formatted markdown for specific task when taskId provided", async () => {
		const mockMessages = [{ ts: 1000, type: "say", say: "user_feedback", text: "Task specific message" }]

		// Mock readTaskMessages to return the messages
		mockReadTaskMessages.mockResolvedValue(mockMessages)

		const result = await api.getTaskAsMarkdown("task-123")

		expect(result).toBeDefined()
		expect(result).toContain("say: Task specific message")
		expect(mockReadTaskMessages).toHaveBeenCalledWith({
			taskId: "task-123",
			globalStoragePath: "/mock/storage/path",
		})
	})

	it("should return undefined when specific task messages not found", async () => {
		// Mock readTaskMessages to throw an error
		mockReadTaskMessages.mockRejectedValue(new Error("Task messages not found"))

		const result = await api.getTaskAsMarkdown("non-existent-task")

		expect(result).toBeUndefined()
		// Note: log method won't be called because logging is disabled in tests
		expect(mockReadTaskMessages).toHaveBeenCalledWith({
			taskId: "non-existent-task",
			globalStoragePath: "/mock/storage/path",
		})
	})

	it("should return undefined when task has no messages", async () => {
		// Mock readTaskMessages to return empty array
		mockReadTaskMessages.mockResolvedValue([])

		const result = await api.getTaskAsMarkdown("task-123")

		expect(result).toBeUndefined()
	})

	it("should handle errors gracefully and return undefined", async () => {
		// Mock readTaskMessages to throw an unexpected error
		mockReadTaskMessages.mockImplementation(() => {
			throw new Error("Unexpected error")
		})

		const result = await api.getTaskAsMarkdown("task-123")

		expect(result).toBeUndefined()
		// Note: log method won't be called because logging is disabled in tests
		// Just verify the method handled the error gracefully
		expect(mockReadTaskMessages).toHaveBeenCalledWith({
			taskId: "task-123",
			globalStoragePath: "/mock/storage/path",
		})
	})

	it("should work with current task that has many messages", async () => {
		const mockMessages = Array.from({ length: 50 }, (_, i) => ({
			ts: 1000 + i,
			type: "say",
			say: i % 2 === 0 ? "user_feedback" : "text",
			text: `Message ${i}`,
		}))

		vi.mocked(mockProvider.getCurrentTask!).mockReturnValue({
			clineMessages: mockMessages,
		} as any)

		const result = await api.getTaskAsMarkdown()

		expect(result).toBeDefined()
		expect(result).toContain("Message 0")
		expect(result).toContain("Message 49")
	})

	it("should work with task loaded from disk with many messages", async () => {
		const mockMessages = Array.from({ length: 100 }, (_, i) => ({
			ts: 2000 + i,
			type: "say",
			say: "text",
			text: `Stored message ${i}`,
		}))

		// Mock readTaskMessages to return many messages
		mockReadTaskMessages.mockResolvedValue(mockMessages)

		const result = await api.getTaskAsMarkdown("task-with-many-messages")

		expect(result).toBeDefined()
		expect(result).toContain("Stored message 0")
		expect(result).toContain("Stored message 99")
	})
})
