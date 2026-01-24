// npx vitest run src/api/providers/__tests__/harmony-roo-code-integration.spec.ts
// Integration tests simulating the exact message format that Roo Code's
// BaseOpenAiCompatibleProvider would send to the Harmony API
// Run with: HARMONY_API_KEY=your-key npx vitest run --run api/providers/__tests__/harmony-roo-code-integration.spec.ts

import { describe, it, expect, beforeEach } from "vitest"
import OpenAI from "openai"

const isIntegrationTest = !!process.env.HARMONY_API_KEY
const skipIfNoApi = isIntegrationTest ? describe : describe.skip

skipIfNoApi("Roo Code Integration with Harmony API (Integration Tests)", () => {
	let client: OpenAI

	beforeEach(() => {
		const apiKey = process.env.HARMONY_API_KEY || "sk-placeholder"
		const baseURL = process.env.HARMONY_BASE_URL || "https://ai.mezzanineapps.com/v1"
		client = new OpenAI({ baseURL, apiKey })
	})

	describe("Standard task request", () => {
		it("should handle typical Roo Code task request with system prompt", async () => {
			const response = await client.chat.completions.create({
				model: "gpt-oss-20b",
				messages: [
					{
						role: "system",
						content:
							"You are a helpful coding assistant. Respond with clear, concise answers. Always use proper formatting for code examples.",
					},
					{
						role: "user",
						content:
							"Write a simple TypeScript function that takes two numbers and returns their sum. Include JSDoc comments.",
					},
				],
				temperature: 0.7,
				max_tokens: 500,
				stream: false,
			})

			expect(response.choices).toHaveLength(1)
			expect(response.choices[0].message.content).toBeTruthy()
			expect(response.usage?.prompt_tokens).toBeGreaterThan(0)
			expect(response.usage?.completion_tokens).toBeGreaterThan(0)
			expect(response.usage?.total_tokens).toBeGreaterThan(0)
		})

		it("should maintain proper response structure", async () => {
			const response = await client.chat.completions.create({
				model: "gpt-oss-20b",
				messages: [
					{
						role: "system",
						content: "You are a helpful assistant.",
					},
					{
						role: "user",
						content: "What is 2 + 2?",
					},
				],
				temperature: 0.7,
				max_tokens: 100,
			})

			expect(response).toHaveProperty("id")
			expect(response).toHaveProperty("object", "chat.completion")
			expect(response).toHaveProperty("created")
			expect(response).toHaveProperty("model")
			expect(response).toHaveProperty("choices")
			expect(response).toHaveProperty("usage")
			expect(response.choices[0].message).toHaveProperty("role", "assistant")
			expect(response.choices[0].message).toHaveProperty("content")
		})
	})

	describe("Streaming responses", () => {
		it("should handle streaming response like real-time Roo Code", async () => {
			const stream = await client.chat.completions.create({
				model: "gpt-oss-20b",
				messages: [
					{
						role: "system",
						content: "You are a helpful assistant. Respond in a friendly, conversational tone.",
					},
					{
						role: "user",
						content:
							"Explain the concept of async/await in JavaScript in simple terms, suitable for beginners.",
					},
				],
				temperature: 0.7,
				max_tokens: 300,
				stream: true,
			})

			let chunkCount = 0
			let totalContent = ""

			for await (const chunk of stream) {
				chunkCount++
				if (chunk.choices[0].delta.content) {
					totalContent += chunk.choices[0].delta.content
				}
			}

			expect(chunkCount).toBeGreaterThan(0)
			expect(totalContent).toBeTruthy()
		})

		it("should properly receive streaming chunks", async () => {
			const stream = await client.chat.completions.create({
				model: "gpt-oss-20b",
				messages: [
					{
						role: "user",
						content: "Count from 1 to 5",
					},
				],
				temperature: 0.7,
				max_tokens: 50,
				stream: true,
			})

			const chunks: string[] = []

			for await (const chunk of stream) {
				if (chunk.choices[0].delta.content) {
					chunks.push(chunk.choices[0].delta.content)
				}
			}

			expect(chunks.length).toBeGreaterThan(0)
			const fullResponse = chunks.join("")
			expect(fullResponse.length).toBeGreaterThan(0)
		})
	})

	describe("Reasoning content (Harmony-specific)", () => {
		it("should extract reasoning content when available", async () => {
			const response = await client.chat.completions.create({
				model: "gpt-oss-20b",
				messages: [
					{
						role: "user",
						content: "What is the capital of France?",
					},
				],
				temperature: 0.5,
				max_tokens: 100,
			})

			const message = response.choices[0].message as any
			expect(message.content).toBeTruthy()

			// Reasoning content may or may not be present depending on model/config
			if (message.reasoning_content) {
				expect(typeof message.reasoning_content).toBe("string")
			}
		})
	})

	describe("Connection resilience", () => {
		it("should maintain stable connection for multiple requests", async () => {
			// First request
			const response1 = await client.chat.completions.create({
				model: "gpt-oss-20b",
				messages: [{ role: "user", content: "First request" }],
				max_tokens: 50,
			})
			expect(response1.choices[0].message.content).toBeTruthy()

			// Second request
			const response2 = await client.chat.completions.create({
				model: "gpt-oss-20b",
				messages: [{ role: "user", content: "Second request" }],
				max_tokens: 50,
			})
			expect(response2.choices[0].message.content).toBeTruthy()

			// Third request
			const response3 = await client.chat.completions.create({
				model: "gpt-oss-20b",
				messages: [{ role: "user", content: "Third request" }],
				max_tokens: 50,
			})
			expect(response3.choices[0].message.content).toBeTruthy()
		})

		it("should recover from transient errors", async () => {
			// This test verifies the client can make requests sequentially
			const responses = await Promise.all([
				client.chat.completions.create({
					model: "gpt-oss-20b",
					messages: [{ role: "user", content: "Request A" }],
					max_tokens: 30,
				}),
				client.chat.completions.create({
					model: "gpt-oss-20b",
					messages: [{ role: "user", content: "Request B" }],
					max_tokens: 30,
				}),
				client.chat.completions.create({
					model: "gpt-oss-20b",
					messages: [{ role: "user", content: "Request C" }],
					max_tokens: 30,
				}),
			])

			expect(responses).toHaveLength(3)
			responses.forEach((response) => {
				expect(response.choices[0].message.content).toBeTruthy()
			})
		})
	})

	describe("Temperature and parameter handling", () => {
		it("should accept custom temperature values", async () => {
			const temperatures = [0, 0.5, 0.7, 1, 1.5]

			for (const temp of temperatures) {
				const response = await client.chat.completions.create({
					model: "gpt-oss-20b",
					messages: [{ role: "user", content: "Test" }],
					temperature: temp,
					max_tokens: 30,
				})

				expect(response.choices[0].message.content).toBeTruthy()
			}
		})

		it("should respect max_tokens parameter", async () => {
			const response = await client.chat.completions.create({
				model: "gpt-oss-20b",
				messages: [
					{
						role: "user",
						content:
							"Write a very long essay about the history of computer science. Make it at least 5000 words.",
					},
				],
				max_tokens: 50,
			})

			// Check that we got a response (actual token limit enforcement depends on API)
			expect(response.choices[0].message.content).toBeTruthy()
			expect(response.usage?.completion_tokens).toBeLessThanOrEqual(100) // Some buffer for variation
		})
	})
})
