// npx vitest src/core/tools/__tests__/simpleReadFileTool.spec.ts

import * as path from "path"
import { isBinaryFile } from "isbinaryfile"
import { countFileLines } from "../../../integrations/misc/line-counter"
import { extractTextFromFile, addLineNumbers } from "../../../integrations/misc/extract-text"
import { simpleReadFileTool } from "../simpleReadFileTool"
import { ToolUse, ToolResponse, ToolParamName } from "../../../shared/tools"
import {
	validateFileTokenBudget,
	truncateFileContent,
	FILE_SIZE_THRESHOLD,
	MAX_FILE_SIZE_FOR_TOKENIZATION,
} from "../helpers/fileTokenBudget"
import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "@roo-code/types"

// Mock path module
vi.mock("path", async () => {
	const originalPath = await vi.importActual("path")
	return {
		default: originalPath,
		...originalPath,
		resolve: vi.fn().mockImplementation((...args) => args.join("/")),
	}
})

// Mock isBinaryFile
vi.mock("isbinaryfile")

// Mock line-counter
vi.mock("../../../integrations/misc/line-counter")

// Mock extract-text
vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn(),
	addLineNumbers: vi.fn((text) => text),
	getSupportedBinaryFormats: vi.fn(() => [".pdf", ".docx", ".ipynb"]),
}))

// Mock tree-sitter for definitions
vi.mock("../../../services/tree-sitter", () => ({
	parseSourceCodeDefinitionsForFile: vi.fn().mockResolvedValue(null),
}))

// Mock fs/promises for file stats
const fsPromises = vi.hoisted(() => ({
	stat: vi.fn().mockResolvedValue({ size: 1024 }),
	readFile: vi.fn(),
	open: vi.fn(),
}))
vi.mock("fs/promises", () => fsPromises)

// Mock fileTokenBudget helpers
vi.mock("../helpers/fileTokenBudget", async () => {
	const actual = await vi.importActual("../helpers/fileTokenBudget")
	return {
		...actual,
		validateFileTokenBudget: vi.fn(),
		truncateFileContent: vi.fn(),
	}
})

// Mock formatResponse
vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolDenied: vi.fn(() => "The user denied this operation."),
		toolDeniedWithFeedback: vi.fn(
			(feedback?: string) =>
				`The user denied this operation and provided the following feedback:\n<feedback>\n${feedback}\n</feedback>`,
		),
		toolApprovedWithFeedback: vi.fn(
			(feedback?: string) =>
				`The user approved this operation and provided the following context:\n<feedback>\n${feedback}\n</feedback>`,
		),
		rooIgnoreError: vi.fn(
			(path: string) =>
				`Access to ${path} is blocked by the .rooignore file settings. You must try to continue in the task without using this file, or ask the user to update the .rooignore file.`,
		),
		toolResult: vi.fn((text: string, images?: string[]) => text),
	},
}))

// Mock i18n
vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string, params?: Record<string, any>) => {
		const translations: Record<string, string> = {
			"tools:readFile.definitionsOnly": " (definitions only)",
			"tools:readFile.maxLines": " (max {{max}} lines)",
		}
		let result = translations[key] || key
		if (params) {
			Object.entries(params).forEach(([param, value]) => {
				result = result.replace(new RegExp(`{{${param}}}`, "g"), String(value))
			})
		}
		return result
	}),
}))

// Mock getModelMaxOutputTokens
vi.mock("../../../shared/api", () => ({
	getModelMaxOutputTokens: vi.fn().mockReturnValue(8192),
}))

// Get mocked functions
const mockedCountFileLines = vi.mocked(countFileLines)
const mockedExtractTextFromFile = vi.mocked(extractTextFromFile)
const mockedIsBinaryFile = vi.mocked(isBinaryFile)
const mockedPathResolve = vi.mocked(path.resolve)
const mockedValidateFileTokenBudget = vi.mocked(validateFileTokenBudget)
const mockedTruncateFileContent = vi.mocked(truncateFileContent)

/**
 * Create a mock Task (cline) object for testing
 */
function createMockCline(overrides: Partial<any> = {}): any {
	const mockProvider = {
		getState: vi.fn().mockResolvedValue({ maxReadFileLine: -1 }),
		deref: vi.fn().mockReturnThis(),
	}

	return {
		cwd: "/",
		task: "Test",
		providerRef: mockProvider,
		rooIgnoreController: {
			validateAccess: vi.fn().mockReturnValue(true),
		},
		say: vi.fn().mockResolvedValue(undefined),
		ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
		sayAndCreateMissingParamError: vi.fn().mockResolvedValue("Missing required parameter"),
		consecutiveMistakeCount: 0,
		recordToolError: vi.fn(),
		didRejectTool: false,
		fileContextTracker: {
			trackFileContext: vi.fn().mockResolvedValue(undefined),
		},
		getTokenUsage: vi.fn().mockReturnValue({
			contextTokens: 10000,
		}),
		apiConfiguration: {
			apiProvider: "anthropic",
		},
		api: {
			getModel: vi.fn().mockReturnValue({
				id: "test-model",
				info: {
					supportsImages: false,
					contextWindow: 200000,
					maxTokens: 8192,
				},
			}),
		},
		...overrides,
	}
}

describe("simpleReadFileTool token budget validation", () => {
	const testFilePath = "test/file.txt"
	const absoluteFilePath = "/test/file.txt"
	const fileContent = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"

	beforeEach(() => {
		vi.clearAllMocks()

		// Default mock setups
		mockedPathResolve.mockReturnValue(absoluteFilePath)
		mockedIsBinaryFile.mockResolvedValue(false)
		mockedCountFileLines.mockResolvedValue(5)
		mockedExtractTextFromFile.mockResolvedValue(fileContent)

		// Default: file does not need truncation
		mockedValidateFileTokenBudget.mockResolvedValue({
			shouldTruncate: false,
		})
	})

	/**
	 * Helper function to execute simpleReadFileTool
	 */
	async function executeSimpleReadFileTool(
		mockCline: any,
		filePath: string = testFilePath,
	): Promise<ToolResponse | undefined> {
		let toolResult: ToolResponse | undefined

		const toolUse: ToolUse = {
			type: "tool_use",
			name: "read_file",
			params: { path: filePath },
			partial: false,
		}

		await simpleReadFileTool(
			mockCline,
			toolUse,
			mockCline.ask,
			vi.fn(), // handleError
			(result: ToolResponse) => {
				toolResult = result
			},
			(_: ToolParamName, content?: string) => content ?? "",
		)

		return toolResult
	}

	describe("files within budget limits", () => {
		it("should read file normally when within token budget", async () => {
			const mockCline = createMockCline()

			// File is within budget
			mockedValidateFileTokenBudget.mockResolvedValue({
				shouldTruncate: false,
			})

			const result = await executeSimpleReadFileTool(mockCline)

			// Verify validateFileTokenBudget was called with correct params
			expect(mockedValidateFileTokenBudget).toHaveBeenCalledWith(
				absoluteFilePath,
				expect.any(Number), // contextWindow - maxOutputTokens
				10000, // current context tokens
			)

			// Verify truncateFileContent was NOT called
			expect(mockedTruncateFileContent).not.toHaveBeenCalled()

			// Verify result contains full file content
			expect(result).toContain(`<path>${testFilePath}</path>`)
			expect(result).toContain(`<content lines="1-5">`)
			expect(result).toContain(fileContent)
			expect(result).not.toContain("<notice>")
		})

		it("should not truncate files smaller than FILE_SIZE_THRESHOLD", async () => {
			const mockCline = createMockCline()
			const smallContent = "Small file content"

			mockedExtractTextFromFile.mockResolvedValue(smallContent)
			mockedCountFileLines.mockResolvedValue(1)
			mockedValidateFileTokenBudget.mockResolvedValue({
				shouldTruncate: false,
			})

			const result = await executeSimpleReadFileTool(mockCline)

			expect(mockedValidateFileTokenBudget).toHaveBeenCalled()
			expect(mockedTruncateFileContent).not.toHaveBeenCalled()
			expect(result).toContain(smallContent)
		})
	})

	describe("files exceeding token budget", () => {
		it("should truncate file content when exceeding token budget", async () => {
			const mockCline = createMockCline()
			const largeContent = "x".repeat(500000) // Large file content
			const truncatedContent = "x".repeat(50000) // Truncated version
			const truncationNotice = "File truncated to 50000 of 500000 characters due to context limitations."

			mockedExtractTextFromFile.mockResolvedValue(largeContent)
			mockedCountFileLines.mockResolvedValue(1000)

			// File exceeds budget
			mockedValidateFileTokenBudget.mockResolvedValue({
				shouldTruncate: true,
				maxChars: 50000,
				reason: "File requires 150000 tokens but only 114000 tokens available",
				isPreview: false,
			})

			mockedTruncateFileContent.mockReturnValue({
				content: truncatedContent,
				notice: truncationNotice,
			})

			const result = await executeSimpleReadFileTool(mockCline)

			// Verify truncateFileContent was called
			expect(mockedTruncateFileContent).toHaveBeenCalledWith(
				largeContent,
				50000,
				largeContent.length,
				false, // isPreview
			)

			// Verify result contains truncation notice
			expect(result).toContain(`<notice>${truncationNotice}</notice>`)
		})

		it("should calculate maxChars based on available token budget", async () => {
			const mockCline = createMockCline({
				getTokenUsage: vi.fn().mockReturnValue({
					contextTokens: 100000, // Higher token usage
				}),
				api: {
					getModel: vi.fn().mockReturnValue({
						id: "test-model",
						info: {
							supportsImages: false,
							contextWindow: 200000,
							maxTokens: 8192,
						},
					}),
				},
			})

			const content = "test content"
			mockedExtractTextFromFile.mockResolvedValue(content)
			mockedCountFileLines.mockResolvedValue(1)

			// Simulate limited budget
			mockedValidateFileTokenBudget.mockResolvedValue({
				shouldTruncate: true,
				maxChars: 30000,
				reason: "Limited context budget",
			})

			mockedTruncateFileContent.mockReturnValue({
				content: "truncated",
				notice: "Truncated due to context limitations",
			})

			await executeSimpleReadFileTool(mockCline)

			// Verify budget calculation was passed correctly
			// contextWindow (200000) - maxOutputTokens (8192) = 191808
			expect(mockedValidateFileTokenBudget).toHaveBeenCalledWith(
				absoluteFilePath,
				expect.any(Number),
				100000, // current context tokens
			)
		})

		it("should handle zero available budget gracefully", async () => {
			const mockCline = createMockCline({
				getTokenUsage: vi.fn().mockReturnValue({
					contextTokens: 200000, // Context is full
				}),
			})

			mockedValidateFileTokenBudget.mockResolvedValue({
				shouldTruncate: true,
				maxChars: 0,
				reason: "No available context budget for file reading",
			})

			mockedTruncateFileContent.mockReturnValue({
				content: "",
				notice: "No context budget available",
			})

			const result = await executeSimpleReadFileTool(mockCline)

			expect(mockedTruncateFileContent).toHaveBeenCalledWith(
				fileContent,
				0,
				fileContent.length,
				undefined, // isPreview
			)
			expect(result).toContain("<notice>")
		})
	})

	describe("large files triggering preview mode", () => {
		it("should use preview mode for files exceeding MAX_FILE_SIZE_FOR_TOKENIZATION", async () => {
			const mockCline = createMockCline()
			const largeContent = "x".repeat(100000) // Preview content
			const previewNotice =
				"Preview: Showing first 0.1MB of 10.00MB file. Use line_range to read specific sections."

			mockedExtractTextFromFile.mockResolvedValue(largeContent)
			mockedCountFileLines.mockResolvedValue(10000)

			// File triggers preview mode
			mockedValidateFileTokenBudget.mockResolvedValue({
				shouldTruncate: true,
				maxChars: 100000,
				reason: previewNotice,
				isPreview: true,
			})

			mockedTruncateFileContent.mockReturnValue({
				content: largeContent,
				notice: previewNotice,
			})

			const result = await executeSimpleReadFileTool(mockCline)

			// Verify isPreview flag was passed to truncateFileContent
			expect(mockedTruncateFileContent).toHaveBeenCalledWith(
				largeContent,
				100000,
				largeContent.length,
				true, // isPreview
			)

			expect(result).toContain(previewNotice)
		})

		it("should include preview-specific notice for very large files", async () => {
			const mockCline = createMockCline()
			const previewContent = "x".repeat(50000)
			const previewNotice = "File is too large (10.00MB) to read entirely. Showing preview."

			mockedExtractTextFromFile.mockResolvedValue(previewContent)
			mockedCountFileLines.mockResolvedValue(5000)

			mockedValidateFileTokenBudget.mockResolvedValue({
				shouldTruncate: true,
				maxChars: 50000,
				reason: previewNotice,
				isPreview: true,
			})

			mockedTruncateFileContent.mockReturnValue({
				content: previewContent,
				notice: previewNotice,
			})

			const result = await executeSimpleReadFileTool(mockCline)

			expect(result).toContain(previewNotice)
			expect(mockedTruncateFileContent).toHaveBeenCalledWith(
				expect.any(String),
				50000,
				expect.any(Number),
				true, // isPreview
			)
		})
	})

	describe("model-specific context window calculations", () => {
		it("should use model contextWindow for budget calculation", async () => {
			const smallContextWindow = 32000
			const mockCline = createMockCline({
				api: {
					getModel: vi.fn().mockReturnValue({
						id: "small-context-model",
						info: {
							supportsImages: false,
							contextWindow: smallContextWindow,
							maxTokens: 4096,
						},
					}),
				},
				getTokenUsage: vi.fn().mockReturnValue({
					contextTokens: 5000,
				}),
			})

			mockedValidateFileTokenBudget.mockResolvedValue({
				shouldTruncate: false,
			})

			await executeSimpleReadFileTool(mockCline)

			// Verify budget was calculated with model's context window
			// Expected: contextWindow (32000) - maxOutputTokens (4096 clamped to 20% of 32000 = 6400)
			expect(mockedValidateFileTokenBudget).toHaveBeenCalledWith(
				absoluteFilePath,
				expect.any(Number),
				5000, // current context tokens
			)
		})

		it("should use ANTHROPIC_DEFAULT_MAX_TOKENS as fallback for max output tokens", async () => {
			const mockCline = createMockCline({
				api: {
					getModel: vi.fn().mockReturnValue({
						id: "model-without-max-tokens",
						info: {
							supportsImages: false,
							contextWindow: 100000,
							// maxTokens intentionally undefined
						},
					}),
				},
			})

			mockedValidateFileTokenBudget.mockResolvedValue({
				shouldTruncate: false,
			})

			await executeSimpleReadFileTool(mockCline)

			// Should still call validateFileTokenBudget
			expect(mockedValidateFileTokenBudget).toHaveBeenCalled()
		})

		it("should handle different model configurations correctly", async () => {
			// Test with a model that has a large context window (like Gemini)
			const largeContextWindow = 1000000
			const mockCline = createMockCline({
				api: {
					getModel: vi.fn().mockReturnValue({
						id: "gemini-pro",
						info: {
							supportsImages: true,
							contextWindow: largeContextWindow,
							maxTokens: 8192,
						},
					}),
				},
				getTokenUsage: vi.fn().mockReturnValue({
					contextTokens: 50000,
				}),
			})

			mockedValidateFileTokenBudget.mockResolvedValue({
				shouldTruncate: false,
			})

			await executeSimpleReadFileTool(mockCline)

			// Should handle large context window appropriately
			expect(mockedValidateFileTokenBudget).toHaveBeenCalledWith(
				absoluteFilePath,
				expect.any(Number), // Large available budget
				50000,
			)
		})
	})

	describe("line count tracking with truncation", () => {
		it("should calculate displayed lines correctly when content is truncated", async () => {
			const mockCline = createMockCline()
			const truncatedContent = "Line 1\nLine 2\nLine 3\n" // 3 lines, ends with newline
			const notice = "File truncated"

			mockedExtractTextFromFile.mockResolvedValue("Original content with many lines...")
			mockedCountFileLines.mockResolvedValue(100)

			mockedValidateFileTokenBudget.mockResolvedValue({
				shouldTruncate: true,
				maxChars: 25,
			})

			mockedTruncateFileContent.mockReturnValue({
				content: truncatedContent,
				notice,
			})

			const result = await executeSimpleReadFileTool(mockCline)

			// Should show 3 lines (since content ends with newline, actual lines is 3)
			expect(result).toContain('lines="1-3"')
		})

		it("should handle empty truncated content", async () => {
			const mockCline = createMockCline()

			mockedValidateFileTokenBudget.mockResolvedValue({
				shouldTruncate: true,
				maxChars: 0,
			})

			mockedTruncateFileContent.mockReturnValue({
				content: "",
				notice: "No context budget",
			})

			const result = await executeSimpleReadFileTool(mockCline)

			expect(result).toContain("<content/>")
			expect(result).toContain("<notice>No context budget</notice>")
		})
	})

	describe("integration with existing maxReadFileLine behavior", () => {
		it("should apply token budget validation after maxReadFileLine check passes", async () => {
			const mockProvider = {
				getState: vi.fn().mockResolvedValue({ maxReadFileLine: 1000 }), // High limit
				deref: vi.fn().mockReturnThis(),
			}
			const mockCline = createMockCline({ providerRef: mockProvider })

			// File has only 5 lines, so maxReadFileLine won't trigger
			mockedCountFileLines.mockResolvedValue(5)
			mockedValidateFileTokenBudget.mockResolvedValue({
				shouldTruncate: false,
			})

			await executeSimpleReadFileTool(mockCline)

			// Token budget validation should still be called
			expect(mockedValidateFileTokenBudget).toHaveBeenCalled()
		})

		it("should skip token budget validation when maxReadFileLine triggers truncation", async () => {
			const mockProvider = {
				getState: vi.fn().mockResolvedValue({ maxReadFileLine: 2 }), // Low limit
				deref: vi.fn().mockReturnThis(),
			}
			const mockCline = createMockCline({ providerRef: mockProvider })

			// File has 100 lines, which exceeds maxReadFileLine
			mockedCountFileLines.mockResolvedValue(100)

			await executeSimpleReadFileTool(mockCline)

			// Token budget validation should NOT be called because maxReadFileLine
			// takes precedence and returns early
			expect(mockedValidateFileTokenBudget).not.toHaveBeenCalled()
		})
	})
})

describe("getSimpleReadFileToolDescription", () => {
	it("should be tested via import if needed", () => {
		// This is just to ensure the file exports are correct
		expect(simpleReadFileTool).toBeDefined()
	})
})
