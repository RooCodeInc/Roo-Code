import { describe, it, expect, vi, beforeEach } from "vitest"
import { applyDiffTool } from "../MultiApplyDiffTool"
import { Task } from "../../task/Task"
import { TelemetryService } from "@roo-code/telemetry"
import { EXPERIMENT_IDS } from "../../../shared/experiments"

// Mock dependencies
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureDiffApplicationError: vi.fn(),
		},
	},
}))
vi.mock("../../../utils/resolveToolProtocol", () => ({
	resolveToolProtocol: vi.fn().mockReturnValue("xml"),
}))
vi.mock("../../../shared/experiments", () => ({
	EXPERIMENT_IDS: {
		MULTI_FILE_APPLY_DIFF: "multi_file_apply_diff",
		PREVENT_FOCUS_DISRUPTION: "prevent_focus_disruption",
	},
	experiments: {
		isEnabled: vi.fn().mockReturnValue(true), // Enable multi-file experiment
	},
}))

describe("MultiApplyDiffTool - XML Truncation Detection", () => {
	let mockCline: Partial<Task>
	let mockAskApproval: any
	let mockHandleError: any
	let mockPushToolResult: any
	let mockRemoveClosingTag: any

	beforeEach(() => {
		// Clear all mocks before each test
		vi.clearAllMocks()

		// Set up mock Task instance (cline)
		mockCline = {
			api: {
				getModel: vi.fn().mockReturnValue({
					id: "openrouter/grok-4.1-fast",
					info: { id: "openrouter/grok-4.1-fast" },
				}),
			},
			say: vi.fn().mockResolvedValue(undefined),
			ask: vi.fn().mockResolvedValue({ response: "", text: "", images: [] }),
			recordToolError: vi.fn(),
			processQueuedMessages: vi.fn(),
			sayAndCreateMissingParamError: vi.fn().mockResolvedValue("Missing parameter error"),
			consecutiveMistakeCount: 0,
			taskId: "test-task-id",
			cwd: "/workspace",
			diffViewProvider: {
				reset: vi.fn().mockResolvedValue(undefined),
			},
			providerRef: {
				deref: vi.fn().mockReturnValue({
					getState: vi.fn().mockResolvedValue({
						experiments: {},
					}),
				}),
			},
		} as any

		// Set up mock callbacks
		mockAskApproval = vi.fn().mockResolvedValue(true)
		mockHandleError = vi.fn()
		mockPushToolResult = vi.fn()
		mockRemoveClosingTag = vi.fn()
	})

	it("should detect StopNode is not closed error as truncation", async () => {
		const block = {
			params: {
				args: `<args>
					<file>
						<path>test.ts</path>
						<diff>
							<content>some diff<`, // Truncated XML
			},
		}

		// Mock parseXmlForDiff to throw the typical truncation error
		vi.doMock("../../../utils/xml", () => ({
			parseXmlForDiff: vi.fn().mockImplementation(() => {
				throw new Error("Failed to parse XML: StopNode is not closed")
			}),
		}))

		await applyDiffTool(
			mockCline as Task,
			block as any,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Verify truncation-specific error was shown
		expect(mockCline.say).toHaveBeenCalledWith(
			"diff_error",
			expect.stringContaining("XML response truncated due to context/output limits"),
		)

		// Verify Grok-specific message was included
		expect(mockCline.say).toHaveBeenCalledWith(
			"diff_error",
			expect.stringContaining("Known issue with Grok-4.1-Fast at 150k+ tokens"),
		)

		// Verify detailed error includes truncation-specific guidance
		expect(mockPushToolResult).toHaveBeenCalledWith(
			expect.stringContaining("XML response was truncated (incomplete)"),
		)
		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining('Use the "Condense Context" feature'))
	})

	it("should detect XML ending with incomplete tag as truncation", async () => {
		const block = {
			params: {
				args: `<args>
					<file>
						<path>test.ts</path>
						<diff>
							<content>some diff</`, // Ends with opening tag
			},
		}

		// Mock parseXmlForDiff to throw a generic error
		vi.doMock("../../../utils/xml", () => ({
			parseXmlForDiff: vi.fn().mockImplementation(() => {
				throw new Error("Failed to parse XML: Unexpected end")
			}),
		}))

		await applyDiffTool(
			mockCline as Task,
			block as any,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Verify truncation was detected
		expect(mockCline.say).toHaveBeenCalledWith(
			"diff_error",
			expect.stringContaining("XML response truncated due to context/output limits"),
		)
	})

	it("should handle non-truncation XML errors normally", async () => {
		const block = {
			params: {
				args: `<args>
					<file>
						<malformed>This is not valid structure</malformed>
					</file>
				</args>`, // Complete but malformed XML
			},
		}

		// Mock parseXmlForDiff to throw a non-truncation error
		vi.doMock("../../../utils/xml", () => ({
			parseXmlForDiff: vi.fn().mockImplementation(() => {
				throw new Error("Invalid XML structure: missing <path> tag")
			}),
		}))

		await applyDiffTool(
			mockCline as Task,
			block as any,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Verify standard error message was shown (not truncation-specific)
		expect(mockCline.say).toHaveBeenCalledWith(
			"diff_error",
			expect.stringContaining("Failed to parse apply_diff XML"),
		)

		// Verify NO truncation-specific messages were shown
		expect(mockCline.say).not.toHaveBeenCalledWith("diff_error", expect.stringContaining("truncated"))

		// Verify detailed error shows standard format guidance
		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Expected structure:"))

		// Verify NO condensing context messages
		expect(mockPushToolResult).not.toHaveBeenCalledWith(expect.stringContaining("Condense Context"))
	})
})
