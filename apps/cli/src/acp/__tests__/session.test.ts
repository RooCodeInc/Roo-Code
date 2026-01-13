import type * as acp from "@agentclientprotocol/sdk"
import { AgentLoopState } from "@/agent/agent-state.js"

// Track registered event handlers for simulation
type EventHandler = (data: unknown) => void
const clientEventHandlers: Map<string, EventHandler[]> = new Map()

vi.mock("@/agent/extension-host.js", () => {
	const mockClient = {
		on: vi.fn().mockImplementation((event: string, handler: EventHandler) => {
			const handlers = clientEventHandlers.get(event) || []
			handlers.push(handler)
			clientEventHandlers.set(event, handlers)
			return mockClient
		}),
		off: vi.fn().mockReturnThis(),
		respond: vi.fn(),
		approve: vi.fn(),
		reject: vi.fn(),
		getAgentState: vi.fn().mockReturnValue({
			state: AgentLoopState.RUNNING,
			isRunning: true,
			isStreaming: false,
			currentAsk: null,
		}),
	}

	return {
		ExtensionHost: vi.fn().mockImplementation(() => ({
			client: mockClient,
			activate: vi.fn().mockResolvedValue(undefined),
			dispose: vi.fn().mockResolvedValue(undefined),
			sendToExtension: vi.fn(),
			// Add on/off methods for extension host events (e.g., extensionWebviewMessage)
			on: vi.fn().mockReturnThis(),
			off: vi.fn().mockReturnThis(),
		})),
	}
})

/**
 * Simulate the extension responding to a cancel by emitting a state change to a terminal state.
 */
function simulateExtensionCancelResponse(): void {
	const handlers = clientEventHandlers.get("stateChange") || []
	handlers.forEach((handler) => {
		handler({
			previousState: { state: AgentLoopState.RUNNING, isRunning: true, isStreaming: false },
			currentState: { state: AgentLoopState.IDLE, isRunning: false, isStreaming: false },
		})
	})
}

import { AcpSession, type AcpSessionOptions } from "../session.js"
import { ExtensionHost } from "@/agent/extension-host.js"

describe("AcpSession", () => {
	let mockConnection: acp.AgentSideConnection

	const defaultOptions: AcpSessionOptions = {
		extensionPath: "/test/extension",
		provider: "openrouter",
		apiKey: "test-api-key",
		model: "test-model",
		mode: "code",
	}

	beforeEach(() => {
		// Clear registered event handlers between tests
		clientEventHandlers.clear()

		mockConnection = {
			sessionUpdate: vi.fn().mockResolvedValue(undefined),
			requestPermission: vi.fn().mockResolvedValue({
				outcome: { outcome: "selected", optionId: "allow" },
			}),
			readTextFile: vi.fn().mockResolvedValue({ content: "test content" }),
			writeTextFile: vi.fn().mockResolvedValue({}),
			createTerminal: vi.fn(),
			extMethod: vi.fn(),
			extNotification: vi.fn(),
			signal: new AbortController().signal,
			closed: Promise.resolve(),
		} as unknown as acp.AgentSideConnection

		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
		clientEventHandlers.clear()
	})

	describe("create", () => {
		it("should create a session with a unique ID", async () => {
			const session = await AcpSession.create({
				sessionId: "test-session-1",
				cwd: "/test/workspace",
				connection: mockConnection,
				options: defaultOptions,
				deps: {},
			})

			expect(session).toBeDefined()
			expect(session.getSessionId()).toBe("test-session-1")
		})

		it("should create ExtensionHost with correct config", async () => {
			await AcpSession.create({
				sessionId: "test-session-2",
				cwd: "/test/workspace",
				connection: mockConnection,
				options: defaultOptions,
				deps: {},
			})

			expect(ExtensionHost).toHaveBeenCalledWith(
				expect.objectContaining({
					extensionPath: "/test/extension",
					workspacePath: "/test/workspace",
					provider: "openrouter",
					apiKey: "test-api-key",
					model: "test-model",
					mode: "code",
				}),
			)
		})

		it("should accept client capabilities", async () => {
			const session = await AcpSession.create({
				sessionId: "test-session-3",
				cwd: "/test/workspace",
				connection: mockConnection,
				options: defaultOptions,
				deps: {},
			})

			expect(session).toBeDefined()
		})

		it("should activate the extension host", async () => {
			await AcpSession.create({
				sessionId: "test-session-4",
				cwd: "/test/workspace",
				connection: mockConnection,
				options: defaultOptions,
				deps: {},
			})

			const mockHostInstance = vi.mocked(ExtensionHost).mock.results[0]!.value
			expect(mockHostInstance.activate).toHaveBeenCalled()
		})
	})

	describe("prompt", () => {
		it("should send a task to the extension host", async () => {
			const session = await AcpSession.create({
				sessionId: "test-session",
				cwd: "/test/workspace",
				connection: mockConnection,
				options: defaultOptions,
				deps: {},
			})

			const mockHostInstance = vi.mocked(ExtensionHost).mock.results[0]!.value

			// Start the prompt (don't await - it waits for taskCompleted event)
			const promptPromise = session.prompt({
				sessionId: "test-session",
				prompt: [{ type: "text", text: "Hello, world!" }],
			})

			// Verify the task was sent
			expect(mockHostInstance.sendToExtension).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "newTask",
					text: "Hello, world!",
				}),
			)

			// Cancel to resolve the promise - simulate extension responding to cancel
			session.cancel()
			simulateExtensionCancelResponse()
			const result = await promptPromise
			expect(result.stopReason).toBe("cancelled")
		})

		it("should handle image prompts", async () => {
			const session = await AcpSession.create({
				sessionId: "test-session",
				cwd: "/test/workspace",
				connection: mockConnection,
				options: defaultOptions,
				deps: {},
			})

			const mockHostInstance = vi.mocked(ExtensionHost).mock.results[0]!.value

			const promptPromise = session.prompt({
				sessionId: "test-session",
				prompt: [
					{ type: "text", text: "Describe this image" },
					{ type: "image", mimeType: "image/png", data: "base64data" },
				],
			})

			// Images are extracted as raw base64 data, text includes [image content] placeholder
			expect(mockHostInstance.sendToExtension).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "newTask",
					images: expect.arrayContaining(["base64data"]),
				}),
			)

			session.cancel()
			simulateExtensionCancelResponse()
			await promptPromise
		})
	})

	describe("cancel", () => {
		it("should send cancel message to extension host", async () => {
			const session = await AcpSession.create({
				sessionId: "test-session",
				cwd: "/test/workspace",
				connection: mockConnection,
				options: defaultOptions,
				deps: {},
			})

			const mockHostInstance = vi.mocked(ExtensionHost).mock.results[0]!.value

			// Start a prompt first
			const promptPromise = session.prompt({
				sessionId: "test-session",
				prompt: [{ type: "text", text: "Hello" }],
			})

			// Cancel and simulate extension responding
			session.cancel()
			simulateExtensionCancelResponse()

			expect(mockHostInstance.sendToExtension).toHaveBeenCalledWith({ type: "cancelTask" })

			await promptPromise
		})
	})

	describe("setMode", () => {
		it("should update the session mode", async () => {
			const session = await AcpSession.create({
				sessionId: "test-session",
				cwd: "/test/workspace",
				connection: mockConnection,
				options: defaultOptions,
				deps: {},
			})

			const mockHostInstance = vi.mocked(ExtensionHost).mock.results[0]!.value

			session.setMode("architect")

			expect(mockHostInstance.sendToExtension).toHaveBeenCalledWith({
				type: "updateSettings",
				updatedSettings: { mode: "architect" },
			})
		})
	})

	describe("dispose", () => {
		it("should dispose the extension host", async () => {
			const session = await AcpSession.create({
				sessionId: "test-session",
				cwd: "/test/workspace",
				connection: mockConnection,
				options: defaultOptions,
				deps: {},
			})

			const mockHostInstance = vi.mocked(ExtensionHost).mock.results[0]!.value

			await session.dispose()

			expect(mockHostInstance.dispose).toHaveBeenCalled()
		})
	})

	describe("getSessionId", () => {
		it("should return the session ID", async () => {
			const session = await AcpSession.create({
				sessionId: "my-unique-session-id",
				cwd: "/test/workspace",
				connection: mockConnection,
				options: defaultOptions,
				deps: {},
			})

			expect(session.getSessionId()).toBe("my-unique-session-id")
		})
	})
})
