import * as path from "path"
import fs from "fs/promises"

import type { MockedFunction } from "vitest"

import { fileExistsAtPath } from "../../../utils/fs"
import { isPathOutsideWorkspace } from "../../../utils/pathUtils"
import { getReadablePath } from "../../../utils/path"
import { ToolUse, ToolResponse } from "../../../shared/tools"
import { editTool } from "../EditTool"

vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn().mockResolvedValue(""),
	},
}))

vi.mock("path", async () => {
	const originalPath = await vi.importActual("path")
	return {
		...originalPath,
		resolve: vi.fn().mockImplementation((...args) => {
			const separator = process.platform === "win32" ? "\\" : "/"
			return args.join(separator)
		}),
		isAbsolute: vi.fn().mockReturnValue(false),
		relative: vi.fn().mockImplementation((_from, to) => to),
	}
})

vi.mock("delay", () => ({
	default: vi.fn(),
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(true),
}))

vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolError: vi.fn((msg: string) => `Error: ${msg}`),
		rooIgnoreError: vi.fn((filePath: string) => `Access denied: ${filePath}`),
		createPrettyPatch: vi.fn(() => "mock-diff"),
	},
}))

vi.mock("../../../utils/pathUtils", () => ({
	isPathOutsideWorkspace: vi.fn().mockReturnValue(false),
}))

vi.mock("../../../utils/path", () => ({
	getReadablePath: vi.fn().mockReturnValue("test/path.txt"),
}))

vi.mock("../../diff/stats", () => ({
	sanitizeUnifiedDiff: vi.fn((diff: string) => diff),
	computeDiffStats: vi.fn(() => ({ additions: 1, deletions: 1 })),
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

describe("editTool", () => {
	// Test data
	const testFilePath = "test/file.txt"
	const absoluteFilePath = process.platform === "win32" ? "C:\\test\\file.txt" : "/test/file.txt"
	const testFileContent = "Line 1\nLine 2\nLine 3\nLine 4"

	// Mocked functions
	const mockedFileExistsAtPath = fileExistsAtPath as MockedFunction<typeof fileExistsAtPath>
	const mockedFsReadFile = fs.readFile as unknown as MockedFunction<
		(path: string, encoding: string) => Promise<string>
	>
	const mockedIsPathOutsideWorkspace = isPathOutsideWorkspace as MockedFunction<typeof isPathOutsideWorkspace>
	const mockedGetReadablePath = getReadablePath as MockedFunction<typeof getReadablePath>
	const mockedPathResolve = path.resolve as MockedFunction<typeof path.resolve>
	const mockedPathIsAbsolute = path.isAbsolute as MockedFunction<typeof path.isAbsolute>

	const mockTask: any = {}
	let mockAskApproval: ReturnType<typeof vi.fn>
	let mockHandleError: ReturnType<typeof vi.fn>
	let mockPushToolResult: ReturnType<typeof vi.fn>
	let toolResult: ToolResponse | undefined

	beforeEach(() => {
		vi.clearAllMocks()

		mockedPathResolve.mockReturnValue(absoluteFilePath)
		mockedPathIsAbsolute.mockReturnValue(false)
		mockedFileExistsAtPath.mockResolvedValue(true)
		mockedFsReadFile.mockResolvedValue(testFileContent)
		mockedIsPathOutsideWorkspace.mockReturnValue(false)
		mockedGetReadablePath.mockReturnValue("test/path.txt")

		mockTask.cwd = "/"
		mockTask.consecutiveMistakeCount = 0
		mockTask.didEditFile = false
		mockTask.providerRef = {
			deref: vi.fn().mockReturnValue({
				getState: vi.fn().mockResolvedValue({
					diagnosticsEnabled: true,
					writeDelayMs: 1000,
					experiments: {},
				}),
			}),
		}
		mockTask.rooIgnoreController = {
			validateAccess: vi.fn().mockReturnValue(true),
		}
		mockTask.rooProtectedController = {
			isWriteProtected: vi.fn().mockReturnValue(false),
		}
		mockTask.diffViewProvider = {
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
			saveDirectly: vi.fn().mockResolvedValue(undefined),
			scrollToFirstDiff: vi.fn(),
			pushToolWriteResult: vi.fn().mockResolvedValue("Tool result message"),
		}
		mockTask.fileContextTracker = {
			trackFileContext: vi.fn().mockResolvedValue(undefined),
		}
		mockTask.say = vi.fn().mockResolvedValue(undefined)
		mockTask.ask = vi.fn().mockResolvedValue(undefined)
		mockTask.recordToolError = vi.fn()
		mockTask.recordToolUsage = vi.fn()
		mockTask.processQueuedMessages = vi.fn()
		mockTask.sayAndCreateMissingParamError = vi.fn().mockResolvedValue("Missing param error")

		mockAskApproval = vi.fn().mockResolvedValue(true)
		mockHandleError = vi.fn().mockResolvedValue(undefined)

		toolResult = undefined
	})

	/**
	 * Helper function to execute the edit tool with different parameters
	 */
	async function executeEditTool(
		params: {
			file_path?: string
			old_string?: string
			new_string?: string
			replace_all?: string
		} = {},
		options: {
			fileExists?: boolean
			fileContent?: string
			isPartial?: boolean
			accessAllowed?: boolean
		} = {},
	): Promise<ToolResponse | undefined> {
		const fileExists = options.fileExists ?? true
		const fileContent = options.fileContent ?? testFileContent
		const isPartial = options.isPartial ?? false
		const accessAllowed = options.accessAllowed ?? true

		mockedFileExistsAtPath.mockResolvedValue(fileExists)
		mockedFsReadFile.mockResolvedValue(fileContent)
		mockTask.rooIgnoreController.validateAccess.mockReturnValue(accessAllowed)

		const defaultParams = {
			file_path: testFilePath,
			old_string: "Line 2",
			new_string: "Modified Line 2",
		}
		const fullParams: Record<string, string | undefined> = { ...defaultParams, ...params }

		// Build nativeArgs from params (only include defined values)
		const nativeArgs: Record<string, unknown> = {}
		if (fullParams.file_path !== undefined) {
			nativeArgs.file_path = fullParams.file_path
		}
		if (fullParams.old_string !== undefined) {
			nativeArgs.old_string = fullParams.old_string
		}
		if (fullParams.new_string !== undefined) {
			nativeArgs.new_string = fullParams.new_string
		}
		if (fullParams.replace_all !== undefined) {
			nativeArgs.replace_all = fullParams.replace_all === "true"
		}

		const toolUse: ToolUse = {
			type: "tool_use",
			name: "edit",
			params: fullParams as Partial<Record<string, string>>,
			nativeArgs: nativeArgs as ToolUse<"edit">["nativeArgs"],
			partial: isPartial,
		}

		mockPushToolResult = vi.fn((result: ToolResponse) => {
			toolResult = result
		})

		await editTool.handle(mockTask, toolUse as ToolUse<"edit">, {
			askApproval: mockAskApproval,
			handleError: mockHandleError,
			pushToolResult: mockPushToolResult,
		})

		return toolResult
	}

	describe("basic replacement", () => {
		it("replaces a single unique occurrence of old_string with new_string", async () => {
			await executeEditTool(
				{ old_string: "Line 2", new_string: "Modified Line 2" },
				{ fileContent: "Line 1\nLine 2\nLine 3" },
			)

			expect(mockTask.consecutiveMistakeCount).toBe(0)
			expect(mockTask.diffViewProvider.editType).toBe("modify")
			expect(mockAskApproval).toHaveBeenCalled()
		})
	})

	describe("replace_all", () => {
		it("replaces all occurrences when replace_all is true", async () => {
			await executeEditTool(
				{ old_string: "Line", new_string: "Row", replace_all: "true" },
				{ fileContent: "Line 1\nLine 2\nLine 3" },
			)

			expect(mockTask.consecutiveMistakeCount).toBe(0)
			expect(mockTask.diffViewProvider.editType).toBe("modify")
			expect(mockAskApproval).toHaveBeenCalled()
		})
	})

	describe("uniqueness check", () => {
		it("returns error when old_string appears multiple times without replace_all", async () => {
			const result = await executeEditTool(
				{ old_string: "Line", new_string: "Row" },
				{ fileContent: "Line 1\nLine 2\nLine 3" },
			)

			expect(result).toContain("Error:")
			expect(result).toContain("3 matches")
			expect(result).toContain("replace_all")
			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("edit")
		})
	})

	describe("no match error", () => {
		it("returns error when old_string is not found in the file", async () => {
			const result = await executeEditTool(
				{ old_string: "NonExistent", new_string: "New" },
				{ fileContent: "Line 1\nLine 2\nLine 3" },
			)

			expect(result).toContain("Error:")
			expect(result).toContain("No match found")
			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("edit", "no_match")
		})
	})

	describe("old_string equals new_string", () => {
		it("returns error when old_string and new_string are identical", async () => {
			const result = await executeEditTool(
				{ old_string: "Line 2", new_string: "Line 2" },
				{ fileContent: "Line 1\nLine 2\nLine 3" },
			)

			expect(result).toContain("Error:")
			expect(result).toContain("identical")
			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("edit")
		})
	})

	describe("missing required params", () => {
		it("returns error when file_path is missing", async () => {
			const result = await executeEditTool({ file_path: undefined })

			expect(result).toBe("Missing param error")
			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("edit")
			expect(mockTask.sayAndCreateMissingParamError).toHaveBeenCalledWith("edit", "file_path")
		})

		it("returns error when old_string is missing", async () => {
			const result = await executeEditTool({ old_string: undefined })

			expect(result).toBe("Missing param error")
			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("edit")
			expect(mockTask.sayAndCreateMissingParamError).toHaveBeenCalledWith("edit", "old_string")
		})

		it("returns error when new_string is missing", async () => {
			const result = await executeEditTool({ new_string: undefined })

			expect(result).toBe("Missing param error")
			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("edit")
			expect(mockTask.sayAndCreateMissingParamError).toHaveBeenCalledWith("edit", "new_string")
		})
	})

	describe("file access", () => {
		it("returns error when file does not exist", async () => {
			const result = await executeEditTool({}, { fileExists: false })

			expect(result).toContain("Error:")
			expect(result).toContain("File not found")
			expect(mockTask.consecutiveMistakeCount).toBe(1)
		})

		it("returns error when access is denied", async () => {
			const result = await executeEditTool({}, { accessAllowed: false })

			expect(result).toContain("Access denied")
		})
	})

	describe("approval workflow", () => {
		it("saves changes when user approves", async () => {
			mockAskApproval.mockResolvedValue(true)

			await executeEditTool()

			expect(mockTask.diffViewProvider.saveChanges).toHaveBeenCalled()
			expect(mockTask.didEditFile).toBe(true)
			expect(mockTask.recordToolUsage).toHaveBeenCalledWith("edit")
		})

		it("reverts changes when user rejects", async () => {
			mockAskApproval.mockResolvedValue(false)

			const result = await executeEditTool()

			expect(mockTask.diffViewProvider.revertChanges).toHaveBeenCalled()
			expect(mockTask.diffViewProvider.saveChanges).not.toHaveBeenCalled()
			expect(result).toContain("rejected")
		})
	})

	describe("partial block handling", () => {
		it("handles partial block without errors after path stabilizes", async () => {
			// Path stabilization requires two consecutive calls with the same path
			await executeEditTool({}, { isPartial: true })
			await executeEditTool({}, { isPartial: true })

			expect(mockTask.ask).toHaveBeenCalled()
		})
	})

	describe("error handling", () => {
		it("handles file read errors gracefully", async () => {
			mockedFsReadFile.mockRejectedValueOnce(new Error("Read failed"))

			const toolUse: ToolUse = {
				type: "tool_use",
				name: "edit",
				params: {
					file_path: testFilePath,
					old_string: "Line 2",
					new_string: "Modified",
				},
				nativeArgs: {
					file_path: testFilePath,
					old_string: "Line 2",
					new_string: "Modified",
				} as ToolUse<"edit">["nativeArgs"],
				partial: false,
			}

			let capturedResult: ToolResponse | undefined
			const localPushToolResult = vi.fn((result: ToolResponse) => {
				capturedResult = result
			})

			await editTool.handle(mockTask, toolUse as ToolUse<"edit">, {
				askApproval: mockAskApproval,
				handleError: mockHandleError,
				pushToolResult: localPushToolResult,
			})

			expect(capturedResult).toContain("Error:")
			expect(capturedResult).toContain("Failed to read file")
			expect(mockTask.consecutiveMistakeCount).toBe(1)
		})

		it("handles general errors and resets diff view", async () => {
			mockTask.diffViewProvider.open.mockRejectedValueOnce(new Error("General error"))

			await executeEditTool()

			expect(mockHandleError).toHaveBeenCalledWith("edit", expect.any(Error))
			expect(mockTask.diffViewProvider.reset).toHaveBeenCalled()
		})
	})

	describe("file tracking", () => {
		it("tracks file context after successful edit", async () => {
			await executeEditTool()

			expect(mockTask.fileContextTracker.trackFileContext).toHaveBeenCalledWith(testFilePath, "roo_edited")
		})
	})
})
