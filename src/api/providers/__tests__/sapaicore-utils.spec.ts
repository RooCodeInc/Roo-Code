// npx vitest run src/api/providers/__tests__/sapaicore-utils.spec.ts

import {
	formatMessagesForConverseAPI,
	applyCacheControlToMessages,
	prepareSystemMessages,
	prepareGeminiRequestPayload,
	processGeminiStreamChunk,
	parseJsonSafely,
} from "../sapaicore"
import { sapAiCoreModels } from "@roo-code/types"
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages"

describe("SAP AI Core Utility Functions", () => {
	describe("prepareSystemMessages", () => {
		it("should return undefined for empty system prompt", () => {
			const result = prepareSystemMessages("", false)
			expect(result).toBeUndefined()
		})

		it("should return text only for system prompt without caching", () => {
			const result = prepareSystemMessages("You are a helpful assistant", false)
			expect(result).toEqual([{ text: "You are a helpful assistant" }])
		})

		it("should return text with cache point when caching enabled", () => {
			const result = prepareSystemMessages("You are a helpful assistant", true)
			expect(result).toEqual([{ text: "You are a helpful assistant" }, { cachePoint: { type: "default" } }])
		})
	})

	describe("applyCacheControlToMessages", () => {
		const mockMessages = [
			{ role: "user", content: [{ text: "First message" }] },
			{ role: "assistant", content: [{ text: "Response" }] },
			{ role: "user", content: [{ text: "Second message" }] },
			{ role: "assistant", content: [{ text: "Another response" }] },
			{ role: "user", content: [{ text: "Third message" }] },
		]

		it("should add cache points to specified message indices", () => {
			const result = applyCacheControlToMessages(mockMessages, 4, 2)

			// Check that cache points were added to indices 2 and 4
			expect(result[2].content).toContainEqual({
				cachePoint: { type: "default" },
			})
			expect(result[4].content).toContainEqual({
				cachePoint: { type: "default" },
			})

			// Check that other messages are unchanged
			expect(result[0].content).not.toContainEqual({
				cachePoint: { type: "default" },
			})
			expect(result[1].content).not.toContainEqual({
				cachePoint: { type: "default" },
			})
			expect(result[3].content).not.toContainEqual({
				cachePoint: { type: "default" },
			})
		})

		it("should handle messages without content arrays", () => {
			const messagesWithoutArrays = [
				{ role: "user", content: "Simple text" },
				{ role: "assistant", content: "Response" },
			]

			const result = applyCacheControlToMessages(messagesWithoutArrays, 1, 0)

			// Should return messages unchanged if content is not an array
			expect(result[0]).toEqual(messagesWithoutArrays[0])
			expect(result[1]).toEqual(messagesWithoutArrays[1])
		})
	})

	describe("formatMessagesForConverseAPI", () => {
		it("should format simple text messages", () => {
			const messages = [
				{ role: "user" as const, content: "Hello" },
				{ role: "assistant" as const, content: "Hi there!" },
			]

			const result = formatMessagesForConverseAPI(messages)

			expect(result).toEqual([
				{ role: "user", content: [{ text: "Hello" }] },
				{ role: "assistant", content: [{ text: "Hi there!" }] },
			])
		})

		it("should format messages with text and image content", () => {
			const messages = [
				{
					role: "user" as const,
					content: [
						{ type: "text", text: "What's in this image?" },
						{
							type: "image",
							source: {
								type: "base64",
								media_type: "image/jpeg",
								data: "base64imagedata",
							},
						},
					],
				},
			] as MessageParam[]

			const result = formatMessagesForConverseAPI(messages)

			expect(result[0].role).toBe("user")
			expect(result[0].content).toHaveLength(2)
			expect(result[0].content[0]).toEqual({ text: "What's in this image?" })
			expect(result[0].content[1]).toHaveProperty("image")
		})

		it("should handle unsupported content types gracefully", () => {
			const messages = [
				{
					role: "user" as const,
					content: [{ type: "text", text: "Hello" }, { type: "unsupported", data: "some data" } as any],
				},
			]

			// Mock console.warn to verify it's called
			const consoleSpy = vitest.spyOn(console, "warn").mockImplementation(() => {})

			const result = formatMessagesForConverseAPI(messages)

			expect(result[0].content).toHaveLength(1)
			expect(result[0].content[0]).toEqual({ text: "Hello" })
			expect(consoleSpy).toHaveBeenCalledWith("Unsupported content type: unsupported")

			consoleSpy.mockRestore()
		})
	})

	describe("prepareGeminiRequestPayload", () => {
		const mockModel = {
			id: "gemini-2.5-flash" as const,
			info: sapAiCoreModels["gemini-2.5-flash"],
		}

		it("should prepare basic Gemini payload", () => {
			const messages = [{ role: "user" as const, content: "Hello" }]

			const result = prepareGeminiRequestPayload("You are a helpful assistant", messages, mockModel)

			expect(result).toHaveProperty("contents")
			expect(result).toHaveProperty("systemInstruction")
			expect(result).toHaveProperty("generationConfig")
			expect(result.systemInstruction.parts[0].text).toBe("You are a helpful assistant")
			expect(result.generationConfig.maxOutputTokens).toBe(mockModel.info.maxTokens)
		})

		it("should add thinking config when thinking budget provided", () => {
			const messages = [{ role: "user" as const, content: "Hello" }]

			const result = prepareGeminiRequestPayload(
				"You are a helpful assistant",
				messages,
				mockModel,
				1000, // thinking budget
			)

			expect(result).toHaveProperty("thinkingConfig")
			expect(result.thinkingConfig.thinkingBudget).toBe(1000)
			expect(result.thinkingConfig.includeThoughts).toBe(true)
		})

		it("should not add thinking config when no budget provided", () => {
			const messages = [{ role: "user" as const, content: "Hello" }]

			const result = prepareGeminiRequestPayload("You are a helpful assistant", messages, mockModel)

			expect(result).not.toHaveProperty("thinkingConfig")
		})

		it("should not add thinking config when model doesn't support thinking", () => {
			const nonThinkingModel = {
				id: "gpt-4o" as const,
				info: sapAiCoreModels["gpt-4o"],
			}

			const messages = [{ role: "user" as const, content: "Hello" }]

			const result = prepareGeminiRequestPayload(
				"You are a helpful assistant",
				messages,
				nonThinkingModel,
				1000, // thinking budget
			)

			expect(result).not.toHaveProperty("thinkingConfig")
		})
	})

	describe("processGeminiStreamChunk", () => {
		it("should process regular text content", () => {
			const mockData = {
				text: "Hello world",
				usageMetadata: {
					promptTokenCount: 10,
					candidatesTokenCount: 5,
				},
			}

			const result = processGeminiStreamChunk(mockData)

			expect(result.text).toBe("Hello world")
			expect(result.usageMetadata?.promptTokenCount).toBe(10)
			expect(result.usageMetadata?.candidatesTokenCount).toBe(5)
		})

		it("should process thinking content", () => {
			const mockData = {
				candidates: [
					{
						content: {
							parts: [
								{ thought: true, text: "Let me think about this..." },
								{ thought: true, text: "The answer is clear." },
							],
						},
					},
				],
			}

			const result = processGeminiStreamChunk(mockData)

			expect(result.reasoning).toBe("Let me think about this...\nThe answer is clear.")
		})

		it("should process mixed content (text and thinking)", () => {
			const mockData = {
				candidates: [
					{
						content: {
							parts: [{ thought: true, text: "Thinking..." }, { text: "The answer is 42" }],
						},
					},
				],
			}

			const result = processGeminiStreamChunk(mockData)

			expect(result.reasoning).toBe("Thinking...")
			expect(result.text).toBe("The answer is 42")
		})

		it("should handle empty or malformed data", () => {
			const result1 = processGeminiStreamChunk({})
			expect(result1).toEqual({})

			const result2 = processGeminiStreamChunk(null)
			expect(result2).toEqual({})

			const result3 = processGeminiStreamChunk(undefined)
			expect(result3).toEqual({})
		})

		it("should process complete usage metadata", () => {
			const mockData = {
				usageMetadata: {
					promptTokenCount: 100,
					candidatesTokenCount: 50,
					thoughtsTokenCount: 25,
					cachedContentTokenCount: 10,
				},
			}

			const result = processGeminiStreamChunk(mockData)

			expect(result.usageMetadata?.promptTokenCount).toBe(100)
			expect(result.usageMetadata?.candidatesTokenCount).toBe(50)
			expect(result.usageMetadata?.thoughtsTokenCount).toBe(25)
			expect(result.usageMetadata?.cachedContentTokenCount).toBe(10)
		})
	})

	describe("parseJsonSafely", () => {
		beforeEach(() => {
			// Clear console mocks before each test
			vitest.clearAllMocks()
		})

		describe("valid JSON parsing", () => {
			it("should parse valid JSON strings correctly", () => {
				const validJson = '{"message": "hello", "count": 42}'
				const result = parseJsonSafely(validJson)

				expect(result).toEqual({ message: "hello", count: 42 })
			})

			it("should parse valid JSON arrays", () => {
				const validJsonArray = '["item1", "item2", 3]'
				const result = parseJsonSafely(validJsonArray)

				expect(result).toEqual(["item1", "item2", 3])
			})

			it("should parse valid nested JSON objects", () => {
				const nestedJson = '{"user": {"name": "John", "age": 30}, "active": true}'
				const result = parseJsonSafely(nestedJson)

				expect(result).toEqual({
					user: { name: "John", age: 30 },
					active: true,
				})
			})

			it("should parse JSON with special characters", () => {
				const jsonWithSpecialChars = '{"text": "Hello\\nWorld\\t!", "emoji": "😀"}'
				const result = parseJsonSafely(jsonWithSpecialChars)

				expect(result).toEqual({
					text: "Hello\nWorld\t!",
					emoji: "😀",
				})
			})
		})

		describe("JSON repair functionality", () => {
			it("should fix trailing commas in objects", () => {
				const jsonWithTrailingComma = '{"message": "hello", "count": 42,}'
				const result = parseJsonSafely(jsonWithTrailingComma)

				expect(result).toEqual({ message: "hello", count: 42 })
			})

			it("should fix trailing commas in arrays", () => {
				const jsonWithTrailingComma = '["item1", "item2", 3,]'
				const result = parseJsonSafely(jsonWithTrailingComma)

				expect(result).toEqual(["item1", "item2", 3])
			})

			it("should fix multiple trailing commas", () => {
				const jsonWithMultipleTrailingCommas = '{"items": ["a", "b",], "count": 2,}'
				const result = parseJsonSafely(jsonWithMultipleTrailingCommas)

				expect(result).toEqual({ items: ["a", "b"], count: 2 })
			})

			it("should quote unquoted object keys", () => {
				const jsonWithUnquotedKeys = '{message: "hello", count: 42}'
				const result = parseJsonSafely(jsonWithUnquotedKeys)

				expect(result).toEqual({ message: "hello", count: 42 })
			})

			it("should fix mixed issues (trailing commas and unquoted keys)", () => {
				const malformedJson = '{message: "hello", count: 42, active: true,}'
				const result = parseJsonSafely(malformedJson)

				expect(result).toEqual({ message: "hello", count: 42, active: true })
			})

			it("should handle complex nested objects with multiple issues", () => {
				const complexMalformedJson = '{user: {name: "John", age: 30,}, items: ["a", "b",], active: true,}'
				const result = parseJsonSafely(complexMalformedJson)

				expect(result).toEqual({
					user: { name: "John", age: 30 },
					items: ["a", "b"],
					active: true,
				})
			})

			it("should preserve quoted keys that contain special characters", () => {
				const jsonWithSpecialKeys = '{"special-key": "value1", "another_key": "value2", normalKey: "value3"}'
				const result = parseJsonSafely(jsonWithSpecialKeys)

				expect(result).toEqual({
					"special-key": "value1",
					another_key: "value2",
					normalKey: "value3",
				})
			})

			it("should handle keys with underscores and dollar signs", () => {
				const jsonWithSpecialKeys = '{_private: "private", $special: "special", normal_key: "normal"}'
				const result = parseJsonSafely(jsonWithSpecialKeys)

				expect(result).toEqual({
					_private: "private",
					$special: "special",
					normal_key: "normal",
				})
			})
		})

		describe("error handling", () => {
			it("should throw error for completely invalid JSON that cannot be repaired", () => {
				const consoleSpy = vitest.spyOn(console, "error").mockImplementation(() => {})
				const invalidJson = '{"message": "unclosed string'

				expect(() => parseJsonSafely(invalidJson)).toThrow()
				expect(consoleSpy).toHaveBeenCalledWith("Failed to parse JSON safely:", invalidJson, expect.any(Error))

				consoleSpy.mockRestore()
			})

			it("should throw error for malformed JSON with mismatched brackets", () => {
				const consoleSpy = vitest.spyOn(console, "error").mockImplementation(() => {})
				const invalidJson = '{"message": "hello", "data": {"nested": "value"}'

				expect(() => parseJsonSafely(invalidJson)).toThrow()
				expect(consoleSpy).toHaveBeenCalled()

				consoleSpy.mockRestore()
			})

			it("should throw error for invalid JSON structure", () => {
				const consoleSpy = vitest.spyOn(console, "error").mockImplementation(() => {})
				const invalidJson = "{message: hello}" // unquoted value

				expect(() => parseJsonSafely(invalidJson)).toThrow()
				expect(consoleSpy).toHaveBeenCalled()

				consoleSpy.mockRestore()
			})

			it("should log original string and error when parsing fails", () => {
				const consoleSpy = vitest.spyOn(console, "error").mockImplementation(() => {})
				const invalidJson = "definitely not json"

				expect(() => parseJsonSafely(invalidJson)).toThrow()
				expect(consoleSpy).toHaveBeenCalledWith("Failed to parse JSON safely:", invalidJson, expect.any(Error))

				consoleSpy.mockRestore()
			})

			it("should handle empty strings gracefully", () => {
				const consoleSpy = vitest.spyOn(console, "error").mockImplementation(() => {})

				expect(() => parseJsonSafely("")).toThrow()
				expect(consoleSpy).toHaveBeenCalled()

				consoleSpy.mockRestore()
			})

			it("should handle whitespace-only strings", () => {
				const consoleSpy = vitest.spyOn(console, "error").mockImplementation(() => {})

				expect(() => parseJsonSafely("   \n\t  ")).toThrow()
				expect(consoleSpy).toHaveBeenCalled()

				consoleSpy.mockRestore()
			})
		})

		describe("real-world SAP AI Core scenarios", () => {
			it("should handle typical SAP AI Core streaming response format", () => {
				const sapResponse =
					'{"contentBlockDelta": {"delta": {"text": "Hello world"}}, "metadata": {"usage": {"inputTokens": 10, "outputTokens": 5}}}'
				const result = parseJsonSafely(sapResponse)

				expect(result).toEqual({
					contentBlockDelta: {
						delta: { text: "Hello world" },
					},
					metadata: {
						usage: { inputTokens: 10, outputTokens: 5 },
					},
				})
			})

			it("should handle SAP AI Core response with trailing comma", () => {
				const sapResponseWithComma =
					'{"contentBlockDelta": {"delta": {"text": "Hello"}}, "metadata": {"usage": {"inputTokens": 10,}},}'
				const result = parseJsonSafely(sapResponseWithComma)

				expect(result).toEqual({
					contentBlockDelta: {
						delta: { text: "Hello" },
					},
					metadata: {
						usage: { inputTokens: 10 },
					},
				})
			})

			it("should handle SAP AI Core response with reasoning content", () => {
				const sapResponseWithReasoning =
					'{"contentBlockDelta": {"delta": {"reasoningContent": {"text": "Let me think..."}, "text": "The answer is"}}, "metadata": {"usage": {"totalTokens": 50}}}'
				const result = parseJsonSafely(sapResponseWithReasoning)

				expect(result).toEqual({
					contentBlockDelta: {
						delta: {
							reasoningContent: { text: "Let me think..." },
							text: "The answer is",
						},
					},
					metadata: {
						usage: { totalTokens: 50 },
					},
				})
			})

			it("should handle complex SAP AI Core cache metadata", () => {
				const sapCacheResponse =
					'{"metadata": {"usage": {"inputTokens": 100, "outputTokens": 50, "cacheReadInputTokens": 25, "cacheWriteOutputTokens": 10, "totalTokens": 185,}}}'
				const result = parseJsonSafely(sapCacheResponse)

				expect(result).toEqual({
					metadata: {
						usage: {
							inputTokens: 100,
							outputTokens: 50,
							cacheReadInputTokens: 25,
							cacheWriteOutputTokens: 10,
							totalTokens: 185,
						},
					},
				})
			})
		})

		describe("edge cases", () => {
			it("should handle JSON with null values", () => {
				const jsonWithNull = '{"message": null, "data": {"value": null}}'
				const result = parseJsonSafely(jsonWithNull)

				expect(result).toEqual({
					message: null,
					data: { value: null },
				})
			})

			it("should handle JSON with boolean values", () => {
				const jsonWithBooleans = '{"active": true, "completed": false, "pending": null}'
				const result = parseJsonSafely(jsonWithBooleans)

				expect(result).toEqual({
					active: true,
					completed: false,
					pending: null,
				})
			})

			it("should handle JSON with numeric values including zero", () => {
				const jsonWithNumbers = '{"count": 0, "temperature": 0.5, "negative": -1, "large": 1000000}'
				const result = parseJsonSafely(jsonWithNumbers)

				expect(result).toEqual({
					count: 0,
					temperature: 0.5,
					negative: -1,
					large: 1000000,
				})
			})

			it("should handle deeply nested objects", () => {
				const deeplyNested = '{"level1": {"level2": {"level3": {"level4": {"message": "deep"}}}}}'
				const result = parseJsonSafely(deeplyNested)

				expect(result).toEqual({
					level1: {
						level2: {
							level3: {
								level4: { message: "deep" },
							},
						},
					},
				})
			})

			it("should handle arrays with mixed types", () => {
				const mixedArray = '["string", 42, true, null, {"nested": "object"}]'
				const result = parseJsonSafely(mixedArray)

				expect(result).toEqual(["string", 42, true, null, { nested: "object" }])
			})
		})
	})
})
