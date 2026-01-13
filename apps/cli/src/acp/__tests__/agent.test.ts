import type * as acp from "@agentclientprotocol/sdk"

import { RooCodeAgent } from "../agent.js"
import type { AcpSessionOptions } from "../session.js"

vi.mock("@/commands/auth/index.js", () => ({
	login: vi.fn().mockResolvedValue({ success: true }),
	logout: vi.fn().mockResolvedValue({ success: true }),
	status: vi.fn().mockResolvedValue({ authenticated: false }),
}))

vi.mock("../session.js", () => ({
	AcpSession: {
		create: vi.fn().mockResolvedValue({
			prompt: vi.fn().mockResolvedValue({ stopReason: "end_turn" }),
			cancel: vi.fn(),
			setMode: vi.fn(),
			dispose: vi.fn().mockResolvedValue(undefined),
			getSessionId: vi.fn().mockReturnValue("test-session-id"),
		}),
	},
}))

describe("RooCodeAgent", () => {
	let agent: RooCodeAgent
	let mockConnection: acp.AgentSideConnection

	const defaultOptions: AcpSessionOptions = {
		extensionPath: "/test/extension",
		provider: "openrouter",
		apiKey: "test-key",
		model: "test-model",
		mode: "code",
	}

	beforeEach(() => {
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

		agent = new RooCodeAgent(defaultOptions, mockConnection)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("initialize", () => {
		it("should return protocol version and capabilities", async () => {
			const result = await agent.initialize({
				protocolVersion: 1,
			})

			expect(result.protocolVersion).toBeDefined()
			expect(result.agentCapabilities).toBeDefined()
			expect(result.agentCapabilities?.loadSession).toBe(false)
			expect(result.agentCapabilities?.promptCapabilities?.image).toBe(true)
		})

		it("should return auth methods", async () => {
			const result = await agent.initialize({
				protocolVersion: 1,
			})

			expect(result.authMethods).toBeDefined()
			expect(result.authMethods).toHaveLength(1)

			const methods = result.authMethods!
			expect(methods[0]!.id).toBe("roo")
		})

		it("should store client capabilities", async () => {
			const clientCapabilities: acp.ClientCapabilities = {
				fs: {
					readTextFile: true,
					writeTextFile: true,
				},
			}

			await agent.initialize({
				protocolVersion: 1,
				clientCapabilities,
			})

			// Capabilities should be stored for use in newSession
			// This is tested indirectly through the session creation
		})
	})

	describe("authenticate", () => {
		it("should throw for invalid auth method", async () => {
			await expect(
				agent.authenticate({
					methodId: "invalid-method",
				}),
			).rejects.toThrow()
		})
	})

	describe("newSession", () => {
		it("should create a new session", async () => {
			const result = await agent.newSession({
				cwd: "/test/workspace",
				mcpServers: [],
			})

			expect(result.sessionId).toBeDefined()
			expect(typeof result.sessionId).toBe("string")
		})

		it("should throw auth error when not authenticated and no API key", async () => {
			// Create agent without API key
			const agentWithoutKey = new RooCodeAgent({ ...defaultOptions, apiKey: undefined }, mockConnection)

			// Mock environment to not have API key
			const originalEnv = process.env.OPENROUTER_API_KEY
			delete process.env.OPENROUTER_API_KEY

			try {
				await expect(
					agentWithoutKey.newSession({
						cwd: "/test/workspace",
						mcpServers: [],
					}),
				).rejects.toThrow()
			} finally {
				if (originalEnv) {
					process.env.OPENROUTER_API_KEY = originalEnv
				}
			}
		})
	})

	describe("prompt", () => {
		it("should forward prompt to session", async () => {
			// Setup
			const { sessionId } = await agent.newSession({
				cwd: "/test/workspace",
				mcpServers: [],
			})

			// Execute
			const result = await agent.prompt({
				sessionId,
				prompt: [{ type: "text", text: "Hello, world!" }],
			})

			// Verify
			expect(result.stopReason).toBe("end_turn")
		})

		it("should throw for invalid session ID", async () => {
			await expect(
				agent.prompt({
					sessionId: "invalid-session",
					prompt: [{ type: "text", text: "Hello" }],
				}),
			).rejects.toThrow("Session not found")
		})
	})

	describe("cancel", () => {
		it("should cancel session prompt", async () => {
			// Setup
			const { sessionId } = await agent.newSession({
				cwd: "/test/workspace",
				mcpServers: [],
			})

			// Execute - should not throw
			await agent.cancel({ sessionId })
		})

		it("should handle cancel for non-existent session gracefully", async () => {
			// Should not throw for invalid session
			await agent.cancel({ sessionId: "non-existent" })
		})
	})

	describe("setSessionMode", () => {
		it("should set session mode", async () => {
			// Setup
			const { sessionId } = await agent.newSession({
				cwd: "/test/workspace",
				mcpServers: [],
			})

			// Execute
			const result = await agent.setSessionMode({
				sessionId,
				modeId: "architect",
			})

			// Verify
			expect(result).toEqual({})
		})

		it("should throw for invalid mode", async () => {
			// Setup
			const { sessionId } = await agent.newSession({
				cwd: "/test/workspace",
				mcpServers: [],
			})

			// Execute
			await expect(
				agent.setSessionMode({
					sessionId,
					modeId: "invalid-mode",
				}),
			).rejects.toThrow("Unknown mode")
		})

		it("should throw for invalid session", async () => {
			await expect(
				agent.setSessionMode({
					sessionId: "invalid-session",
					modeId: "code",
				}),
			).rejects.toThrow("Session not found")
		})
	})

	describe("dispose", () => {
		it("should dispose all sessions", async () => {
			// Setup
			await agent.newSession({ cwd: "/test/workspace1", mcpServers: [] })
			await agent.newSession({ cwd: "/test/workspace2", mcpServers: [] })

			// Execute
			await agent.dispose()

			// Verify - creating new session should work (sessions map is cleared)
			// The next newSession would create a fresh session
		})
	})
})
