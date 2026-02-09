// npx vitest utils/__tests__/tiktoken.spec.ts

import type { RooContentBlock } from "../../core/task-persistence/apiMessages"
import { tiktoken } from "../tiktoken"

describe("tiktoken", () => {
	it("should return 0 for empty content array", async () => {
		const result = await tiktoken([])
		expect(result).toBe(0)
	})

	it("should correctly count tokens for text content", async () => {
		const content: RooContentBlock[] = [{ type: "text", text: "Hello world" }]

		const result = await tiktoken(content)
		// We can't predict the exact token count without mocking,
		// but we can verify it's a positive number
		expect(result).toEqual(3)
	})

	it("should handle empty text content", async () => {
		const content: RooContentBlock[] = [{ type: "text", text: "" }]

		const result = await tiktoken(content)
		expect(result).toBe(0)
	})

	it("should not throw on text content with special tokens", async () => {
		const content: RooContentBlock[] = [{ type: "text", text: "something<|endoftext|>something" }]

		const result = await tiktoken(content)
		expect(result).toBeGreaterThan(0)
	})

	it("should handle missing text content", async () => {
		// Using 'as any' to bypass TypeScript's type checking for this test case
		// since we're specifically testing how the function handles undefined text
		const content = [{ type: "text" }] as any as RooContentBlock[]

		const result = await tiktoken(content)
		expect(result).toBe(0)
	})

	it("should correctly count tokens for image content with data", async () => {
		const base64Data =
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
		const content: RooContentBlock[] = [
			{
				type: "image",
				image: base64Data,
				mediaType: "image/png",
			},
		]

		const result = await tiktoken(content)
		// For images, we expect a token count based on the square root of the data length
		// plus the fudge factor
		const expectedMinTokens = Math.ceil(Math.sqrt(base64Data.length))
		expect(result).toBeGreaterThanOrEqual(expectedMinTokens)
	})

	it("should use conservative estimate for image content without data", async () => {
		// Using 'as any' to bypass TypeScript's type checking for this test case
		// since we're specifically testing the fallback behavior
		const content = [
			{
				type: "image",
				source: {
					type: "base64",
					media_type: "image/png",
					// data is intentionally missing to test fallback
				},
			},
		] as any as RooContentBlock[]

		const result = await tiktoken(content)
		// Conservative estimate is 300 tokens, plus the fudge factor
		const expectedMinTokens = 300
		expect(result).toBeGreaterThanOrEqual(expectedMinTokens)
	})

	it("should correctly count tokens for mixed content", async () => {
		const base64Data =
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
		const content: RooContentBlock[] = [
			{ type: "text", text: "Hello world" },
			{
				type: "image",
				image: base64Data,
				mediaType: "image/png",
			},
			{ type: "text", text: "Goodbye world" },
		]

		const result = await tiktoken(content)
		// We expect a positive token count for mixed content
		expect(result).toBeGreaterThan(0)
	})

	it("should apply a fudge factor to the token count", async () => {
		// We can test the fudge factor by comparing the token count with a rough estimate
		const content: RooContentBlock[] = [{ type: "text", text: "Test" }]

		const result = await tiktoken(content)

		// Run the function again with the same content to get a consistent result
		const result2 = await tiktoken(content)

		// Both calls should return the same token count
		expect(result).toBe(result2)

		// The result should be greater than 0
		expect(result).toBeGreaterThan(0)
	})

	it("should reuse the encoder for multiple calls", async () => {
		// We can't directly test the caching behavior without mocking,
		// but we can test that multiple calls with the same content return the same result
		// which indirectly verifies the encoder is working consistently

		const content: RooContentBlock[] = [{ type: "text", text: "Hello world" }]

		const result1 = await tiktoken(content)
		const result2 = await tiktoken(content)

		// Both calls should return the same token count
		expect(result1).toBe(result2)
	})

	describe("tool_use blocks", () => {
		it("should count tokens for tool_use blocks with simple arguments", async () => {
			const content = [
				{
					type: "tool-call",
					toolCallId: "tool_123",
					toolName: "read_file",
					input: { path: "/src/main.ts" },
				},
			] as RooContentBlock[]

			const result = await tiktoken(content)
			// Should return a positive token count for the serialized tool call
			expect(result).toBeGreaterThan(0)
		})

		it("should count tokens for tool_use blocks with complex arguments", async () => {
			const content = [
				{
					type: "tool-call",
					toolCallId: "tool_456",
					toolName: "write_to_file",
					input: {
						path: "/src/components/Button.tsx",
						content:
							"import React from 'react';\n\nexport const Button = ({ children, onClick }) => {\n  return <button onClick={onClick}>{children}</button>;\n};",
					},
				},
			] as RooContentBlock[]

			const result = await tiktoken(content)
			// Should return a token count reflecting the larger content
			expect(result).toBeGreaterThan(10)
		})

		it("should handle tool_use blocks with empty input", async () => {
			const content = [
				{
					type: "tool-call",
					toolCallId: "tool_789",
					toolName: "list_files",
					input: {},
				},
			] as RooContentBlock[]

			const result = await tiktoken(content)
			// Should still count the tool name (and empty args)
			expect(result).toBeGreaterThan(0)
		})
	})

	describe("tool_result blocks", () => {
		it("should count tokens for tool_result blocks with string content", async () => {
			const content = [
				{
					type: "tool-result",
					toolCallId: "tool_123",
					toolName: "",
					output: { type: "text" as const, value: "File content: export const foo = 'bar';" },
				},
			] as RooContentBlock[]

			const result = await tiktoken(content)
			// Should return a positive token count
			expect(result).toBeGreaterThan(0)
		})

		it("should count tokens for tool_result blocks with array content", async () => {
			const content = [
				{
					type: "tool-result" as const,
					toolCallId: "tool_456",
					toolName: "",
					output: {
						type: "content" as const,
						value: [
							{ type: "text" as const, text: "First part of the result" },
							{ type: "text" as const, text: "Second part of the result" },
						],
					},
				},
			] as RooContentBlock[]

			const result = await tiktoken(content)
			// Should count tokens from all text parts
			expect(result).toBeGreaterThan(0)
		})

		it("should count tokens for tool_result blocks with error flag", async () => {
			const content = [
				{
					type: "tool-result",
					toolCallId: "tool_789",
					toolName: "",
					output: { type: "text" as const, value: "Error: File not found" },
				},
			] as RooContentBlock[]

			const result = await tiktoken(content)
			// Should include the error indicator and content
			expect(result).toBeGreaterThan(0)
		})

		it("should handle tool_result blocks with image content in array", async () => {
			const content = [
				{
					type: "tool-result" as const,
					toolCallId: "tool_abc",
					toolName: "",
					output: {
						type: "content" as const,
						value: [
							{ type: "text" as const, text: "Screenshot captured" },
							{ type: "image-data" as const, data: "abc123", mediaType: "image/png" },
						],
					},
				},
			] as RooContentBlock[]

			const result = await tiktoken(content)
			// Should count text and include placeholder for images
			expect(result).toBeGreaterThan(0)
		})
	})

	describe("mixed content with tools", () => {
		it("should count tokens for conversation with tool_use and tool_result", async () => {
			const content = [
				{ type: "text", text: "Let me read that file for you." },
				{
					type: "tool-call",
					toolCallId: "tool_123",
					toolName: "read_file",
					input: { path: "/src/index.ts" },
				},
			] as RooContentBlock[]

			const result = await tiktoken(content)
			// Should count both text and tool_use tokens
			expect(result).toBeGreaterThan(5)
		})

		it("should produce larger count for tool_result with large content vs small content", async () => {
			const smallContent = [
				{
					type: "tool-result",
					toolCallId: "tool_1",
					toolName: "",
					output: { type: "text" as const, value: "OK" },
				},
			] as RooContentBlock[]

			const largeContent = [
				{
					type: "tool-result",
					toolCallId: "tool_2",
					toolName: "",
					output: {
						type: "text" as const,
						value: "This is a much longer result that contains a lot more text and should therefore have a significantly higher token count than the small content.",
					},
				},
			] as RooContentBlock[]

			const smallResult = await tiktoken(smallContent)
			const largeResult = await tiktoken(largeContent)

			// Large content should have more tokens
			expect(largeResult).toBeGreaterThan(smallResult)
		})
	})
})
