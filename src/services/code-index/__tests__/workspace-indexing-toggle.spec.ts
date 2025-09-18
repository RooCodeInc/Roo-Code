import * as vscode from "vscode"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { CodeIndexConfigManager } from "../config-manager"
import { ContextProxy } from "../../../core/config/ContextProxy"

describe("Workspace-level Indexing Toggle", () => {
	let configManager: CodeIndexConfigManager
	let mockContextProxy: ContextProxy
	let mockContext: vscode.ExtensionContext
	const testWorkspacePath = "/test/workspace"

	beforeEach(() => {
		// Mock ContextProxy
		mockContextProxy = {
			getValue: vi.fn(),
			setValue: vi.fn(),
			getGlobalState: vi.fn(),
			updateGlobalState: vi.fn(),
			getSecret: vi.fn(),
			storeSecret: vi.fn(),
		} as any

		// Mock VSCode Extension Context
		mockContext = {
			workspaceState: {
				get: vi.fn(),
				update: vi.fn(),
			},
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
			},
			secrets: {
				get: vi.fn(),
				store: vi.fn(),
			},
		} as any

		// Initialize config manager with mocks
		configManager = new CodeIndexConfigManager(mockContextProxy, testWorkspacePath, mockContext)
	})

	describe("Workspace-specific settings", () => {
		it("should inherit global setting when workspace setting is not set", () => {
			// Mock global setting enabled
			vi.spyOn(mockContextProxy, "getGlobalState").mockReturnValue({
				codebaseIndexEnabled: true,
			})

			// Mock no workspace-specific setting
			vi.spyOn(mockContext.workspaceState, "get").mockReturnValue(undefined)

			// Should inherit global setting (true)
			expect(configManager.isFeatureEnabled).toBe(true)
		})

		it("should use workspace setting when explicitly set to false", () => {
			// Mock global setting enabled
			vi.spyOn(mockContextProxy, "getGlobalState").mockReturnValue({
				codebaseIndexEnabled: true,
			})

			// Mock workspace-specific setting disabled
			const workspaceKey = `codebaseIndexEnabled_${Buffer.from(testWorkspacePath).toString("base64")}`
			vi.spyOn(mockContext.workspaceState, "get").mockImplementation((key) => {
				if (key === workspaceKey) return false
				return undefined
			})

			// Create a new instance to trigger loadWorkspaceSettings
			const newConfigManager = new CodeIndexConfigManager(mockContextProxy, testWorkspacePath, mockContext)

			// Should use workspace setting (false) instead of global (true)
			expect(newConfigManager.getWorkspaceIndexEnabled(testWorkspacePath)).toBe(false)
		})

		it("should use workspace setting when explicitly set to true", () => {
			// Mock global setting disabled
			vi.spyOn(mockContextProxy, "getGlobalState").mockReturnValue({
				codebaseIndexEnabled: false,
			})

			// Mock workspace-specific setting enabled
			const workspaceKey = `codebaseIndexEnabled_${Buffer.from(testWorkspacePath).toString("base64")}`
			vi.spyOn(mockContext.workspaceState, "get").mockImplementation((key) => {
				if (key === workspaceKey) return true
				return undefined
			})

			// Create a new instance to trigger loadWorkspaceSettings
			const newConfigManager = new CodeIndexConfigManager(mockContextProxy, testWorkspacePath, mockContext)

			// Workspace setting should be true
			expect(newConfigManager.getWorkspaceIndexEnabled(testWorkspacePath)).toBe(true)
			// But overall feature should still be disabled due to global setting
			expect(newConfigManager.isFeatureEnabled).toBe(false)
		})

		it("should persist workspace setting when changed", async () => {
			const updateSpy = vi.spyOn(mockContext.workspaceState, "update")

			await configManager.setWorkspaceIndexEnabled(testWorkspacePath, false)

			const expectedKey = `codebaseIndexEnabled_${Buffer.from(testWorkspacePath).toString("base64")}`
			expect(updateSpy).toHaveBeenCalledWith(expectedKey, false)
		})

		it("should correctly identify when workspace has specific setting", () => {
			// No workspace-specific setting
			vi.spyOn(mockContext.workspaceState, "get").mockReturnValue(undefined)
			expect(configManager.hasWorkspaceSpecificSetting()).toBe(false)

			// With workspace-specific setting
			const workspaceKey = `codebaseIndexEnabled_${Buffer.from(testWorkspacePath).toString("base64")}`
			vi.spyOn(mockContext.workspaceState, "get").mockImplementation((key) => {
				if (key === workspaceKey) return true
				return undefined
			})

			const newConfigManager = new CodeIndexConfigManager(mockContextProxy, testWorkspacePath, mockContext)
			newConfigManager.loadWorkspaceSettings()

			expect(newConfigManager.hasWorkspaceSpecificSetting()).toBe(true)
		})
	})

	describe("Multi-root workspace handling", () => {
		it("should handle different settings for different workspace folders", () => {
			const workspace1 = "/workspace1"
			const workspace2 = "/workspace2"

			// Mock different settings for each workspace
			vi.spyOn(mockContext.workspaceState, "get").mockImplementation((key) => {
				const key1 = `codebaseIndexEnabled_${Buffer.from(workspace1).toString("base64")}`
				const key2 = `codebaseIndexEnabled_${Buffer.from(workspace2).toString("base64")}`

				if (key === key1) return true
				if (key === key2) return false
				return undefined
			})

			// Create managers for each workspace
			const manager1 = new CodeIndexConfigManager(mockContextProxy, workspace1, mockContext)
			const manager2 = new CodeIndexConfigManager(mockContextProxy, workspace2, mockContext)

			manager1.loadWorkspaceSettings()
			manager2.loadWorkspaceSettings()

			expect(manager1.getWorkspaceIndexEnabled(workspace1)).toBe(true)
			expect(manager2.getWorkspaceIndexEnabled(workspace2)).toBe(false)
		})
	})

	describe("Global setting disabled", () => {
		it("should always return false when global setting is disabled", () => {
			// Mock global setting disabled
			vi.spyOn(mockContextProxy, "getGlobalState").mockReturnValue({
				codebaseIndexEnabled: false,
			})

			// Even with workspace setting enabled
			const workspaceKey = `codebaseIndexEnabled_${Buffer.from(testWorkspacePath).toString("base64")}`
			vi.spyOn(mockContext.workspaceState, "get").mockImplementation((key) => {
				if (key === workspaceKey) return true
				return undefined
			})

			const newConfigManager = new CodeIndexConfigManager(mockContextProxy, testWorkspacePath, mockContext)

			// Feature should be disabled
			expect(newConfigManager.isFeatureEnabled).toBe(false)
		})
	})
})
