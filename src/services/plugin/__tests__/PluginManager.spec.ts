import * as fs from "fs/promises"
import * as path from "path"

import { PluginManager } from "../PluginManager"
import * as GitHubSource from "../GitHubSource"
import * as PluginInstaller from "../PluginInstaller"

// Mock dependencies
vi.mock("fs/promises")
vi.mock("../GitHubSource")
vi.mock("../PluginInstaller")
vi.mock("../../../utils/globalContext", () => ({
	ensureSettingsDirectoryExists: vi.fn().mockResolvedValue("/mock/settings"),
}))
vi.mock("../../roo-config", () => ({
	getGlobalRooDirectory: vi.fn().mockReturnValue("/mock/home/.roo"),
	getProjectRooDirectoryForCwd: vi.fn().mockReturnValue("/mock/project/.roo"),
}))
vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn().mockResolvedValue(undefined),
}))

describe("PluginManager", () => {
	let manager: PluginManager
	const mockExtensionContext = {} as any

	beforeEach(() => {
		vi.clearAllMocks()
		manager = new PluginManager(mockExtensionContext, "/mock/project")
	})

	describe("install", () => {
		it("should install a plugin from GitHub", async () => {
			const mockManifest = {
				name: "test-plugin",
				version: "1.0.0",
				description: "Test",
				commands: [{ name: "review", file: "commands/review.md" }],
				modes: [],
				skills: [],
			}

			vi.mocked(GitHubSource.parsePluginSource).mockReturnValue({
				owner: "owner",
				repo: "repo",
				ref: "main",
			})

			vi.mocked(GitHubSource.fetchPluginManifest).mockResolvedValue(mockManifest as any)

			// Mock empty plugins file (not installed yet)
			vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"))
			vi.mocked(fs.mkdir).mockResolvedValue(undefined as any)

			vi.mocked(PluginInstaller.installPluginExtensions).mockResolvedValue({
				commands: ["review"],
				modes: [],
				mcpServers: [],
				skills: [],
			})

			const result = await manager.install("owner/repo")

			expect(result.name).toBe("test-plugin")
			expect(result.version).toBe("1.0.0")
			expect(result.source).toBe("owner/repo")
			expect(result.ref).toBe("main")
			expect(result.target).toBe("project")
			expect(result.installedExtensions.commands).toEqual(["review"])
			expect(GitHubSource.fetchPluginManifest).toHaveBeenCalled()
			expect(PluginInstaller.installPluginExtensions).toHaveBeenCalled()
		})

		it("should throw if plugin is already installed", async () => {
			const existingPlugins = {
				installedPlugins: [
					{
						name: "test-plugin",
						version: "1.0.0",
						source: "owner/repo",
						ref: "main",
						installedAt: "2024-01-01T00:00:00Z",
						target: "project",
						installedExtensions: { commands: [], modes: [], mcpServers: [], skills: [] },
					},
				],
			}

			vi.mocked(GitHubSource.parsePluginSource).mockReturnValue({
				owner: "owner",
				repo: "repo",
				ref: "main",
			})

			vi.mocked(GitHubSource.fetchPluginManifest).mockResolvedValue({
				name: "test-plugin",
				version: "1.0.0",
				commands: [],
				modes: [],
				skills: [],
			} as any)

			vi.mocked(fs.mkdir).mockResolvedValue(undefined as any)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingPlugins) as any)

			await expect(manager.install("owner/repo")).rejects.toThrow("already installed")
		})

		it("should install to global scope when specified", async () => {
			vi.mocked(GitHubSource.parsePluginSource).mockReturnValue({
				owner: "owner",
				repo: "repo",
				ref: "main",
			})

			vi.mocked(GitHubSource.fetchPluginManifest).mockResolvedValue({
				name: "global-plugin",
				version: "1.0.0",
				commands: [],
				modes: [],
				skills: [],
			} as any)

			vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"))

			vi.mocked(PluginInstaller.installPluginExtensions).mockResolvedValue({
				commands: [],
				modes: [],
				mcpServers: [],
				skills: [],
			})

			const result = await manager.install("owner/repo", "global")

			expect(result.target).toBe("global")
		})
	})

	describe("remove", () => {
		it("should remove an installed plugin", async () => {
			const existingPlugins = {
				installedPlugins: [
					{
						name: "test-plugin",
						version: "1.0.0",
						source: "owner/repo",
						ref: "main",
						installedAt: "2024-01-01T00:00:00Z",
						target: "project",
						installedExtensions: {
							commands: ["review"],
							modes: [],
							mcpServers: [],
							skills: [],
						},
					},
				],
			}

			vi.mocked(fs.mkdir).mockResolvedValue(undefined as any)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingPlugins) as any)
			vi.mocked(PluginInstaller.removePluginExtensions).mockResolvedValue(undefined)

			await manager.remove("test-plugin")

			expect(PluginInstaller.removePluginExtensions).toHaveBeenCalledWith(
				existingPlugins.installedPlugins[0].installedExtensions,
				"project",
				"/mock/project",
				mockExtensionContext,
			)
		})

		it("should throw if plugin is not installed", async () => {
			vi.mocked(fs.mkdir).mockResolvedValue(undefined as any)
			vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"))

			await expect(manager.remove("nonexistent")).rejects.toThrow("not installed")
		})
	})

	describe("list", () => {
		it("should list plugins from both project and global", async () => {
			const projectPlugins = {
				installedPlugins: [
					{
						name: "project-plugin",
						version: "1.0.0",
						source: "o/r",
						ref: "main",
						installedAt: "2024-01-01T00:00:00Z",
						target: "project",
						installedExtensions: { commands: [], modes: [], mcpServers: [], skills: [] },
					},
				],
			}

			const globalPlugins = {
				installedPlugins: [
					{
						name: "global-plugin",
						version: "2.0.0",
						source: "g/r",
						ref: "main",
						installedAt: "2024-01-01T00:00:00Z",
						target: "global",
						installedExtensions: { commands: [], modes: [], mcpServers: [], skills: [] },
					},
				],
			}

			vi.mocked(fs.mkdir).mockResolvedValue(undefined as any)
			// First call is for project, second for global
			vi.mocked(fs.readFile)
				.mockResolvedValueOnce(JSON.stringify(projectPlugins) as any)
				.mockResolvedValueOnce(JSON.stringify(globalPlugins) as any)

			const result = await manager.list()

			expect(result).toHaveLength(2)
			expect(result[0].name).toBe("project-plugin")
			expect(result[1].name).toBe("global-plugin")
		})

		it("should return empty array when no plugins installed", async () => {
			vi.mocked(fs.mkdir).mockResolvedValue(undefined as any)
			vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"))

			const result = await manager.list()
			expect(result).toEqual([])
		})
	})
})
