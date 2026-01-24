// npx vitest run src/api/providers/__tests__/harmony-edge-cases.spec.ts
// Integration tests for Harmony API edge cases
// Run with: HARMONY_API_KEY=your-key npx vitest run --run api/providers/__tests__/harmony-edge-cases.spec.ts

import { describe, it, expect, beforeEach, vi } from "vitest"
import OpenAI from "openai"

const isIntegrationTest = !!process.env.HARMONY_API_KEY
const skipIfNoApi = isIntegrationTest ? describe : describe.skip

skipIfNoApi("Harmony API Edge Cases (Integration Tests)", () => {
	let client: OpenAI

	beforeEach(() => {
		const apiKey = process.env.HARMONY_API_KEY || "sk-placeholder"
		const baseURL = process.env.HARMONY_BASE_URL || "https://ai.mezzanineapps.com/v1"
		client = new OpenAI({ baseURL, apiKey })
	})

	it("should handle large input (testing context window)", async () => {
		const largeInput = "Summarize this text: " + "Lorem ipsum dolor sit amet. ".repeat(500)
		const response = await client.chat.completions.create({
			model: "gpt-oss-20b",
			messages: [{ role: "user", content: largeInput }],
			max_tokens: 100,
		})

		expect(response.choices).toHaveLength(1)
		expect(response.choices[0].message.content).toBeTruthy()
		expect(response.usage?.prompt_tokens).toBeGreaterThan(0)
	})

	it("should handle conversation with multiple messages", async () => {
		const response = await client.chat.completions.create({
			model: "gpt-oss-20b",
			messages: [
				{ role: "user", content: "What is your name?" },
				{ role: "assistant", content: "I'm Claude, an AI assistant." },
				{ role: "user", content: "What can you help me with?" },
			],
			max_tokens: 100,
		})

		expect(response.choices).toHaveLength(1)
		expect(response.choices[0].message.content).toBeTruthy()
	})

	it("should return proper error for invalid API key", async () => {
		const badClient = new OpenAI({
			baseURL: "https://ai.mezzanineapps.com/v1",
			apiKey: "invalid-key-12345",
		})

		await expect(
			badClient.chat.completions.create({
				model: "gpt-oss-20b",
				messages: [{ role: "user", content: "Test" }],
			}),
		).rejects.toThrow()
	})

	it("should return proper error for unknown model", async () => {
		await expect(
			client.chat.completions.create({
				model: "unknown-model-xyz",
				messages: [{ role: "user", content: "Test" }],
			}),
		).rejects.toThrow()
	})

	it("should list available models", async () => {
		const models = await client.models.list()

		expect(models.data).toBeDefined()
		expect(Array.isArray(models.data)).toBe(true)
		if (models.data.length > 0) {
			expect(models.data[0].id).toBeTruthy()
		}
	})

	it("should handle high temperature (creative output)", async () => {
		const response = await client.chat.completions.create({
			model: "gpt-oss-20b",
			messages: [{ role: "user", content: "Generate a creative story starter in one sentence" }],
			temperature: 1.5,
			max_tokens: 100,
		})

		expect(response.choices[0].message.content).toBeTruthy()
	})

	it("should handle zero temperature (deterministic)", async () => {
		const response = await client.chat.completions.create({
			model: "gpt-oss-20b",
			messages: [{ role: "user", content: "What is 2+2?" }],
			temperature: 0,
			max_tokens: 50,
		})

		expect(response.choices[0].message.content).toBeTruthy()
	})
})
