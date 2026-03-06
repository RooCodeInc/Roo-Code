import * as path from "path"

import { fileExistsAtPath } from "../../../utils/fs"
import { getReadablePath } from "../../../utils/path"
import { unescapeHtmlEntities } from "../../../utils/text-normalization"
import { ToolUse } from "../../../shared/tools"
import { applyDiffTool } from "../ApplyDiffTool"

vi.mock("path", async () => {
	const originalPath = await vi.importActual("path")
	return {
		...originalPath,
		resolve: vi.fn().mockImplementation((...args) => {
			const separator = process.platform === "win32" ? "\\" : "/"
			return args.join(separator)
		}),
	}
})

vi.mock("delay", () => ({
	default: vi.fn(),
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(true),
	createDirectoriesForFile: vi.fn().mockResolvedValue([]),
}))

vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolError: vi.fn((msg) => `Error: ${msg}`),
		rooIgnoreError: vi.fn((path) => `Access denied: ${path}`),
		createPrettyPatch: vi.fn(() => "mock-diff"),
		applyDiffMissingDiffError: vi.fn(
			() =>
				"Missing value for required parameter 'diff'. This most commonly happens when the diff content is too large and your response was truncated.",
		),
	},
}))

vi.mock("../../../utils/pathUtils", () => ({
	isPathOutsideWorkspace: vi.fn().mockReturnValue(false),
}))

vi.mock("../../../utils/path", () => ({
	getReadablePath: vi.fn().mockReturnValue("test/file.txt"),
}))

vi.mock("../../../utils/text-normalization", () => ({
	unescapeHtmlEntities: vi.fn().mockImplementation((content) => content),
}))

vi.mock("vscode", () => ({
	window: {
		showWarningMessage: vi.fn().mockResolvedValue(undefined),
	},
	env: {
		openExternal: vi.fn(),
	},
	Uri: {
		parse: vi.fn(),
	},
}))

vi.mock("../../ignore/RooIgnoreController", () => ({
	RooIgnoreController: class {
		initialize() {
			return Promise.resolve()
		}
		validateAccess() {
			return true
		}
	},
}))

describe("applyDiffTool", () => {
	const testFilePath = "test/file.txt"
	const testDiffContent = `--- a/test/file.txt
+++ b/test/file.txt
@@ -1,3 +1,3 @@
 line 1
-line 2
+line 2 modified
 line 3`

	const mockCline: any = {}
	let mockAskApproval: ReturnType<typeof vi.fn>
	let mockHandleError: ReturnType<typeof vi.fn>
	let mockPushToolResult: ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.clearAllMocks()
		applyDiffTool.resetPartialState()

		mockCline.cwd = "/"
		mockCline.consecutiveMistakeCount = 0
		mockCline.consecutiveMistakeCountForApplyDiff = new Map()
		mockCline.didEditFile = false
		mockCline.diffStrategy = undefined
		mockCline.providerRef = {
			deref: vi.fn().mockReturnValue({
				getState: vi.fn().mockResolvedValue({
					diagnosticsEnabled: true,
					writeDelayMs: 1000,
				}),
			}),
		}
		mockCline.rooIgnoreController = {
			validateAccess: vi.fn().mockReturnValue(true),
		}
		mockCline.diffViewProvider = {
			editType: undefined,
			isEditing: false,
			originalContent: "",
			open: vi.fn().mockResolvedValue(undefined),
			update: vi.fn().mockResolvedValue(undefined),
			reset: vi.fn().mockResolvedValue(undefined),
			revertChanges: vi.fn().mockResolvedValue(undefined),
			saveChanges: vi.fn().mockResolvedValue({
				newProblemsMessage: "",
				userEdits: null,
				finalContent: "final content",
			}),
			scrollToFirstDiff: vi.fn(),
			updateDiagnosticSettings: vi.fn(),
		}
		mockCline.api = {
			getModel: vi.fn().mockReturnValue({ id: "claude-3" }),
		}
		mockCline.fileContextTracker = {
			trackFileContext: vi.fn().mockResolvedValue(undefined),
		}
		mockCline.say = vi.fn().mockResolvedValue(undefined)
		mockCline.ask = vi.fn().mockResolvedValue(undefined)
		mockCline.recordToolError = vi.fn()
		mockCline.sayAndCreateMissingParamError = vi.fn().mockResolvedValue("Missing param error")

		mockAskApproval = vi.fn().mockResolvedValue(true)
		mockHandleError = vi.fn().mockResolvedValue(undefined)
		mockPushToolResult = vi.fn()
	})

	describe("missing parameter handling", () => {
		it("returns enhanced error when diff is missing, suggesting alternatives to large diffs", async () => {
			const toolUse: ToolUse = {
				type: "tool_use",
				name: "apply_diff",
				params: { path: testFilePath },
				nativeArgs: { path: testFilePath, diff: undefined } as any,
				partial: false,
			}

			await applyDiffTool.handle(mockCline, toolUse as ToolUse<"apply_diff">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
			})

			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.recordToolError).toHaveBeenCalledWith("apply_diff")
			expect(mockCline.say).toHaveBeenCalledWith(
				"error",
				expect.stringContaining("without value for required parameter 'diff'"),
			)
			expect(mockCline.say).toHaveBeenCalledWith("error", expect.stringContaining("output token limits"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("truncated"))
			// Should NOT call the generic sayAndCreateMissingParamError
			expect(mockCline.sayAndCreateMissingParamError).not.toHaveBeenCalled()
		})

		it("returns generic error when path is missing", async () => {
			const toolUse: ToolUse = {
				type: "tool_use",
				name: "apply_diff",
				params: {},
				nativeArgs: { path: undefined, diff: testDiffContent } as any,
				partial: false,
			}

			await applyDiffTool.handle(mockCline, toolUse as ToolUse<"apply_diff">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
			})

			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.recordToolError).toHaveBeenCalledWith("apply_diff")
			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("apply_diff", "path")
		})
	})
})
