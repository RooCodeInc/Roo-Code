import { describe, it, expect, vi, beforeEach } from "vitest"
import { countFileLines, countFileLinesAndTokens } from "../line-counter"
import fs from "fs"
import { countTokens } from "../../../utils/countTokens"

// Mock dependencies
vi.mock("fs", () => ({
	default: {
		promises: {
			access: vi.fn(),
		},
		constants: {
			F_OK: 0,
		},
		createReadStream: vi.fn(),
	},
	createReadStream: vi.fn(),
}))

vi.mock("../../../utils/countTokens", () => ({
	countTokens: vi.fn(),
}))

const mockCountTokens = vi.mocked(countTokens)

describe("line-counter", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("countFileLinesAndTokens", () => {
		it("should count lines and tokens without budget limit", async () => {
			const mockStream = {
				on: vi.fn((event, handler) => {
					if (event === "data") {
						// Simulate reading lines
						handler("line1\n")
						handler("line2\n")
						handler("line3\n")
					}
					return mockStream
				}),
				destroy: vi.fn(),
			}

			vi.mocked(fs.createReadStream).mockReturnValue(mockStream as any)
			vi.mocked(fs.promises.access).mockResolvedValue(undefined)

			// Mock token counting - simulate ~10 tokens per line
			mockCountTokens.mockResolvedValue(30)

			const result = await countFileLinesAndTokens("/test/file.txt")

			expect(result.lineCount).toBeGreaterThan(0)
			expect(result.tokenEstimate).toBeGreaterThan(0)
			expect(result.complete).toBe(true)
		})

		it("should handle tokenizer errors with conservative estimate", async () => {
			const mockStream = {
				on: vi.fn((event, handler) => {
					if (event === "data") {
						handler("line1\n")
					}
					return mockStream
				}),
				destroy: vi.fn(),
			}

			vi.mocked(fs.createReadStream).mockReturnValue(mockStream as any)
			vi.mocked(fs.promises.access).mockResolvedValue(undefined)

			// Simulate tokenizer error
			mockCountTokens.mockRejectedValue(new Error("unreachable"))

			const result = await countFileLinesAndTokens("/test/file.txt")

			// Should still complete with conservative token estimate
			expect(result.lineCount).toBeGreaterThan(0)
			expect(result.tokenEstimate).toBeGreaterThan(0)
			expect(result.complete).toBe(true)
		})

		it("should throw error for non-existent files", async () => {
			vi.mocked(fs.promises.access).mockRejectedValue(new Error("ENOENT"))

			await expect(countFileLinesAndTokens("/nonexistent/file.txt")).rejects.toThrow("File not found")
		})
	})

	describe("countFileLines", () => {
		it("should throw error for non-existent files", async () => {
			vi.mocked(fs.promises.access).mockRejectedValue(new Error("ENOENT"))

			await expect(countFileLines("/nonexistent/file.txt")).rejects.toThrow("File not found")
		})
	})
})
