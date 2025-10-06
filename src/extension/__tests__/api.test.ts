import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { API } from "../api"
import { ClineProvider } from "../../core/webview/ClineProvider"
import { setMcpApi, getMcpApi } from "@roo-code/types"

// Mock the types module with partial mocking
vi.mock("@roo-code/types", async (importOriginal) => {
	const actual = (await importOriginal()) as any
	return {
		...actual,
		setMcpApi: vi.fn(),
		getMcpApi: vi.fn(),
	}
})

// Mock vscode module
vi.mock("vscode", () => ({
	OutputChannel: vi.fn(),
	ExtensionContext: vi.fn(),
}))

describe("API", () => {
	let mockOutputChannel: vscode.OutputChannel
	let mockProvider: ClineProvider
	let api: API

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Create mock objects
		mockOutputChannel = {
			appendLine: vi.fn(),
		} as any

		mockProvider = {
			context: {
				subscriptions: [],
			} as any,
			getMcpHub: vi.fn(),
			on: vi.fn(),
			viewLaunched: true,
			getCurrentTaskStack: vi.fn(),
			finishSubTask: vi.fn(),
			postStateToWebview: vi.fn(),
			cancelTask: vi.fn(),
			postMessageToWebview: vi.fn(),
			removeClineFromStack: vi.fn(),
			createTask: vi.fn(),
			getTaskWithId: vi.fn(),
			createTaskWithHistoryItem: vi.fn(),
			getValues: vi.fn().mockReturnValue({}),
			contextProxy: {
				setValues: vi.fn(),
			},
			providerSettingsManager: {
				saveConfig: vi.fn(),
			},
			getProviderProfileEntries: vi.fn().mockReturnValue([]),
			getProviderProfileEntry: vi.fn(),
			upsertProviderProfile: vi.fn(),
			deleteProviderProfile: vi.fn(),
			activateProviderProfile: vi.fn(),
		} as any

		// Create API instance
		api = new API(mockOutputChannel, mockProvider)
	})

	describe("refreshMcpServers", () => {
		it("should call refreshAllConnections on the MCP hub", async () => {
			// Arrange
			const mockMcpHub = {
				refreshAllConnections: vi.fn().mockResolvedValue(undefined),
			}
			mockProvider.getMcpHub = vi.fn().mockReturnValue(mockMcpHub)

			// Act
			await api.refreshMcpServers()

			// Assert
			expect(mockProvider.getMcpHub).toHaveBeenCalled()
			expect(mockMcpHub.refreshAllConnections).toHaveBeenCalled()
		})

		it("should throw an error when MCP hub is not available", async () => {
			// Arrange
			mockProvider.getMcpHub = vi.fn().mockReturnValue(undefined)

			// Act & Assert
			await expect(api.refreshMcpServers()).rejects.toThrow("MCP hub is not available")
			expect(mockProvider.getMcpHub).toHaveBeenCalled()
		})

		it("should propagate errors from refreshAllConnections", async () => {
			// Arrange
			const testError = new Error("Connection failed")
			const mockMcpHub = {
				refreshAllConnections: vi.fn().mockRejectedValue(testError),
			}
			mockProvider.getMcpHub = vi.fn().mockReturnValue(mockMcpHub)

			// Act & Assert
			await expect(api.refreshMcpServers()).rejects.toThrow("Connection failed")
			expect(mockProvider.getMcpHub).toHaveBeenCalled()
			expect(mockMcpHub.refreshAllConnections).toHaveBeenCalled()
		})
	})

	describe("API initialization", () => {
		it("should register the API with setMcpApi", () => {
			// Assert
			expect(setMcpApi).toHaveBeenCalledWith(api)
		})

		it("should implement the McpApi interface", () => {
			// Assert
			expect(api.refreshMcpServers).toBeDefined()
			expect(typeof api.refreshMcpServers).toBe("function")
		})
	})
})
