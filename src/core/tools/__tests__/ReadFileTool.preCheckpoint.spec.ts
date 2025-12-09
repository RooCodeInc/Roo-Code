import { describe, it, expect, vi, beforeEach } from "vitest"
import path from "path"
import * as fs from "fs/promises"
import { ReadFileTool } from "../ReadFileTool"
import type { Task } from "../../task/Task"
import type { ToolCallbacks } from "../BaseTool"
import { validateFileTokenBudget } from "../helpers/fileTokenBudget"

// Mock the fileTokenBudget helper
vi.mock("../helpers/fileTokenBudget", () => ({
	validateFileTokenBudget: vi.fn(),
	truncateFileContent: vi.fn(),
}))

// Mock fs/promises
vi.mock("fs/promises", () => ({
	stat: vi.fn(),
	readFile: vi.fn(),
	open: vi.fn(),
}))

// Mock isBinaryFile
vi.mock("isbinaryfile", () => ({
	isBinaryFile: vi.fn().mockResolvedValue(false),
}))

// Mock extractTextFromFile
vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn().mockResolvedValue("file content"),
	addLineNumbers: vi.fn((content: string) => content),
	getSupportedBinaryFormats: vi.fn().mockReturnValue([]),
}))

// Mock countFileLines
vi.mock("../../../integrations/misc/line-counter", () => ({
	countFileLines: vi.fn().mockResolvedValue(10),
}))

describe("ReadFileTool - Pre-read Checkpoint", () => {
	let readFileTool: ReadFileTool
	let mockTask: Partial<Task>
	let mockCallbacks: ToolCallbacks

	beforeEach(() => {
		vi.clearAllMocks()
		readFileTool = new ReadFileTool()

		// Setup mock task
		mockTask = {
			cwd: "/test/workspace",
			api: {
				getModel: () => ({
					info: {
						contextWindow: 100000,
						supportsImages: false,
					},
				}),
			},
			apiConfiguration: {
				apiProvider: "anthropic",
			},
			getTokenUsage: () => ({ contextTokens: 50000 }),
			providerRef: {
				deref: () => ({
					getState: vi.fn().mockResolvedValue({
						preReadFileCheckpoint: true,
						maxReadFileLine: -1,
					}),
				}),
			},
			say: vi.fn(),
			ask: vi.fn(),
			sayAndCreateMissingParamError: vi.fn(),
			fileContextTracker: {
				trackFileContext: vi.fn(),
			},
			rooIgnoreController: {
				validateAccess: () => true,
			},
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			didRejectTool: false,
			didToolFailInCurrentTurn: false,
		} as any

		mockCallbacks = {
			handleError: vi.fn(),
			pushToolResult: vi.fn(),
			toolProtocol: "xml",
			askApproval: vi.fn(),
			removeClosingTag: vi.fn(),
		}

		// Setup default fs mock responses
		vi.mocked(fs.stat).mockResolvedValue({ size: 500000 } as any) // 500KB file
		vi.mocked(fs.readFile).mockResolvedValue("file content")
	})

	it("should check file size against context limits when preReadFileCheckpoint is enabled", async () => {
		// Mock validateFileTokenBudget to indicate file exceeds budget
		vi.mocked(validateFileTokenBudget).mockResolvedValue({
			shouldTruncate: true,
			maxChars: 1000,
			reason: "File requires 60000 tokens but only 30000 tokens available in context budget",
		})

		// Mock user approval
		mockTask.ask = vi.fn().mockResolvedValue({
			response: "yesButtonClicked",
		})

		const params = {
			files: [{ path: "test.ts", lineRanges: [] }],
		}

		await readFileTool.execute(params, mockTask as Task, mockCallbacks)

		// Verify that validateFileTokenBudget was called
		expect(validateFileTokenBudget).toHaveBeenCalledWith(path.resolve("/test/workspace", "test.ts"), 100000, 50000)

		// Verify that ask was called with warning message
		expect(mockTask.ask).toHaveBeenCalledWith("tool", expect.stringContaining("File Size Warning"), false)

		// Verify that tool result was pushed
		expect(mockCallbacks.pushToolResult).toHaveBeenCalled()
	})

	it("should skip file when user denies reading file that exceeds context limits", async () => {
		// Mock validateFileTokenBudget to indicate file exceeds budget
		vi.mocked(validateFileTokenBudget).mockResolvedValue({
			shouldTruncate: true,
			maxChars: 1000,
			reason: "File requires 60000 tokens but only 30000 tokens available in context budget",
		})

		// Mock user denial
		mockTask.ask = vi.fn().mockResolvedValue({
			response: "noButtonClicked",
			text: "File is too large",
		})

		const params = {
			files: [{ path: "large-file.ts", lineRanges: [] }],
		}

		await readFileTool.execute(params, mockTask as Task, mockCallbacks)

		// Verify that validateFileTokenBudget was called
		expect(validateFileTokenBudget).toHaveBeenCalled()

		// Verify that ask was called with warning message
		expect(mockTask.ask).toHaveBeenCalled()

		// Verify that the tool marked rejection
		expect(mockTask.didRejectTool).toBe(true)

		// Verify that result includes denial message
		expect(mockCallbacks.pushToolResult).toHaveBeenCalledWith(
			expect.stringContaining("Denied by user due to file size exceeding context limits"),
		)
	})

	it("should not check file size when preReadFileCheckpoint is disabled", async () => {
		// Disable preReadFileCheckpoint
		mockTask.providerRef = {
			deref: () => ({
				getState: vi.fn().mockResolvedValue({
					preReadFileCheckpoint: false, // Disabled
					maxReadFileLine: -1,
				}),
			}),
		} as any

		const params = {
			files: [{ path: "test.ts", lineRanges: [] }],
		}

		// Mock user approval for regular file read
		mockTask.ask = vi.fn().mockResolvedValue({
			response: "yesButtonClicked",
		})

		await readFileTool.execute(params, mockTask as Task, mockCallbacks)

		// Verify that validateFileTokenBudget was NOT called for pre-check
		// (it may still be called later in the normal flow)
		const askCalls = vi.mocked(mockTask.ask).mock.calls
		const warningCalls = askCalls.filter(
			(call) => call[1] && typeof call[1] === "string" && call[1].includes("File Size Warning"),
		)
		expect(warningCalls).toHaveLength(0)
	})

	it("should proceed without warning when file fits within context budget", async () => {
		// Mock validateFileTokenBudget to indicate file fits
		vi.mocked(validateFileTokenBudget).mockResolvedValue({
			shouldTruncate: false,
		})

		// Mock user approval for regular file read
		mockTask.ask = vi.fn().mockResolvedValue({
			response: "yesButtonClicked",
		})

		const params = {
			files: [{ path: "small-file.ts", lineRanges: [] }],
		}

		await readFileTool.execute(params, mockTask as Task, mockCallbacks)

		// Verify that validateFileTokenBudget was called
		expect(validateFileTokenBudget).toHaveBeenCalled()

		// Verify that no warning was shown (only regular approval)
		const askCalls = vi.mocked(mockTask.ask).mock.calls
		const warningCalls = askCalls.filter(
			(call) => call[1] && typeof call[1] === "string" && call[1].includes("File Size Warning"),
		)
		expect(warningCalls).toHaveLength(0)

		// Verify that tool result was pushed
		expect(mockCallbacks.pushToolResult).toHaveBeenCalled()
	})
})
