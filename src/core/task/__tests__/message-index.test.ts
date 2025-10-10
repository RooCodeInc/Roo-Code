import { describe, it, expect, beforeEach, vi, beforeAll } from "vitest"
import { Task } from "../Task"
import { ClineMessage } from "@roo-code/types"
import type { ClineProvider } from "../../webview/ClineProvider"

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		get instance() {
			return {
				captureTaskCreated: vi.fn(),
				captureTaskRestarted: vi.fn(),
				captureEvent: vi.fn(),
				captureLlmCompletion: vi.fn(),
				captureConversationMessage: vi.fn(),
				captureConsecutiveMistakeError: vi.fn(),
				captureMemoryUsage: vi.fn(),
				captureMemoryWarning: vi.fn(),
				captureImageCleanup: vi.fn(),
			}
		},
	},
}))

// Mock CloudService
vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		isEnabled: () => false,
		get instance() {
			return {
				captureEvent: vi.fn(),
			}
		},
	},
	BridgeOrchestrator: {
		subscribeToTask: vi.fn(),
		unsubscribeFromTask: vi.fn(),
		getInstance: vi.fn(() => ({
			unsubscribeFromTask: vi.fn().mockResolvedValue(undefined),
		})),
	},
}))

// Mock vscode module with all required APIs
vi.mock("vscode", () => ({
	workspace: {
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		})),
		getConfiguration: vi.fn(() => ({
			get: vi.fn((key: string) => {
				if (key === "useAgentRules") return true
				if (key === "newTaskRequireTodos") return false
				return undefined
			}),
		})),
	},
	window: {
		createTextEditorDecorationType: vi.fn(() => ({
			dispose: vi.fn(),
		})),
		createOutputChannel: vi.fn(() => ({
			appendLine: vi.fn(),
			dispose: vi.fn(),
		})),
	},
	RelativePattern: class RelativePattern {
		constructor(
			public base: string,
			public pattern: string,
		) {}
	},
	Uri: {
		file: (path: string) => ({ fsPath: path }),
	},
	EventEmitter: class EventEmitter {
		event = vi.fn()
		fire = vi.fn()
		dispose = vi.fn()
	},
}))

describe("Task Message Index Optimization", () => {
	let task: Task
	let mockProvider: Partial<ClineProvider>

	beforeAll(() => {
		// Initialize any global mocks if needed
	})

	beforeEach(() => {
		// Mock provider
		mockProvider = {
			context: {
				globalStorageUri: { fsPath: "/tmp/test-storage" },
			} as any,
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			getState: vi.fn().mockResolvedValue({ mode: "code" }),
			log: vi.fn(),
		}

		// Create task instance
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: {
				apiProvider: "anthropic",
				apiKey: "test-key",
			} as any,
			startTask: false,
		})
	})

	it("should use O(1) Map lookup for findMessageByTimestamp", async () => {
		// Add multiple messages
		const messages: ClineMessage[] = []
		for (let i = 0; i < 1000; i++) {
			const message: ClineMessage = {
				ts: 1000 + i,
				type: "say",
				say: "text",
				text: `Message ${i}`,
			}
			messages.push(message)
			await (task as any).addToClineMessages(message)
		}

		// Test that findMessageByTimestamp works correctly
		const targetTs = 1500
		const found = (task as any).findMessageByTimestamp(targetTs)

		expect(found).toBeDefined()
		expect(found?.ts).toBe(targetTs)
		expect(found?.text).toBe("Message 500")
	})

	it("should rebuild index when overwriting messages", async () => {
		// Add initial messages
		const message1: ClineMessage = {
			ts: 1000,
			type: "say",
			say: "text",
			text: "Message 1",
		}
		const message2: ClineMessage = {
			ts: 2000,
			type: "say",
			say: "text",
			text: "Message 2",
		}

		await (task as any).addToClineMessages(message1)
		await (task as any).addToClineMessages(message2)

		// Verify initial state
		expect((task as any).findMessageByTimestamp(1000)).toBeDefined()
		expect((task as any).findMessageByTimestamp(2000)).toBeDefined()

		// Overwrite with new messages
		const newMessage1: ClineMessage = {
			ts: 3000,
			type: "say",
			say: "text",
			text: "New Message 1",
		}
		const newMessage2: ClineMessage = {
			ts: 4000,
			type: "say",
			say: "text",
			text: "New Message 2",
		}

		await task.overwriteClineMessages([newMessage1, newMessage2])

		// Old messages should not be found
		expect((task as any).findMessageByTimestamp(1000)).toBeUndefined()
		expect((task as any).findMessageByTimestamp(2000)).toBeUndefined()

		// New messages should be found
		expect((task as any).findMessageByTimestamp(3000)).toBeDefined()
		expect((task as any).findMessageByTimestamp(4000)).toBeDefined()
		expect((task as any).findMessageByTimestamp(3000)?.text).toBe("New Message 1")
	})

	it("should handle messages with duplicate timestamps", async () => {
		const ts = 1000
		const message1: ClineMessage = {
			ts,
			type: "say",
			say: "text",
			text: "First message",
		}
		const message2: ClineMessage = {
			ts,
			type: "say",
			say: "text",
			text: "Second message",
		}

		await (task as any).addToClineMessages(message1)
		await (task as any).addToClineMessages(message2)

		// Should return the last message with this timestamp
		const found = (task as any).findMessageByTimestamp(ts)
		expect(found?.text).toBe("Second message")
	})

	it("should clear index on dispose", () => {
		const message: ClineMessage = {
			ts: 1000,
			type: "say",
			say: "text",
			text: "Test message",
		}

		;(task as any).addToClineMessages(message)

		// Verify message is in index
		expect((task as any).messageIndex.size).toBeGreaterThan(0)

		// Dispose task
		task.dispose()

		// Index should be cleared
		expect((task as any).messageIndex.size).toBe(0)
	})

	it("should maintain index consistency with clineMessages array", async () => {
		const messages: ClineMessage[] = []
		for (let i = 0; i < 100; i++) {
			const message: ClineMessage = {
				ts: 1000 + i,
				type: "say",
				say: "text",
				text: `Message ${i}`,
			}
			messages.push(message)
			await (task as any).addToClineMessages(message)
		}

		// Verify all messages are in both array and index
		expect((task as any).clineMessages.length).toBe(100)
		expect((task as any).messageIndex.size).toBe(100)

		// Verify each message in array is also in index
		for (const msg of (task as any).clineMessages) {
			const indexed = (task as any).messageIndex.get(msg.ts)
			expect(indexed).toBe(msg)
		}
	})

	it("should handle message updates correctly", async () => {
		const message: ClineMessage = {
			ts: 1000,
			type: "say",
			say: "text",
			text: "Original text",
			partial: true,
		}

		await (task as any).addToClineMessages(message)

		// Get reference from index
		const indexed = (task as any).findMessageByTimestamp(1000)
		expect(indexed?.text).toBe("Original text")
		expect(indexed?.partial).toBe(true)

		// Update the message (simulating what happens during streaming)
		indexed.text = "Updated text"
		indexed.partial = false

		// Index should reflect the update (same object reference)
		const updatedIndexed = (task as any).findMessageByTimestamp(1000)
		expect(updatedIndexed?.text).toBe("Updated text")
		expect(updatedIndexed?.partial).toBe(false)
	})
})
