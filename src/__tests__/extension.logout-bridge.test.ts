import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { ExtensionContext } from "vscode"
import type { AuthState, CloudUserInfo } from "@roo-code/types"
import { CloudService, BridgeOrchestrator } from "@roo-code/cloud"

// Mock modules
vi.mock("vscode", () => ({
	window: {
		createOutputChannel: vi.fn(() => ({
			appendLine: vi.fn(),
		})),
	},
	env: {
		sessionId: "test-session-id",
	},
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn(() => []),
		})),
	},
	commands: {
		executeCommand: vi.fn(),
	},
}))

vi.mock("@roo-code/cloud", () => {
	const mockBridgeOrchestrator = {
		connectOrDisconnect: vi.fn(),
		getInstance: vi.fn(),
		disconnect: vi.fn(),
	}

	const mockCloudService = {
		instance: {
			off: vi.fn(),
			getUserInfo: vi.fn(),
			cloudAPI: {
				bridgeConfig: vi.fn(() => ({
					userId: "test-user",
					socketBridgeUrl: "wss://test.bridge.url",
					token: "test-token",
				})),
			},
		},
		hasInstance: vi.fn(() => true),
		createInstance: vi.fn(),
	}

	return {
		CloudService: mockCloudService,
		BridgeOrchestrator: mockBridgeOrchestrator,
	}
})

describe("Extension Bridge Logout", () => {
	let authStateChangedHandler: ((data: { state: AuthState; previousState: AuthState }) => Promise<void>) | undefined
	let mockCloudLogger: ReturnType<typeof vi.fn>
	let mockProvider: any

	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks()

		// Setup mock logger
		mockCloudLogger = vi.fn()

		// Setup mock provider
		mockProvider = {
			postStateToWebview: vi.fn(),
		}

		// Reset handlers
		authStateChangedHandler = undefined
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should disconnect BridgeOrchestrator when user logs out", async () => {
		// Create the auth state changed handler (simulating what extension.ts does)
		const postStateListener = () => mockProvider.postStateToWebview()

		authStateChangedHandler = async (data: { state: AuthState; previousState: AuthState }) => {
			postStateListener()

			// Check if user has logged out
			if (data.state === "logged-out") {
				try {
					// Disconnect the bridge when user logs out
					await BridgeOrchestrator.connectOrDisconnect(null, false, {
						userId: "",
						socketBridgeUrl: "",
						token: "",
						provider: mockProvider,
						sessionId: "test-session-id",
					})

					mockCloudLogger("[CloudService] BridgeOrchestrator disconnected on logout")
				} catch (error) {
					mockCloudLogger(
						`[CloudService] Failed to disconnect BridgeOrchestrator on logout: ${
							error instanceof Error ? error.message : String(error)
						}`,
					)
				}
			}
		}

		// Simulate logout event
		await authStateChangedHandler({
			state: "logged-out",
			previousState: "active-session",
		})

		// Verify that postStateToWebview was called
		expect(mockProvider.postStateToWebview).toHaveBeenCalledOnce()

		// Verify that BridgeOrchestrator.connectOrDisconnect was called with correct params to disconnect
		expect(BridgeOrchestrator.connectOrDisconnect).toHaveBeenCalledWith(
			null, // userInfo is null when logged out
			false, // remoteControlEnabled is false to trigger disconnection
			{
				userId: "",
				socketBridgeUrl: "",
				token: "",
				provider: mockProvider,
				sessionId: "test-session-id",
			},
		)

		// Verify success log message
		expect(mockCloudLogger).toHaveBeenCalledWith("[CloudService] BridgeOrchestrator disconnected on logout")
	})

	it("should handle errors when disconnecting BridgeOrchestrator fails", async () => {
		// Make connectOrDisconnect throw an error
		const errorMessage = "Failed to disconnect"
		vi.mocked(BridgeOrchestrator.connectOrDisconnect).mockRejectedValueOnce(new Error(errorMessage))

		// Create the auth state changed handler
		const postStateListener = () => mockProvider.postStateToWebview()

		authStateChangedHandler = async (data: { state: AuthState; previousState: AuthState }) => {
			postStateListener()

			if (data.state === "logged-out") {
				try {
					await BridgeOrchestrator.connectOrDisconnect(null, false, {
						userId: "",
						socketBridgeUrl: "",
						token: "",
						provider: mockProvider,
						sessionId: "test-session-id",
					})

					mockCloudLogger("[CloudService] BridgeOrchestrator disconnected on logout")
				} catch (error) {
					mockCloudLogger(
						`[CloudService] Failed to disconnect BridgeOrchestrator on logout: ${
							error instanceof Error ? error.message : String(error)
						}`,
					)
				}
			}
		}

		// Simulate logout event
		await authStateChangedHandler({
			state: "logged-out",
			previousState: "active-session",
		})

		// Verify error was caught and logged
		expect(mockCloudLogger).toHaveBeenCalledWith(
			`[CloudService] Failed to disconnect BridgeOrchestrator on logout: ${errorMessage}`,
		)

		// Verify that postStateToWebview was still called despite the error
		expect(mockProvider.postStateToWebview).toHaveBeenCalledOnce()
	})

	it("should not disconnect BridgeOrchestrator for non-logout state changes", async () => {
		// Create the auth state changed handler
		const postStateListener = () => mockProvider.postStateToWebview()

		authStateChangedHandler = async (data: { state: AuthState; previousState: AuthState }) => {
			postStateListener()

			if (data.state === "logged-out") {
				try {
					await BridgeOrchestrator.connectOrDisconnect(null, false, {
						userId: "",
						socketBridgeUrl: "",
						token: "",
						provider: mockProvider,
						sessionId: "test-session-id",
					})

					mockCloudLogger("[CloudService] BridgeOrchestrator disconnected on logout")
				} catch (error) {
					mockCloudLogger(
						`[CloudService] Failed to disconnect BridgeOrchestrator on logout: ${
							error instanceof Error ? error.message : String(error)
						}`,
					)
				}
			}
		}

		// Simulate state change that is NOT a logout
		await authStateChangedHandler({
			state: "active-session",
			previousState: "attempting-session",
		})

		// Verify that postStateToWebview was called
		expect(mockProvider.postStateToWebview).toHaveBeenCalledOnce()

		// Verify that BridgeOrchestrator.connectOrDisconnect was NOT called
		expect(BridgeOrchestrator.connectOrDisconnect).not.toHaveBeenCalled()

		// Verify no log messages about disconnection
		expect(mockCloudLogger).not.toHaveBeenCalled()
	})
})
