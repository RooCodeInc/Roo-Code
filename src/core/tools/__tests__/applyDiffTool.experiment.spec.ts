import { EXPERIMENT_IDS } from "../../../shared/experiments"
import { TOOL_PROTOCOL } from "@roo-code/types"

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(),
	},
}))

// Import after mocking to get the mocked version
import { applyDiffTool as multiApplyDiffTool } from "../MultiApplyDiffTool"

/**
 * These tests verify that multiApplyDiffTool properly handles multi-file operations.
 *
 * NOTE: Routing between single-file and multi-file tools is now done in presentAssistantMessage.ts
 * based on nativeArgs format. multiApplyDiffTool is responsible for:
 * - Handling XML args format (multi-file XML protocol)
 * - Handling nativeArgs.files format (multi-file native protocol)
 * - Handling legacy path/diff params (single file, XML protocol)
 *
 * The routing logic tests (when to use applyDiffTool vs multiApplyDiffTool) should be
 * tested in presentAssistantMessage.spec.ts or integration tests.
 */
describe("applyDiffTool experiment routing", () => {
	let mockCline: any
	let mockBlock: any
	let mockAskApproval: any
	let mockHandleError: any
	let mockPushToolResult: any
	let mockRemoveClosingTag: any
	let mockProvider: any

	beforeEach(async () => {
		vi.clearAllMocks()

		// Reset vscode mock to default behavior (XML protocol)
		const vscode = await import("vscode")
		vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
			get: vi.fn().mockReturnValue(TOOL_PROTOCOL.XML),
		} as any)

		mockProvider = {
			getState: vi.fn(),
		}

		mockCline = {
			providerRef: {
				deref: vi.fn().mockReturnValue(mockProvider),
			},
			cwd: "/test",
			diffStrategy: {
				applyDiff: vi.fn(),
				getProgressStatus: vi.fn(),
			},
			diffViewProvider: {
				reset: vi.fn(),
			},
			apiConfiguration: {
				apiProvider: "anthropic",
			},
			api: {
				getModel: vi.fn().mockReturnValue({
					id: "test-model",
					info: {
						maxTokens: 4096,
						contextWindow: 128000,
						supportsPromptCache: false,
						supportsNativeTools: false,
					},
				}),
			},
			processQueuedMessages: vi.fn(),
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			sayAndCreateMissingParamError: vi.fn().mockResolvedValue("Missing parameter error"),
			// Required for file access validation
			rooIgnoreController: {
				validateAccess: vi.fn().mockReturnValue(true),
			},
			rooProtectedController: {
				isWriteProtected: vi.fn().mockReturnValue(false),
			},
			say: vi.fn().mockResolvedValue(undefined),
		} as any

		mockBlock = {
			type: "tool_use",
			name: "apply_diff",
			params: {
				path: "test.ts",
				diff: "test diff",
			},
			partial: false,
		}

		mockAskApproval = vi.fn()
		mockHandleError = vi.fn()
		mockPushToolResult = vi.fn()
		mockRemoveClosingTag = vi.fn((tag, value) => value)
	})

	it("should handle legacy params directly when experiment is disabled", async () => {
		// With new architecture, multiApplyDiffTool handles the request directly
		// when called with legacy params. Routing to applyDiffTool (single-file)
		// is now done in presentAssistantMessage.ts BEFORE calling this function.
		mockProvider.getState.mockResolvedValue({
			experiments: {
				[EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF]: false,
			},
		})

		// This will result in an error because the file doesn't exist,
		// but it verifies the function processes the request directly
		await multiApplyDiffTool(
			mockCline,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Function should process the request - it will push a result (error about missing file)
		expect(mockPushToolResult).toHaveBeenCalled()
	})

	it("should handle legacy params directly when experiments are not defined", async () => {
		mockProvider.getState.mockResolvedValue({})

		// This will result in an error because the file doesn't exist,
		// but it verifies the function processes the request directly
		await multiApplyDiffTool(
			mockCline,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Function should process the request - it will push a result (error about missing file)
		expect(mockPushToolResult).toHaveBeenCalled()
	})

	it("should handle multi-file operations when MULTI_FILE_APPLY_DIFF experiment is enabled", async () => {
		mockProvider.getState.mockResolvedValue({
			experiments: {
				[EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF]: true,
			},
		})

		// This will result in an error because the file doesn't exist,
		// but it verifies the function processes the request directly
		await multiApplyDiffTool(
			mockCline,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Function should process the request directly
		expect(mockPushToolResult).toHaveBeenCalled()
	})

	it("should handle native multi-file format (nativeArgs.files)", async () => {
		// Test that multiApplyDiffTool properly handles native multi-file format
		mockProvider.getState.mockResolvedValue({
			experiments: {
				[EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF]: true,
			},
		})

		const blockWithNativeArgs = {
			type: "tool_use" as const,
			name: "apply_diff" as const,
			params: {},
			partial: false,
			nativeArgs: {
				files: [
					{ path: "test1.ts", diff: "test diff 1" },
					{ path: "test2.ts", diff: "test diff 2" },
				],
			},
		}

		await multiApplyDiffTool(
			mockCline,
			blockWithNativeArgs,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Function should process the multi-file request
		expect(mockPushToolResult).toHaveBeenCalled()
	})

	it("should handle partial messages for native multi-file format", async () => {
		mockProvider.getState.mockResolvedValue({
			experiments: {
				[EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF]: true,
			},
		})

		const mockAsk = vi.fn().mockResolvedValue({})
		mockCline.ask = mockAsk

		const blockWithNativeArgs = {
			type: "tool_use" as const,
			name: "apply_diff" as const,
			params: {},
			partial: true,
			nativeArgs: {
				files: [{ path: "test1.ts", diff: "partial diff" }],
			},
		}

		await multiApplyDiffTool(
			mockCline,
			blockWithNativeArgs,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// For partial messages, should call ask with partial=true
		expect(mockAsk).toHaveBeenCalledWith("tool", expect.any(String), true)
	})
})
