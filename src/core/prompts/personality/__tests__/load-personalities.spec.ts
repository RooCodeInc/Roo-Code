import * as fs from "fs"
import * as path from "path"

import { Personality, PERSONALITIES } from "@roo-code/types"

import {
	loadPersonalityContent,
	loadSinglePersonalityContent,
	clearPersonalityCache,
	getPersonalitiesDirectory,
} from "../load-personalities"

// Mock the fs module
vi.mock("fs")

describe("load-personalities", () => {
	const mockFriendlyContent = "# Friendly Personality\n\nBe warm and supportive."
	const mockPragmaticContent = "# Pragmatic Personality\n\nBe direct and efficient."

	beforeEach(() => {
		vi.clearAllMocks()
		// Clear the cache before each test
		clearPersonalityCache()
	})

	describe("getPersonalitiesDirectory", () => {
		it("should return the personalities directory path", () => {
			const dir = getPersonalitiesDirectory()
			expect(dir).toContain("personalities")
		})
	})

	describe("loadPersonalityContent", () => {
		it("should load all personality files successfully", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true)
			vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
				const pathStr = filePath.toString()
				if (pathStr.includes("friendly.md")) {
					return mockFriendlyContent
				}
				if (pathStr.includes("pragmatic.md")) {
					return mockPragmaticContent
				}
				return ""
			})

			const result = loadPersonalityContent()

			expect(result).not.toBeUndefined()
			expect(result![Personality.Friendly]).toBe(mockFriendlyContent)
			expect(result![Personality.Pragmatic]).toBe(mockPragmaticContent)
		})

		it("should cache results on subsequent calls", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true)
			vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
				const pathStr = filePath.toString()
				if (pathStr.includes("friendly.md")) {
					return mockFriendlyContent
				}
				if (pathStr.includes("pragmatic.md")) {
					return mockPragmaticContent
				}
				return ""
			})

			// First call
			loadPersonalityContent()
			// Second call
			loadPersonalityContent()

			// readFileSync should only be called once per file due to caching
			expect(fs.readFileSync).toHaveBeenCalledTimes(PERSONALITIES.length)
		})

		it("should return undefined when a personality file is missing", () => {
			vi.mocked(fs.existsSync).mockImplementation((filePath) => {
				const pathStr = filePath.toString()
				// Only friendly.md exists
				return pathStr.includes("friendly.md")
			})

			const result = loadPersonalityContent()

			expect(result).toBeUndefined()
		})

		it("should return undefined when file content is empty", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true)
			vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
				const pathStr = filePath.toString()
				if (pathStr.includes("friendly.md")) {
					return "   " // Only whitespace
				}
				if (pathStr.includes("pragmatic.md")) {
					return mockPragmaticContent
				}
				return ""
			})

			const result = loadPersonalityContent()

			expect(result).toBeUndefined()
		})

		it("should return undefined when readFileSync throws an error", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true)
			vi.mocked(fs.readFileSync).mockImplementation(() => {
				throw new Error("File read error")
			})

			const result = loadPersonalityContent()

			expect(result).toBeUndefined()
		})

		it("should trim whitespace from loaded content", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true)
			vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
				const pathStr = filePath.toString()
				if (pathStr.includes("friendly.md")) {
					return `  ${mockFriendlyContent}  \n\n`
				}
				if (pathStr.includes("pragmatic.md")) {
					return mockPragmaticContent
				}
				return ""
			})

			const result = loadPersonalityContent()

			expect(result).not.toBeUndefined()
			expect(result![Personality.Friendly]).toBe(mockFriendlyContent)
		})
	})

	describe("loadSinglePersonalityContent", () => {
		it("should load a single personality file", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true)
			vi.mocked(fs.readFileSync).mockReturnValue(mockFriendlyContent)

			const result = loadSinglePersonalityContent(Personality.Friendly)

			expect(result).toBe(mockFriendlyContent)
		})

		it("should return undefined when file does not exist", () => {
			vi.mocked(fs.existsSync).mockReturnValue(false)

			const result = loadSinglePersonalityContent(Personality.Friendly)

			expect(result).toBeUndefined()
		})

		it("should return undefined when readFileSync throws", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true)
			vi.mocked(fs.readFileSync).mockImplementation(() => {
				throw new Error("Read error")
			})

			const result = loadSinglePersonalityContent(Personality.Friendly)

			expect(result).toBeUndefined()
		})

		it("should trim whitespace from content", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true)
			vi.mocked(fs.readFileSync).mockReturnValue(`  ${mockFriendlyContent}  `)

			const result = loadSinglePersonalityContent(Personality.Friendly)

			expect(result).toBe(mockFriendlyContent)
		})
	})

	describe("clearPersonalityCache", () => {
		it("should clear cached content", () => {
			// First, load content
			vi.mocked(fs.existsSync).mockReturnValue(true)
			vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
				const pathStr = filePath.toString()
				if (pathStr.includes("friendly.md")) {
					return mockFriendlyContent
				}
				if (pathStr.includes("pragmatic.md")) {
					return mockPragmaticContent
				}
				return ""
			})

			loadPersonalityContent()
			vi.mocked(fs.readFileSync).mockClear()

			// Clear cache
			clearPersonalityCache()

			// Load again - should read from files again
			loadPersonalityContent()

			expect(fs.readFileSync).toHaveBeenCalledTimes(PERSONALITIES.length)
		})
	})
})
