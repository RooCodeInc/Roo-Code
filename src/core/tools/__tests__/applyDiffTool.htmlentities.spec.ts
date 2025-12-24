import { describe, it, expect, vi, beforeEach } from "vitest"
import path from "path"
import fs from "fs/promises"
import { ApplyDiffTool } from "../ApplyDiffTool"
import { Task } from "../../task/Task"
import { fileExistsAtPath } from "../../../utils/fs"

vi.mock("fs/promises")
vi.mock("../../../utils/fs")
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureDiffApplicationError: vi.fn(),
		},
	},
}))

describe("ApplyDiffTool - HTML Entity Handling", () => {
	let applyDiffTool: ApplyDiffTool
	let mockTask: any
	let mockCallbacks: any

	beforeEach(() => {
		applyDiffTool = new ApplyDiffTool()

		// Mock task with all required properties
		mockTask = {
			cwd: "/test",
			api: {
				getModel: vi.fn().mockReturnValue({ id: "test-model" }),
			},
			diffStrategy: {
				applyDiff: vi.fn(),
			},
			rooIgnoreController: {
				validateAccess: vi.fn().mockReturnValue(true),
			},
			consecutiveMistakeCount: 0,
			consecutiveMistakeCountForApplyDiff: new Map(),
			recordToolError: vi.fn(),
			say: vi.fn(),
			sayAndCreateMissingParamError: vi.fn(),
			diffViewProvider: {
				editType: "",
				originalContent: "",
				open: vi.fn(),
				update: vi.fn(),
				scrollToFirstDiff: vi.fn(),
				revertChanges: vi.fn(),
				saveChanges: vi.fn(),
				saveDirectly: vi.fn(),
				pushToolWriteResult: vi.fn(),
				reset: vi.fn(),
			},
			providerRef: {
				deref: vi.fn().mockReturnValue({
					getState: vi.fn().mockResolvedValue({
						diagnosticsEnabled: true,
						writeDelayMs: 100,
						experiments: {},
					}),
				}),
			},
			fileContextTracker: {
				trackFileContext: vi.fn(),
			},
			didEditFile: false,
			processQueuedMessages: vi.fn(),
			rooProtectedController: undefined,
		}

		mockCallbacks = {
			askApproval: vi.fn().mockResolvedValue(true),
			handleError: vi.fn(),
			pushToolResult: vi.fn(),
			toolProtocol: "xml",
		}

		vi.mocked(fileExistsAtPath).mockResolvedValue(true)
		vi.mocked(fs.readFile).mockResolvedValue("This doesn't change" as any)
	})

	it("should preserve HTML entities in diff content and not unescape them", async () => {
		const params = {
			path: "test.jsx",
			diff: `<<<<<<< SEARCH
:start_line:1
-------
This doesn't change
=======
This doesn&apos;t change
>>>>>>> REPLACE`,
		}

		// Mock successful diff application
		mockTask.diffStrategy.applyDiff.mockResolvedValue({
			success: true,
			content: "This doesn&apos;t change",
		})

		await applyDiffTool.execute(params, mockTask, mockCallbacks)

		// Verify that applyDiff was called with the original diff content (not unescaped)
		expect(mockTask.diffStrategy.applyDiff).toHaveBeenCalledWith("This doesn't change", params.diff, 1)

		// Verify the diff content was not modified (no unescaping happened)
		const callArgs = mockTask.diffStrategy.applyDiff.mock.calls[0]
		// The diff should contain the HTML entity in the REPLACE section
		expect(callArgs[1]).toContain("&apos;")
		// The entire diff string should match exactly what was passed in
		expect(callArgs[1]).toBe(params.diff)
	})

	it("should correctly identify different content when HTML entities are used", async () => {
		const params = {
			path: "test.jsx",
			diff: `<<<<<<< SEARCH
:start_line:1
-------
This doesn't change
=======
This doesn&apos;t change
>>>>>>> REPLACE`,
		}

		// The diff strategy should recognize these as different
		mockTask.diffStrategy.applyDiff.mockResolvedValue({
			success: true,
			content: "This doesn&apos;t change",
		})

		await applyDiffTool.execute(params, mockTask, mockCallbacks)

		expect(mockTask.diffStrategy.applyDiff).toHaveBeenCalledTimes(1)
		expect(mockCallbacks.pushToolResult).toHaveBeenCalled()
		expect(mockTask.consecutiveMistakeCount).toBe(0) // No errors should occur
	})

	it("should handle multiple HTML entities correctly", async () => {
		const params = {
			path: "test.jsx",
			diff: `<<<<<<< SEARCH
:start_line:1
-------
<div>It's "quoted" & special</div>
=======
<div>It&apos;s &quot;quoted&quot; &amp; special</div>
>>>>>>> REPLACE`,
		}

		vi.mocked(fs.readFile).mockResolvedValue(`<div>It's "quoted" & special</div>` as any)

		mockTask.diffStrategy.applyDiff.mockResolvedValue({
			success: true,
			content: `<div>It&apos;s &quot;quoted&quot; &amp; special</div>`,
		})

		await applyDiffTool.execute(params, mockTask, mockCallbacks)

		// Verify entities are preserved in the diff
		const callArgs = mockTask.diffStrategy.applyDiff.mock.calls[0]
		expect(callArgs[1]).toContain("&apos;")
		expect(callArgs[1]).toContain("&quot;")
		expect(callArgs[1]).toContain("&amp;")
	})

	it("should work for both Claude and non-Claude models", async () => {
		const params = {
			path: "test.jsx",
			diff: `<<<<<<< SEARCH
:start_line:1
-------
This doesn't change
=======
This doesn&apos;t change
>>>>>>> REPLACE`,
		}

		// Test with non-Claude model
		mockTask.api.getModel.mockReturnValue({ id: "gpt-4" })
		mockTask.diffStrategy.applyDiff.mockResolvedValue({
			success: true,
			content: "This doesn&apos;t change",
		})

		await applyDiffTool.execute(params, mockTask, mockCallbacks)

		let callArgs = mockTask.diffStrategy.applyDiff.mock.calls[0]
		expect(callArgs[1]).toContain("&apos;")

		// Reset and test with Claude model
		vi.clearAllMocks()
		mockTask.api.getModel.mockReturnValue({ id: "claude-3-opus" })
		mockTask.diffStrategy.applyDiff.mockResolvedValue({
			success: true,
			content: "This doesn&apos;t change",
		})
		vi.mocked(fileExistsAtPath).mockResolvedValue(true)
		vi.mocked(fs.readFile).mockResolvedValue("This doesn't change" as any)

		await applyDiffTool.execute(params, mockTask, mockCallbacks)

		callArgs = mockTask.diffStrategy.applyDiff.mock.calls[0]
		expect(callArgs[1]).toContain("&apos;")
	})
})
