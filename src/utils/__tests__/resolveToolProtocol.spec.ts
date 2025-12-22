import { describe, it, expect } from "vitest"
import { resolveToolProtocol, detectToolProtocolFromHistory } from "../resolveToolProtocol"
import { TOOL_PROTOCOL, openAiModelInfoSaneDefaults } from "@roo-code/types"
import type { ProviderSettings, ModelInfo } from "@roo-code/types"
import type { Anthropic } from "@anthropic-ai/sdk"

describe("resolveToolProtocol", () => {
	describe("Precedence Level 1: User Profile Setting", () => {
		it("should use profile toolProtocol when explicitly set to xml", () => {
			const settings: ProviderSettings = {
				toolProtocol: "xml",
				apiProvider: "anthropic",
			}
			const result = resolveToolProtocol(settings)
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})

		it("should use profile toolProtocol when explicitly set to native", () => {
			const settings: ProviderSettings = {
				toolProtocol: "native",
				apiProvider: "anthropic",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: true, // Model supports native tools
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})

		it("should override model default when profile setting is present", () => {
			const settings: ProviderSettings = {
				toolProtocol: "xml",
				apiProvider: "openai-native",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				defaultToolProtocol: "native",
				supportsNativeTools: true,
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML) // Profile setting wins
		})

		it("should override model capability when profile setting is present", () => {
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
			expect(result).toBe(TOOL_PROTOCOL.XML) // Profile setting wins
		})
	})

	describe("Precedence Level 2: Model Default", () => {
		it("should use model defaultToolProtocol when no profile setting", () => {
			const settings: ProviderSettings = {
				apiProvider: "roo",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				defaultToolProtocol: "native",
				supportsNativeTools: true, // Model must support native tools
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE) // Model default wins when experiment is disabled
		})

		it("should override model capability when model default is present", () => {
			const settings: ProviderSettings = {
				apiProvider: "roo",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				defaultToolProtocol: "xml",
				supportsNativeTools: true,
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML) // Model default wins over capability
		})
	})

	describe("Support Validation", () => {
		it("should fall back to XML when model doesn't support native", () => {
			const settings: ProviderSettings = {
				apiProvider: "anthropic",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: false,
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})

		it("should fall back to XML when user prefers native but model doesn't support it", () => {
			const settings: ProviderSettings = {
				toolProtocol: "native", // User wants native
				apiProvider: "anthropic",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: false, // But model doesn't support it
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML) // Falls back to XML due to lack of support
		})

		it("should fall back to XML when user prefers native but model support is undefined", () => {
			const settings: ProviderSettings = {
				toolProtocol: "native", // User wants native
				apiProvider: "anthropic",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				// supportsNativeTools is undefined (not specified)
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML) // Falls back to XML - undefined treated as unsupported
		})
	})

	describe("Precedence Level 3: Native Fallback", () => {
		it("should use Native fallback when no model default is specified and model supports native", () => {
			const settings: ProviderSettings = {
				apiProvider: "anthropic",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: true,
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML) // XML fallback
		})
	})

	describe("Complete Precedence Chain", () => {
		it("should respect full precedence: Profile > Model Default > Native Fallback", () => {
			// Set up a scenario with all levels defined
			const settings: ProviderSettings = {
				toolProtocol: "native", // Level 1: User profile setting
				apiProvider: "roo",
			}

			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				defaultToolProtocol: "xml", // Level 2: Model default
				supportsNativeTools: true, // Support check
			}

			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE) // Profile setting wins
		})

		it("should skip to model default when profile setting is undefined", () => {
			const settings: ProviderSettings = {
				apiProvider: "openai-native",
			}

			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				defaultToolProtocol: "xml", // Level 2
				supportsNativeTools: true, // Support check
			}

			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML) // Model default wins
		})

		it("should skip to Native fallback when profile and model default are undefined", () => {
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
			expect(result).toBe(TOOL_PROTOCOL.XML) // XML fallback
		})

		it("should skip to XML fallback when model info is unavailable", () => {
			const settings: ProviderSettings = {
				apiProvider: "anthropic",
			}

			const result = resolveToolProtocol(settings, undefined)
			expect(result).toBe(TOOL_PROTOCOL.XML) // XML fallback (no model info means no native support)
		})
	})

	describe("Locked Protocol (Precedence Level 0)", () => {
		it("should return lockedProtocol when provided, ignoring all other settings", () => {
			const settings: ProviderSettings = {
				toolProtocol: "xml", // User wants XML
				apiProvider: "openai-native",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: true,
				defaultToolProtocol: "xml",
			}
			// lockedProtocol overrides everything
			const result = resolveToolProtocol(settings, modelInfo, "native")
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})

		it("should return XML lockedProtocol even when model supports native", () => {
			const settings: ProviderSettings = {
				toolProtocol: "native", // User wants native
				apiProvider: "anthropic",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: true, // Model supports native
				defaultToolProtocol: "native",
			}
			// lockedProtocol forces XML
			const result = resolveToolProtocol(settings, modelInfo, "xml")
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})

		it("should fall through to normal resolution when lockedProtocol is undefined", () => {
			const settings: ProviderSettings = {
				toolProtocol: "xml",
				apiProvider: "anthropic",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: true,
			}
			// undefined lockedProtocol should use normal precedence
			const result = resolveToolProtocol(settings, modelInfo, undefined)
			expect(result).toBe(TOOL_PROTOCOL.XML) // User setting wins
		})
	})

	describe("Edge Cases", () => {
		it("should handle missing provider name gracefully", () => {
			const settings: ProviderSettings = {}
			const result = resolveToolProtocol(settings)
			expect(result).toBe(TOOL_PROTOCOL.XML) // Falls back to XML (no model info)
		})

		it("should handle undefined model info gracefully", () => {
			const settings: ProviderSettings = {
				apiProvider: "openai-native",
			}
			const result = resolveToolProtocol(settings, undefined)
			expect(result).toBe(TOOL_PROTOCOL.XML) // XML fallback (no model info)
		})

		it("should fall back to XML when model doesn't support native", () => {
			const settings: ProviderSettings = {
				apiProvider: "roo",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: false, // Model doesn't support native
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML) // Falls back to XML due to lack of support
		})
	})

	describe("Real-world Scenarios", () => {
		it("should use Native fallback for models without defaultToolProtocol", () => {
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
			expect(result).toBe(TOOL_PROTOCOL.XML) // XML fallback
		})

		it("should use XML for Claude models with Anthropic provider", () => {
			const settings: ProviderSettings = {
				apiProvider: "anthropic",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsPromptCache: true,
				supportsNativeTools: false,
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})

		it("should allow user to force XML on native-supporting model", () => {
			const settings: ProviderSettings = {
				toolProtocol: "xml", // User explicitly wants XML
				apiProvider: "openai-native",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: true, // Model supports native but user wants XML
				defaultToolProtocol: "native",
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML) // User preference wins
		})

		it("should not allow user to force native when model doesn't support it", () => {
			const settings: ProviderSettings = {
				toolProtocol: "native", // User wants native
				apiProvider: "anthropic",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: false, // Model doesn't support native
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML) // Falls back to XML due to lack of support
		})

		it("should use model default when available", () => {
			const settings: ProviderSettings = {
				apiProvider: "roo",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsPromptCache: true,
				defaultToolProtocol: "xml",
				supportsNativeTools: true,
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML) // Model default wins
		})

		it("should use native tools for OpenAI compatible provider with default model info", () => {
			const settings: ProviderSettings = {
				apiProvider: "openai",
			}
			// Using the actual openAiModelInfoSaneDefaults to verify the fix
			const result = resolveToolProtocol(settings, openAiModelInfoSaneDefaults)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE) // Should use native tools by default
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
