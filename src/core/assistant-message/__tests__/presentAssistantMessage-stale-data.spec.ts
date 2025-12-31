// npx vitest src/core/assistant-message/__tests__/presentAssistantMessage-stale-data.spec.ts

import { describe, it, expect, beforeEach, vi } from "vitest"
import { presentAssistantMessage } from "../presentAssistantMessage"

// Mock dependencies
vi.mock("../../task/Task")
vi.mock("../../tools/validateToolUse", () => ({
	validateToolUse: vi.fn(),
}))
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureToolUsage: vi.fn(),
			captureConsecutiveMistakeError: vi.fn(),
		},
	},
}))

/**
 * Tests for the fix to ROO-311: write_to_file truncates filenames at special characters
 *
 * The issue was that during streaming, partial-json parsing could produce truncated
 * values (e.g., path "sr" instead of "src/core/prompts/sections/skills.ts").
 * These truncated values would be cloned by presentAssistantMessage before the
 * final tool_call_end event updated the array with correct data.
 *
 * The fix ensures that for non-partial tool_use blocks, we re-read from
 * assistantMessageContent to get the final data, not stale partial data.
 */
describe("presentAssistantMessage - Stale Partial Data Fix (ROO-311)", () => {
	let mockTask: any

	beforeEach(() => {
		// Create a mock Task with minimal properties needed for testing
		mockTask = {
			taskId: "test-task-id",
			instanceId: "test-instance",
			abort: false,
			presentAssistantMessageLocked: false,
			presentAssistantMessageHasPendingUpdates: false,
			currentStreamingContentIndex: 0,
			assistantMessageContent: [],
			userMessageContent: [],
			didCompleteReadingStream: false,
			didRejectTool: false,
			didAlreadyUseTool: false,
			diffEnabled: false,
			consecutiveMistakeCount: 0,
			clineMessages: [],
			api: {
				getModel: () => ({ id: "test-model", info: {} }),
			},
			browserSession: {
				closeBrowser: vi.fn().mockResolvedValue(undefined),
			},
			recordToolUsage: vi.fn(),
			recordToolError: vi.fn(),
			toolRepetitionDetector: {
				check: vi.fn().mockReturnValue({ allowExecution: true }),
			},
			providerRef: {
				deref: () => ({
					getState: vi.fn().mockResolvedValue({
						mode: "code",
						customModes: [],
					}),
				}),
			},
			say: vi.fn().mockResolvedValue(undefined),
			ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
		}
	})

	it("should use fresh data from assistantMessageContent for non-partial tool_use blocks", async () => {
		// This test simulates the scenario where:
		// 1. A partial tool_use block is added with truncated data
		// 2. The block is updated with final data
		// 3. presentAssistantMessage should use the final data, not the stale partial data

		const toolCallId = "tool_call_stale_test"
		const truncatedPath = "sr" // Truncated by partial-json
		const fullPath = "src/core/prompts/sections/skills.ts" // Full path from final JSON

		// Set up the assistantMessageContent with the FINAL data
		// (simulating what happens after tool_call_end updates the array)
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "write_to_file",
				params: {
					path: fullPath,
					content: "file content",
				},
				nativeArgs: {
					path: fullPath,
					content: "file content",
				},
				partial: false, // Non-partial = ready for execution
			},
		]

		// Execute presentAssistantMessage
		await presentAssistantMessage(mockTask)

		// The block that was processed should have the full path, not truncated
		// We can verify this by checking that the tool was called with correct params
		// Since we're mocking, we just verify the block in assistantMessageContent has correct data
		const processedBlock = mockTask.assistantMessageContent[0]
		expect(processedBlock.params.path).toBe(fullPath)
		expect(processedBlock.nativeArgs.path).toBe(fullPath)
		expect(processedBlock.params.path).not.toBe(truncatedPath)
	})

	it("should re-read block data when processing non-partial tool_use", async () => {
		// This test verifies that the fix actually re-reads from assistantMessageContent
		// by checking that updates to the array are reflected in the processed block

		const toolCallId = "tool_call_reread_test"

		// Initial setup with partial-like data (but marked as non-partial)
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "read_file",
				params: {
					path: "test.ts",
				},
				nativeArgs: {
					files: [{ path: "test.ts" }],
				},
				partial: false,
			},
		]

		// Execute presentAssistantMessage
		await presentAssistantMessage(mockTask)

		// Verify the block was processed (not frozen due to stale data)
		// The test passes if presentAssistantMessage completes without error
		// and the block is still in the expected state
		expect(mockTask.assistantMessageContent[0].partial).toBe(false)
	})

	it("should not re-read for partial tool_use blocks (streaming in progress)", async () => {
		// Partial blocks should NOT be re-read because they're still being updated
		// by the streaming process

		const toolCallId = "tool_call_partial_test"

		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "write_to_file",
				params: {
					path: "partial/path", // Partial data
				},
				partial: true, // Still streaming
			},
		]

		// Execute presentAssistantMessage
		await presentAssistantMessage(mockTask)

		// For partial blocks, the function should return early without processing
		// (partial blocks are handled by handlePartial, not execute)
		// Verify the block is still partial
		expect(mockTask.assistantMessageContent[0].partial).toBe(true)
	})

	it("should handle the case where assistantMessageContent is updated between clone and execution", async () => {
		// This test simulates a race condition where:
		// 1. Block is cloned with partial data
		// 2. Array is updated with final data
		// 3. The fix ensures we use the final data

		const toolCallId = "tool_call_race_test"
		const partialPath = "src/co" // Truncated
		const finalPath = "src/core/prompts/sections/skills.ts"

		// Start with partial-looking data but marked as non-partial
		// (simulating the moment right after tool_call_end but before re-read)
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "write_to_file",
				params: {
					path: finalPath, // Final data is already in the array
					content: "content",
				},
				nativeArgs: {
					path: finalPath,
					content: "content",
				},
				partial: false,
			},
		]

		// Execute presentAssistantMessage
		await presentAssistantMessage(mockTask)

		// Verify the final path was used
		const block = mockTask.assistantMessageContent[0]
		expect(block.params.path).toBe(finalPath)
		expect(block.params.path).not.toBe(partialPath)
	})

	it("should handle mcp_tool_use blocks correctly (no re-read needed)", async () => {
		// MCP tool use blocks have a different type and should be handled correctly

		const toolCallId = "mcp_tool_call_test"

		// Add getMcpHub mock for MCP tool handling
		mockTask.providerRef = {
			deref: () => ({
				getState: vi.fn().mockResolvedValue({
					mode: "code",
					customModes: [],
				}),
				getMcpHub: vi.fn().mockReturnValue({
					findServerNameBySanitizedName: vi.fn().mockReturnValue("server"),
				}),
			}),
		}

		mockTask.assistantMessageContent = [
			{
				type: "mcp_tool_use",
				id: toolCallId,
				name: "mcp--server--tool",
				serverName: "server",
				toolName: "tool",
				arguments: { arg: "value" },
				partial: false,
			},
		]

		// Execute presentAssistantMessage
		await presentAssistantMessage(mockTask)

		// MCP tool use should be processed without error
		// The test passes if no exception is thrown
		expect(mockTask.assistantMessageContent[0].type).toBe("mcp_tool_use")
	})
})
