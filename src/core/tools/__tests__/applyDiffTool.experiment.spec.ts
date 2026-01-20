import { EXPERIMENT_IDS } from "../../../shared/experiments"

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(),
	},
}))

// Mock the ApplyDiffTool module
vi.mock("../ApplyDiffTool", () => ({
	applyDiffTool: {
		handle: vi.fn(),
	},
}))

// Import after mocking to get the mocked version
import { applyDiffTool as multiApplyDiffTool } from "../MultiApplyDiffTool"
import { applyDiffTool as applyDiffToolClass } from "../ApplyDiffTool"

describe("applyDiffTool experiment routing", () => {
	let mockCline: any
	let mockBlock: any
	let mockAskApproval: any
	let mockHandleError: any
	let mockPushToolResult: any
	let mockProvider: any

	beforeEach(async () => {
		vi.clearAllMocks()

		// Reset vscode mock to default behavior
		const vscode = await import("vscode")
		vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
			get: vi.fn().mockReturnValue(undefined),
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
					},
				}),
			},
			processQueuedMessages: vi.fn(),
		} as any

		mockBlock = {
			params: {
				path: "test.ts",
				diff: "test diff",
			},
			partial: false,
		}

		mockAskApproval = vi.fn()
		mockHandleError = vi.fn()
		mockPushToolResult = vi.fn()
	})

	it("should always use class-based tool with native protocol", async () => {
		mockProvider.getState.mockResolvedValue({
			experiments: {
				[EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF]: false,
			},
		})

		// Mock the class-based tool to resolve successfully
		;(applyDiffToolClass.handle as any).mockResolvedValue(undefined)

		await multiApplyDiffTool(mockCline, mockBlock, mockAskApproval, mockHandleError, mockPushToolResult)

		// MultiApplyDiffTool always delegates to the class-based tool.
		expect(applyDiffToolClass.handle).toHaveBeenCalledWith(mockCline, mockBlock, {
			askApproval: mockAskApproval,
			handleError: mockHandleError,
			pushToolResult: mockPushToolResult,
		})
	})

	it("should use class-based tool when experiments are not defined", async () => {
		mockProvider.getState.mockResolvedValue({})

		// Mock the class-based tool to resolve successfully
		;(applyDiffToolClass.handle as any).mockResolvedValue(undefined)

		await multiApplyDiffTool(mockCline, mockBlock, mockAskApproval, mockHandleError, mockPushToolResult)

		// MultiApplyDiffTool always delegates to the class-based tool.
		expect(applyDiffToolClass.handle).toHaveBeenCalledWith(mockCline, mockBlock, {
			askApproval: mockAskApproval,
			handleError: mockHandleError,
			pushToolResult: mockPushToolResult,
		})
	})

	it("should use class-based tool when MULTI_FILE_APPLY_DIFF experiment is enabled", async () => {
		mockProvider.getState.mockResolvedValue({
			experiments: {
				[EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF]: true,
			},
		})

		// Mock the class-based tool to resolve successfully
		;(applyDiffToolClass.handle as any).mockResolvedValue(undefined)

		await multiApplyDiffTool(mockCline, mockBlock, mockAskApproval, mockHandleError, mockPushToolResult)

		// MultiApplyDiffTool always delegates to the class-based tool.
		expect(applyDiffToolClass.handle).toHaveBeenCalledWith(mockCline, mockBlock, {
			askApproval: mockAskApproval,
			handleError: mockHandleError,
			pushToolResult: mockPushToolResult,
		})
	})

	// MultiApplyDiffTool always delegates to the class-based tool.
})
