// pnpm --filter @roo-code/cli test src/__tests__/extension-host.test.ts

import { EventEmitter } from "events"
import fs from "fs"
import os from "os"
import path from "path"

import type { WebviewMessage } from "@roo-code/types"

import type { SupportedProvider } from "../types.js"
import { type ExtensionHostOptions, ExtensionHost } from "../extension-host.js"

vi.mock("@roo-code/vscode-shim", () => ({
	createVSCodeAPI: vi.fn(() => ({
		context: { extensionPath: "/test/extension" },
	})),
	setRuntimeConfigValues: vi.fn(),
}))

/**
 * Create a test ExtensionHost with default options
 */
function createTestHost({
	mode = "code",
	provider = "openrouter",
	model = "test-model",
	...options
}: Partial<ExtensionHostOptions> = {}): ExtensionHost {
	return new ExtensionHost({
		mode,
		user: null,
		provider,
		model,
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
			const options: ExtensionHostOptions = {
				mode: "code",
				workspacePath: "/my/workspace",
				extensionPath: "/my/extension",
				user: null,
				apiKey: "test-key",
				provider: "openrouter",
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
				"vercel-ai-gateway",
				"vai-key",
				"vai-model",
				{
					apiProvider: "vercel-ai-gateway",
					vercelAiGatewayApiKey: "vai-key",
					vercelAiGatewayModelId: "vai-model",
				},
			],
		])("should configure %s provider correctly", (provider, apiKey, model, expected) => {
			const host = createTestHost({
				provider: provider as SupportedProvider,
				apiKey,
				model,
			})

			const config = callPrivate<Record<string, unknown>>(host, "buildApiConfiguration")

			expect(config).toEqual(expected)
		})

		it("should use default provider when not specified", () => {
			const host = createTestHost({
				apiKey: "test-key",
				model: "test-model",
			})

			const config = callPrivate<Record<string, unknown>>(host, "buildApiConfiguration")

			expect(config.apiProvider).toBe("openrouter")
		})

		it("should handle missing apiKey gracefully", () => {
			const host = createTestHost({
				provider: "anthropic",
				model: "test-model",
			})

			const config = callPrivate<Record<string, unknown>>(host, "buildApiConfiguration")

			expect(config.apiProvider).toBe("anthropic")
			expect(config.apiKey).toBeUndefined()
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
				host.sendToExtension({ type: "requestModes" })
				host.sendToExtension({ type: "requestCommands" })

				// Mark ready (should flush)
				host.markWebviewReady()

				// Check that webviewMessage events were emitted for pending messages
				expect(emitSpy).toHaveBeenCalledWith("webviewMessage", { type: "requestModes" })
				expect(emitSpy).toHaveBeenCalledWith("webviewMessage", { type: "requestCommands" })
			})
		})
	})

	describe("sendToExtension", () => {
		it("should queue message when webview not ready", () => {
			const host = createTestHost()
			const message: WebviewMessage = { type: "requestModes" }

			host.sendToExtension(message)

			const pending = getPrivate<unknown[]>(host, "pendingMessages")
			expect(pending).toContain(message)
		})

		it("should emit webviewMessage event when webview is ready", () => {
			const host = createTestHost()
			const emitSpy = vi.spyOn(host, "emit")
			const message: WebviewMessage = { type: "requestModes" }

			host.markWebviewReady()
			host.sendToExtension(message)

			expect(emitSpy).toHaveBeenCalledWith("webviewMessage", message)
		})

		it("should not queue message when webview is ready", () => {
			const host = createTestHost()

			host.markWebviewReady()
			host.sendToExtension({ type: "requestModes" })

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
	})

	describe("handleSayMessage", () => {
		let host: ExtensionHost
		let outputSpy: ReturnType<typeof vi.spyOn>
		let outputErrorSpy: ReturnType<typeof vi.spyOn>

		beforeEach(() => {
			host = createTestHost()
			// Mock process.stdout.write and process.stderr.write which are used by output() and outputError()
			vi.spyOn(process.stdout, "write").mockImplementation(() => true)
			vi.spyOn(process.stderr, "write").mockImplementation(() => true)
			// Spy on the output methods
			outputSpy = spyOnPrivate(host, "output")
			outputErrorSpy = spyOnPrivate(host, "outputError")
		})

		afterEach(() => {
			vi.restoreAllMocks()
		})

		it("should emit taskComplete for completion_result", () => {
			const emitSpy = vi.spyOn(host, "emit")

			callPrivate(host, "handleSayMessage", 123, "completion_result", "Task done", false)

			expect(emitSpy).toHaveBeenCalledWith("taskComplete")
			expect(outputSpy).toHaveBeenCalledWith("\n[task complete]", "Task done")
		})

		it("should output error messages without emitting taskError", () => {
			const emitSpy = vi.spyOn(host, "emit")

			callPrivate(host, "handleSayMessage", 123, "error", "Something went wrong", false)

			// Errors are informational - they don't terminate the task
			// The agent should decide what to do next
			expect(emitSpy).not.toHaveBeenCalledWith("taskError", "Something went wrong")
			expect(outputErrorSpy).toHaveBeenCalledWith("\n[error]", "Something went wrong")
		})

		it("should handle command_output messages", () => {
			// Mock writeStream since command_output now uses it directly
			const writeStreamSpy = spyOnPrivate(host, "writeStream")

			callPrivate(host, "handleSayMessage", 123, "command_output", "output text", false)

			// command_output now uses writeStream to bypass quiet mode
			expect(writeStreamSpy).toHaveBeenCalledWith("\n[command output] ")
			expect(writeStreamSpy).toHaveBeenCalledWith("output text")
			expect(writeStreamSpy).toHaveBeenCalledWith("\n")
		})

		it("should handle tool messages", () => {
			callPrivate(host, "handleSayMessage", 123, "tool", "tool usage", false)

			expect(outputSpy).toHaveBeenCalledWith("\n[tool]", "tool usage")
		})

		it("should skip already displayed complete messages", () => {
			// First display
			callPrivate(host, "handleSayMessage", 123, "completion_result", "Task done", false)
			outputSpy.mockClear()

			// Second display should be skipped
			callPrivate(host, "handleSayMessage", 123, "completion_result", "Task done", false)

			expect(outputSpy).not.toHaveBeenCalled()
		})

		it("should not output completion_result for partial messages", () => {
			const emitSpy = vi.spyOn(host, "emit")

			// Partial message should not trigger output or taskComplete
			callPrivate(host, "handleSayMessage", 123, "completion_result", "", true)

			expect(outputSpy).not.toHaveBeenCalled()
			expect(emitSpy).not.toHaveBeenCalledWith("taskComplete")
		})

		it("should output completion_result text when complete message arrives after partial", () => {
			const emitSpy = vi.spyOn(host, "emit")

			// First, a partial message with empty text (simulates streaming)
			callPrivate(host, "handleSayMessage", 123, "completion_result", "", true)
			outputSpy.mockClear()
			emitSpy.mockClear()

			// Then, the complete message with the actual completion text
			callPrivate(host, "handleSayMessage", 123, "completion_result", "Task completed successfully!", false)

			expect(outputSpy).toHaveBeenCalledWith("\n[task complete]", "Task completed successfully!")
			expect(emitSpy).toHaveBeenCalledWith("taskComplete")
		})

		it("should track displayed messages", () => {
			callPrivate(host, "handleSayMessage", 123, "tool", "test", false)

			const displayed = getPrivate<Map<number, unknown>>(host, "displayedMessages")
			expect(displayed.has(123)).toBe(true)
		})
	})

	describe("handleAskMessage", () => {
		let host: ExtensionHost
		let outputSpy: ReturnType<typeof vi.spyOn>

		beforeEach(() => {
			// Use nonInteractive mode for display-only behavior tests
			host = createTestHost({ nonInteractive: true })
			// Mock process.stdout.write which is used by output()
			vi.spyOn(process.stdout, "write").mockImplementation(() => true)
			outputSpy = spyOnPrivate(host, "output")
		})

		afterEach(() => {
			vi.restoreAllMocks()
		})

		it("should handle command type in non-interactive mode", () => {
			callPrivate(host, "handleAskMessage", 123, "command", "ls -la", false)

			expect(outputSpy).toHaveBeenCalledWith("\n[command]", "ls -la")
		})

		it("should handle tool type with JSON parsing in non-interactive mode", () => {
			const toolInfo = JSON.stringify({ tool: "write_file", path: "/test/file.txt" })

			callPrivate(host, "handleAskMessage", 123, "tool", toolInfo, false)

			expect(outputSpy).toHaveBeenCalledWith("\n[Tool Request] write_file")
			expect(outputSpy).toHaveBeenCalledWith("  path: /test/file.txt")
		})

		it("should handle tool type with content preview in non-interactive mode", () => {
			const toolInfo = JSON.stringify({
				tool: "write_file",
				content: "This is the content that will be written to the file. It might be long.",
			})

			callPrivate(host, "handleAskMessage", 123, "tool", toolInfo, false)

			// Content is now shown (all tool parameters are displayed)
			expect(outputSpy).toHaveBeenCalledWith("\n[Tool Request] write_file")
			expect(outputSpy).toHaveBeenCalledWith(
				"  content: This is the content that will be written to the file. It might be long.",
			)
		})

		it("should handle tool type with invalid JSON in non-interactive mode", () => {
			callPrivate(host, "handleAskMessage", 123, "tool", "not json", false)

			expect(outputSpy).toHaveBeenCalledWith("\n[Tool Request] unknown")
		})

		it("should not display duplicate messages for same ts", () => {
			const toolInfo = JSON.stringify({ tool: "read_file" })

			// First call
			callPrivate(host, "handleAskMessage", 123, "tool", toolInfo, false)
			outputSpy.mockClear()

			// Same ts - should be duplicate (already displayed)
			callPrivate(host, "handleAskMessage", 123, "tool", toolInfo, false)

			// Should not log again
			expect(outputSpy).not.toHaveBeenCalled()
		})

		it("should handle other ask types in non-interactive mode", () => {
			callPrivate(host, "handleAskMessage", 123, "question", "What is your name?", false)

			expect(outputSpy).toHaveBeenCalledWith("\n[question]", "What is your name?")
		})

		it("should skip partial messages", () => {
			callPrivate(host, "handleAskMessage", 123, "command", "ls -la", true)

			// Partial messages should be skipped
			expect(outputSpy).not.toHaveBeenCalled()
		})
	})

	describe("handleAskMessage - interactive mode", () => {
		let host: ExtensionHost
		let outputSpy: ReturnType<typeof vi.spyOn>

		beforeEach(() => {
			// Default interactive mode
			host = createTestHost({ nonInteractive: false })
			// Mock process.stdout.write which is used by output()
			vi.spyOn(process.stdout, "write").mockImplementation(() => true)
			outputSpy = spyOnPrivate(host, "output")
			// Mock readline to prevent actual prompting
			vi.spyOn(process.stdin, "on").mockImplementation(() => process.stdin)
		})

		afterEach(() => {
			vi.restoreAllMocks()
		})

		it("should mark ask as pending in interactive mode", () => {
			// This will try to prompt, but we're testing the pendingAsks tracking
			callPrivate(host, "handleAskMessage", 123, "command", "ls -la", false)

			const pendingAsks = getPrivate<Set<number>>(host, "pendingAsks")
			expect(pendingAsks.has(123)).toBe(true)
		})

		it("should skip already pending asks", () => {
			// First call - marks as pending
			callPrivate(host, "handleAskMessage", 123, "command", "ls -la", false)
			const callCount1 = outputSpy.mock.calls.length

			// Second call - should skip
			callPrivate(host, "handleAskMessage", 123, "command", "ls -la", false)
			const callCount2 = outputSpy.mock.calls.length

			// Should not have logged again
			expect(callCount2).toBe(callCount1)
		})
	})

	describe("handleFollowupQuestion", () => {
		let host: ExtensionHost
		let outputSpy: ReturnType<typeof vi.spyOn>

		beforeEach(() => {
			host = createTestHost({ nonInteractive: false })
			// Mock process.stdout.write which is used by output()
			vi.spyOn(process.stdout, "write").mockImplementation(() => true)
			outputSpy = spyOnPrivate(host, "output")
			// Mock readline to prevent actual prompting
			vi.spyOn(process.stdin, "on").mockImplementation(() => process.stdin)
		})

		afterEach(() => {
			vi.restoreAllMocks()
		})

		it("should parse followup question JSON with suggestion objects containing answer and mode", async () => {
			// This is the format from AskFollowupQuestionTool
			// { question: "...", suggest: [{ answer: "text", mode: "code" }, ...] }
			const text = JSON.stringify({
				question: "What would you like to do?",
				suggest: [
					{ answer: "Write code", mode: "code" },
					{ answer: "Debug issue", mode: "debug" },
					{ answer: "Just explain", mode: null },
				],
			})

			// Call the handler (it will try to prompt but we just want to test parsing)
			callPrivate(host, "handleFollowupQuestion", 123, text)

			// Should display the question
			expect(outputSpy).toHaveBeenCalledWith("\n[question]", "What would you like to do?")

			// Should display suggestions with answer text and mode hints
			expect(outputSpy).toHaveBeenCalledWith("\nSuggested answers:")
			expect(outputSpy).toHaveBeenCalledWith("  1. Write code (mode: code)")
			expect(outputSpy).toHaveBeenCalledWith("  2. Debug issue (mode: debug)")
			expect(outputSpy).toHaveBeenCalledWith("  3. Just explain")
		})

		it("should handle followup question with suggestions that have no mode", async () => {
			const text = JSON.stringify({
				question: "What path?",
				suggest: [{ answer: "./src/file.ts" }, { answer: "./lib/other.ts" }],
			})

			callPrivate(host, "handleFollowupQuestion", 123, text)

			expect(outputSpy).toHaveBeenCalledWith("\n[question]", "What path?")
			expect(outputSpy).toHaveBeenCalledWith("  1. ./src/file.ts")
			expect(outputSpy).toHaveBeenCalledWith("  2. ./lib/other.ts")
		})

		it("should handle plain text (non-JSON) as the question", async () => {
			callPrivate(host, "handleFollowupQuestion", 123, "What is your name?")

			expect(outputSpy).toHaveBeenCalledWith("\n[question]", "What is your name?")
		})

		it("should handle empty suggestions array", async () => {
			const text = JSON.stringify({
				question: "Tell me more",
				suggest: [],
			})

			callPrivate(host, "handleFollowupQuestion", 123, text)

			expect(outputSpy).toHaveBeenCalledWith("\n[question]", "Tell me more")
			// Should not show "Suggested answers:" if array is empty
			expect(outputSpy).not.toHaveBeenCalledWith("\nSuggested answers:")
		})
	})

	describe("handleFollowupQuestionWithTimeout", () => {
		let host: ExtensionHost
		let outputSpy: ReturnType<typeof vi.spyOn>
		const originalIsTTY = process.stdin.isTTY

		beforeEach(() => {
			// Non-interactive mode uses the timeout variant
			host = createTestHost({ nonInteractive: true })
			// Mock process.stdout.write which is used by output()
			vi.spyOn(process.stdout, "write").mockImplementation(() => true)
			outputSpy = spyOnPrivate(host, "output")
			// Mock stdin - set isTTY to false so setRawMode is not called
			Object.defineProperty(process.stdin, "isTTY", { value: false, writable: true })
			vi.spyOn(process.stdin, "on").mockImplementation(() => process.stdin)
			vi.spyOn(process.stdin, "resume").mockImplementation(() => process.stdin)
			vi.spyOn(process.stdin, "pause").mockImplementation(() => process.stdin)
			vi.spyOn(process.stdin, "removeListener").mockImplementation(() => process.stdin)
		})

		afterEach(() => {
			vi.restoreAllMocks()
			Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, writable: true })
		})

		it("should parse followup question JSON and display question with suggestions", () => {
			const text = JSON.stringify({
				question: "What would you like to do?",
				suggest: [
					{ answer: "Option A", mode: "code" },
					{ answer: "Option B", mode: null },
				],
			})

			// Call the handler - it will display the question and start the timeout
			callPrivate(host, "handleFollowupQuestionWithTimeout", 123, text)

			// Should display the question
			expect(outputSpy).toHaveBeenCalledWith("\n[question]", "What would you like to do?")

			// Should display suggestions
			expect(outputSpy).toHaveBeenCalledWith("\nSuggested answers:")
			expect(outputSpy).toHaveBeenCalledWith("  1. Option A (mode: code)")
			expect(outputSpy).toHaveBeenCalledWith("  2. Option B")
		})

		it("should handle non-JSON text as plain question", () => {
			callPrivate(host, "handleFollowupQuestionWithTimeout", 123, "Plain question text")

			expect(outputSpy).toHaveBeenCalledWith("\n[question]", "Plain question text")
		})

		it("should include auto-select hint in prompt when suggestions exist", () => {
			const stdoutWriteSpy = vi.spyOn(process.stdout, "write")
			const text = JSON.stringify({
				question: "Choose one",
				suggest: [{ answer: "First option" }],
			})

			callPrivate(host, "handleFollowupQuestionWithTimeout", 123, text)

			// Should show prompt with timeout hint
			expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining("auto-select in 60s"))
		})
	})

	describe("handleAskMessageNonInteractive - followup handling", () => {
		let host: ExtensionHost
		let _outputSpy: ReturnType<typeof vi.spyOn>
		let handleFollowupTimeoutSpy: ReturnType<typeof vi.spyOn>
		const originalIsTTY = process.stdin.isTTY

		beforeEach(() => {
			host = createTestHost({ nonInteractive: true })
			vi.spyOn(process.stdout, "write").mockImplementation(() => true)
			_outputSpy = spyOnPrivate(host, "output")
			handleFollowupTimeoutSpy = spyOnPrivate(host, "handleFollowupQuestionWithTimeout")
			// Mock stdin - set isTTY to false so setRawMode is not called
			Object.defineProperty(process.stdin, "isTTY", { value: false, writable: true })
			vi.spyOn(process.stdin, "on").mockImplementation(() => process.stdin)
			vi.spyOn(process.stdin, "resume").mockImplementation(() => process.stdin)
			vi.spyOn(process.stdin, "pause").mockImplementation(() => process.stdin)
			vi.spyOn(process.stdin, "removeListener").mockImplementation(() => process.stdin)
		})

		afterEach(() => {
			vi.restoreAllMocks()
			Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, writable: true })
		})

		it("should call handleFollowupQuestionWithTimeout for followup asks in non-interactive mode", () => {
			const text = JSON.stringify({
				question: "What to do?",
				suggest: [{ answer: "Do something" }],
			})

			callPrivate(host, "handleAskMessageNonInteractive", 123, "followup", text)

			expect(handleFollowupTimeoutSpy).toHaveBeenCalledWith(123, text)
		})

		it("should add ts to pendingAsks for followup in non-interactive mode", () => {
			const text = JSON.stringify({
				question: "What to do?",
				suggest: [{ answer: "Do something" }],
			})

			callPrivate(host, "handleAskMessageNonInteractive", 123, "followup", text)

			const pendingAsks = getPrivate<Set<number>>(host, "pendingAsks")
			expect(pendingAsks.has(123)).toBe(true)
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
			it("should suppress console.log, warn, debug, info when enabled", () => {
				const host = createTestHost()
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
				const host = createTestHost()
				const originalError = console.error

				callPrivate(host, "setupQuietMode")

				expect(console.error).toBe(originalError)

				callPrivate(host, "restoreConsole")
			})

			it("should store original console methods", () => {
				const host = createTestHost()
				const originalLog = console.log

				callPrivate(host, "setupQuietMode")

				const stored = getPrivate<{ log: typeof console.log }>(host, "originalConsole")
				expect(stored.log).toBe(originalLog)

				callPrivate(host, "restoreConsole")
			})
		})

		describe("restoreConsole", () => {
			it("should restore original console methods", () => {
				const host = createTestHost()
				const originalLog = console.log

				callPrivate(host, "setupQuietMode")
				callPrivate(host, "restoreConsole")

				expect(console.log).toBe(originalLog)
			})

			it("should handle case where console was not suppressed", () => {
				const host = createTestHost()

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
	})

	describe("handleStateMessage - mode tracking", () => {
		let host: ExtensionHost

		beforeEach(() => {
			host = createTestHost({
				mode: "code",
				provider: "anthropic",
				apiKey: "test-key",
				model: "test-model",
			})
			// Mock process.stdout.write which is used by output()
			vi.spyOn(process.stdout, "write").mockImplementation(() => true)
		})

		afterEach(() => {
			vi.restoreAllMocks()
		})

		it("should track current mode when state updates with a mode", () => {
			// Initial state update establishes current mode
			callPrivate(host, "handleStateMessage", { type: "state", state: { mode: "code", clineMessages: [] } })
			expect(getPrivate(host, "currentMode")).toBe("code")

			// Second state update should update tracked mode
			callPrivate(host, "handleStateMessage", { type: "state", state: { mode: "architect", clineMessages: [] } })
			expect(getPrivate(host, "currentMode")).toBe("architect")
		})

		it("should not change current mode when state has no mode", () => {
			// Initial state update establishes current mode
			callPrivate(host, "handleStateMessage", { type: "state", state: { mode: "code", clineMessages: [] } })
			expect(getPrivate(host, "currentMode")).toBe("code")

			// State without mode should not change tracked mode
			callPrivate(host, "handleStateMessage", { type: "state", state: { clineMessages: [] } })
			expect(getPrivate(host, "currentMode")).toBe("code")
		})

		it("should track current mode across multiple changes", () => {
			// Start with code mode
			callPrivate(host, "handleStateMessage", { type: "state", state: { mode: "code", clineMessages: [] } })
			expect(getPrivate(host, "currentMode")).toBe("code")

			// Change to architect
			callPrivate(host, "handleStateMessage", { type: "state", state: { mode: "architect", clineMessages: [] } })
			expect(getPrivate(host, "currentMode")).toBe("architect")

			// Change to debug
			callPrivate(host, "handleStateMessage", { type: "state", state: { mode: "debug", clineMessages: [] } })
			expect(getPrivate(host, "currentMode")).toBe("debug")

			// Another state update with debug
			callPrivate(host, "handleStateMessage", { type: "state", state: { mode: "debug", clineMessages: [] } })
			expect(getPrivate(host, "currentMode")).toBe("debug")
		})

		it("should not send updateSettings on mode change (CLI settings are applied once during runTask)", () => {
			// This test ensures mode changes don't trigger automatic re-application of API settings.
			// CLI settings are applied once during runTask() via updateSettings.
			// Mode-specific provider profiles are handled by the extension's handleModeSwitch.
			const sendToExtensionSpy = vi.spyOn(host, "sendToExtension")

			// Initial state
			callPrivate(host, "handleStateMessage", { type: "state", state: { mode: "code", clineMessages: [] } })
			sendToExtensionSpy.mockClear()

			// Mode change should NOT trigger sendToExtension
			callPrivate(host, "handleStateMessage", { type: "state", state: { mode: "architect", clineMessages: [] } })
			expect(sendToExtensionSpy).not.toHaveBeenCalled()
		})
	})

	describe("applyRuntimeSettings - mode switching", () => {
		it("should use currentMode when set (from user mode switches)", () => {
			const host = createTestHost({
				mode: "code", // Initial mode from CLI options
				provider: "anthropic",
				apiKey: "test-key",
				model: "test-model",
			})

			// Simulate user switching mode via Ctrl+M - this updates currentMode
			;(host as unknown as Record<string, unknown>).currentMode = "architect"

			// Create settings object to be modified
			const settings: Record<string, unknown> = {}
			callPrivate(host, "applyRuntimeSettings", settings)

			// Should use currentMode (architect), not options.mode (code)
			expect(settings.mode).toBe("architect")
		})

		it("should fall back to options.mode when currentMode is not set", () => {
			const host = createTestHost({
				mode: "code",
				provider: "anthropic",
				apiKey: "test-key",
				model: "test-model",
			})

			// currentMode is not set (still null from constructor)
			expect(getPrivate(host, "currentMode")).toBe("code") // Set from options.mode in constructor

			const settings: Record<string, unknown> = {}
			callPrivate(host, "applyRuntimeSettings", settings)

			// Should use options.mode as fallback
			expect(settings.mode).toBe("code")
		})

		it("should use currentMode even when it differs from initial options.mode", () => {
			const host = createTestHost({
				mode: "code",
				provider: "anthropic",
				apiKey: "test-key",
				model: "test-model",
			})

			// Simulate multiple mode switches: code -> architect -> debug
			;(host as unknown as Record<string, unknown>).currentMode = "debug"

			const settings: Record<string, unknown> = {}
			callPrivate(host, "applyRuntimeSettings", settings)

			// Should use the latest currentMode
			expect(settings.mode).toBe("debug")
		})

		it("should not set mode if neither currentMode nor options.mode is set", () => {
			const host = createTestHost({
				// No mode specified - mode defaults to "code" in createTestHost
				provider: "anthropic",
				apiKey: "test-key",
				model: "test-model",
			})

			// Explicitly set currentMode to null (edge case)
			;(host as unknown as Record<string, unknown>).currentMode = null
			// Also clear options.mode
			const options = getPrivate<ExtensionHostOptions>(host, "options")
			options.mode = ""

			const settings: Record<string, unknown> = {}
			callPrivate(host, "applyRuntimeSettings", settings)

			// Mode should not be set
			expect(settings.mode).toBeUndefined()
		})
	})

	describe("mode switching - end to end simulation", () => {
		let host: ExtensionHost

		beforeEach(() => {
			host = createTestHost({
				mode: "code",
				provider: "anthropic",
				apiKey: "test-key",
				model: "test-model",
			})
			vi.spyOn(process.stdout, "write").mockImplementation(() => true)
		})

		afterEach(() => {
			vi.restoreAllMocks()
		})

		it("should preserve mode switch when starting a new task", () => {
			// Step 1: Initial state from extension (like webviewDidLaunch response)
			callPrivate(host, "handleStateMessage", {
				type: "state",
				state: { mode: "code", clineMessages: [] },
			})
			expect(getPrivate(host, "currentMode")).toBe("code")

			// Step 2: User presses Ctrl+M to switch mode, extension sends new state
			callPrivate(host, "handleStateMessage", {
				type: "state",
				state: { mode: "architect", clineMessages: [] },
			})
			expect(getPrivate(host, "currentMode")).toBe("architect")

			// Step 3: When runTask is called, applyRuntimeSettings should use architect
			const settings: Record<string, unknown> = {}
			callPrivate(host, "applyRuntimeSettings", settings)
			expect(settings.mode).toBe("architect")
		})

		it("should handle mode switch before any state messages", () => {
			// currentMode is initialized to options.mode in constructor
			expect(getPrivate(host, "currentMode")).toBe("code")

			// Without any state messages, should still use options.mode
			const settings: Record<string, unknown> = {}
			callPrivate(host, "applyRuntimeSettings", settings)
			expect(settings.mode).toBe("code")
		})

		it("should track multiple mode switches correctly", () => {
			// Switch through multiple modes
			callPrivate(host, "handleStateMessage", {
				type: "state",
				state: { mode: "code", clineMessages: [] },
			})
			callPrivate(host, "handleStateMessage", {
				type: "state",
				state: { mode: "architect", clineMessages: [] },
			})
			callPrivate(host, "handleStateMessage", {
				type: "state",
				state: { mode: "debug", clineMessages: [] },
			})
			callPrivate(host, "handleStateMessage", {
				type: "state",
				state: { mode: "ask", clineMessages: [] },
			})

			// Should use the most recent mode
			expect(getPrivate(host, "currentMode")).toBe("ask")

			const settings: Record<string, unknown> = {}
			callPrivate(host, "applyRuntimeSettings", settings)
			expect(settings.mode).toBe("ask")
		})
	})

	describe("ephemeral mode", () => {
		describe("constructor", () => {
			it("should store ephemeral option", () => {
				const host = createTestHost({ ephemeral: true })
				const options = getPrivate<ExtensionHostOptions>(host, "options")
				expect(options.ephemeral).toBe(true)
			})

			it("should default ephemeral to undefined", () => {
				const host = createTestHost()
				const options = getPrivate<ExtensionHostOptions>(host, "options")
				expect(options.ephemeral).toBeUndefined()
			})

			it("should initialize ephemeralStorageDir to null", () => {
				const host = createTestHost({ ephemeral: true })
				expect(getPrivate(host, "ephemeralStorageDir")).toBeNull()
			})
		})

		describe("createEphemeralStorageDir", () => {
			let createdDirs: string[] = []

			afterEach(async () => {
				// Clean up any directories created during tests
				for (const dir of createdDirs) {
					try {
						await fs.promises.rm(dir, { recursive: true, force: true })
					} catch {
						// Ignore cleanup errors
					}
				}
				createdDirs = []
			})

			it("should create a directory in the system temp folder", async () => {
				const host = createTestHost({ ephemeral: true })
				const tmpDir = await callPrivate<Promise<string>>(host, "createEphemeralStorageDir")
				createdDirs.push(tmpDir)

				expect(tmpDir).toContain(os.tmpdir())
				expect(tmpDir).toContain("roo-cli-")
				expect(fs.existsSync(tmpDir)).toBe(true)
			})

			it("should create a unique directory each time", async () => {
				const host = createTestHost({ ephemeral: true })
				const dir1 = await callPrivate<Promise<string>>(host, "createEphemeralStorageDir")
				const dir2 = await callPrivate<Promise<string>>(host, "createEphemeralStorageDir")
				createdDirs.push(dir1, dir2)

				expect(dir1).not.toBe(dir2)
				expect(fs.existsSync(dir1)).toBe(true)
				expect(fs.existsSync(dir2)).toBe(true)
			})

			it("should include timestamp and random id in directory name", async () => {
				const host = createTestHost({ ephemeral: true })
				const tmpDir = await callPrivate<Promise<string>>(host, "createEphemeralStorageDir")
				createdDirs.push(tmpDir)

				const dirName = path.basename(tmpDir)
				// Format: roo-cli-{timestamp}-{randomId}
				expect(dirName).toMatch(/^roo-cli-\d+-[a-z0-9]+$/)
			})
		})

		describe("dispose - ephemeral cleanup", () => {
			it("should clean up ephemeral storage directory on dispose", async () => {
				const host = createTestHost({ ephemeral: true })

				// Create the ephemeral directory
				const tmpDir = await callPrivate<Promise<string>>(host, "createEphemeralStorageDir")
				;(host as unknown as Record<string, unknown>).ephemeralStorageDir = tmpDir

				// Verify directory exists
				expect(fs.existsSync(tmpDir)).toBe(true)

				// Dispose the host
				await host.dispose()

				// Directory should be removed
				expect(fs.existsSync(tmpDir)).toBe(false)
				expect(getPrivate(host, "ephemeralStorageDir")).toBeNull()
			})

			it("should not fail dispose if ephemeral directory doesn't exist", async () => {
				const host = createTestHost({ ephemeral: true })

				// Set a non-existent directory
				;(host as unknown as Record<string, unknown>).ephemeralStorageDir = "/non/existent/path/roo-cli-test"

				// Dispose should not throw
				await expect(host.dispose()).resolves.toBeUndefined()
			})

			it("should clean up ephemeral directory with contents", async () => {
				const host = createTestHost({ ephemeral: true })

				// Create the ephemeral directory with some content
				const tmpDir = await callPrivate<Promise<string>>(host, "createEphemeralStorageDir")
				;(host as unknown as Record<string, unknown>).ephemeralStorageDir = tmpDir

				// Add some files and subdirectories
				await fs.promises.writeFile(path.join(tmpDir, "test.txt"), "test content")
				await fs.promises.mkdir(path.join(tmpDir, "subdir"))
				await fs.promises.writeFile(path.join(tmpDir, "subdir", "nested.txt"), "nested content")

				// Verify content exists
				expect(fs.existsSync(path.join(tmpDir, "test.txt"))).toBe(true)
				expect(fs.existsSync(path.join(tmpDir, "subdir", "nested.txt"))).toBe(true)

				// Dispose the host
				await host.dispose()

				// Directory and all contents should be removed
				expect(fs.existsSync(tmpDir)).toBe(false)
			})

			it("should not clean up anything if not in ephemeral mode", async () => {
				const host = createTestHost({ ephemeral: false })

				// ephemeralStorageDir should be null
				expect(getPrivate(host, "ephemeralStorageDir")).toBeNull()

				// Dispose should complete normally
				await expect(host.dispose()).resolves.toBeUndefined()
			})
		})
	})
})
