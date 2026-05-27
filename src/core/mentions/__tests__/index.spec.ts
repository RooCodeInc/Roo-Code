// npx vitest core/mentions/__tests__/index.spec.ts

import * as vscode from "vscode"

import { parseMentions } from "../index"

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

// Mock fetchUrlContent
vi.mock("../fetchUrlContent", () => ({
	fetchUrlContent: vi.fn().mockResolvedValue({
		url: "https://example.com",
		content: "Example page content here",
		truncated: false,
	}),
}))

describe("parseMentions - URL mention handling", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should replace URL mentions with quoted URL reference indicating content", async () => {
		const result = await parseMentions("Check @https://example.com", "/test")

		expect(result.text).toContain("'https://example.com' (see below for fetched content)")
	})

	it("should produce a content block with fetched URL content", async () => {
		const result = await parseMentions("Check @https://example.com", "/test")

		expect(result.contentBlocks).toHaveLength(1)
		expect(result.contentBlocks[0].type).toBe("url")
		expect(result.contentBlocks[0].content).toContain("Example page content here")
		expect(result.contentBlocks[0].content).toContain("[url_content for 'https://example.com']")
	})

	it("should handle URL fetch errors gracefully", async () => {
		const { fetchUrlContent } = await import("../fetchUrlContent")
		vi.mocked(fetchUrlContent).mockRejectedValueOnce(new Error("Network timeout"))

		const result = await parseMentions("Check @https://example.com", "/test")

		expect(result.contentBlocks).toHaveLength(1)
		expect(result.contentBlocks[0].type).toBe("url")
		expect(result.contentBlocks[0].content).toContain("Error fetching URL content: Network timeout")
	})

	it("should indicate truncation when content is truncated", async () => {
		const { fetchUrlContent } = await import("../fetchUrlContent")
		vi.mocked(fetchUrlContent).mockResolvedValueOnce({
			url: "https://example.com",
			content: "Truncated content...",
			truncated: true,
		})

		const result = await parseMentions("Check @https://example.com", "/test")

		expect(result.contentBlocks).toHaveLength(1)
		expect(result.contentBlocks[0].content).toContain("[Content truncated due to length]")
	})
})
