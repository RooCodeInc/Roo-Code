import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"

import type { MarketplaceItem } from "@roo-code/types"

import { SimpleInstaller } from "../SimpleInstaller"
import type { CustomModesManager } from "../../../core/config/CustomModesManager"

vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [
			{
				uri: {
					fsPath: "/test/workspace",
				},
			},
		],
	},
}))

vi.mock("fs/promises")
vi.mock("../../../utils/globalContext", () => ({
	ensureSettingsDirectoryExists: vi.fn(),
}))
vi.mock("../../../shared/globalFileNames", () => ({
	GlobalFileNames: {
		customModes: "custom-modes.yaml",
		mcpSettings: "mcp-settings.json",
	},
}))

// Import the mocked module to ensure it's available
import { ensureSettingsDirectoryExists } from "../../../utils/globalContext"

describe("SimpleInstaller - Submodes Support", () => {
	let installer: SimpleInstaller
	let mockCustomModesManager: CustomModesManager
	let mockContext: vscode.ExtensionContext

	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks()

		// Set up the mock to return a valid path
		vi.mocked(ensureSettingsDirectoryExists).mockResolvedValue("/test/.roo")

		// Mock extension context
		mockContext = {
			globalStorageUri: {
				fsPath: "/test/.roo",
			},
		} as any

		// Mock CustomModesManager
		mockCustomModesManager = {
			importModeWithRules: vi.fn(),
			deleteCustomMode: vi.fn(),
			getCustomModes: vi.fn(),
		} as any

		installer = new SimpleInstaller(mockContext, mockCustomModesManager)

		// Default file system mocks
		vi.mocked(fs.readFile).mockResolvedValue("")
		vi.mocked(fs.writeFile).mockResolvedValue()
		vi.mocked(fs.mkdir).mockResolvedValue(undefined as any)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("installMode with submodes", () => {
		it("should install a mode with bundled submodes", async () => {
			const mockModeItem: MarketplaceItem = {
				type: "mode",
				id: "complex-mode",
				name: "Complex Mode",
				description: "A mode with submodes",
				content: yaml.stringify({
					slug: "complex-mode",
					name: "Complex Mode",
					roleDefinition: "Main mode role",
					groups: ["read", "edit"],
				}),
				submodes: [
					yaml.stringify({
						slug: "submode-1",
						name: "Submode 1",
						roleDefinition: "Submode 1 role",
						groups: ["read"],
					}),
					yaml.stringify({
						slug: "submode-2",
						name: "Submode 2",
						roleDefinition: "Submode 2 role",
						groups: ["edit"],
					}),
				],
			}

			vi.mocked(mockCustomModesManager.importModeWithRules).mockResolvedValue({
				success: true,
				slug: "complex-mode",
			})

			vi.mocked(fs.readFile).mockResolvedValue(
				yaml.stringify({
					customModes: [
						{
							slug: "complex-mode",
							name: "Complex Mode",
							roleDefinition: "Main mode role",
							groups: ["read", "edit"],
						},
						{
							slug: "submode-1",
							name: "Submode 1",
							roleDefinition: "Submode 1 role",
							groups: ["read"],
							parent: "complex-mode",
							hidden: true,
						},
						{
							slug: "submode-2",
							name: "Submode 2",
							roleDefinition: "Submode 2 role",
							groups: ["edit"],
							parent: "complex-mode",
							hidden: true,
						},
					],
				}),
			)

			const result = await installer.installItem(mockModeItem, { target: "project" })

			// Verify that importModeWithRules was called with all modes
			expect(mockCustomModesManager.importModeWithRules).toHaveBeenCalledTimes(1)
			const importCall = vi.mocked(mockCustomModesManager.importModeWithRules).mock.calls[0]
			const importedData = yaml.parse(importCall[0])

			// Check that we have 3 modes total
			expect(importedData.customModes).toHaveLength(3)

			// Verify main mode
			expect(importedData.customModes[0].slug).toBe("complex-mode")

			// Verify submodes have parent and hidden properties
			expect(importedData.customModes[1].slug).toBe("submode-1")
			expect(importedData.customModes[1].parent).toBe("complex-mode")
			expect(importedData.customModes[1].hidden).toBe(true)

			expect(importedData.customModes[2].slug).toBe("submode-2")
			expect(importedData.customModes[2].parent).toBe("complex-mode")
			expect(importedData.customModes[2].hidden).toBe(true)

			// Verify the file path was returned
			expect(result.filePath).toBe(path.join("/test/workspace", ".roomodes"))
		})

		it("should handle mode with no submodes", async () => {
			const mockModeItem: MarketplaceItem = {
				type: "mode",
				id: "simple-mode",
				name: "Simple Mode",
				description: "A mode without submodes",
				content: yaml.stringify({
					slug: "simple-mode",
					name: "Simple Mode",
					roleDefinition: "Simple mode role",
					groups: ["read"],
				}),
				// No submodes property
			}

			vi.mocked(mockCustomModesManager.importModeWithRules).mockResolvedValue({
				success: true,
				slug: "simple-mode",
			})

			vi.mocked(fs.readFile).mockResolvedValue(
				yaml.stringify({
					customModes: [
						{
							slug: "simple-mode",
							name: "Simple Mode",
							roleDefinition: "Simple mode role",
							groups: ["read"],
						},
					],
				}),
			)

			const result = await installer.installItem(mockModeItem, { target: "global" })

			const importCall = vi.mocked(mockCustomModesManager.importModeWithRules).mock.calls[0]
			const importedData = yaml.parse(importCall[0])

			// Should only have the main mode
			expect(importedData.customModes).toHaveLength(1)
			expect(importedData.customModes[0].slug).toBe("simple-mode")

			// Verify the file path was returned
			expect(result.filePath).toBe(path.join("/test/.roo", "custom-modes.yaml"))
		})

		it("should handle invalid submode YAML gracefully", async () => {
			const mockModeItem: MarketplaceItem = {
				type: "mode",
				id: "mode-with-bad-submode",
				name: "Mode with Bad Submode",
				description: "Has an invalid submode",
				content: yaml.stringify({
					slug: "main-mode",
					name: "Main Mode",
					roleDefinition: "Main role",
					groups: ["read"],
				}),
				submodes: [
					"this is not valid YAML {{{",
					yaml.stringify({
						slug: "valid-submode",
						name: "Valid Submode",
						roleDefinition: "Valid role",
						groups: ["edit"],
					}),
				],
			}

			vi.mocked(mockCustomModesManager.importModeWithRules).mockResolvedValue({
				success: true,
				slug: "main-mode",
			})

			await installer.installItem(mockModeItem, { target: "project" })

			const importCall = vi.mocked(mockCustomModesManager.importModeWithRules).mock.calls[0]
			const importedData = yaml.parse(importCall[0])

			// Should have main mode and valid submode only
			expect(importedData.customModes).toHaveLength(2)
			expect(importedData.customModes[0].slug).toBe("main-mode")
			expect(importedData.customModes[1].slug).toBe("valid-submode")
		})
	})

	describe("removeMode with submodes", () => {
		it("should remove a mode and its submodes", async () => {
			const mockModeItem: MarketplaceItem = {
				type: "mode",
				id: "parent-mode",
				name: "Parent Mode",
				description: "Mode with submodes",
				content: yaml.stringify({
					slug: "parent-mode",
					name: "Parent Mode",
					roleDefinition: "Parent role",
					groups: ["read"],
				}),
			}

			// Mock getCustomModes to return parent and submodes
			vi.mocked(mockCustomModesManager.getCustomModes).mockResolvedValue([
				{
					slug: "parent-mode",
					name: "Parent Mode",
					roleDefinition: "Parent role",
					groups: ["read"],
				},
				{
					slug: "submode-a",
					name: "Submode A",
					roleDefinition: "Submode A role",
					groups: ["edit"],
					parent: "parent-mode",
					hidden: true,
				},
				{
					slug: "submode-b",
					name: "Submode B",
					roleDefinition: "Submode B role",
					groups: ["command"],
					parent: "parent-mode",
					hidden: true,
				},
				{
					slug: "unrelated-mode",
					name: "Unrelated Mode",
					roleDefinition: "Unrelated role",
					groups: ["read"],
				},
			] as any)

			vi.mocked(mockCustomModesManager.deleteCustomMode).mockResolvedValue()

			await installer.removeItem(mockModeItem, { target: "project" })

			// Should delete submodes first, then parent
			expect(mockCustomModesManager.deleteCustomMode).toHaveBeenCalledTimes(3)

			// Verify submodes were deleted
			expect(mockCustomModesManager.deleteCustomMode).toHaveBeenCalledWith("submode-a", true)
			expect(mockCustomModesManager.deleteCustomMode).toHaveBeenCalledWith("submode-b", true)

			// Verify parent was deleted
			expect(mockCustomModesManager.deleteCustomMode).toHaveBeenCalledWith("parent-mode", true)
		})

		it("should handle mode without submodes", async () => {
			const mockModeItem: MarketplaceItem = {
				type: "mode",
				id: "standalone-mode",
				name: "Standalone Mode",
				description: "Mode without submodes",
				content: yaml.stringify({
					slug: "standalone-mode",
					name: "Standalone Mode",
					roleDefinition: "Standalone role",
					groups: ["read"],
				}),
			}

			vi.mocked(mockCustomModesManager.getCustomModes).mockResolvedValue([
				{
					slug: "standalone-mode",
					name: "Standalone Mode",
					roleDefinition: "Standalone role",
					groups: ["read"],
				},
				{
					slug: "other-mode",
					name: "Other Mode",
					roleDefinition: "Other role",
					groups: ["edit"],
				},
			] as any)

			vi.mocked(mockCustomModesManager.deleteCustomMode).mockResolvedValue()

			await installer.removeItem(mockModeItem, { target: "global" })

			// Should only delete the standalone mode
			expect(mockCustomModesManager.deleteCustomMode).toHaveBeenCalledTimes(1)
			expect(mockCustomModesManager.deleteCustomMode).toHaveBeenCalledWith("standalone-mode", true)
		})

		it("should continue deletion even if submode deletion fails", async () => {
			const mockModeItem: MarketplaceItem = {
				type: "mode",
				id: "parent-with-failing-submode",
				name: "Parent Mode",
				description: "Mode with problematic submode",
				content: yaml.stringify({
					slug: "parent-mode",
					name: "Parent Mode",
					roleDefinition: "Parent role",
					groups: ["read"],
				}),
			}

			vi.mocked(mockCustomModesManager.getCustomModes).mockResolvedValue([
				{
					slug: "parent-mode",
					name: "Parent Mode",
					roleDefinition: "Parent role",
					groups: ["read"],
				},
				{
					slug: "failing-submode",
					name: "Failing Submode",
					roleDefinition: "Failing role",
					groups: ["edit"],
					parent: "parent-mode",
					hidden: true,
				},
				{
					slug: "working-submode",
					name: "Working Submode",
					roleDefinition: "Working role",
					groups: ["command"],
					parent: "parent-mode",
					hidden: true,
				},
			] as any)

			// Make the first submode deletion fail
			vi.mocked(mockCustomModesManager.deleteCustomMode)
				.mockRejectedValueOnce(new Error("Failed to delete submode"))
				.mockResolvedValue()

			await installer.removeItem(mockModeItem, { target: "project" })

			// Should still attempt to delete all modes
			expect(mockCustomModesManager.deleteCustomMode).toHaveBeenCalledTimes(3)
			expect(mockCustomModesManager.deleteCustomMode).toHaveBeenCalledWith("failing-submode", true)
			expect(mockCustomModesManager.deleteCustomMode).toHaveBeenCalledWith("working-submode", true)
			expect(mockCustomModesManager.deleteCustomMode).toHaveBeenCalledWith("parent-mode", true)
		})
	})

	describe("edge cases", () => {
		it("should only delete hidden submodes with matching parent", async () => {
			const mockModeItem: MarketplaceItem = {
				type: "mode",
				id: "parent-mode",
				name: "Parent Mode",
				description: "Mode to remove",
				content: yaml.stringify({
					slug: "parent-mode",
					name: "Parent Mode",
					roleDefinition: "Parent role",
					groups: ["read"],
				}),
			}

			vi.mocked(mockCustomModesManager.getCustomModes).mockResolvedValue([
				{
					slug: "parent-mode",
					name: "Parent Mode",
					roleDefinition: "Parent role",
					groups: ["read"],
				},
				{
					slug: "visible-submode",
					name: "Visible Submode",
					roleDefinition: "Visible role",
					groups: ["edit"],
					parent: "parent-mode",
					// No hidden flag - should not be deleted
				},
				{
					slug: "hidden-different-parent",
					name: "Hidden Different Parent",
					roleDefinition: "Different parent role",
					groups: ["command"],
					parent: "other-parent",
					hidden: true,
					// Different parent - should not be deleted
				},
				{
					slug: "hidden-correct-parent",
					name: "Hidden Correct Parent",
					roleDefinition: "Correct parent role",
					groups: ["mcp"],
					parent: "parent-mode",
					hidden: true,
					// Correct parent and hidden - should be deleted
				},
			] as any)

			vi.mocked(mockCustomModesManager.deleteCustomMode).mockResolvedValue()

			await installer.removeItem(mockModeItem, { target: "project" })

			// Should only delete the parent and the correctly matched hidden submode
			expect(mockCustomModesManager.deleteCustomMode).toHaveBeenCalledTimes(2)
			expect(mockCustomModesManager.deleteCustomMode).toHaveBeenCalledWith("hidden-correct-parent", true)
			expect(mockCustomModesManager.deleteCustomMode).toHaveBeenCalledWith("parent-mode", true)
		})
	})
})
