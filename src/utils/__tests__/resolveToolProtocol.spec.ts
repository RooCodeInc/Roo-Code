import { describe, it, expect } from "vitest"
import { resolveToolProtocol, detectToolProtocolFromHistory } from "../resolveToolProtocol"
import { TOOL_PROTOCOL, openAiModelInfoSaneDefaults } from "@roo-code/types"
import type { ProviderSettings, ModelInfo } from "@roo-code/types"
import type { Anthropic } from "@anthropic-ai/sdk"

describe("resolveToolProtocol", () => {
	/**
	 * Tool Protocol Resolution:
	 *
	 * Precedence:
	 * 1. Locked Protocol (for resumed tasks - highest priority)
	 * 2. User Preference (toolProtocol setting)
	 * 3. Model Native Tools Support (supportsNativeTools)
	 * 4. Model Default Protocol (defaultToolProtocol)
	 * 5. Fallback to XML
	 */

	describe("Locked Protocol (Precedence Level 1 - Highest Priority)", () => {
		it("should return lockedProtocol when provided", () => {
			const settings: ProviderSettings = {
				toolProtocol: "xml",
				apiProvider: "openai-native",
			}
			// lockedProtocol overrides everything
			const result = resolveToolProtocol(settings, undefined, "native")
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})

		it("should return XML lockedProtocol for resumed tasks that used XML", () => {
			const settings: ProviderSettings = {
				toolProtocol: "native",
				apiProvider: "anthropic",
			}
			// lockedProtocol forces XML for backward compatibility
			const result = resolveToolProtocol(settings, undefined, "xml")
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})

		it("should fall through to user preference when lockedProtocol is undefined", () => {
			const settings: ProviderSettings = {
				toolProtocol: "xml",
				apiProvider: "anthropic",
			}
			// undefined lockedProtocol should use user preference
			const result = resolveToolProtocol(settings, undefined, undefined)
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})
	})

	describe("User Preference (Precedence Level 2)", () => {
		it("should use user preference when no locked protocol", () => {
			const settings: ProviderSettings = {
				toolProtocol: "xml",
				apiProvider: "anthropic",
			}
			const result = resolveToolProtocol(settings)
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})

		it("should use user preference even when model supports native tools", () => {
			const settings: ProviderSettings = {
				toolProtocol: "xml",
				apiProvider: "openai-native",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: true,
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})

		it("should use native when user sets it explicitly", () => {
			const settings: ProviderSettings = {
				toolProtocol: "native",
				apiProvider: "anthropic",
			}
			const result = resolveToolProtocol(settings)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})
	})

	describe("Model Native Tools Support (Precedence Level 3)", () => {
		it("should use native for OpenAI compatible provider when no user preference", () => {
			const settings: ProviderSettings = {
				apiProvider: "openai",
			}
			const result = resolveToolProtocol(settings, openAiModelInfoSaneDefaults)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})

		it("should use Native for OpenAI models when no user preference", () => {
			const settings: ProviderSettings = {
				apiProvider: "openai-native",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: true,
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})

		it("should use Native for Claude models when no user preference", () => {
			const settings: ProviderSettings = {
				apiProvider: "anthropic",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsPromptCache: true,
				supportsNativeTools: true,
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})
	})

	describe("Edge Cases", () => {
		it("should fallback to XML when no preference or model info", () => {
			const settings: ProviderSettings = {}
			const result = resolveToolProtocol(settings)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})

		it("should fallback to XML when model info is undefined", () => {
			const settings: ProviderSettings = {
				apiProvider: "openai-native",
			}
			const result = resolveToolProtocol(settings, undefined)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})

		it("should fallback to NATIVE for empty settings", () => {
			const settings: ProviderSettings = {}
			const result = resolveToolProtocol(settings)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})
	})

	describe("Real-world Scenarios", () => {
		it("should honor locked protocol for resumed tasks that used XML", () => {
			const settings: ProviderSettings = {
				apiProvider: "anthropic",
			}
			// Task was started when XML was used, so it's locked to XML
			const result = resolveToolProtocol(settings, undefined, "xml")
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})

		it("should respect user preference over model capabilities", () => {
			const settings: ProviderSettings = {
				toolProtocol: "xml",
				apiProvider: "anthropic",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsPromptCache: true,
				supportsNativeTools: true,
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})
	})
})

describe("detectToolProtocolFromHistory", () => {
	// Helper type for API messages in tests
	type ApiMessageForTest = Anthropic.MessageParam & { ts?: number }

	describe("Native Protocol Detection", () => {
		it("should detect native protocol when tool_use block has an id", () => {
			const messages: ApiMessageForTest[] = [
				{ role: "user", content: "Hello" },
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "toolu_01abc123", // Native protocol always has an ID
							name: "read_file",
							input: { path: "test.ts" },
						},
					],
				},
			]
			const result = detectToolProtocolFromHistory(messages)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})

		it("should detect native protocol from the first tool_use block found", () => {
			const messages: ApiMessageForTest[] = [
				{ role: "user", content: "First message" },
				{ role: "assistant", content: "Let me help you" },
				{ role: "user", content: "Second message" },
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "toolu_first",
							name: "read_file",
							input: { path: "first.ts" },
						},
					],
				},
				{ role: "user", content: "Third message" },
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "toolu_second",
							name: "write_to_file",
							input: { path: "second.ts", content: "test" },
						},
					],
				},
			]
			const result = detectToolProtocolFromHistory(messages)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})
	})

	describe("XML Protocol Detection", () => {
		it("should detect XML protocol when tool_use block has no id", () => {
			const messages: ApiMessageForTest[] = [
				{ role: "user", content: "Hello" },
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							// No id field - XML protocol tool calls never have an ID
							name: "read_file",
							input: { path: "test.ts" },
						} as Anthropic.ToolUseBlock, // Cast to bypass type check for missing id
					],
				},
			]
			const result = detectToolProtocolFromHistory(messages)
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})

		it("should detect XML protocol when id is empty string", () => {
			const messages: ApiMessageForTest[] = [
				{ role: "user", content: "Hello" },
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "", // Empty string should be treated as no id
							name: "read_file",
							input: { path: "test.ts" },
						},
					],
				},
			]
			const result = detectToolProtocolFromHistory(messages)
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})
	})

	describe("No Tool Calls", () => {
		it("should return undefined when no messages", () => {
			const messages: ApiMessageForTest[] = []
			const result = detectToolProtocolFromHistory(messages)
			expect(result).toBeUndefined()
		})

		it("should return undefined when only user messages", () => {
			const messages: ApiMessageForTest[] = [
				{ role: "user", content: "Hello" },
				{ role: "user", content: "How are you?" },
			]
			const result = detectToolProtocolFromHistory(messages)
			expect(result).toBeUndefined()
		})

		it("should return undefined when assistant messages have no tool_use", () => {
			const messages: ApiMessageForTest[] = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi! How can I help?" },
				{ role: "user", content: "What's the weather?" },
				{
					role: "assistant",
					content: [{ type: "text", text: "I don't have access to weather data." }],
				},
			]
			const result = detectToolProtocolFromHistory(messages)
			expect(result).toBeUndefined()
		})

		it("should return undefined when content is string", () => {
			const messages: ApiMessageForTest[] = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there!" },
			]
			const result = detectToolProtocolFromHistory(messages)
			expect(result).toBeUndefined()
		})
	})

	describe("Mixed Content", () => {
		it("should detect protocol from tool_use even with mixed content", () => {
			const messages: ApiMessageForTest[] = [
				{ role: "user", content: "Read this file" },
				{
					role: "assistant",
					content: [
						{ type: "text", text: "I'll read that file for you." },
						{
							type: "tool_use",
							id: "toolu_mixed",
							name: "read_file",
							input: { path: "test.ts" },
						},
					],
				},
			]
			const result = detectToolProtocolFromHistory(messages)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})

		it("should skip user messages and only check assistant messages", () => {
			const messages: ApiMessageForTest[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "toolu_user",
							content: "result",
						},
					],
				},
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "toolu_assistant",
							name: "write_to_file",
							input: { path: "out.ts", content: "test" },
						},
					],
				},
			]
			const result = detectToolProtocolFromHistory(messages)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})
	})

	describe("Edge Cases", () => {
		it("should handle messages with empty content array", () => {
			const messages: ApiMessageForTest[] = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: [] },
			]
			const result = detectToolProtocolFromHistory(messages)
			expect(result).toBeUndefined()
		})

		it("should handle messages with ts field (ApiMessage format)", () => {
			const messages: ApiMessageForTest[] = [
				{ role: "user", content: "Hello", ts: Date.now() },
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "toolu_with_ts",
							name: "read_file",
							input: { path: "test.ts" },
						},
					],
					ts: Date.now(),
				},
			]
			const result = detectToolProtocolFromHistory(messages)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})
	})
})
