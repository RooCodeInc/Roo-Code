import { describe, it, expect, vi, beforeEach } from "vitest"
import { resolveToolProtocol } from "../resolveToolProtocol"
import { TOOL_PROTOCOL } from "@roo-code/types"
import type { ProviderSettings, ModelInfo, ProviderName } from "@roo-code/types"
import * as toolProtocolModule from "../toolProtocol"

// Mock the getToolProtocolFromSettings function
vi.mock("../toolProtocol", () => ({
	getToolProtocolFromSettings: vi.fn(() => "xml"),
}))

describe("resolveToolProtocol", () => {
	beforeEach(() => {
		// Reset mock before each test
		vi.mocked(toolProtocolModule.getToolProtocolFromSettings).mockReturnValue("xml")
	})

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
			const result = resolveToolProtocol(settings, modelInfo, "anthropic")
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
			}
			const result = resolveToolProtocol(settings, modelInfo, "openai-native")
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
			const result = resolveToolProtocol(settings, modelInfo, "openai-native")
			expect(result).toBe(TOOL_PROTOCOL.XML) // Profile setting wins
		})
	})

	describe("Precedence Level 2: Global User Preference (VSCode Setting)", () => {
		it("should use global setting when no profile setting", () => {
			vi.mocked(toolProtocolModule.getToolProtocolFromSettings).mockReturnValue("native")
			const settings: ProviderSettings = {
				apiProvider: "roo",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: true, // Model supports native tools
			}
			const result = resolveToolProtocol(settings, modelInfo, "roo")
			expect(result).toBe(TOOL_PROTOCOL.NATIVE) // Global setting wins over provider default
		})

		it("should use global setting over model default", () => {
			vi.mocked(toolProtocolModule.getToolProtocolFromSettings).mockReturnValue("native")
			const settings: ProviderSettings = {
				apiProvider: "roo",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				defaultToolProtocol: "xml", // Model prefers XML
				supportsNativeTools: true, // But model supports native tools
			}
			const result = resolveToolProtocol(settings, modelInfo, "roo")
			expect(result).toBe(TOOL_PROTOCOL.NATIVE) // Global setting wins
		})
	})

	describe("Precedence Level 3: Model Default", () => {
		it("should use model defaultToolProtocol when no profile or global setting", () => {
			vi.mocked(toolProtocolModule.getToolProtocolFromSettings).mockReturnValue("xml")
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
			const result = resolveToolProtocol(settings, modelInfo, "roo")
			expect(result).toBe(TOOL_PROTOCOL.NATIVE) // Model default wins when global is XML (default)
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
			const result = resolveToolProtocol(settings, modelInfo, "roo")
			expect(result).toBe(TOOL_PROTOCOL.XML) // Model default wins over capability
		})
	})

	describe("Support Validation", () => {
		it("should use provider default (XML) even when model supports native tools", () => {
			const settings: ProviderSettings = {
				apiProvider: "openai-native",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: true,
			}
			const result = resolveToolProtocol(settings, modelInfo, "openai-native")
			expect(result).toBe(TOOL_PROTOCOL.XML) // Provider default is XML (list is empty)
		})

		it("should fall back to XML when provider default is native but model doesn't support it", () => {
			const settings: ProviderSettings = {
				apiProvider: "openai-native",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: false, // Model doesn't support native
			}
			const result = resolveToolProtocol(settings, modelInfo, "openai-native")
			expect(result).toBe(TOOL_PROTOCOL.XML) // Falls back to XML due to lack of support
		})

		it("should use provider default (XML) when model doesn't support native", () => {
			const settings: ProviderSettings = {
				apiProvider: "anthropic",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: false,
			}
			const result = resolveToolProtocol(settings, modelInfo, "anthropic")
			expect(result).toBe(TOOL_PROTOCOL.XML) // Provider default is XML
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
			const result = resolveToolProtocol(settings, modelInfo, "anthropic")
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
			const result = resolveToolProtocol(settings, modelInfo, "anthropic")
			expect(result).toBe(TOOL_PROTOCOL.XML) // Falls back to XML - undefined treated as unsupported
		})
	})

	describe("Precedence Level 4: Provider Default", () => {
		it("should use XML for all providers by default (when nativePreferredProviders is empty)", () => {
			const settings: ProviderSettings = {
				apiProvider: "anthropic",
			}
			const result = resolveToolProtocol(settings, undefined, "anthropic")
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})

		it("should use XML for Bedrock provider", () => {
			const settings: ProviderSettings = {
				apiProvider: "bedrock",
			}
			const result = resolveToolProtocol(settings, undefined, "bedrock")
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})

		it("should use XML for Claude Code provider", () => {
			const settings: ProviderSettings = {
				apiProvider: "claude-code",
			}
			const result = resolveToolProtocol(settings, undefined, "claude-code")
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})

		it("should use XML for OpenAI Native provider (when not in native list)", () => {
			const settings: ProviderSettings = {
				apiProvider: "openai-native",
			}
			const result = resolveToolProtocol(settings, undefined, "openai-native")
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})

		it("should use XML for Roo provider (when not in native list)", () => {
			const settings: ProviderSettings = {
				apiProvider: "roo",
			}
			const result = resolveToolProtocol(settings, undefined, "roo")
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})

		it("should use XML for Gemini provider (when not in native list)", () => {
			const settings: ProviderSettings = {
				apiProvider: "gemini",
			}
			const result = resolveToolProtocol(settings, undefined, "gemini")
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})

		it("should use XML for Mistral provider (when not in native list)", () => {
			const settings: ProviderSettings = {
				apiProvider: "mistral",
			}
			const result = resolveToolProtocol(settings, undefined, "mistral")
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})
	})

	describe("Precedence Level 5: XML Fallback", () => {
		it("should use XML fallback when no provider is specified and no preferences", () => {
			vi.mocked(toolProtocolModule.getToolProtocolFromSettings).mockReturnValue("xml")
			const settings: ProviderSettings = {}
			const result = resolveToolProtocol(settings, undefined, undefined)
			expect(result).toBe(TOOL_PROTOCOL.XML) // XML fallback
		})
	})

	describe("Complete Precedence Chain", () => {
		it("should respect full precedence: Profile > Model Default > Model Capability > Provider > Global", () => {
			// Set up a scenario with all levels defined
			vi.mocked(toolProtocolModule.getToolProtocolFromSettings).mockReturnValue("xml")

			const settings: ProviderSettings = {
				toolProtocol: "native", // Level 1: User profile setting
				apiProvider: "roo",
			}

			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				defaultToolProtocol: "xml", // Level 2: Model default
				supportsNativeTools: true, // Level 3: Model capability
			}

			// Level 4: Provider default would be "native" for roo
			// Level 5: Global setting is "xml"

			const result = resolveToolProtocol(settings, modelInfo, "roo")
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
				supportsNativeTools: true, // Support check (doesn't affect precedence)
			}

			const result = resolveToolProtocol(settings, modelInfo, "openai-native")
			expect(result).toBe(TOOL_PROTOCOL.XML) // Model default wins over provider default
		})

		it("should skip to provider default when profile and model default are undefined", () => {
			const settings: ProviderSettings = {
				apiProvider: "openai-native",
			}

			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: true, // Support check (doesn't affect precedence)
			}

			const result = resolveToolProtocol(settings, modelInfo, "openai-native")
			expect(result).toBe(TOOL_PROTOCOL.XML) // Provider default (XML for all when list is empty)
		})

		it("should skip to provider default when model info is unavailable", () => {
			const settings: ProviderSettings = {
				apiProvider: "anthropic",
			}

			const result = resolveToolProtocol(settings, undefined, "anthropic")
			expect(result).toBe(TOOL_PROTOCOL.XML) // Provider default wins
		})

		it("should use global setting over provider default", () => {
			vi.mocked(toolProtocolModule.getToolProtocolFromSettings).mockReturnValue("native")
			const settings: ProviderSettings = {
				apiProvider: "ollama", // Provider not in native list, defaults to XML
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: true, // Model supports native tools
			}

			const result = resolveToolProtocol(settings, modelInfo, "ollama")
			expect(result).toBe(TOOL_PROTOCOL.NATIVE) // Global setting wins over provider default
		})
	})

	describe("Edge Cases", () => {
		it("should handle missing provider name gracefully", () => {
			const settings: ProviderSettings = {}
			const result = resolveToolProtocol(settings)
			expect(result).toBe(TOOL_PROTOCOL.XML) // Falls back to global
		})

		it("should handle undefined model info gracefully", () => {
			const settings: ProviderSettings = {
				apiProvider: "openai-native",
			}
			const result = resolveToolProtocol(settings, undefined, "openai-native")
			expect(result).toBe(TOOL_PROTOCOL.XML) // Provider default (XML for all)
		})

		it("should fall back to XML when provider prefers native but model doesn't support it", () => {
			const settings: ProviderSettings = {
				apiProvider: "roo",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: false, // Model doesn't support native
			}
			const result = resolveToolProtocol(settings, modelInfo, "roo")
			expect(result).toBe(TOOL_PROTOCOL.XML) // Falls back to XML due to lack of support
		})
	})

	describe("Real-world Scenarios", () => {
		it("should use XML for GPT-4 with OpenAI provider (when list is empty)", () => {
			const settings: ProviderSettings = {
				apiProvider: "openai-native",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: true,
			}
			const result = resolveToolProtocol(settings, modelInfo, "openai-native")
			expect(result).toBe(TOOL_PROTOCOL.XML) // Provider default is XML
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
			const result = resolveToolProtocol(settings, modelInfo, "anthropic")
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
			const result = resolveToolProtocol(settings, modelInfo, "openai-native")
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
			const result = resolveToolProtocol(settings, modelInfo, "anthropic")
			expect(result).toBe(TOOL_PROTOCOL.XML) // Falls back to XML due to lack of support
		})

		it("should use model default for Roo provider with mixed-protocol model", () => {
			const settings: ProviderSettings = {
				apiProvider: "roo",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsPromptCache: true,
				defaultToolProtocol: "xml", // Anthropic model via Roo
				supportsNativeTools: false,
			}
			const result = resolveToolProtocol(settings, modelInfo, "roo")
			expect(result).toBe(TOOL_PROTOCOL.XML) // Model default wins over provider default
		})
	})
})
