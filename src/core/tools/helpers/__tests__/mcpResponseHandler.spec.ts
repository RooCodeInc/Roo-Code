import * as fs from "fs/promises"
import * as path from "path"
import { Task } from "../../../task/Task"
import {
	handleMcpResponse,
	getAvailableMcpResponseBudget,
	MCP_RESPONSE_BUDGET_PERCENT,
	MCP_RESPONSE_DIR,
	DEFAULT_PREVIEW_LINES,
} from "../mcpResponseHandler"

// Mock dependencies
vi.mock("fs/promises")
vi.mock("../../../../utils/countTokens", () => ({
	countTokens: vi.fn().mockResolvedValue(100),
}))

const mockFs = vi.mocked(fs)

describe("mcpResponseHandler", () => {
	let mockTask: Partial<Task>

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup mock task with typical values
		mockTask = {
			cwd: "/test/workspace",
			api: {
				getModel: vi.fn().mockReturnValue({
					id: "claude-sonnet-4-20250514",
					info: {
						contextWindow: 200000,
						maxTokens: 8192,
						supportsPromptCache: true,
					},
				}),
			} as any,
			getTokenUsage: vi.fn().mockReturnValue({
				contextTokens: 50000,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
			}),
			apiConfiguration: {},
		}

		// Mock fs operations
		mockFs.mkdir.mockResolvedValue(undefined)
		mockFs.writeFile.mockResolvedValue(undefined)
	})

	describe("handleMcpResponse", () => {
		it("should return response directly when it fits within context budget", async () => {
			const smallResponse = "This is a small MCP response"

			const result = await handleMcpResponse(mockTask as Task, smallResponse)

			expect(result.savedToFile).toBe(false)
			expect(result.content).toBe(smallResponse)
			expect(result.filePath).toBeUndefined()
			expect(mockFs.writeFile).not.toHaveBeenCalled()
		})

		it("should save response to file when it exceeds context budget", async () => {
			// Mock countTokens to return a very large number for the first call (response)
			// and small number for preview
			const { countTokens } = await import("../../../../utils/countTokens")
			vi.mocked(countTokens)
				.mockResolvedValueOnce(500000) // Original response tokens - exceeds budget
				.mockResolvedValueOnce(100) // Preview tokens

			const largeResponse = "A".repeat(1000000) // Very large response

			const result = await handleMcpResponse(mockTask as Task, largeResponse)

			expect(result.savedToFile).toBe(true)
			expect(result.filePath).toBeDefined()
			expect(result.filePath).toContain(MCP_RESPONSE_DIR.replace(".roo/", ""))
			expect(result.content).toContain("[MCP Response Saved to File]")
			expect(result.content).toContain("read_file tool")
			expect(mockFs.mkdir).toHaveBeenCalled()
			expect(mockFs.writeFile).toHaveBeenCalled()
		})

		it("should generate preview with correct number of lines", async () => {
			const { countTokens } = await import("../../../../utils/countTokens")
			vi.mocked(countTokens)
				.mockResolvedValueOnce(500000) // Original exceeds budget
				.mockResolvedValueOnce(50) // Preview tokens

			// Create response with many lines
			const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}: Content`)
			const multilineResponse = lines.join("\n")

			const result = await handleMcpResponse(mockTask as Task, multilineResponse, {
				previewLines: 20,
			})

			expect(result.savedToFile).toBe(true)
			// Preview should contain only first 20 lines
			const previewSection = result.content.split("---")[1]
			const previewLineCount = previewSection.trim().split("\n").length
			expect(previewLineCount).toBeLessThanOrEqual(20)
		})

		it("should use custom file name prefix when provided", async () => {
			const { countTokens } = await import("../../../../utils/countTokens")
			vi.mocked(countTokens)
				.mockResolvedValueOnce(500000) // Exceeds budget
				.mockResolvedValueOnce(50)

			const response = "Large response content"

			const result = await handleMcpResponse(mockTask as Task, response, {
				fileNamePrefix: "custom-prefix",
			})

			expect(result.savedToFile).toBe(true)
			// Check that writeFile was called with a path containing the custom prefix
			const writeFileCall = mockFs.writeFile.mock.calls[0]
			expect(writeFileCall[0]).toContain("custom-prefix")
		})

		it("should handle token counting errors gracefully", async () => {
			const { countTokens } = await import("../../../../utils/countTokens")
			vi.mocked(countTokens).mockRejectedValue(new Error("Token counting failed"))

			const response = "Test response"

			// Should not throw, should fall back to character-based estimation
			const result = await handleMcpResponse(mockTask as Task, response)

			expect(result).toBeDefined()
			expect(typeof result.originalTokenCount).toBe("number")
		})

		it("should include token count information in result", async () => {
			const { countTokens } = await import("../../../../utils/countTokens")
			vi.mocked(countTokens).mockResolvedValue(1500)

			const response = "Test response with moderate size"

			const result = await handleMcpResponse(mockTask as Task, response)

			expect(result.originalTokenCount).toBe(1500)
			expect(result.returnedTokenCount).toBe(1500)
		})

		it("should save to correct directory structure", async () => {
			const { countTokens } = await import("../../../../utils/countTokens")
			vi.mocked(countTokens)
				.mockResolvedValueOnce(500000)
				.mockResolvedValueOnce(50)

			const response = "Large response"

			await handleMcpResponse(mockTask as Task, response)

			// Check mkdir was called with correct path
			expect(mockFs.mkdir).toHaveBeenCalledWith(
				path.join("/test/workspace", MCP_RESPONSE_DIR),
				{ recursive: true },
			)
		})

		it("should handle zero available budget gracefully", async () => {
			// Set up task with very high current token usage
			mockTask.getTokenUsage = vi.fn().mockReturnValue({
				contextTokens: 195000, // Nearly at context window limit
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
			})

			const { countTokens } = await import("../../../../utils/countTokens")
			vi.mocked(countTokens)
				.mockResolvedValueOnce(100)
				.mockResolvedValueOnce(50)

			const response = "Small response"

			const result = await handleMcpResponse(mockTask as Task, response)

			// Even small response should be saved to file when budget is exhausted
			expect(result.savedToFile).toBe(true)
		})
	})

	describe("getAvailableMcpResponseBudget", () => {
		it("should calculate correct budget based on context window and usage", () => {
			const budget = getAvailableMcpResponseBudget(mockTask as Task)

			// contextWindow: 200000
			// maxOutputTokens: ~8192 (from model info)
			// contextTokens: 50000
			// remaining = 200000 - 8192 - 50000 = 141808
			// budget = 141808 * 0.5 = 70904
			expect(budget).toBeGreaterThan(0)
			expect(budget).toBeLessThan(200000)
		})

		it("should return smaller budget when context is nearly full", () => {
			mockTask.getTokenUsage = vi.fn().mockReturnValue({
				contextTokens: 180000,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
			})

			const budget = getAvailableMcpResponseBudget(mockTask as Task)

			// remaining = 200000 - 8192 - 180000 = 11808
			// budget = 11808 * 0.5 = 5904
			expect(budget).toBeLessThan(10000)
		})

		it("should handle different model context windows", () => {
			// Test with smaller context window model
			mockTask.api = {
				getModel: vi.fn().mockReturnValue({
					id: "small-model",
					info: {
						contextWindow: 32000,
						maxTokens: 4096,
						supportsPromptCache: false,
					},
				}),
			} as any

			mockTask.getTokenUsage = vi.fn().mockReturnValue({
				contextTokens: 10000,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
			})

			const budget = getAvailableMcpResponseBudget(mockTask as Task)

			// remaining = 32000 - 4096 - 10000 = 17904
			// budget = 17904 * 0.5 = 8952
			expect(budget).toBeLessThan(10000)
		})
	})

	describe("constants", () => {
		it("should have correct budget percentage", () => {
			expect(MCP_RESPONSE_BUDGET_PERCENT).toBe(0.5)
		})

		it("should have correct default preview lines", () => {
			expect(DEFAULT_PREVIEW_LINES).toBe(50)
		})

		it("should have correct response directory", () => {
			expect(MCP_RESPONSE_DIR).toBe(".roo/tmp/mcp-responses")
		})
	})
})
