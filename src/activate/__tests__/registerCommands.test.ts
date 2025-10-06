import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { registerCommands } from "../registerCommands"
import { ClineProvider } from "../../core/webview/ClineProvider"

// Mock vscode module
vi.mock("vscode", () => ({
	window: {
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
	},
	commands: {
		registerCommand: vi.fn(),
	},
}))

describe("registerCommands", () => {
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockProvider: ClineProvider

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Create mock objects
		mockContext = {
			subscriptions: {
				push: vi.fn(),
			},
		} as any

		mockOutputChannel = {
			appendLine: vi.fn(),
		} as any

		mockProvider = {
			getMcpHub: vi.fn(),
		} as any
	})

	describe("refreshMcpServers command", () => {
		it("should refresh MCP servers when hub is available", async () => {
			// Arrange
			const mockMcpHub = {
				refreshAllConnections: vi.fn().mockResolvedValue(undefined),
			}
			mockProvider.getMcpHub = vi.fn().mockReturnValue(mockMcpHub)

			// Mock getVisibleProviderOrLog to return our mock provider
			const getVisibleProviderOrLog = vi.fn().mockReturnValue(mockProvider)

			// Register commands
			const commands = registerCommands({
				context: mockContext,
				outputChannel: mockOutputChannel,
				provider: mockProvider,
			})

			// Find and execute the refreshMcpServers command
			const registerCommandCalls = vi.mocked(vscode.commands.registerCommand).mock.calls
			const refreshCommand = registerCommandCalls.find(([cmd]) => cmd === "roo-cline.refreshMcpServers")

			expect(refreshCommand).toBeDefined()

			// Execute the command callback
			const commandCallback = refreshCommand![1] as () => Promise<void>
			await commandCallback()

			// Assert
			expect(mockProvider.getMcpHub).toHaveBeenCalled()
			expect(mockMcpHub.refreshAllConnections).toHaveBeenCalled()
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("MCP servers refreshed successfully")
		})

		it("should show warning when MCP hub is not available", async () => {
			// Arrange
			mockProvider.getMcpHub = vi.fn().mockReturnValue(undefined)

			// Mock getVisibleProviderOrLog to return our mock provider
			const getVisibleProviderOrLog = vi.fn().mockReturnValue(mockProvider)

			// Register commands
			const commands = registerCommands({
				context: mockContext,
				outputChannel: mockOutputChannel,
				provider: mockProvider,
			})

			// Find and execute the refreshMcpServers command
			const registerCommandCalls = vi.mocked(vscode.commands.registerCommand).mock.calls
			const refreshCommand = registerCommandCalls.find(([cmd]) => cmd === "roo-cline.refreshMcpServers")

			expect(refreshCommand).toBeDefined()

			// Execute the command callback
			const commandCallback = refreshCommand![1] as () => Promise<void>
			await commandCallback()

			// Assert
			expect(mockProvider.getMcpHub).toHaveBeenCalled()
			expect(vscode.window.showWarningMessage).toHaveBeenCalledWith("MCP hub is not available")
		})

		it("should not execute when no visible provider is found", async () => {
			// Arrange
			// Mock getVisibleProviderOrLog to return undefined
			const getVisibleProviderOrLog = vi.fn().mockReturnValue(undefined)

			// Register commands
			const commands = registerCommands({
				context: mockContext,
				outputChannel: mockOutputChannel,
				provider: mockProvider,
			})

			// Find and execute the refreshMcpServers command
			const registerCommandCalls = vi.mocked(vscode.commands.registerCommand).mock.calls
			const refreshCommand = registerCommandCalls.find(([cmd]) => cmd === "roo-cline.refreshMcpServers")

			expect(refreshCommand).toBeDefined()

			// Execute the command callback
			const commandCallback = refreshCommand![1] as () => Promise<void>
			await commandCallback()

			// Assert - should return early without calling getMcpHub
			expect(mockProvider.getMcpHub).not.toHaveBeenCalled()
			expect(vscode.window.showInformationMessage).not.toHaveBeenCalled()
			expect(vscode.window.showWarningMessage).not.toHaveBeenCalled()
		})
	})
})
