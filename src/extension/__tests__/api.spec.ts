import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import { API } from "../api"
import { ClineProvider } from "../../core/webview/ClineProvider"
import { Package } from "../../shared/package"

// Mock vscode module
vi.mock("vscode", () => ({
	commands: {
		executeCommand: vi.fn(),
	},
	workspace: {
		getConfiguration: vi.fn(() => ({
			update: vi.fn(),
		})),
	},
	window: {
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		createTextEditorDecorationType: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
	},
	ConfigurationTarget: {
		Global: 1,
	},
}))

describe("API", () => {
	let api: API
	let mockOutputChannel: any
	let mockProvider: any
	let mockMcpHub: any

	beforeEach(() => {
		// Create mock output channel
		mockOutputChannel = {
			appendLine: vi.fn(),
		}

		// Create mock MCP hub
		mockMcpHub = {
			initializeRuntimeMcpServers: vi.fn(),
		}

		// Create mock provider
		mockProvider = {
			context: {
				extension: {
					packageJSON: {
						version: "1.0.0",
					},
				},
			},
			setValues: vi.fn(),
			removeClineFromStack: vi.fn(),
			postStateToWebview: vi.fn(),
			postMessageToWebview: vi.fn(),
			createTask: vi.fn().mockResolvedValue({ taskId: "test-task-id" }),
			getMcpHub: vi.fn().mockReturnValue(mockMcpHub),
			on: vi.fn(),
			off: vi.fn(),
		}

		// Create API instance
		api = new API(mockOutputChannel, mockProvider as any)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("startNewTask", () => {
		it("should initialize runtime MCP servers when mcpServers is provided in configuration", async () => {
			const configuration = {
				apiProvider: "openai" as const,
				mcpServers: {
					"test-server": {
						type: "stdio",
						command: "node",
						args: ["test.js"],
					},
				},
			}

			const taskId = await api.startNewTask({
				configuration,
				text: "Test task",
			})

			// Verify MCP hub was retrieved
			expect(mockProvider.getMcpHub).toHaveBeenCalled()

			// Verify runtime MCP servers were initialized
			expect(mockMcpHub.initializeRuntimeMcpServers).toHaveBeenCalledWith(configuration.mcpServers)

			// Verify other methods were called
			expect(mockProvider.setValues).toHaveBeenCalledWith(configuration)
			expect(mockProvider.createTask).toHaveBeenCalled()
			expect(taskId).toBe("test-task-id")
		})

		it("should not initialize MCP servers when mcpServers is not provided", async () => {
			const configuration = {
				apiProvider: "openai" as const,
			}

			await api.startNewTask({
				configuration,
				text: "Test task",
			})

			// Verify MCP hub was not retrieved
			expect(mockProvider.getMcpHub).not.toHaveBeenCalled()

			// Verify runtime MCP servers were not initialized
			expect(mockMcpHub.initializeRuntimeMcpServers).not.toHaveBeenCalled()

			// Verify other methods were still called
			expect(mockProvider.setValues).toHaveBeenCalledWith(configuration)
			expect(mockProvider.createTask).toHaveBeenCalled()
		})

		it("should handle when MCP hub is not available", async () => {
			// Make getMcpHub return undefined
			mockProvider.getMcpHub.mockReturnValue(undefined)

			const configuration = {
				apiProvider: "openai" as const,
				mcpServers: {
					"test-server": {
						type: "stdio",
						command: "node",
						args: ["test.js"],
					},
				},
			}

			// Should not throw an error
			const taskId = await api.startNewTask({
				configuration,
				text: "Test task",
			})

			// Verify MCP hub was retrieved
			expect(mockProvider.getMcpHub).toHaveBeenCalled()

			// Verify runtime MCP servers were not initialized (since hub is undefined)
			expect(mockMcpHub.initializeRuntimeMcpServers).not.toHaveBeenCalled()

			// Verify other methods were still called
			expect(mockProvider.setValues).toHaveBeenCalledWith(configuration)
			expect(mockProvider.createTask).toHaveBeenCalled()
			expect(taskId).toBe("test-task-id")
		})

		it("should handle complex MCP server configurations", async () => {
			const configuration = {
				apiProvider: "openai" as const,
				mcpServers: {
					"stdio-server": {
						type: "stdio",
						command: "node",
						args: ["server.js"],
						env: { NODE_ENV: "production" },
						disabled: false,
						alwaysAllow: ["tool1", "tool2"],
					},
					"sse-server": {
						type: "sse",
						url: "http://localhost:8080/sse",
						headers: { Authorization: "Bearer token" },
						disabled: true,
					},
				},
			}

			await api.startNewTask({
				configuration,
				text: "Test task",
			})

			// Verify runtime MCP servers were initialized with the full configuration
			expect(mockMcpHub.initializeRuntimeMcpServers).toHaveBeenCalledWith(configuration.mcpServers)
		})

		it("should handle empty mcpServers object", async () => {
			const configuration = {
				apiProvider: "openai" as const,
				mcpServers: {},
			}

			await api.startNewTask({
				configuration,
				text: "Test task",
			})

			// Verify MCP hub was retrieved
			expect(mockProvider.getMcpHub).toHaveBeenCalled()

			// Verify runtime MCP servers were initialized with empty object
			expect(mockMcpHub.initializeRuntimeMcpServers).toHaveBeenCalledWith({})
		})
	})
})
