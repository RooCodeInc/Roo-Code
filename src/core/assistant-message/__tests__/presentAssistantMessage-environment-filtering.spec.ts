// npx vitest src/core/assistant-message/__tests__/presentAssistantMessage-environment-filtering.spec.ts

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

describe("presentAssistantMessage - Environment Details Filtering", () => {
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
			api: {
				getModel: () => ({ id: "xai/grok-code-fast-1", info: {} }),
			},
			browserSession: {
				closeBrowser: vi.fn().mockResolvedValue(undefined),
			},
			recordToolUsage: vi.fn(),
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

	it("should filter out complete <environment_details> tags", async () => {
		const contentWithEnvironmentDetails = `Here is my response.
<environment_details>
# VSCode Visible Files
src/test.ts
# Current Time
2025-11-20T03:00:00Z
</environment_details>
This is the actual content the user should see.`

		mockTask.assistantMessageContent = [
			{
				type: "text",
				content: contentWithEnvironmentDetails,
				partial: false,
			},
		]

		await presentAssistantMessage(mockTask)

		// Check that say was called with filtered content
		expect(mockTask.say).toHaveBeenCalledWith(
			"text",
			expect.stringContaining("Here is my response."),
			undefined,
			false,
		)
		expect(mockTask.say).toHaveBeenCalledWith(
			"text",
			expect.stringContaining("This is the actual content the user should see."),
			undefined,
			false,
		)
		expect(mockTask.say).toHaveBeenCalledWith(
			"text",
			expect.not.stringContaining("environment_details"),
			undefined,
			false,
		)
		expect(mockTask.say).toHaveBeenCalledWith(
			"text",
			expect.not.stringContaining("VSCode Visible Files"),
			undefined,
			false,
		)
	})

	it("should filter out partial <environment_details> tag at the end", async () => {
		const contentWithPartialTag = `Here is my response to your query.
The task has been completed successfully.
<environment_det`

		mockTask.assistantMessageContent = [
			{
				type: "text",
				content: contentWithPartialTag,
				partial: true,
			},
		]

		await presentAssistantMessage(mockTask)

		// Check that say was called with content that doesn't have the partial tag
		expect(mockTask.say).toHaveBeenCalledWith(
			"text",
			expect.stringContaining("Here is my response to your query."),
			undefined,
			true,
		)
		expect(mockTask.say).toHaveBeenCalledWith(
			"text",
			expect.stringContaining("The task has been completed successfully."),
			undefined,
			true,
		)
		expect(mockTask.say).toHaveBeenCalledWith(
			"text",
			expect.not.stringContaining("<environment_det"),
			undefined,
			true,
		)
	})

	it("should filter out closing </environment_details> tag", async () => {
		const contentWithClosingTag = `Some content here.
</environment_details>
The actual response continues here.`

		mockTask.assistantMessageContent = [
			{
				type: "text",
				content: contentWithClosingTag,
				partial: false,
			},
		]

		await presentAssistantMessage(mockTask)

		// Check that say was called without the closing tag
		expect(mockTask.say).toHaveBeenCalledWith(
			"text",
			expect.not.stringContaining("</environment_details>"),
			undefined,
			false,
		)
		expect(mockTask.say).toHaveBeenCalledWith(
			"text",
			expect.stringContaining("The actual response continues here."),
			undefined,
			false,
		)
	})

	it("should filter out multiple environment_details blocks", async () => {
		const contentWithMultipleBlocks = `First part of response.
<environment_details>
First block of system info
</environment_details>
Middle content.
<environment_details>
Second block of system info
</environment_details>
Final part of response.`

		mockTask.assistantMessageContent = [
			{
				type: "text",
				content: contentWithMultipleBlocks,
				partial: false,
			},
		]

		await presentAssistantMessage(mockTask)

		// Check that all environment_details blocks are removed
		expect(mockTask.say).toHaveBeenCalledWith(
			"text",
			expect.stringContaining("First part of response."),
			undefined,
			false,
		)
		expect(mockTask.say).toHaveBeenCalledWith("text", expect.stringContaining("Middle content."), undefined, false)
		expect(mockTask.say).toHaveBeenCalledWith(
			"text",
			expect.stringContaining("Final part of response."),
			undefined,
			false,
		)
		expect(mockTask.say).toHaveBeenCalledWith(
			"text",
			expect.not.stringContaining("environment_details"),
			undefined,
			false,
		)
		expect(mockTask.say).toHaveBeenCalledWith("text", expect.not.stringContaining("system info"), undefined, false)
	})

	it("should handle partial closing tag </environ at the end", async () => {
		const contentWithPartialClosingTag = `Response text here.
Some more content.
</environ`

		mockTask.assistantMessageContent = [
			{
				type: "text",
				content: contentWithPartialClosingTag,
				partial: true,
			},
		]

		await presentAssistantMessage(mockTask)

		// Check that the partial closing tag is removed
		expect(mockTask.say).toHaveBeenCalledWith("text", expect.not.stringContaining("</environ"), undefined, true)
		expect(mockTask.say).toHaveBeenCalledWith(
			"text",
			expect.stringContaining("Response text here."),
			undefined,
			true,
		)
	})

	it("should preserve normal content while filtering environment_details", async () => {
		const mixedContent = `Assistant: I'll help you with that task.

<environment_details>
# System information
Current directory: /test
</environment_details>

Let me analyze your code:
- First point
- Second point

<environment_details>
More system info here
</environment_details>

The solution is straightforward.`

		mockTask.assistantMessageContent = [
			{
				type: "text",
				content: mixedContent,
				partial: false,
			},
		]

		await presentAssistantMessage(mockTask)

		const calledContent = mockTask.say.mock.calls[0][1]

		// Check that normal content is preserved
		expect(calledContent).toContain("I'll help you with that task")
		expect(calledContent).toContain("Let me analyze your code:")
		expect(calledContent).toContain("- First point")
		expect(calledContent).toContain("- Second point")
		expect(calledContent).toContain("The solution is straightforward")

		// Check that environment_details content is removed
		expect(calledContent).not.toContain("environment_details")
		expect(calledContent).not.toContain("System information")
		expect(calledContent).not.toContain("Current directory")
		expect(calledContent).not.toContain("More system info")
	})

	it("should handle environment_details tags with whitespace", async () => {
		const contentWithWhitespace = `Response start.
<environment_details>  
Content to be removed
</environment_details>  
Response end.`

		mockTask.assistantMessageContent = [
			{
				type: "text",
				content: contentWithWhitespace,
				partial: false,
			},
		]

		await presentAssistantMessage(mockTask)

		const calledContent = mockTask.say.mock.calls[0][1]

		// Check that tags with whitespace are properly removed
		expect(calledContent).toContain("Response start")
		expect(calledContent).toContain("Response end")
		expect(calledContent).not.toContain("environment_details")
		expect(calledContent).not.toContain("Content to be removed")
	})
})
