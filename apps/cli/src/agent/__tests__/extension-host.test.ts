// pnpm --filter @roo-code/cli test src/agent/__tests__/extension-host.test.ts

import { EventEmitter } from "events"
import fs from "fs"
import os from "os"
import path from "path"

import type { WebviewMessage } from "@roo-code/types"

import { type ExtensionHostOptions, ExtensionHost } from "../extension-host.js"

vi.mock("@roo-code/vscode-shim", () => ({
	createVSCodeAPI: vi.fn(() => ({
		context: { extensionPath: "/test/extension" },
	})),
	setRuntimeConfigValues: vi.fn(),
}))

/**
 * Create a test ExtensionHost with default options.
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

		it("should initialize managers", () => {
			const host = createTestHost()

			// Should have client, outputManager, promptManager, and askDispatcher
			expect(getPrivate(host, "client")).toBeDefined()
			expect(getPrivate(host, "outputManager")).toBeDefined()
			expect(getPrivate(host, "promptManager")).toBeDefined()
			expect(getPrivate(host, "askDispatcher")).toBeDefined()
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
		it("should forward messages to the client", () => {
			const host = createTestHost()
			const client = host.getExtensionClient()
			const handleMessageSpy = vi.spyOn(client, "handleMessage")

			callPrivate(host, "handleExtensionMessage", { type: "state", state: { clineMessages: [] } })

			expect(handleMessageSpy).toHaveBeenCalled()
		})

		it("should track mode from state messages", () => {
			const host = createTestHost()

			callPrivate(host, "handleExtensionMessage", {
				type: "state",
				state: { mode: "architect", clineMessages: [] },
			})

			expect(getPrivate(host, "currentMode")).toBe("architect")
		})

		it("should emit modesUpdated for modes messages", () => {
			const host = createTestHost()
			const emitSpy = vi.spyOn(host, "emit")

			callPrivate(host, "handleExtensionMessage", { type: "modes", modes: [] })

			expect(emitSpy).toHaveBeenCalledWith("modesUpdated", { type: "modes", modes: [] })
		})
	})

	describe("public agent state API", () => {
		it("should return agent state from getAgentState()", () => {
			const host = createTestHost()
			const state = host.getAgentState()

			expect(state).toBeDefined()
			expect(state.state).toBeDefined()
			expect(state.isWaitingForInput).toBeDefined()
			expect(state.isRunning).toBeDefined()
		})

		it("should return isWaitingForInput() status", () => {
			const host = createTestHost()
			expect(typeof host.isWaitingForInput()).toBe("boolean")
		})

		it("should return isAgentRunning() status", () => {
			const host = createTestHost()
			expect(typeof host.isAgentRunning()).toBe("boolean")
		})

		it("should return the client from getExtensionClient()", () => {
			const host = createTestHost()
			const client = host.getExtensionClient()

			expect(client).toBeDefined()
			expect(typeof client.handleMessage).toBe("function")
		})

		it("should return the output manager from getOutputManager()", () => {
			const host = createTestHost()
			const outputManager = host.getOutputManager()

			expect(outputManager).toBeDefined()
			expect(typeof outputManager.output).toBe("function")
		})

		it("should return the prompt manager from getPromptManager()", () => {
			const host = createTestHost()
			const promptManager = host.getPromptManager()

			expect(promptManager).toBeDefined()
		})

		it("should return the ask dispatcher from getAskDispatcher()", () => {
			const host = createTestHost()
			const askDispatcher = host.getAskDispatcher()

			expect(askDispatcher).toBeDefined()
			expect(typeof askDispatcher.handleAsk).toBe("function")
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

		it("should clear managers", async () => {
			const outputManager = host.getOutputManager()
			const askDispatcher = host.getAskDispatcher()
			const outputClearSpy = vi.spyOn(outputManager, "clear")
			const askClearSpy = vi.spyOn(askDispatcher, "clear")

			await host.dispose()

			expect(outputClearSpy).toHaveBeenCalled()
			expect(askClearSpy).toHaveBeenCalled()
		})

		it("should reset client", async () => {
			const client = host.getExtensionClient()
			const resetSpy = vi.spyOn(client, "reset")

			await host.dispose()

			expect(resetSpy).toHaveBeenCalled()
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

	describe("mode tracking via handleExtensionMessage", () => {
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
			callPrivate(host, "handleExtensionMessage", { type: "state", state: { mode: "code", clineMessages: [] } })
			expect(getPrivate(host, "currentMode")).toBe("code")

			// Second state update should update tracked mode
			callPrivate(host, "handleExtensionMessage", {
				type: "state",
				state: { mode: "architect", clineMessages: [] },
			})
			expect(getPrivate(host, "currentMode")).toBe("architect")
		})

		it("should not change current mode when state has no mode", () => {
			// Initial state update establishes current mode
			callPrivate(host, "handleExtensionMessage", { type: "state", state: { mode: "code", clineMessages: [] } })
			expect(getPrivate(host, "currentMode")).toBe("code")

			// State without mode should not change tracked mode
			callPrivate(host, "handleExtensionMessage", { type: "state", state: { clineMessages: [] } })
			expect(getPrivate(host, "currentMode")).toBe("code")
		})

		it("should track current mode across multiple changes", () => {
			// Start with code mode
			callPrivate(host, "handleExtensionMessage", { type: "state", state: { mode: "code", clineMessages: [] } })
			expect(getPrivate(host, "currentMode")).toBe("code")

			// Change to architect
			callPrivate(host, "handleExtensionMessage", {
				type: "state",
				state: { mode: "architect", clineMessages: [] },
			})
			expect(getPrivate(host, "currentMode")).toBe("architect")

			// Change to debug
			callPrivate(host, "handleExtensionMessage", { type: "state", state: { mode: "debug", clineMessages: [] } })
			expect(getPrivate(host, "currentMode")).toBe("debug")

			// Another state update with debug
			callPrivate(host, "handleExtensionMessage", { type: "state", state: { mode: "debug", clineMessages: [] } })
			expect(getPrivate(host, "currentMode")).toBe("debug")
		})

		it("should not send updateSettings on mode change (CLI settings are applied once during runTask)", () => {
			// This test ensures mode changes don't trigger automatic re-application of API settings.
			// CLI settings are applied once during runTask() via updateSettings.
			// Mode-specific provider profiles are handled by the extension's handleModeSwitch.
			const sendToExtensionSpy = vi.spyOn(host, "sendToExtension")

			// Initial state
			callPrivate(host, "handleExtensionMessage", { type: "state", state: { mode: "code", clineMessages: [] } })
			sendToExtensionSpy.mockClear()

			// Mode change should NOT trigger sendToExtension
			callPrivate(host, "handleExtensionMessage", {
				type: "state",
				state: { mode: "architect", clineMessages: [] },
			})
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
			callPrivate(host, "handleExtensionMessage", {
				type: "state",
				state: { mode: "code", clineMessages: [] },
			})
			expect(getPrivate(host, "currentMode")).toBe("code")

			// Step 2: User presses Ctrl+M to switch mode, extension sends new state
			callPrivate(host, "handleExtensionMessage", {
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
			callPrivate(host, "handleExtensionMessage", {
				type: "state",
				state: { mode: "code", clineMessages: [] },
			})
			callPrivate(host, "handleExtensionMessage", {
				type: "state",
				state: { mode: "architect", clineMessages: [] },
			})
			callPrivate(host, "handleExtensionMessage", {
				type: "state",
				state: { mode: "debug", clineMessages: [] },
			})
			callPrivate(host, "handleExtensionMessage", {
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
