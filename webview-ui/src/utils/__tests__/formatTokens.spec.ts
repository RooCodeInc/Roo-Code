import { describe, it, expect, vi } from "vitest"
import { formatTokenCount, formatTokenStats } from "../formatTokens"

// Mock i18next (same as in format.spec.ts)
vi.mock("i18next", () => ({
	default: {
		t: vi.fn((key: string, options?: any) => {
			// Mock translations for testing
			const translations: Record<string, string> = {
				"common:number_format.billion_suffix": "b",
				"common:number_format.million_suffix": "m",
				"common:number_format.thousand_suffix": "k",
			}

			let result = translations[key] || key
			if (options?.count !== undefined) {
				result = result.replace("{{count}}", options.count.toString())
			}
			return result
		}),
		language: "en",
	},
}))

// Mock formatLargeNumber
vi.mock("../format", () => ({
	formatLargeNumber: vi.fn((num: number) => {
		if (num >= 1e9) {
			return (num / 1e9).toFixed(1) + "b"
		}
		if (num >= 1e6) {
			return (num / 1e6).toFixed(1) + "m"
		}
		if (num >= 1e3) {
			return (num / 1e3).toFixed(1) + "k"
		}
		return num.toString()
	}),
}))

describe("formatTokenCount", () => {
	it("should return '0' for undefined count", () => {
		expect(formatTokenCount(undefined)).toBe("0")
	})

	it("should return '0' for count of 0", () => {
		expect(formatTokenCount(0)).toBe("0")
	})

	it("should format small numbers as strings", () => {
		expect(formatTokenCount(42)).toBe("42")
		expect(formatTokenCount(999)).toBe("999")
	})

	it("should format thousands correctly", () => {
		expect(formatTokenCount(1500)).toBe("1.5k")
		expect(formatTokenCount(2000)).toBe("2.0k")
	})

	it("should format millions correctly", () => {
		expect(formatTokenCount(1500000)).toBe("1.5m")
		expect(formatTokenCount(2000000)).toBe("2.0m")
	})

	it("should format billions correctly", () => {
		expect(formatTokenCount(1500000000)).toBe("1.5b")
		expect(formatTokenCount(2000000000)).toBe("2.0b")
	})
})

describe("formatTokenStats", () => {
	describe("without cache reads", () => {
		it("should format input and output tokens without cache", () => {
			const result = formatTokenStats(1000, 500)
			expect(result).toEqual({
				input: "1.0k",
				output: "500",
			})
		})

		it("should handle undefined tokens", () => {
			const result = formatTokenStats(undefined, undefined)
			expect(result).toEqual({
				input: "0",
				output: "0",
			})
		})

		it("should handle zero tokens", () => {
			const result = formatTokenStats(0, 0)
			expect(result).toEqual({
				input: "0",
				output: "0",
			})
		})

		it("should handle only input tokens", () => {
			const result = formatTokenStats(2000, undefined)
			expect(result).toEqual({
				input: "2.0k",
				output: "0",
			})
		})

		it("should handle only output tokens", () => {
			const result = formatTokenStats(undefined, 3000)
			expect(result).toEqual({
				input: "0",
				output: "3.0k",
			})
		})

		it("should handle large numbers", () => {
			const result = formatTokenStats(1500000, 2000000)
			expect(result).toEqual({
				input: "1.5m",
				output: "2.0m",
			})
		})
	})

	describe("with cache reads", () => {
		it("should include cache reads in input display with default label", () => {
			const result = formatTokenStats(1000, 500, 200)
			expect(result).toEqual({
				input: "1.0k (200 cache)",
				output: "500",
			})
		})

		it("should include cache reads in input display with custom label", () => {
			const result = formatTokenStats(1000, 500, 200, "cached")
			expect(result).toEqual({
				input: "1.0k (200 cached)",
				output: "500",
			})
		})

		it("should handle cache reads with large numbers", () => {
			const result = formatTokenStats(1000000, 500000, 200000, "cache")
			expect(result).toEqual({
				input: "1.0m (200.0k cache)",
				output: "500.0k",
			})
		})

		it("should handle zero cache reads (should not display cache)", () => {
			const result = formatTokenStats(1000, 500, 0)
			expect(result).toEqual({
				input: "1.0k",
				output: "500",
			})
		})

		it("should handle undefined cache reads (should not display cache)", () => {
			const result = formatTokenStats(1000, 500, undefined)
			expect(result).toEqual({
				input: "1.0k",
				output: "500",
			})
		})

		it("should handle negative cache reads (should not display cache)", () => {
			const result = formatTokenStats(1000, 500, -100)
			expect(result).toEqual({
				input: "1.0k",
				output: "500",
			})
		})
	})

	describe("edge cases", () => {
		it("should handle very large numbers", () => {
			const result = formatTokenStats(5000000000, 1000000000)
			expect(result).toEqual({
				input: "5.0b",
				output: "1.0b",
			})
		})

		it("should handle decimal numbers", () => {
			const result = formatTokenStats(1234.56, 567.89)
			expect(result).toEqual({
				input: "1.2k",
				output: "567.89", // formatLargeNumber preserves decimals for small numbers
			})
		})

		it("should handle empty cache label", () => {
			const result = formatTokenStats(1000, 500, 200, "")
			expect(result).toEqual({
				input: "1.0k (200 )",
				output: "500",
			})
		})
	})
})
