// npx vitest core/mentions/__tests__/fetchUrlContent.spec.ts

import axios from "axios"

import { fetchUrlContent } from "../fetchUrlContent"

vi.mock("axios")

describe("fetchUrlContent", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should fetch and extract text from HTML content", async () => {
		vi.mocked(axios.get).mockResolvedValueOnce({
			headers: { "content-type": "text/html; charset=utf-8" },
			data: `
				<html>
					<head><title>Test Page</title></head>
					<body>
						<script>console.log("ignore me")</script>
						<style>.ignore { display: none; }</style>
						<nav>Navigation links</nav>
						<main>
							<h1>Hello World</h1>
							<p>This is the main content of the page.</p>
						</main>
						<footer>Footer content</footer>
					</body>
				</html>
			`,
		})

		const result = await fetchUrlContent("https://example.com")

		expect(result.url).toBe("https://example.com")
		expect(result.content).toContain("Hello World")
		expect(result.content).toContain("This is the main content of the page.")
		// Script/style/nav/footer should be removed
		expect(result.content).not.toContain("ignore me")
		expect(result.content).not.toContain("Navigation links")
		expect(result.content).not.toContain("Footer content")
		expect(result.truncated).toBe(false)
	})

	it("should return raw text for non-HTML content", async () => {
		vi.mocked(axios.get).mockResolvedValueOnce({
			headers: { "content-type": "text/plain" },
			data: "Plain text content from the URL",
		})

		const result = await fetchUrlContent("https://example.com/file.txt")

		expect(result.content).toBe("Plain text content from the URL")
		expect(result.truncated).toBe(false)
	})

	it("should handle JSON content type as raw text", async () => {
		vi.mocked(axios.get).mockResolvedValueOnce({
			headers: { "content-type": "application/json" },
			data: '{"key": "value"}',
		})

		const result = await fetchUrlContent("https://example.com/api/data")

		expect(result.content).toBe('{"key": "value"}')
	})

	it("should truncate content that exceeds the max length", async () => {
		const longContent = "x".repeat(60_000)
		vi.mocked(axios.get).mockResolvedValueOnce({
			headers: { "content-type": "text/plain" },
			data: longContent,
		})

		const result = await fetchUrlContent("https://example.com/large")

		expect(result.truncated).toBe(true)
		expect(result.content.length).toBe(50_000)
	})

	it("should propagate axios errors", async () => {
		vi.mocked(axios.get).mockRejectedValueOnce(new Error("Request failed with status code 404"))

		await expect(fetchUrlContent("https://example.com/not-found")).rejects.toThrow(
			"Request failed with status code 404",
		)
	})

	it("should use body as fallback when no main/article element exists", async () => {
		vi.mocked(axios.get).mockResolvedValueOnce({
			headers: { "content-type": "text/html" },
			data: `
				<html>
					<body>
						<div>Some body content without semantic elements</div>
					</body>
				</html>
			`,
		})

		const result = await fetchUrlContent("https://example.com/simple")

		expect(result.content).toContain("Some body content without semantic elements")
	})

	it("should handle missing content-type header", async () => {
		vi.mocked(axios.get).mockResolvedValueOnce({
			headers: {},
			data: "Some raw content",
		})

		const result = await fetchUrlContent("https://example.com/unknown")

		// With no content-type, it falls through to the non-HTML path
		expect(result.content).toBe("Some raw content")
	})
})
