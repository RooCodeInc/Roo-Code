// npx vitest core/mentions/__tests__/index.spec.ts

import * as path from "path"
import * as fs from "fs/promises"
import * as os from "os"
import * as vscode from "vscode"

import { parseMentions } from "../index"
import { UrlContentFetcher } from "../../../services/browser/UrlContentFetcher"

// Mock vscode
vi.mock("vscode", () => ({
	window: {
		showErrorMessage: vi.fn(),
	},
}))

// Mock i18n
vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string) => key),
}))

describe("parseMentions - URL error handling", () => {
	let mockUrlContentFetcher: UrlContentFetcher
	let consoleErrorSpy: any

	beforeEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		mockUrlContentFetcher = {
			launchBrowser: vi.fn(),
			urlToMarkdown: vi.fn(),
			closeBrowser: vi.fn(),
		} as any
	})

	it("should handle timeout errors with appropriate message", async () => {
		const timeoutError = new Error("Navigation timeout of 30000 ms exceeded")
		vi.mocked(mockUrlContentFetcher.urlToMarkdown).mockRejectedValue(timeoutError)

		const result = await parseMentions("Check @https://example.com", "/test", mockUrlContentFetcher)

		expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching URL https://example.com:", timeoutError)
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("common:errors.url_fetch_error_with_url")
		expect(result.text).toContain("Error fetching content: Navigation timeout of 30000 ms exceeded")
	})

	it("should handle DNS resolution errors", async () => {
		const dnsError = new Error("net::ERR_NAME_NOT_RESOLVED")
		vi.mocked(mockUrlContentFetcher.urlToMarkdown).mockRejectedValue(dnsError)

		const result = await parseMentions("Check @https://nonexistent.example", "/test", mockUrlContentFetcher)

		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("common:errors.url_fetch_error_with_url")
		expect(result.text).toContain("Error fetching content: net::ERR_NAME_NOT_RESOLVED")
	})

	it("should handle network disconnection errors", async () => {
		const networkError = new Error("net::ERR_INTERNET_DISCONNECTED")
		vi.mocked(mockUrlContentFetcher.urlToMarkdown).mockRejectedValue(networkError)

		const result = await parseMentions("Check @https://example.com", "/test", mockUrlContentFetcher)

		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("common:errors.url_fetch_error_with_url")
		expect(result.text).toContain("Error fetching content: net::ERR_INTERNET_DISCONNECTED")
	})

	it("should handle 403 Forbidden errors", async () => {
		const forbiddenError = new Error("403 Forbidden")
		vi.mocked(mockUrlContentFetcher.urlToMarkdown).mockRejectedValue(forbiddenError)

		const result = await parseMentions("Check @https://example.com", "/test", mockUrlContentFetcher)

		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("common:errors.url_fetch_error_with_url")
		expect(result.text).toContain("Error fetching content: 403 Forbidden")
	})

	it("should handle 404 Not Found errors", async () => {
		const notFoundError = new Error("404 Not Found")
		vi.mocked(mockUrlContentFetcher.urlToMarkdown).mockRejectedValue(notFoundError)

		const result = await parseMentions("Check @https://example.com/missing", "/test", mockUrlContentFetcher)

		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("common:errors.url_fetch_error_with_url")
		expect(result.text).toContain("Error fetching content: 404 Not Found")
	})

	it("should handle generic errors with fallback message", async () => {
		const genericError = new Error("Some unexpected error")
		vi.mocked(mockUrlContentFetcher.urlToMarkdown).mockRejectedValue(genericError)

		const result = await parseMentions("Check @https://example.com", "/test", mockUrlContentFetcher)

		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("common:errors.url_fetch_error_with_url")
		expect(result.text).toContain("Error fetching content: Some unexpected error")
	})

	it("should handle non-Error objects thrown", async () => {
		const nonErrorObject = { code: "UNKNOWN", details: "Something went wrong" }
		vi.mocked(mockUrlContentFetcher.urlToMarkdown).mockRejectedValue(nonErrorObject)

		const result = await parseMentions("Check @https://example.com", "/test", mockUrlContentFetcher)

		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("common:errors.url_fetch_error_with_url")
		expect(result.text).toContain("Error fetching content:")
	})

	it("should handle browser launch errors correctly", async () => {
		const launchError = new Error("Failed to launch browser")
		vi.mocked(mockUrlContentFetcher.launchBrowser).mockRejectedValue(launchError)

		const result = await parseMentions("Check @https://example.com", "/test", mockUrlContentFetcher)

		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
			"Error fetching content for https://example.com: Failed to launch browser",
		)
		expect(result.text).toContain("Error fetching content: Failed to launch browser")
		// Should not attempt to fetch URL if browser launch failed
		expect(mockUrlContentFetcher.urlToMarkdown).not.toHaveBeenCalled()
	})

	it("should handle browser launch errors without message property", async () => {
		const launchError = "String error"
		vi.mocked(mockUrlContentFetcher.launchBrowser).mockRejectedValue(launchError)

		const result = await parseMentions("Check @https://example.com", "/test", mockUrlContentFetcher)

		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
			"Error fetching content for https://example.com: String error",
		)
		expect(result.text).toContain("Error fetching content: String error")
	})

	it("should successfully fetch URL content when no errors occur", async () => {
		vi.mocked(mockUrlContentFetcher.urlToMarkdown).mockResolvedValue("# Example Content\n\nThis is the content.")

		const result = await parseMentions("Check @https://example.com", "/test", mockUrlContentFetcher)

		expect(vscode.window.showErrorMessage).not.toHaveBeenCalled()
		expect(result.text).toContain('<url_content url="https://example.com">')
		expect(result.text).toContain("# Example Content\n\nThis is the content.")
		expect(result.text).toContain("</url_content>")
	})

	it("should handle multiple URLs with mixed success and failure", async () => {
		vi.mocked(mockUrlContentFetcher.urlToMarkdown)
			.mockResolvedValueOnce("# First Site")
			.mockRejectedValueOnce(new Error("timeout"))

		const result = await parseMentions(
			"Check @https://example1.com and @https://example2.com",
			"/test",
			mockUrlContentFetcher,
		)

		expect(result.text).toContain('<url_content url="https://example1.com">')
		expect(result.text).toContain("# First Site")
		expect(result.text).toContain('<url_content url="https://example2.com">')
		expect(result.text).toContain("Error fetching content: timeout")
	})
})

describe("parseMentions - file token budget", () => {
	let mockUrlContentFetcher: UrlContentFetcher
	let tempDir: string

	beforeEach(async () => {
		vi.clearAllMocks()

		mockUrlContentFetcher = {
			launchBrowser: vi.fn(),
			urlToMarkdown: vi.fn(),
			closeBrowser: vi.fn(),
		} as any

		// Create a temp directory for test files
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mentions-test-"))
	})

	afterEach(async () => {
		// Clean up temp directory
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	it("should truncate large files when maxFileTokenBudget is specified", async () => {
		// Create a large file with many lines
		const lines = Array.from(
			{ length: 1000 },
			(_, i) => `Line ${i + 1}: This is some content that will be repeated to make the file larger.`,
		)
		const largeContent = lines.join("\n")
		const filePath = path.join(tempDir, "large-file.txt")
		await fs.writeFile(filePath, largeContent, "utf8")

		// Use a small token budget to force truncation
		const result = await parseMentions(
			`Check @/${path.basename(filePath)}`,
			tempDir,
			mockUrlContentFetcher,
			undefined,
			undefined,
			false,
			true,
			50,
			undefined,
			50, // Small token budget
		)

		// Should contain truncation message
		expect(result.text).toContain("[File truncated:")
		expect(result.text).toContain("within token budget of 50")
		expect(result.text).toContain("Use the read_file tool to examine specific sections")
	})

	it("should read entire small file when within token budget", async () => {
		// Create a small file
		const smallContent = "Line 1: Hello\nLine 2: World"
		const filePath = path.join(tempDir, "small-file.txt")
		await fs.writeFile(filePath, smallContent, "utf8")

		// Use a large token budget
		const result = await parseMentions(
			`Check @/${path.basename(filePath)}`,
			tempDir,
			mockUrlContentFetcher,
			undefined,
			undefined,
			false,
			true,
			50,
			undefined,
			10000, // Large token budget
		)

		// Should not contain truncation message
		expect(result.text).not.toContain("[File truncated:")
		expect(result.text).toContain("1 | Line 1: Hello")
		expect(result.text).toContain("2 | Line 2: World")
	})

	it("should fall back to line-based reading when no token budget specified", async () => {
		// Create a file
		const content = "Line 1: Hello\nLine 2: World\nLine 3: Test"
		const filePath = path.join(tempDir, "test-file.txt")
		await fs.writeFile(filePath, content, "utf8")

		// Don't specify token budget
		const result = await parseMentions(
			`Check @/${path.basename(filePath)}`,
			tempDir,
			mockUrlContentFetcher,
			undefined,
			undefined,
			false,
			true,
			50,
			undefined, // No maxReadFileLine
			undefined, // No maxFileTokenBudget
		)

		// Should read the full file
		expect(result.text).toContain("1 | Line 1: Hello")
		expect(result.text).toContain("2 | Line 2: World")
		expect(result.text).toContain("3 | Line 3: Test")
	})
})
