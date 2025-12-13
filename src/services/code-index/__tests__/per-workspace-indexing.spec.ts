import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import * as vscode from "vscode"
import { CodeIndexConfigManager } from "../config-manager"
import { ContextProxy } from "../../../core/config/ContextProxy"

// Mock vscode module
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: undefined as any,
		getConfiguration: vi.fn(),
	},
}))

describe("Per-workspace codebase indexing", () => {
	let mockContextProxy: any
	let configManager: CodeIndexConfigManager
	const testWorkspacePath = "/test/workspace"

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Setup mock context proxy
		mockContextProxy = {
			getGlobalState: vi.fn(),
			getSecret: vi.fn(),
			refreshSecrets: vi.fn().mockResolvedValue(undefined),
		}

		// Default mock implementations
		mockContextProxy.getGlobalState.mockReturnValue({
			codebaseIndexEnabled: false, // Global setting disabled by default
			codebaseIndexQdrantUrl: "http://localhost:6333",
			codebaseIndexEmbedderProvider: "openai",
		})

		mockContextProxy.getSecret.mockImplementation((key: string) => {
			if (key === "codeIndexOpenAiKey") return "test-key"
			if (key === "codeIndexQdrantApiKey") return "test-key"
			return undefined
		})
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("Workspace setting overrides global setting", () => {
		it("should enable indexing when workspace setting is true and global is false", () => {
			// Setup workspace folders
			const mockWorkspaceFolder = {
				uri: { fsPath: testWorkspacePath },
			}
			;(vscode.workspace as any).workspaceFolders = [mockWorkspaceFolder]

			// Mock workspace configuration to return true for the workspace setting
			const mockConfig = {
				get: vi.fn().mockReturnValue(true), // Workspace setting enabled
			}
			;(vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig)

			// Global setting is false (set in beforeEach)
			configManager = new CodeIndexConfigManager(mockContextProxy, testWorkspacePath)

			// Workspace setting should override global setting
			expect(configManager.isFeatureEnabled).toBe(true)
			expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith("roo-cline", mockWorkspaceFolder.uri)
			expect(mockConfig.get).toHaveBeenCalledWith("enableCodebaseIndexing")
		})

		it("should disable indexing when workspace setting is false and global is true", () => {
			// Setup workspace folders
			const mockWorkspaceFolder = {
				uri: { fsPath: testWorkspacePath },
			}
			;(vscode.workspace as any).workspaceFolders = [mockWorkspaceFolder]

			// Mock workspace configuration to return false for the workspace setting
			const mockConfig = {
				get: vi.fn().mockReturnValue(false), // Workspace setting disabled
			}
			;(vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig)

			// Set global setting to true
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true, // Global setting enabled
				codebaseIndexQdrantUrl: "http://localhost:6333",
				codebaseIndexEmbedderProvider: "openai",
			})

			configManager = new CodeIndexConfigManager(mockContextProxy, testWorkspacePath)

			// Workspace setting should override global setting
			expect(configManager.isFeatureEnabled).toBe(false)
		})

		it("should use global setting when workspace setting is undefined", () => {
			// Setup workspace folders
			const mockWorkspaceFolder = {
				uri: { fsPath: testWorkspacePath },
			}
			;(vscode.workspace as any).workspaceFolders = [mockWorkspaceFolder]

			// Mock workspace configuration to return undefined (not set)
			const mockConfig = {
				get: vi.fn().mockReturnValue(undefined), // Workspace setting not configured
			}
			;(vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig)

			// Set global setting to true
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true, // Global setting enabled
				codebaseIndexQdrantUrl: "http://localhost:6333",
				codebaseIndexEmbedderProvider: "openai",
			})

			configManager = new CodeIndexConfigManager(mockContextProxy, testWorkspacePath)

			// Should fall back to global setting
			expect(configManager.isFeatureEnabled).toBe(true)
		})
	})

	describe("Multiple workspaces", () => {
		it("should only check setting for the specific workspace", () => {
			// Setup multiple workspace folders
			const workspace1 = {
				uri: { fsPath: "/workspace1" },
			}
			const workspace2 = {
				uri: { fsPath: "/workspace2" },
			}
			;(vscode.workspace as any).workspaceFolders = [workspace1, workspace2]

			// Mock different configurations for each workspace
			const mockConfig1 = {
				get: vi.fn().mockReturnValue(true), // Workspace 1 enabled
			}
			const mockConfig2 = {
				get: vi.fn().mockReturnValue(false), // Workspace 2 disabled
			}

			;(vscode.workspace.getConfiguration as any).mockImplementation((section: string, uri: any) => {
				if (uri.fsPath === "/workspace1") return mockConfig1
				if (uri.fsPath === "/workspace2") return mockConfig2
				return { get: vi.fn().mockReturnValue(undefined) }
			})

			// Test workspace 1
			const configManager1 = new CodeIndexConfigManager(mockContextProxy, "/workspace1")
			expect(configManager1.isFeatureEnabled).toBe(true)

			// Test workspace 2
			const configManager2 = new CodeIndexConfigManager(mockContextProxy, "/workspace2")
			expect(configManager2.isFeatureEnabled).toBe(false)

			// Verify correct workspace was queried
			expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith("roo-cline", workspace1.uri)
			expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith("roo-cline", workspace2.uri)
		})
	})

	describe("No workspace folder", () => {
		it("should use global setting when no workspace folder is found", () => {
			// No workspace folders
			;(vscode.workspace as any).workspaceFolders = []

			// Set global setting to true
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexQdrantUrl: "http://localhost:6333",
				codebaseIndexEmbedderProvider: "openai",
			})

			// Create config manager without workspace path
			configManager = new CodeIndexConfigManager(mockContextProxy, undefined)

			// Should use global setting
			expect(configManager.isFeatureEnabled).toBe(true)
			expect(vscode.workspace.getConfiguration).not.toHaveBeenCalled()
		})

		it("should use global setting when workspace path doesn't match any folder", () => {
			// Setup workspace folders
			const mockWorkspaceFolder = {
				uri: { fsPath: "/different/workspace" },
			}
			;(vscode.workspace as any).workspaceFolders = [mockWorkspaceFolder]

			// Set global setting to true
			mockContextProxy.getGlobalState.mockReturnValue({
				codebaseIndexEnabled: true,
				codebaseIndexQdrantUrl: "http://localhost:6333",
				codebaseIndexEmbedderProvider: "openai",
			})

			// Create config manager with non-matching workspace path
			configManager = new CodeIndexConfigManager(mockContextProxy, "/non/matching/path")

			// Should use global setting since workspace doesn't match
			expect(configManager.isFeatureEnabled).toBe(true)
			expect(vscode.workspace.getConfiguration).not.toHaveBeenCalled()
		})
	})

	describe("Configuration reload", () => {
		it("should pick up workspace setting changes on reload", async () => {
			// Setup workspace folders
			const mockWorkspaceFolder = {
				uri: { fsPath: testWorkspacePath },
			}
			;(vscode.workspace as any).workspaceFolders = [mockWorkspaceFolder]

			// Initially workspace setting is false
			const mockConfig = {
				get: vi.fn().mockReturnValue(false),
			}
			;(vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig)

			configManager = new CodeIndexConfigManager(mockContextProxy, testWorkspacePath)
			expect(configManager.isFeatureEnabled).toBe(false)

			// Change workspace setting to true
			mockConfig.get.mockReturnValue(true)

			// Reload configuration
			await configManager.loadConfiguration()

			// Should pick up the new workspace setting
			expect(configManager.isFeatureEnabled).toBe(true)
		})

		it("should detect restart requirement when workspace setting changes", async () => {
			// Setup workspace folders
			const mockWorkspaceFolder = {
				uri: { fsPath: testWorkspacePath },
			}
			;(vscode.workspace as any).workspaceFolders = [mockWorkspaceFolder]

			// Initially workspace setting is false
			const mockConfig = {
				get: vi.fn().mockReturnValue(false),
			}
			;(vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig)

			configManager = new CodeIndexConfigManager(mockContextProxy, testWorkspacePath)
			expect(configManager.isFeatureEnabled).toBe(false)

			// Change workspace setting to true (and ensure it's configured)
			mockConfig.get.mockReturnValue(true)

			// Reload configuration
			const result = await configManager.loadConfiguration()

			// Should require restart when enabling
			expect(result.requiresRestart).toBe(true)
			expect(configManager.isFeatureEnabled).toBe(true)
		})
	})
})
