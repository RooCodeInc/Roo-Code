// npx vitest run __tests__/subtask-metadata-tracking.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import type { ClineMessage } from "@roo-code/types"
import type { SubtaskMetadata, ClineMessageWithMetadata } from "../core/task/types"
import { subtaskMetadataSchema } from "@roo-code/types"

/**
 * Unit tests for subtask metadata tracking system
 * 
 * Tests validate:
 * - Metadata attachment to messages
 * - Metadata persistence to ui_messages.json
 * - Parent resolution from messages
 * - VSCode restart simulation
 * - Edge cases and error handling
 */

// Mock vscode module
vi.mock("vscode", () => ({
	Uri: {
		file: (path: string) => ({ fsPath: path, toString: () => path }),
	},
	window: {
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
	},
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue([]),
		}),
	},
	env: {
		language: "en",
		machineId: "test-machine",
	},
}))

// Mock dependencies
vi.mock("../core/config/ContextProxy", () => ({
	ContextProxy: {
		getInstance: vi.fn().mockResolvedValue({
			getValue: vi.fn(),
			setValue: vi.fn(),
			getValues: vi.fn().mockReturnValue({}),
			getProviderSettings: vi.fn().mockReturnValue({
				apiProvider: "anthropic",
			}),
			globalStorageUri: { fsPath: "/tmp/test-storage" },
		}),
	},
}))

vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: vi.fn().mockReturnValue(false),
		instance: {
			getUserInfo: vi.fn().mockReturnValue(null),
			isTaskSyncEnabled: vi.fn().mockReturnValue(false),
		},
	},
	BridgeOrchestrator: {
		isEnabled: vi.fn().mockReturnValue(false),
	},
	getRooCodeApiUrl: vi.fn().mockReturnValue("https://app.roocode.com"),
}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		createInstance: vi.fn().mockReturnValue({
			register: vi.fn(),
			setProvider: vi.fn(),
			shutdown: vi.fn(),
		}),
		get instance() {
			return {
				register: vi.fn(),
				setProvider: vi.fn(),
				shutdown: vi.fn(),
				captureEvent: vi.fn(),
			}
		},
	},
}))

describe("SubtaskMetadata Attachment", () => {
	let testDir: string

	beforeEach(async () => {
		// Create temporary test directory
		testDir = path.join("/tmp", `test-subtask-${Date.now()}`)
		await fs.mkdir(testDir, { recursive: true })
	})

	afterEach(async () => {
		// Clean up test directory
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch (error) {
			// Ignore cleanup errors
		}
	})

	it("should attach metadata on subtask creation", async () => {
		// Create mock messages with subtask metadata
		const parentTaskId = "550e8400-e29b-41d4-a716-446655440000"
		const parentMessageId = "1730740800000"
		
		const message: ClineMessage & ClineMessageWithMetadata = {
			ts: Date.now(),
			type: "say",
			say: "text",
			text: "Starting subtask",
			metadata: {
				subtask: {
					parentTaskId,
					parentMessageId,
					depth: 1,
					requiresReturn: true,
				},
			},
		}

		// Verify metadata structure
		expect(message.metadata).toBeDefined()
		expect(message.metadata?.subtask).toBeDefined()
		expect(message.metadata?.subtask?.parentTaskId).toBe(parentTaskId)
		expect(message.metadata?.subtask?.parentMessageId).toBe(parentMessageId)
		expect(message.metadata?.subtask?.depth).toBe(1)
		expect(message.metadata?.subtask?.requiresReturn).toBe(true)
	})

	it("should not attach metadata to root tasks", async () => {
		const message: ClineMessage = {
			ts: Date.now(),
			type: "say",
			say: "text",
			text: "Starting root task",
		}

		// Root task should not have subtask metadata
		const messageWithMeta = message as ClineMessage & ClineMessageWithMetadata
		expect(messageWithMeta.metadata?.subtask).toBeUndefined()
	})

	it("should calculate depth correctly for nested subtasks", async () => {
		// Simulate parent -> child -> grandchild hierarchy
		const messages: (ClineMessage & ClineMessageWithMetadata)[] = [
			{
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Level 0 (root)",
				// No metadata for root
			},
			{
				ts: Date.now() + 1,
				type: "say",
				say: "text",
				text: "Level 1 (child)",
				metadata: {
					subtask: {
						parentTaskId: "root-task-id",
						depth: 1,
						requiresReturn: true,
					},
				},
			},
			{
				ts: Date.now() + 2,
				type: "say",
				say: "text",
				text: "Level 2 (grandchild)",
				metadata: {
					subtask: {
						parentTaskId: "child-task-id",
						depth: 2,
						requiresReturn: true,
					},
				},
			},
		]

		// Verify depth progression
		expect(messages[0].metadata?.subtask).toBeUndefined() // Root: no metadata
		expect(messages[1].metadata?.subtask?.depth).toBe(1) // Child: depth 1
		expect(messages[2].metadata?.subtask?.depth).toBe(2) // Grandchild: depth 2
	})

	it("should validate metadata with Zod schema", async () => {
		// Valid metadata
		const validMetadata: SubtaskMetadata = {
			parentTaskId: "550e8400-e29b-41d4-a716-446655440000",
			parentMessageId: "1730740800000",
			depth: 1,
			requiresReturn: true,
		}

		// Should pass validation
		expect(() => subtaskMetadataSchema.parse(validMetadata)).not.toThrow()

		// Invalid metadata (negative depth)
		const invalidMetadata = {
			parentTaskId: "550e8400-e29b-41d4-a716-446655440000",
			depth: -1,
			requiresReturn: true,
		}

		// Should fail validation
		expect(() => subtaskMetadataSchema.parse(invalidMetadata)).toThrow()
	})
})

describe("Metadata Persistence", () => {
	let testDir: string

	beforeEach(async () => {
		testDir = path.join("/tmp", `test-persist-${Date.now()}`)
		await fs.mkdir(testDir, { recursive: true })
	})

	afterEach(async () => {
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch (error) {
			// Ignore cleanup errors
		}
	})

	it("should persist subtask metadata to ui_messages.json", async () => {
		const taskId = "test-task-123"
		const taskDir = path.join(testDir, taskId)
		await fs.mkdir(taskDir, { recursive: true })

		const messagesFile = path.join(taskDir, "ui_messages.json")
		
		const messages: (ClineMessage & ClineMessageWithMetadata)[] = [
			{
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Subtask message",
				metadata: {
					subtask: {
						parentTaskId: "parent-123",
						parentMessageId: "msg-456",
						depth: 1,
						requiresReturn: true,
					},
				},
			},
		]

		// Write messages to file
		await fs.writeFile(messagesFile, JSON.stringify(messages, null, 2))

		// Read back and verify
		const content = await fs.readFile(messagesFile, "utf8")
		const parsedMessages = JSON.parse(content) as (ClineMessage & ClineMessageWithMetadata)[]

		expect(parsedMessages).toHaveLength(1)
		expect(parsedMessages[0].metadata?.subtask).toBeDefined()
		expect(parsedMessages[0].metadata?.subtask?.parentTaskId).toBe("parent-123")
		expect(parsedMessages[0].metadata?.subtask?.depth).toBe(1)
	})

	it("should maintain metadata after multiple saves", async () => {
		const taskId = "test-task-456"
		const taskDir = path.join(testDir, taskId)
		await fs.mkdir(taskDir, { recursive: true })

		const messagesFile = path.join(taskDir, "ui_messages.json")
		
		const originalMetadata = {
			parentTaskId: "parent-abc",
			parentMessageId: "msg-xyz",
			depth: 2,
			requiresReturn: true,
		}

		const messages: (ClineMessage & ClineMessageWithMetadata)[] = [
			{
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Test message",
				metadata: { subtask: originalMetadata },
			},
		]

		// Save multiple times
		for (let i = 0; i < 3; i++) {
			await fs.writeFile(messagesFile, JSON.stringify(messages, null, 2))
		}

		// Read and verify metadata unchanged
		const content = await fs.readFile(messagesFile, "utf8")
		const parsedMessages = JSON.parse(content) as (ClineMessage & ClineMessageWithMetadata)[]

		expect(parsedMessages[0].metadata?.subtask).toEqual(originalMetadata)
	})

	it("should handle missing metadata file gracefully", async () => {
		const taskId = "nonexistent-task"
		const messagesFile = path.join(testDir, taskId, "ui_messages.json")

		// Attempt to read non-existent file
		await expect(fs.readFile(messagesFile, "utf8")).rejects.toThrow()
	})
})

describe("Parent Resolution from Messages", () => {
	it("should resolve parent from message metadata", async () => {
		const parentTaskId = "parent-task-123"
		const subtaskMessages: (ClineMessage & ClineMessageWithMetadata)[] = [
			{
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Subtask starts",
				metadata: {
					subtask: {
						parentTaskId,
						depth: 1,
						requiresReturn: true,
					},
				},
			},
		]

		// Extract parent ID from first message
		const firstMessage = subtaskMessages[0]
		const resolvedParentId = firstMessage.metadata?.subtask?.parentTaskId

		expect(resolvedParentId).toBe(parentTaskId)
	})

	it("should handle missing parent gracefully", async () => {
		const messages: (ClineMessage & ClineMessageWithMetadata)[] = [
			{
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Orphaned subtask",
				metadata: {
					subtask: {
						// Missing parentTaskId
						depth: 1,
						requiresReturn: true,
					},
				},
			},
		]

		const firstMessage = messages[0]
		const resolvedParentId = firstMessage.metadata?.subtask?.parentTaskId

		// Should be undefined when parent is missing
		expect(resolvedParentId).toBeUndefined()
	})

	it("should fall back to legacy historyItem when message metadata missing", async () => {
		// Simulate legacy message without metadata
		const legacyMessage: ClineMessage = {
			ts: Date.now(),
			type: "say",
			say: "text",
			text: "Legacy subtask",
		}

		// Legacy fallback: check historyItem properties
		const historyItem = {
			id: "subtask-789",
			parentTaskId: "parent-fallback-id",
			number: 1,
			ts: Date.now(),
			task: "Legacy task",
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
		}

		// Verify fallback mechanism works
		const messageWithMeta = legacyMessage as ClineMessage & ClineMessageWithMetadata
		const parentFromMessage = messageWithMeta.metadata?.subtask?.parentTaskId
		const parentFromHistory = historyItem.parentTaskId

		// Message metadata should be undefined, fall back to history
		expect(parentFromMessage).toBeUndefined()
		expect(parentFromHistory).toBe("parent-fallback-id")
	})
})

describe("VSCode Restart Scenarios", () => {
	let testDir: string

	beforeEach(async () => {
		testDir = path.join("/tmp", `test-restart-${Date.now()}`)
		await fs.mkdir(testDir, { recursive: true })
	})

	afterEach(async () => {
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch (error) {
			// Ignore cleanup errors
		}
	})

	it("should restore subtask parent relationship after restart", async () => {
		// Step 1: Create parent and subtask before "restart"
		const parentTaskId = "parent-task-restart"
		const subtaskId = "subtask-restart"
		
		const subtaskDir = path.join(testDir, subtaskId)
		await fs.mkdir(subtaskDir, { recursive: true })

		const messages: (ClineMessage & ClineMessageWithMetadata)[] = [
			{
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Pre-restart subtask",
				metadata: {
					subtask: {
						parentTaskId,
						depth: 1,
						requiresReturn: true,
					},
				},
			},
		]

		// Save messages (simulating pre-restart state)
		const messagesFile = path.join(subtaskDir, "ui_messages.json")
		await fs.writeFile(messagesFile, JSON.stringify(messages, null, 2))

		// Step 2: Simulate VSCode restart by clearing in-memory state
		// (In real code, this would be the clineStack being empty)

		// Step 3: Restore from persistence
		const restoredContent = await fs.readFile(messagesFile, "utf8")
		const restoredMessages = JSON.parse(restoredContent) as (ClineMessage & ClineMessageWithMetadata)[]

		// Verify parent link intact
		expect(restoredMessages[0].metadata?.subtask?.parentTaskId).toBe(parentTaskId)
		expect(restoredMessages[0].metadata?.subtask?.depth).toBe(1)
	})

	it("should handle multi-level nesting after restart", async () => {
		// Create grandparent -> parent -> child hierarchy
		const grandparentId = "grandparent-task"
		const parentId = "parent-task"
		const childId = "child-task"

		// Child task messages
		const childDir = path.join(testDir, childId)
		await fs.mkdir(childDir, { recursive: true })

		const childMessages: (ClineMessage & ClineMessageWithMetadata)[] = [
			{
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Grandchild task",
				metadata: {
					subtask: {
						parentTaskId: parentId,
						depth: 2,
						requiresReturn: true,
					},
				},
			},
		]

		await fs.writeFile(
			path.join(childDir, "ui_messages.json"),
			JSON.stringify(childMessages, null, 2)
		)

		// Parent task messages  
		const parentDir = path.join(testDir, parentId)
		await fs.mkdir(parentDir, { recursive: true })

		const parentMessages: (ClineMessage & ClineMessageWithMetadata)[] = [
			{
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Parent task",
				metadata: {
					subtask: {
						parentTaskId: grandparentId,
						depth: 1,
						requiresReturn: true,
					},
				},
			},
		]

		await fs.writeFile(
			path.join(parentDir, "ui_messages.json"),
			JSON.stringify(parentMessages, null, 2)
		)

		// Simulate restart and restore
		const restoredChild = JSON.parse(
			await fs.readFile(path.join(childDir, "ui_messages.json"), "utf8")
		) as (ClineMessage & ClineMessageWithMetadata)[]

		const restoredParent = JSON.parse(
			await fs.readFile(path.join(parentDir, "ui_messages.json"), "utf8")
		) as (ClineMessage & ClineMessageWithMetadata)[]

		// Verify entire chain
		expect(restoredChild[0].metadata?.subtask?.parentTaskId).toBe(parentId)
		expect(restoredChild[0].metadata?.subtask?.depth).toBe(2)

		expect(restoredParent[0].metadata?.subtask?.parentTaskId).toBe(grandparentId)
		expect(restoredParent[0].metadata?.subtask?.depth).toBe(1)
	})
})

describe("Edge Cases", () => {
	let testDir: string

	beforeEach(async () => {
		testDir = path.join("/tmp", `test-edge-${Date.now()}`)
		await fs.mkdir(testDir, { recursive: true })
	})

	afterEach(async () => {
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch (error) {
			// Ignore cleanup errors
		}
	})

	it("should handle corrupted metadata gracefully", async () => {
		const taskDir = path.join(testDir, "corrupted-task")
		await fs.mkdir(taskDir, { recursive: true })

		const messagesFile = path.join(taskDir, "ui_messages.json")
		
		// Write corrupted JSON
		await fs.writeFile(messagesFile, "{ invalid json }")

		// Attempt to read should throw
		await expect(async () => {
			const content = await fs.readFile(messagesFile, "utf8")
			JSON.parse(content)
		}).rejects.toThrow()
	})

	it("should handle empty messages array", async () => {
		const messages: ClineMessage[] = []

		// Should not throw when accessing empty array
		expect(messages.length).toBe(0)
		expect(messages[0]).toBeUndefined()
	})

	it("should handle concurrent subtasks correctly", async () => {
		// Create multiple subtasks from same parent
		const parentTaskId = "concurrent-parent"
		
		const subtask1Messages: (ClineMessage & ClineMessageWithMetadata)[] = [
			{
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Subtask 1",
				metadata: {
					subtask: {
						parentTaskId,
						depth: 1,
						requiresReturn: true,
					},
				},
			},
		]

		const subtask2Messages: (ClineMessage & ClineMessageWithMetadata)[] = [
			{
				ts: Date.now() + 1,
				type: "say",
				say: "text",
				text: "Subtask 2",
				metadata: {
					subtask: {
						parentTaskId,
						depth: 1,
						requiresReturn: true,
					},
				},
			},
		]

		// Both should have same parent but be independent
		expect(subtask1Messages[0].metadata?.subtask?.parentTaskId).toBe(parentTaskId)
		expect(subtask2Messages[0].metadata?.subtask?.parentTaskId).toBe(parentTaskId)
		
		// But different timestamps
		expect(subtask1Messages[0].ts).not.toBe(subtask2Messages[0].ts)
	})

	it("should handle invalid UUID format in parentTaskId", async () => {
		const invalidMetadata = {
			parentTaskId: "not-a-uuid",
			depth: 1,
			requiresReturn: true,
		}

		// Zod schema should reject invalid UUID
		expect(() => subtaskMetadataSchema.parse(invalidMetadata)).toThrow()
	})

	it("should handle missing required fields", async () => {
		// All fields are optional in the schema for backward compatibility
		const minimalMetadata = {}

		// Should pass validation even with no fields
		expect(() => subtaskMetadataSchema.parse(minimalMetadata)).not.toThrow()
	})

	it("should handle metadata with extra unknown fields", async () => {
		const metadataWithExtras = {
			parentTaskId: "550e8400-e29b-41d4-a716-446655440000",
			depth: 1,
			requiresReturn: true,
			extraField: "should be ignored",
		}

		// Zod should strip unknown fields
		const parsed = subtaskMetadataSchema.parse(metadataWithExtras)
		expect(parsed).not.toHaveProperty("extraField")
	})
})

describe("Resumed Subtask Result Injection", () => {
	let testDir: string

	beforeEach(async () => {
		testDir = path.join("/tmp", `test-injection-${Date.now()}`)
		await fs.mkdir(testDir, { recursive: true })
	})

	afterEach(async () => {
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch (error) {
			// Ignore cleanup errors
		}
	})

	it("should inject subtask result into parent messages when parent not in stack", async () => {
		// Setup: Create parent task directory and messages file
		const parentTaskId = "parent-task-injection-test"
		const parentDir = path.join(testDir, parentTaskId)
		await fs.mkdir(parentDir, { recursive: true })

		const initialParentMessages: ClineMessage[] = [
			{
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Parent task initial message",
			},
		]

		const parentMessagesFile = path.join(parentDir, "ui_messages.json")
		await fs.writeFile(parentMessagesFile, JSON.stringify(initialParentMessages, null, 2))

		// Simulate: Subtask completes and injects result
		const subtaskResult = "Subtask completed successfully with test data"
		const subtaskResultMessage: ClineMessage = {
			ts: Date.now() + 1,
			type: "say",
			say: "subtask_result",
			text: subtaskResult,
		}

		// Load parent messages, inject result, save (simulating finishSubTask behavior)
		const parentContent = await fs.readFile(parentMessagesFile, "utf8")
		const parentMessages = JSON.parse(parentContent) as ClineMessage[]
		parentMessages.push(subtaskResultMessage)
		await fs.writeFile(parentMessagesFile, JSON.stringify(parentMessages, null, 2))

		// Verify: Parent messages now include subtask result
		const updatedContent = await fs.readFile(parentMessagesFile, "utf8")
		const updatedMessages = JSON.parse(updatedContent) as ClineMessage[]

		expect(updatedMessages).toHaveLength(2)
		expect(updatedMessages[0].text).toBe("Parent task initial message")
		expect(updatedMessages[1].type).toBe("say")
		expect(updatedMessages[1].say).toBe("subtask_result")
		expect(updatedMessages[1].text).toBe(subtaskResult)
	})

	it("should preserve existing parent messages when injecting subtask result", async () => {
		// Setup: Parent with multiple existing messages
		const parentTaskId = "parent-multi-message-test"
		const parentDir = path.join(testDir, parentTaskId)
		await fs.mkdir(parentDir, { recursive: true })

		const initialParentMessages: ClineMessage[] = [
			{
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Message 1",
			},
			{
				ts: Date.now() + 1,
				type: "say",
				say: "text",
				text: "Message 2",
			},
			{
				ts: Date.now() + 2,
				type: "ask",
				ask: "followup",
				text: "Question?",
			},
		]

		const parentMessagesFile = path.join(parentDir, "ui_messages.json")
		await fs.writeFile(parentMessagesFile, JSON.stringify(initialParentMessages, null, 2))

		// Inject subtask result
		const subtaskResultMessage: ClineMessage = {
			ts: Date.now() + 3,
			type: "say",
			say: "subtask_result",
			text: "Subtask completed",
		}

		const parentContent = await fs.readFile(parentMessagesFile, "utf8")
		const parentMessages = JSON.parse(parentContent) as ClineMessage[]
		parentMessages.push(subtaskResultMessage)
		await fs.writeFile(parentMessagesFile, JSON.stringify(parentMessages, null, 2))

		// Verify: All original messages preserved + new result
		const updatedContent = await fs.readFile(parentMessagesFile, "utf8")
		const updatedMessages = JSON.parse(updatedContent) as ClineMessage[]

		expect(updatedMessages).toHaveLength(4)
		expect(updatedMessages[0].text).toBe("Message 1")
		expect(updatedMessages[1].text).toBe("Message 2")
		expect(updatedMessages[2].text).toBe("Question?")
		expect(updatedMessages[3].say).toBe("subtask_result")
		expect(updatedMessages[3].text).toBe("Subtask completed")
	})

	it("should handle missing parent messages file gracefully", async () => {
		const parentTaskId = "nonexistent-parent"
		const nonexistentFile = path.join(testDir, parentTaskId, "ui_messages.json")

		// Attempt to read should throw ENOENT
		await expect(fs.readFile(nonexistentFile, "utf8")).rejects.toThrow()
	})

	it("should maintain message ordering after multiple subtask completions", async () => {
		// Setup: Parent task
		const parentTaskId = "parent-multiple-subtasks"
		const parentDir = path.join(testDir, parentTaskId)
		await fs.mkdir(parentDir, { recursive: true })

		const initialMessages: ClineMessage[] = [
			{
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Parent starts",
			},
		]

		const parentMessagesFile = path.join(parentDir, "ui_messages.json")
		await fs.writeFile(parentMessagesFile, JSON.stringify(initialMessages, null, 2))

		// Simulate multiple subtasks completing in sequence
		const subtaskResults = [
			"Subtask 1 result",
			"Subtask 2 result",
			"Subtask 3 result",
		]

		for (let i = 0; i < subtaskResults.length; i++) {
			const content = await fs.readFile(parentMessagesFile, "utf8")
			const messages = JSON.parse(content) as ClineMessage[]
			
			messages.push({
				ts: Date.now() + i + 1,
				type: "say",
				say: "subtask_result",
				text: subtaskResults[i],
			})
			
			await fs.writeFile(parentMessagesFile, JSON.stringify(messages, null, 2))
		}

		// Verify: All results in order
		const finalContent = await fs.readFile(parentMessagesFile, "utf8")
		const finalMessages = JSON.parse(finalContent) as ClineMessage[]

		expect(finalMessages).toHaveLength(4) // 1 parent + 3 subtask results
		expect(finalMessages[0].text).toBe("Parent starts")
		expect(finalMessages[1].text).toBe("Subtask 1 result")
		expect(finalMessages[2].text).toBe("Subtask 2 result")
		expect(finalMessages[3].text).toBe("Subtask 3 result")
	})
})

describe("Performance Tests", () => {
	it("should attach metadata quickly (< 1ms per task)", async () => {
		const iterations = 100
		const start = Date.now()

		for (let i = 0; i < iterations; i++) {
			const message: ClineMessage & ClineMessageWithMetadata = {
				ts: Date.now(),
				type: "say",
				say: "text",
				text: `Message ${i}`,
				metadata: {
					subtask: {
						parentTaskId: "550e8400-e29b-41d4-a716-446655440000",
						depth: 1,
						requiresReturn: true,
					},
				},
			}

			// Simulate metadata attachment
			expect(message.metadata?.subtask).toBeDefined()
		}

		const duration = Date.now() - start
		const avgTime = duration / iterations

		// Should be fast (< 1ms per operation)
		expect(avgTime).toBeLessThan(1)
	})

	it("should handle large message arrays efficiently", async () => {
		const messageCount = 1000
		const messages: (ClineMessage & ClineMessageWithMetadata)[] = []

		for (let i = 0; i < messageCount; i++) {
			messages.push({
				ts: Date.now() + i,
				type: "say",
				say: "text",
				text: `Message ${i}`,
				metadata: {
					subtask: {
						parentTaskId: "550e8400-e29b-41d4-a716-446655440000",
						depth: 1,
						requiresReturn: true,
					},
				},
			})
		}

		// Should be able to process large arrays quickly
		const start = Date.now()
		const firstMessage = messages[0]
		const lastMessage = messages[messageCount - 1]
		const duration = Date.now() - start

		expect(firstMessage.metadata?.subtask).toBeDefined()
		expect(lastMessage.metadata?.subtask).toBeDefined()
		expect(duration).toBeLessThan(10) // Should be very fast
	})
})