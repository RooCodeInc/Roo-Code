// npx vitest core/webview/__tests__/webviewMessageHandler.race-condition.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import { webviewMessageHandler } from "../webviewMessageHandler"
import { ClineProvider } from "../ClineProvider"
import { Task } from "../../task/Task"
import { WebviewMessage } from "../../../shared/WebviewMessage"

vi.mock("vscode")

describe("webviewMessageHandler - Race Condition Prevention", () => {
	let provider: ClineProvider
	let task: any
	let messageQueueService: any
	let postStateToWebviewSpy: any
	let addMessageSpy: any

	beforeEach(() => {
		// Create mock message queue service
		messageQueueService = {
			addMessage: vi.fn().mockReturnValue(true),
			getMessage: vi.fn(),
			getAllMessages: vi.fn().mockReturnValue([]),
			clearMessages: vi.fn(),
			on: vi.fn(),
			off: vi.fn(),
			emit: vi.fn(),
		}

		// Create mock task - use 'any' type to allow modifiable taskAsk
		task = {
			id: "test-task-123",
			taskAsk: undefined, // Initially no pending ask
			messageQueueService,
			handleWebviewAskResponse: vi.fn(),
		}

		// Create mock provider
		provider = {
			context: {
				globalState: {
					get: vi.fn().mockReturnValue(undefined),
					update: vi.fn().mockResolvedValue(undefined),
				},
				workspaceState: {
					get: vi.fn().mockReturnValue(undefined),
					update: vi.fn().mockResolvedValue(undefined),
				},
				extensionPath: "/test/path",
			},
			contextProxy: {
				getValue: vi.fn(),
				setValue: vi.fn().mockResolvedValue(undefined),
				globalStorageUri: { fsPath: "/test/storage" },
			},
			cwd: "/test/workspace",
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			getCurrentTask: vi.fn().mockReturnValue(task),
			log: vi.fn(),
		} as any

		// Setup spies - use 'any' type to avoid type issues
		postStateToWebviewSpy = vi.spyOn(provider, "postStateToWebview")
		addMessageSpy = vi.spyOn(messageQueueService, "addMessage")
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("Defensive routing for free user messages", () => {
		it('should route message to queue when askResponse is "messageResponse" and no taskAsk exists', async () => {
			// Arrange: No pending ask
			task.taskAsk = undefined

			const message: WebviewMessage = {
				type: "askResponse",
				askResponse: "messageResponse",
				text: "User message during race condition",
				images: ["image1.png"],
			}

			// Act
			await webviewMessageHandler(provider, message)

			// Assert: Message should be queued instead of processed as askResponse
			expect(addMessageSpy).toHaveBeenCalledWith("User message during race condition", ["image1.png"])
			expect(task.handleWebviewAskResponse).not.toHaveBeenCalled()
			expect(postStateToWebviewSpy).toHaveBeenCalled()
		})

		it("should process askResponse normally when taskAsk exists", async () => {
			// Arrange: Pending ask exists
			task.taskAsk = {
				type: "followup",
				text: "Need user input",
			} as any

			const message: WebviewMessage = {
				type: "askResponse",
				askResponse: "messageResponse",
				text: "User response to ask",
				images: [],
			}

			// Act
			await webviewMessageHandler(provider, message)

			// Assert: Message should be processed as askResponse
			expect(task.handleWebviewAskResponse).toHaveBeenCalledWith("messageResponse", "User response to ask", [])
			expect(addMessageSpy).not.toHaveBeenCalled()
		})

		it("should not affect other askResponse types", async () => {
			// Arrange: No pending ask but different response type
			task.taskAsk = undefined

			const message: WebviewMessage = {
				type: "askResponse",
				askResponse: "yesButtonClicked", // Different response type
			}

			// Act
			await webviewMessageHandler(provider, message)

			// Assert: Should process normally (not queue)
			expect(task.handleWebviewAskResponse).toHaveBeenCalledWith("yesButtonClicked", undefined, undefined)
			expect(addMessageSpy).not.toHaveBeenCalled()
		})

		it("should handle case when no current task exists", async () => {
			// Arrange: No current task
			provider.getCurrentTask = vi.fn().mockReturnValue(undefined)

			const message: WebviewMessage = {
				type: "askResponse",
				askResponse: "messageResponse",
				text: "Message with no task",
				images: [],
			}

			// Act & Assert: Should not throw error
			await expect(webviewMessageHandler(provider, message)).resolves.not.toThrow()
			expect(addMessageSpy).not.toHaveBeenCalled()
		})
	})

	describe("Queue message handling", () => {
		it("should add message to queue when queueMessage type is received", async () => {
			// Arrange
			const message: WebviewMessage = {
				type: "queueMessage",
				text: "Queued message",
				images: ["image.jpg"],
			}

			// Act
			await webviewMessageHandler(provider, message)

			// Assert
			expect(addMessageSpy).toHaveBeenCalledWith("Queued message", ["image.jpg"])
			// Note: postStateToWebview is not called for queueMessage in actual implementation
		})

		it("should handle queue full scenario gracefully", async () => {
			// Arrange: Queue is full
			addMessageSpy.mockReturnValue(false)

			const message: WebviewMessage = {
				type: "queueMessage",
				text: "Message when queue is full",
				images: [],
			}

			// Act
			await webviewMessageHandler(provider, message)

			// Assert: Should attempt to add to queue even if full
			expect(addMessageSpy).toHaveBeenCalledWith("Message when queue is full", [])
			// The actual implementation uses message.text ?? "" so it passes the actual text
		})
	})

	describe("Race condition window coverage", () => {
		it("should prevent message loss during rapid state transitions", async () => {
			// Simulate rapid fire messages during state transition
			const messages: WebviewMessage[] = [
				{ type: "askResponse", askResponse: "messageResponse", text: "Message 1", images: [] },
				{ type: "askResponse", askResponse: "messageResponse", text: "Message 2", images: [] },
				{ type: "askResponse", askResponse: "messageResponse", text: "Message 3", images: [] },
			]

			// Initially no ask
			task.taskAsk = undefined

			// Process all messages
			for (const msg of messages) {
				await webviewMessageHandler(provider, msg)
			}

			// All messages should be queued
			expect(addMessageSpy).toHaveBeenCalledTimes(3)
			expect(addMessageSpy).toHaveBeenNthCalledWith(1, "Message 1", [])
			expect(addMessageSpy).toHaveBeenNthCalledWith(2, "Message 2", [])
			expect(addMessageSpy).toHaveBeenNthCalledWith(3, "Message 3", [])

			// None should be processed as askResponse
			expect(task.handleWebviewAskResponse).not.toHaveBeenCalled()
		})

		it("should handle mixed message scenarios correctly", async () => {
			// Start with no ask
			task.taskAsk = undefined

			// Message 1: Should be queued
			await webviewMessageHandler(provider, {
				type: "askResponse",
				askResponse: "messageResponse",
				text: "Message during no ask",
				images: [],
			})

			expect(addMessageSpy).toHaveBeenCalledWith("Message during no ask", [])
			expect(addMessageSpy).toHaveBeenCalledTimes(1)

			// Now set taskAsk
			task.taskAsk = { type: "followup" } as any

			// Message 2: Should be processed
			await webviewMessageHandler(provider, {
				type: "askResponse",
				askResponse: "messageResponse",
				text: "Message during ask",
				images: [],
			})

			expect(task.handleWebviewAskResponse).toHaveBeenCalledWith("messageResponse", "Message during ask", [])

			// Remove taskAsk again
			task.taskAsk = undefined

			// Message 3: Should be queued again
			await webviewMessageHandler(provider, {
				type: "askResponse",
				askResponse: "messageResponse",
				text: "Another message during no ask",
				images: [],
			})

			expect(addMessageSpy).toHaveBeenCalledTimes(2)
			expect(addMessageSpy).toHaveBeenNthCalledWith(2, "Another message during no ask", [])
		})
	})

	describe("Console logging behavior", () => {
		it("should log when routing message to queue due to no pending ask", async () => {
			// Arrange
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
			task.taskAsk = undefined

			const message: WebviewMessage = {
				type: "askResponse",
				askResponse: "messageResponse",
				text: "Test message",
				images: [],
			}

			// Act
			await webviewMessageHandler(provider, message)

			// Assert
			expect(consoleSpy).toHaveBeenCalledWith("[webviewMessageHandler] No pending ask, routing message to queue")

			consoleSpy.mockRestore()
		})
	})
})
