// npx vitest src/core/mentions/__tests__/folder-limits.spec.ts

import * as path from "path"
import { MAX_FOLDER_FILES_TO_READ, MAX_FOLDER_CONTENT_SIZE } from "../index"

// Mock vscode
vi.mock("vscode", () => ({
	window: {
		showErrorMessage: vi.fn(),
	},
	languages: {
		getDiagnostics: vi.fn().mockReturnValue([]),
	},
}))

// Mock i18n
vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string) => key),
}))

// Mock isbinaryfile
vi.mock("isbinaryfile", () => ({
	isBinaryFile: vi.fn().mockResolvedValue(false),
}))

// Mock fs/promises
const mockReaddir = vi.fn()
const mockStat = vi.fn()
const mockReadFile = vi.fn()

vi.mock("fs/promises", () => ({
	default: {
		readdir: (...args: any[]) => mockReaddir(...args),
		stat: (...args: any[]) => mockStat(...args),
		readFile: (...args: any[]) => mockReadFile(...args),
		access: vi.fn().mockResolvedValue(undefined),
	},
	readdir: (...args: any[]) => mockReaddir(...args),
	stat: (...args: any[]) => mockStat(...args),
	readFile: (...args: any[]) => mockReadFile(...args),
	access: vi.fn().mockResolvedValue(undefined),
}))

// Mock extract-text module
vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFileWithMetadata: vi.fn().mockImplementation(async (filePath: string) => {
		// Return a predictable result for testing
		return {
			content: `1 | // Content of ${path.basename(filePath)}\n2 | const x = 1;`,
			totalLines: 2,
			returnedLines: 2,
			wasTruncated: false,
		}
	}),
}))

describe("Folder Mention Content Limits", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Constants", () => {
		it("should export MAX_FOLDER_FILES_TO_READ constant", () => {
			expect(MAX_FOLDER_FILES_TO_READ).toBeDefined()
			expect(typeof MAX_FOLDER_FILES_TO_READ).toBe("number")
			expect(MAX_FOLDER_FILES_TO_READ).toBeGreaterThan(0)
		})

		it("should export MAX_FOLDER_CONTENT_SIZE constant", () => {
			expect(MAX_FOLDER_CONTENT_SIZE).toBeDefined()
			expect(typeof MAX_FOLDER_CONTENT_SIZE).toBe("number")
			expect(MAX_FOLDER_CONTENT_SIZE).toBeGreaterThan(0)
		})

		it("should have reasonable default values", () => {
			// MAX_FOLDER_FILES_TO_READ should be reasonable (e.g., 10)
			expect(MAX_FOLDER_FILES_TO_READ).toBeLessThanOrEqual(50)
			expect(MAX_FOLDER_FILES_TO_READ).toBeGreaterThanOrEqual(5)

			// MAX_FOLDER_CONTENT_SIZE should be reasonable (e.g., 100KB)
			expect(MAX_FOLDER_CONTENT_SIZE).toBeGreaterThanOrEqual(50_000)
			expect(MAX_FOLDER_CONTENT_SIZE).toBeLessThanOrEqual(500_000)
		})
	})

	describe("parseMentions with folder limits", () => {
		// These tests import parseMentions dynamically to ensure mocks are applied
		it("should limit the number of files read from a folder", async () => {
			// Create many file entries to exceed the limit
			const numFiles = MAX_FOLDER_FILES_TO_READ + 5
			const entries = Array.from({ length: numFiles }, (_, i) => ({
				name: `file${i}.ts`,
				isFile: () => true,
				isDirectory: () => false,
			}))

			mockStat.mockResolvedValue({
				isFile: () => false,
				isDirectory: () => true,
			})
			mockReaddir.mockResolvedValue(entries)

			// Import the module after mocks are set up
			const { parseMentions } = await import("../index")
			const mockUrlContentFetcher = {
				launchBrowser: vi.fn(),
				urlToMarkdown: vi.fn(),
				closeBrowser: vi.fn(),
			} as any

			const result = await parseMentions("Check @/test-folder/", "/workspace", mockUrlContentFetcher)

			// Should have content blocks with folder content
			expect(result.contentBlocks.length).toBeGreaterThan(0)
			const folderBlock = result.contentBlocks.find((b) => b.type === "folder")
			expect(folderBlock).toBeDefined()

			// Should contain truncation notice
			expect(folderBlock?.content).toContain("Content Truncated")
			expect(folderBlock?.content).toContain(`Only ${MAX_FOLDER_FILES_TO_READ} files were read`)
		})

		it("should limit total content size", async () => {
			// Create a few files that together exceed the content size limit
			const numFiles = 3
			const entries = Array.from({ length: numFiles }, (_, i) => ({
				name: `file${i}.ts`,
				isFile: () => true,
				isDirectory: () => false,
			}))

			mockStat.mockResolvedValue({
				isFile: () => false,
				isDirectory: () => true,
			})
			mockReaddir.mockResolvedValue(entries)

			// Mock extractTextFromFileWithMetadata to return large content
			const { extractTextFromFileWithMetadata } = await import("../../../integrations/misc/extract-text")
			vi.mocked(extractTextFromFileWithMetadata).mockImplementation(async () => {
				// Return content that's about half of MAX_FOLDER_CONTENT_SIZE
				const largeContent = "x".repeat(Math.ceil(MAX_FOLDER_CONTENT_SIZE / 2))
				return {
					content: largeContent,
					totalLines: 1000,
					returnedLines: 1000,
					wasTruncated: false,
				}
			})

			// Import the module after mocks are set up
			const { parseMentions } = await import("../index")
			const mockUrlContentFetcher = {
				launchBrowser: vi.fn(),
				urlToMarkdown: vi.fn(),
				closeBrowser: vi.fn(),
			} as any

			const result = await parseMentions("Check @/test-folder/", "/workspace", mockUrlContentFetcher)

			// Should have content blocks with folder content
			expect(result.contentBlocks.length).toBeGreaterThan(0)
			const folderBlock = result.contentBlocks.find((b) => b.type === "folder")
			expect(folderBlock).toBeDefined()

			// Should contain truncation notice due to size
			expect(folderBlock?.content).toContain("Content Truncated")
			expect(folderBlock?.content).toContain("KB to prevent context window overflow")
		})

		it("should not add truncation notice when within limits", async () => {
			// Create a few small files within limits
			const numFiles = 3
			const entries = Array.from({ length: numFiles }, (_, i) => ({
				name: `file${i}.ts`,
				isFile: () => true,
				isDirectory: () => false,
			}))

			mockStat.mockResolvedValue({
				isFile: () => false,
				isDirectory: () => true,
			})
			mockReaddir.mockResolvedValue(entries)

			// Mock extractTextFromFileWithMetadata to return small content
			const { extractTextFromFileWithMetadata } = await import("../../../integrations/misc/extract-text")
			vi.mocked(extractTextFromFileWithMetadata).mockImplementation(async (filePath: string) => {
				return {
					content: `1 | // Small file ${path.basename(filePath)}`,
					totalLines: 1,
					returnedLines: 1,
					wasTruncated: false,
				}
			})

			// Import the module after mocks are set up
			const { parseMentions } = await import("../index")
			const mockUrlContentFetcher = {
				launchBrowser: vi.fn(),
				urlToMarkdown: vi.fn(),
				closeBrowser: vi.fn(),
			} as any

			const result = await parseMentions("Check @/small-folder/", "/workspace", mockUrlContentFetcher)

			// Should have content blocks with folder content
			expect(result.contentBlocks.length).toBeGreaterThan(0)
			const folderBlock = result.contentBlocks.find((b) => b.type === "folder")
			expect(folderBlock).toBeDefined()

			// Should NOT contain truncation notice
			expect(folderBlock?.content).not.toContain("Content Truncated")
		})

		it("should still show folder listing even when files are skipped", async () => {
			// Create many file entries
			const numFiles = MAX_FOLDER_FILES_TO_READ + 10
			const entries = Array.from({ length: numFiles }, (_, i) => ({
				name: `file${i}.ts`,
				isFile: () => true,
				isDirectory: () => false,
			}))

			mockStat.mockResolvedValue({
				isFile: () => false,
				isDirectory: () => true,
			})
			mockReaddir.mockResolvedValue(entries)

			// Import the module after mocks are set up
			const { parseMentions } = await import("../index")
			const mockUrlContentFetcher = {
				launchBrowser: vi.fn(),
				urlToMarkdown: vi.fn(),
				closeBrowser: vi.fn(),
			} as any

			const result = await parseMentions("Check @/large-folder/", "/workspace", mockUrlContentFetcher)

			const folderBlock = result.contentBlocks.find((b) => b.type === "folder")
			expect(folderBlock).toBeDefined()

			// Should contain the folder listing with all files listed
			// (the listing shows all files, only content reading is limited)
			expect(folderBlock?.content).toContain("Folder listing:")
			expect(folderBlock?.content).toContain("file0.ts")
			expect(folderBlock?.content).toContain(`file${numFiles - 1}.ts`)
		})
	})
})
