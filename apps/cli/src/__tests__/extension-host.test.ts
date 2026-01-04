/**
 * Unit tests for ExtensionHost class
 */

import { ExtensionHost, type ExtensionHostOptions } from "../extension-host.js"
import { EventEmitter } from "events"
import fs from "fs"
import path from "path"

// Mock modules
vi.mock("fs")
vi.mock("@roo-code/vscode-shim", () => ({
	createVSCodeAPI: vi.fn(() => ({
		context: { extensionPath: "/test/extension" },
	})),
}))

/**
 * Create a test ExtensionHost with default options
 */
function createTestHost(options?: Partial<ExtensionHostOptions>): ExtensionHost {
	return new ExtensionHost({
		workspacePath: "/test/workspace",
		extensionPath: "/test/extension",
		...options,
	})
}

// Type for accessing private members
type PrivateHost = Record<string, unknown>

/**
 * Helper to access private members for testing
 */
function getPrivate<T>(host: ExtensionHost, key: string): T {
	return (host as unknown as PrivateHost)[key] as T
}

/**
 * Helper to call private methods for testing
 */
function callPrivate<T>(host: ExtensionHost, method: string, ...args: unknown[]): T {
	const fn = (host as unknown as PrivateHost)[method] as ((...a: unknown[]) => T) | undefined
	if (!fn) throw new Error(`Method ${method} not found`)
	return fn.apply(host, args)
}

/**
 * Helper to spy on private methods
 * This uses a more permissive type to avoid TypeScript errors with vi.spyOn on private methods
 */
function spyOnPrivate(host: ExtensionHost, method: string) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return vi.spyOn(host as any, method)
}

describe("ExtensionHost", () => {
	beforeEach(() => {
		vi.resetAllMocks()
		// Clean up globals
		delete (global as Record<string, unknown>).vscode
		delete (global as Record<string, unknown>).__extensionHost
	})

	describe("constructor", () => {
		it("should store options correctly", () => {
			const options = {
				workspacePath: "/my/workspace",
				extensionPath: "/my/extension",
				verbose: true,
				quiet: true,
				apiKey: "test-key",
				apiProvider: "openrouter",
				model: "test-model",
			}

			const host = new ExtensionHost(options)

			expect(getPrivate(host, "options")).toEqual(options)
		})

		it("should be an EventEmitter instance", () => {
			const host = createTestHost()
			expect(host).toBeInstanceOf(EventEmitter)
		})

		it("should initialize with default state values", () => {
			const host = createTestHost()

			expect(getPrivate(host, "isWebviewReady")).toBe(false)
			expect(getPrivate<unknown[]>(host, "pendingMessages")).toEqual([])
			expect(getPrivate(host, "vscode")).toBeNull()
			expect(getPrivate(host, "extensionModule")).toBeNull()
		})
	})

	describe("buildApiConfiguration", () => {
		it.each([
			[
				"anthropic",
				"test-key",
				"test-model",
				{ apiProvider: "anthropic", apiKey: "test-key", apiModelId: "test-model" },
			],
			[
				"openrouter",
				"or-key",
				"or-model",
				{
					apiProvider: "openrouter",
					openRouterApiKey: "or-key",
					openRouterModelId: "or-model",
					enableReasoningEffort: true,
					reasoningEffort: "medium",
				},
			],
			[
				"gemini",
				"gem-key",
				"gem-model",
				{ apiProvider: "gemini", geminiApiKey: "gem-key", apiModelId: "gem-model" },
			],
			[
				"openai-native",
				"oai-key",
				"oai-model",
				{ apiProvider: "openai-native", openAiNativeApiKey: "oai-key", apiModelId: "oai-model" },
			],
			[
				"openai",
				"oai-key",
				"oai-model",
				{ apiProvider: "openai", openAiApiKey: "oai-key", openAiModelId: "oai-model" },
			],
			[
				"mistral",
				"mis-key",
				"mis-model",
				{ apiProvider: "mistral", mistralApiKey: "mis-key", apiModelId: "mis-model" },
			],
			[
				"deepseek",
				"ds-key",
				"ds-model",
				{ apiProvider: "deepseek", deepSeekApiKey: "ds-key", apiModelId: "ds-model" },
			],
			["xai", "xai-key", "xai-model", { apiProvider: "xai", xaiApiKey: "xai-key", apiModelId: "xai-model" }],
			[
				"groq",
				"groq-key",
				"groq-model",
				{ apiProvider: "groq", groqApiKey: "groq-key", apiModelId: "groq-model" },
			],
			[
				"fireworks",
				"fw-key",
				"fw-model",
				{ apiProvider: "fireworks", fireworksApiKey: "fw-key", apiModelId: "fw-model" },
			],
			[
				"cerebras",
				"cer-key",
				"cer-model",
				{ apiProvider: "cerebras", cerebrasApiKey: "cer-key", apiModelId: "cer-model" },
			],
			[
				"sambanova",
				"sn-key",
				"sn-model",
				{ apiProvider: "sambanova", sambaNovaApiKey: "sn-key", apiModelId: "sn-model" },
			],
			[
				"ollama",
				"oll-key",
				"oll-model",
				{ apiProvider: "ollama", ollamaApiKey: "oll-key", ollamaModelId: "oll-model" },
			],
			["lmstudio", undefined, "lm-model", { apiProvider: "lmstudio", lmStudioModelId: "lm-model" }],
			[
				"litellm",
				"lite-key",
				"lite-model",
				{ apiProvider: "litellm", litellmApiKey: "lite-key", litellmModelId: "lite-model" },
			],
			[
				"huggingface",
				"hf-key",
				"hf-model",
				{ apiProvider: "huggingface", huggingFaceApiKey: "hf-key", huggingFaceModelId: "hf-model" },
			],
			["chutes", "ch-key", "ch-model", { apiProvider: "chutes", chutesApiKey: "ch-key", apiModelId: "ch-model" }],
			[
				"featherless",
				"fl-key",
				"fl-model",
				{ apiProvider: "featherless", featherlessApiKey: "fl-key", apiModelId: "fl-model" },
			],
			[
				"unbound",
				"ub-key",
				"ub-model",
				{ apiProvider: "unbound", unboundApiKey: "ub-key", unboundModelId: "ub-model" },
			],
			[
				"requesty",
				"req-key",
				"req-model",
				{ apiProvider: "requesty", requestyApiKey: "req-key", requestyModelId: "req-model" },
			],
			[
				"deepinfra",
				"di-key",
				"di-model",
				{ apiProvider: "deepinfra", deepInfraApiKey: "di-key", deepInfraModelId: "di-model" },
			],
			[
				"vercel-ai-gateway",
				"vai-key",
				"vai-model",
				{
					apiProvider: "vercel-ai-gateway",
					vercelAiGatewayApiKey: "vai-key",
					vercelAiGatewayModelId: "vai-model",
				},
			],
			["zai", "zai-key", "zai-model", { apiProvider: "zai", zaiApiKey: "zai-key", apiModelId: "zai-model" }],
			[
				"baseten",
				"bt-key",
				"bt-model",
				{ apiProvider: "baseten", basetenApiKey: "bt-key", apiModelId: "bt-model" },
			],
			["doubao", "db-key", "db-model", { apiProvider: "doubao", doubaoApiKey: "db-key", apiModelId: "db-model" }],
			[
				"moonshot",
				"ms-key",
				"ms-model",
				{ apiProvider: "moonshot", moonshotApiKey: "ms-key", apiModelId: "ms-model" },
			],
			[
				"minimax",
				"mm-key",
				"mm-model",
				{ apiProvider: "minimax", minimaxApiKey: "mm-key", apiModelId: "mm-model" },
			],
			[
				"io-intelligence",
				"io-key",
				"io-model",
				{ apiProvider: "io-intelligence", ioIntelligenceApiKey: "io-key", ioIntelligenceModelId: "io-model" },
			],
		])("should configure %s provider correctly", (provider, apiKey, model, expected) => {
			const host = createTestHost({
				apiProvider: provider,
				apiKey,
				model,
			})

			const config = callPrivate<Record<string, unknown>>(host, "buildApiConfiguration")

			expect(config).toEqual(expected)
		})

		it("should use default provider (anthropic) when not specified", () => {
			const host = createTestHost({
				apiKey: "test-key",
				model: "test-model",
			})

			const config = callPrivate<Record<string, unknown>>(host, "buildApiConfiguration")

			expect(config.apiProvider).toBe("anthropic")
		})

		it("should handle missing apiKey gracefully", () => {
			const host = createTestHost({
				apiProvider: "anthropic",
				model: "test-model",
			})

			const config = callPrivate<Record<string, unknown>>(host, "buildApiConfiguration")

			expect(config.apiProvider).toBe("anthropic")
			expect(config.apiKey).toBeUndefined()
			expect(config.apiModelId).toBe("test-model")
		})

		it("should handle missing model gracefully", () => {
			const host = createTestHost({
				apiProvider: "anthropic",
				apiKey: "test-key",
			})

			const config = callPrivate<Record<string, unknown>>(host, "buildApiConfiguration")

			expect(config.apiProvider).toBe("anthropic")
			expect(config.apiKey).toBe("test-key")
			expect(config.apiModelId).toBeUndefined()
		})

		it("should use default config for unknown providers", () => {
			const host = createTestHost({
				apiProvider: "unknown-provider",
				apiKey: "test-key",
				model: "test-model",
			})

			const config = callPrivate<Record<string, unknown>>(host, "buildApiConfiguration")

			expect(config.apiProvider).toBe("unknown-provider")
			expect(config.apiKey).toBe("test-key")
			expect(config.apiModelId).toBe("test-model")
		})
	})

	describe("webview provider registration", () => {
		it("should register webview provider", () => {
			const host = createTestHost()
			const mockProvider = { resolveWebviewView: vi.fn() }

			host.registerWebviewProvider("test-view", mockProvider)

			const providers = getPrivate<Map<string, unknown>>(host, "webviewProviders")
			expect(providers.get("test-view")).toBe(mockProvider)
		})

		it("should unregister webview provider", () => {
			const host = createTestHost()
			const mockProvider = { resolveWebviewView: vi.fn() }

			host.registerWebviewProvider("test-view", mockProvider)
			host.unregisterWebviewProvider("test-view")

			const providers = getPrivate<Map<string, unknown>>(host, "webviewProviders")
			expect(providers.has("test-view")).toBe(false)
		})

		it("should handle unregistering non-existent provider gracefully", () => {
			const host = createTestHost()

			expect(() => {
				host.unregisterWebviewProvider("non-existent")
			}).not.toThrow()
		})
	})

	describe("webview ready state", () => {
		describe("isInInitialSetup", () => {
			it("should return true before webview is ready", () => {
				const host = createTestHost()
				expect(host.isInInitialSetup()).toBe(true)
			})

			it("should return false after markWebviewReady is called", () => {
				const host = createTestHost()
				host.markWebviewReady()
				expect(host.isInInitialSetup()).toBe(false)
			})
		})

		describe("markWebviewReady", () => {
			it("should set isWebviewReady to true", () => {
				const host = createTestHost()
				host.markWebviewReady()
				expect(getPrivate(host, "isWebviewReady")).toBe(true)
			})

			it("should emit webviewReady event", () => {
				const host = createTestHost()
				const listener = vi.fn()

				host.on("webviewReady", listener)
				host.markWebviewReady()

				expect(listener).toHaveBeenCalled()
			})

			it("should flush pending messages", () => {
				const host = createTestHost()
				const emitSpy = vi.spyOn(host, "emit")

				// Queue messages before ready
				host.sendToExtension({ type: "test1" })
				host.sendToExtension({ type: "test2" })

				// Mark ready (should flush)
				host.markWebviewReady()

				// Check that webviewMessage events were emitted for pending messages
				expect(emitSpy).toHaveBeenCalledWith("webviewMessage", { type: "test1" })
				expect(emitSpy).toHaveBeenCalledWith("webviewMessage", { type: "test2" })
			})
		})
	})

	describe("sendToExtension", () => {
		it("should queue message when webview not ready", () => {
			const host = createTestHost()
			const message = { type: "test" }

			host.sendToExtension(message)

			const pending = getPrivate<unknown[]>(host, "pendingMessages")
			expect(pending).toContain(message)
		})

		it("should emit webviewMessage event when webview is ready", () => {
			const host = createTestHost()
			const emitSpy = vi.spyOn(host, "emit")
			const message = { type: "test" }

			host.markWebviewReady()
			host.sendToExtension(message)

			expect(emitSpy).toHaveBeenCalledWith("webviewMessage", message)
		})

		it("should not queue message when webview is ready", () => {
			const host = createTestHost()

			host.markWebviewReady()
			host.sendToExtension({ type: "test" })

			const pending = getPrivate<unknown[]>(host, "pendingMessages")
			expect(pending).toHaveLength(0)
		})
	})

	describe("handleExtensionMessage", () => {
		it("should route state messages to handleStateMessage", () => {
			const host = createTestHost()
			const handleStateSpy = spyOnPrivate(host, "handleStateMessage")

			callPrivate(host, "handleExtensionMessage", { type: "state", state: {} })

			expect(handleStateSpy).toHaveBeenCalled()
		})

		it("should route messageUpdated to handleMessageUpdated", () => {
			const host = createTestHost()
			const handleMsgUpdatedSpy = spyOnPrivate(host, "handleMessageUpdated")

			callPrivate(host, "handleExtensionMessage", { type: "messageUpdated", clineMessage: {} })

			expect(handleMsgUpdatedSpy).toHaveBeenCalled()
		})

		it("should route action messages to handleActionMessage", () => {
			const host = createTestHost()
			const handleActionSpy = spyOnPrivate(host, "handleActionMessage")

			callPrivate(host, "handleExtensionMessage", { type: "action", action: "test" })

			expect(handleActionSpy).toHaveBeenCalled()
		})

		it("should route invoke messages to handleInvokeMessage", () => {
			const host = createTestHost()
			const handleInvokeSpy = spyOnPrivate(host, "handleInvokeMessage")

			callPrivate(host, "handleExtensionMessage", { type: "invoke", invoke: "test" })

			expect(handleInvokeSpy).toHaveBeenCalled()
		})
	})

	describe("handleSayMessage", () => {
		let host: ExtensionHost
		let mockLog: ReturnType<typeof vi.fn>
		let mockError: ReturnType<typeof vi.fn>

		beforeEach(() => {
			host = createTestHost()
			mockLog = vi.fn()
			mockError = vi.fn()
		})

		it("should emit taskComplete for completion_result", () => {
			const emitSpy = vi.spyOn(host, "emit")

			callPrivate(host, "handleSayMessage", 123, "completion_result", "Task done", false, mockLog, mockError)

			expect(emitSpy).toHaveBeenCalledWith("taskComplete")
			expect(mockLog).toHaveBeenCalledWith("\n[Task Complete]", "Task done")
		})

		it("should emit taskError for error messages", () => {
			const emitSpy = vi.spyOn(host, "emit")

			callPrivate(host, "handleSayMessage", 123, "error", "Something went wrong", false, mockLog, mockError)

			expect(emitSpy).toHaveBeenCalledWith("taskError", "Something went wrong")
			expect(mockError).toHaveBeenCalledWith("\n[Error]", "Something went wrong")
		})

		it("should handle command_output messages", () => {
			callPrivate(host, "handleSayMessage", 123, "command_output", "output text", false, mockLog, mockError)

			expect(mockLog).toHaveBeenCalledWith("\n[Command Output]", "output text")
		})

		it("should handle tool messages", () => {
			callPrivate(host, "handleSayMessage", 123, "tool", "tool usage", false, mockLog, mockError)

			expect(mockLog).toHaveBeenCalledWith("\n[Tool]", "tool usage")
		})

		it("should skip already displayed complete messages", () => {
			// First display
			callPrivate(host, "handleSayMessage", 123, "completion_result", "Task done", false, mockLog, mockError)
			mockLog.mockClear()

			// Second display should be skipped
			callPrivate(host, "handleSayMessage", 123, "completion_result", "Task done", false, mockLog, mockError)

			expect(mockLog).not.toHaveBeenCalled()
		})

		it("should track displayed messages", () => {
			callPrivate(host, "handleSayMessage", 123, "tool", "test", false, mockLog, mockError)

			const displayed = getPrivate<Map<number, unknown>>(host, "displayedMessages")
			expect(displayed.has(123)).toBe(true)
		})
	})

	describe("handleAskMessage", () => {
		let host: ExtensionHost
		let mockLog: ReturnType<typeof vi.fn>

		beforeEach(() => {
			host = createTestHost()
			mockLog = vi.fn()
		})

		it("should handle command type", () => {
			callPrivate(host, "handleAskMessage", 123, "command", "ls -la", false, mockLog)

			expect(mockLog).toHaveBeenCalledWith("\n[Running Command]", "ls -la")
		})

		it("should handle tool type with JSON parsing", () => {
			const toolInfo = JSON.stringify({ tool: "write_file", path: "/test/file.txt" })

			callPrivate(host, "handleAskMessage", 123, "tool", toolInfo, false, mockLog)

			expect(mockLog).toHaveBeenCalledWith("\n[Tool Call] write_file")
			expect(mockLog).toHaveBeenCalledWith("  Path: /test/file.txt")
		})

		it("should handle tool type with content preview", () => {
			const toolInfo = JSON.stringify({
				tool: "write_file",
				content: "This is the content that will be written to the file. It might be long.",
			})

			callPrivate(host, "handleAskMessage", 123, "tool", toolInfo, false, mockLog)

			expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("Content:"))
		})

		it("should handle tool type with invalid JSON", () => {
			callPrivate(host, "handleAskMessage", 123, "tool", "not json", false, mockLog)

			expect(mockLog).toHaveBeenCalledWith("\n[Tool Call]", "not json")
		})

		it("should track seen tool calls to avoid duplicates", () => {
			const toolInfo = JSON.stringify({ tool: "read_file" })

			// First call
			callPrivate(host, "handleAskMessage", 123, "tool", toolInfo, false, mockLog)
			mockLog.mockClear()

			// Same ts - should be duplicate
			callPrivate(host, "handleAskMessage", 123, "tool", toolInfo, false, mockLog)

			// Tool call log should not be called again
			expect(mockLog).not.toHaveBeenCalledWith("\n[Tool Call] read_file")
		})

		it("should handle other ask types", () => {
			callPrivate(host, "handleAskMessage", 123, "question", "What is your name?", false, mockLog)

			expect(mockLog).toHaveBeenCalledWith("\n[Assistant asks]", "What is your name?")
		})
	})

	describe("streamContent", () => {
		let host: ExtensionHost
		let writeStreamSpy: ReturnType<typeof vi.spyOn>

		beforeEach(() => {
			host = createTestHost()
			// Mock process.stdout.write
			vi.spyOn(process.stdout, "write").mockImplementation(() => true)
			writeStreamSpy = spyOnPrivate(host, "writeStream")
		})

		afterEach(() => {
			vi.restoreAllMocks()
		})

		it("should output header and text for new messages", () => {
			callPrivate(host, "streamContent", 123, "Hello", "[Test]")

			expect(writeStreamSpy).toHaveBeenCalledWith("\n[Test] ")
			expect(writeStreamSpy).toHaveBeenCalledWith("Hello")
		})

		it("should compute delta for growing text", () => {
			// First call - establishes baseline
			callPrivate(host, "streamContent", 123, "Hello", "[Test]")
			writeStreamSpy.mockClear()

			// Second call - should only output delta
			callPrivate(host, "streamContent", 123, "Hello World", "[Test]")

			expect(writeStreamSpy).toHaveBeenCalledWith(" World")
		})

		it("should skip when text has not grown", () => {
			callPrivate(host, "streamContent", 123, "Hello", "[Test]")
			writeStreamSpy.mockClear()

			callPrivate(host, "streamContent", 123, "Hello", "[Test]")

			expect(writeStreamSpy).not.toHaveBeenCalled()
		})

		it("should skip when text does not match prefix", () => {
			callPrivate(host, "streamContent", 123, "Hello", "[Test]")
			writeStreamSpy.mockClear()

			// Different text entirely
			callPrivate(host, "streamContent", 123, "Goodbye", "[Test]")

			expect(writeStreamSpy).not.toHaveBeenCalled()
		})

		it("should track currently streaming ts", () => {
			callPrivate(host, "streamContent", 123, "Hello", "[Test]")

			expect(getPrivate(host, "currentlyStreamingTs")).toBe(123)
		})
	})

	describe("finishStream", () => {
		let host: ExtensionHost
		let writeStreamSpy: ReturnType<typeof vi.spyOn>

		beforeEach(() => {
			host = createTestHost()
			vi.spyOn(process.stdout, "write").mockImplementation(() => true)
			writeStreamSpy = spyOnPrivate(host, "writeStream")
		})

		afterEach(() => {
			vi.restoreAllMocks()
		})

		it("should add newline when finishing current stream", () => {
			// Set up streaming state
			callPrivate(host, "streamContent", 123, "Hello", "[Test]")
			writeStreamSpy.mockClear()

			callPrivate(host, "finishStream", 123)

			expect(writeStreamSpy).toHaveBeenCalledWith("\n")
			expect(getPrivate(host, "currentlyStreamingTs")).toBeNull()
		})

		it("should not add newline for different ts", () => {
			callPrivate(host, "streamContent", 123, "Hello", "[Test]")
			writeStreamSpy.mockClear()

			callPrivate(host, "finishStream", 456)

			expect(writeStreamSpy).not.toHaveBeenCalled()
		})
	})

	describe("quiet mode", () => {
		describe("setupQuietMode", () => {
			it("should not modify console when quiet mode disabled", () => {
				const host = createTestHost({ quiet: false })
				const originalLog = console.log

				callPrivate(host, "setupQuietMode")

				expect(console.log).toBe(originalLog)
			})

			it("should suppress console.log, warn, debug, info when enabled", () => {
				const host = createTestHost({ quiet: true })
				const originalLog = console.log

				callPrivate(host, "setupQuietMode")

				// These should be no-ops now (different from original)
				expect(console.log).not.toBe(originalLog)

				// Verify they are actually no-ops by calling them (should not throw)
				expect(() => console.log("test")).not.toThrow()
				expect(() => console.warn("test")).not.toThrow()
				expect(() => console.debug("test")).not.toThrow()
				expect(() => console.info("test")).not.toThrow()

				// Restore for other tests
				callPrivate(host, "restoreConsole")
			})

			it("should preserve console.error", () => {
				const host = createTestHost({ quiet: true })
				const originalError = console.error

				callPrivate(host, "setupQuietMode")

				expect(console.error).toBe(originalError)

				callPrivate(host, "restoreConsole")
			})

			it("should store original console methods", () => {
				const host = createTestHost({ quiet: true })
				const originalLog = console.log

				callPrivate(host, "setupQuietMode")

				const stored = getPrivate<{ log: typeof console.log }>(host, "originalConsole")
				expect(stored.log).toBe(originalLog)

				callPrivate(host, "restoreConsole")
			})
		})

		describe("restoreConsole", () => {
			it("should restore original console methods", () => {
				const host = createTestHost({ quiet: true })
				const originalLog = console.log

				callPrivate(host, "setupQuietMode")
				callPrivate(host, "restoreConsole")

				expect(console.log).toBe(originalLog)
			})

			it("should handle case where console was not suppressed", () => {
				const host = createTestHost({ quiet: false })

				expect(() => {
					callPrivate(host, "restoreConsole")
				}).not.toThrow()
			})
		})

		describe("suppressNodeWarnings", () => {
			it("should suppress process.emitWarning", () => {
				const host = createTestHost()
				const originalEmitWarning = process.emitWarning

				callPrivate(host, "suppressNodeWarnings")

				expect(process.emitWarning).not.toBe(originalEmitWarning)

				// Restore
				callPrivate(host, "restoreConsole")
			})
		})
	})

	describe("dispose", () => {
		let host: ExtensionHost

		beforeEach(() => {
			host = createTestHost()
			vi.mocked(fs.openSync).mockReturnValue(1)
			vi.mocked(fs.writeSync).mockReturnValue(0)
			vi.mocked(fs.closeSync).mockReturnValue(undefined)
		})

		it("should close debug log file", async () => {
			// Initialize debug log first
			callPrivate(host, "initDebugLog")

			await host.dispose()

			expect(fs.closeSync).toHaveBeenCalled()
		})

		it("should remove message listener", async () => {
			const listener = vi.fn()
			;(host as unknown as Record<string, unknown>).messageListener = listener
			host.on("extensionWebviewMessage", listener)

			await host.dispose()

			expect(getPrivate(host, "messageListener")).toBeNull()
		})

		it("should call extension deactivate if available", async () => {
			const deactivateMock = vi.fn()
			;(host as unknown as Record<string, unknown>).extensionModule = {
				deactivate: deactivateMock,
			}

			await host.dispose()

			expect(deactivateMock).toHaveBeenCalled()
		})

		it("should clear vscode reference", async () => {
			;(host as unknown as Record<string, unknown>).vscode = { context: {} }

			await host.dispose()

			expect(getPrivate(host, "vscode")).toBeNull()
		})

		it("should clear extensionModule reference", async () => {
			;(host as unknown as Record<string, unknown>).extensionModule = {}

			await host.dispose()

			expect(getPrivate(host, "extensionModule")).toBeNull()
		})

		it("should clear webviewProviders", async () => {
			host.registerWebviewProvider("test", {})

			await host.dispose()

			const providers = getPrivate<Map<string, unknown>>(host, "webviewProviders")
			expect(providers.size).toBe(0)
		})

		it("should delete global vscode", async () => {
			;(global as Record<string, unknown>).vscode = {}

			await host.dispose()

			expect((global as Record<string, unknown>).vscode).toBeUndefined()
		})

		it("should delete global __extensionHost", async () => {
			;(global as Record<string, unknown>).__extensionHost = {}

			await host.dispose()

			expect((global as Record<string, unknown>).__extensionHost).toBeUndefined()
		})

		it("should restore console if it was suppressed", async () => {
			const restoreConsoleSpy = spyOnPrivate(host, "restoreConsole")

			await host.dispose()

			expect(restoreConsoleSpy).toHaveBeenCalled()
		})
	})

	describe("debug logging", () => {
		let host: ExtensionHost

		beforeEach(() => {
			host = createTestHost()
			vi.mocked(fs.openSync).mockReturnValue(42)
			vi.mocked(fs.writeSync).mockReturnValue(0)
			vi.mocked(fs.closeSync).mockReturnValue(undefined)
		})

		describe("initDebugLog", () => {
			it("should create log file in workspace path", () => {
				callPrivate(host, "initDebugLog")

				expect(fs.openSync).toHaveBeenCalledWith(path.join("/test/workspace", "cli-stream-debug.log"), "w")
			})

			it("should handle file creation errors gracefully", () => {
				vi.mocked(fs.openSync).mockImplementation(() => {
					throw new Error("Permission denied")
				})

				expect(() => {
					callPrivate(host, "initDebugLog")
				}).not.toThrow()

				expect(getPrivate(host, "debugLogFile")).toBeNull()
			})
		})

		describe("debugLog", () => {
			it("should write timestamped message to log file", () => {
				callPrivate(host, "initDebugLog")
				callPrivate(host, "debugLog", "Test message")

				expect(fs.writeSync).toHaveBeenCalledWith(42, expect.stringContaining("Test message"))
			})

			it("should do nothing when debugLogFile is null", () => {
				// Don't init, so debugLogFile is null
				callPrivate(host, "debugLog", "Test message")

				// writeSync should only be called for initDebugLog, not debugLog
				expect(fs.writeSync).not.toHaveBeenCalled()
			})
		})

		describe("closeDebugLog", () => {
			it("should write closing message and close file", () => {
				callPrivate(host, "initDebugLog")
				callPrivate(host, "closeDebugLog")

				expect(fs.writeSync).toHaveBeenCalledWith(42, expect.stringContaining("Log ended"))
				expect(fs.closeSync).toHaveBeenCalledWith(42)
			})

			it("should set debugLogFile to null", () => {
				callPrivate(host, "initDebugLog")
				callPrivate(host, "closeDebugLog")

				expect(getPrivate(host, "debugLogFile")).toBeNull()
			})
		})
	})

	describe("waitForCompletion", () => {
		it("should resolve when taskComplete is emitted", async () => {
			const host = createTestHost()

			const promise = callPrivate<Promise<void>>(host, "waitForCompletion")

			// Emit completion after a short delay
			setTimeout(() => host.emit("taskComplete"), 10)

			await expect(promise).resolves.toBeUndefined()
		})

		it("should reject when taskError is emitted", async () => {
			const host = createTestHost()

			const promise = callPrivate<Promise<void>>(host, "waitForCompletion")

			setTimeout(() => host.emit("taskError", "Test error"), 10)

			await expect(promise).rejects.toThrow("Test error")
		})

		it("should timeout after configured duration", async () => {
			const host = createTestHost()

			// Use fake timers for this test
			vi.useFakeTimers()

			const promise = callPrivate<Promise<void>>(host, "waitForCompletion")

			// Fast-forward past the timeout (10 minutes)
			vi.advanceTimersByTime(10 * 60 * 1000 + 1)

			await expect(promise).rejects.toThrow("Task timed out")

			vi.useRealTimers()
		})
	})
})
