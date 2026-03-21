import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"

import type { InstalledPlugin, PluginsFile, PluginManifest } from "@roo-code/types"
import { pluginsFileSchema } from "@roo-code/types"

import { GlobalFileNames } from "../../shared/globalFileNames"
import { ensureSettingsDirectoryExists } from "../../utils/globalContext"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { getGlobalRooDirectory, getProjectRooDirectoryForCwd } from "../roo-config"
import { parsePluginSource, fetchPluginManifest, type PluginSourceRef } from "./GitHubSource"
import { installPluginExtensions, removePluginExtensions, type PluginInstallContext } from "./PluginInstaller"

export class PluginManager {
	constructor(
		private readonly extensionContext: vscode.ExtensionContext,
		private readonly cwd: string,
	) {}

	/**
	 * Install a plugin from a GitHub repository source.
	 *
	 * @param source - GitHub repo in "owner/repo" or "owner/repo@ref" format
	 * @param target - Install to "project" (.roo/) or "global" (~/.roo/)
	 * @returns The installed plugin record
	 */
	async install(source: string, target: "project" | "global" = "project"): Promise<InstalledPlugin> {
		const sourceRef = parsePluginSource(source)

		// Fetch and validate manifest
		const manifest = await fetchPluginManifest(sourceRef)

		// Check if already installed
		const existing = await this.getInstalledPlugin(manifest.name, target)
		if (existing) {
			throw new Error(
				`Plugin "${manifest.name}" is already installed (${target}). Remove it first with /plugin remove ${manifest.name}`,
			)
		}

		// Install all extension points
		const ctx: PluginInstallContext = {
			sourceRef,
			manifest,
			target,
			cwd: this.cwd,
			extensionContext: this.extensionContext,
		}

		const installedExtensions = await installPluginExtensions(ctx)

		// Create install record
		const record: InstalledPlugin = {
			name: manifest.name,
			version: manifest.version,
			source: `${sourceRef.owner}/${sourceRef.repo}`,
			ref: sourceRef.ref,
			installedAt: new Date().toISOString(),
			target,
			installedExtensions,
		}

		// Save to tracking file
		await this.addPluginRecord(record, target)

		return record
	}

	/**
	 * Remove an installed plugin and clean up all its extension points.
	 */
	async remove(pluginName: string, target?: "project" | "global"): Promise<void> {
		// Find the plugin - check both project and global if target not specified
		let record: InstalledPlugin | undefined
		let recordTarget: "project" | "global"

		if (target) {
			record = await this.getInstalledPlugin(pluginName, target)
			recordTarget = target
		} else {
			// Check project first, then global
			record = await this.getInstalledPlugin(pluginName, "project")
			recordTarget = "project"
			if (!record) {
				record = await this.getInstalledPlugin(pluginName, "global")
				recordTarget = "global"
			}
		}

		if (!record) {
			throw new Error(`Plugin "${pluginName}" is not installed.`)
		}

		// Remove all installed extension points
		await removePluginExtensions(record.installedExtensions, recordTarget!, this.cwd, this.extensionContext)

		// Remove from tracking file
		await this.removePluginRecord(pluginName, recordTarget!)
	}

	/**
	 * List all installed plugins (both project and global).
	 */
	async list(): Promise<InstalledPlugin[]> {
		const projectPlugins = await this.readPluginsFile("project")
		const globalPlugins = await this.readPluginsFile("global")
		return [...projectPlugins.installedPlugins, ...globalPlugins.installedPlugins]
	}

	/**
	 * Get a specific installed plugin by name and target.
	 */
	async getInstalledPlugin(name: string, target: "project" | "global"): Promise<InstalledPlugin | undefined> {
		const pluginsFile = await this.readPluginsFile(target)
		return pluginsFile.installedPlugins.find((p) => p.name === name)
	}

	// --- Private helpers ---

	private async getPluginsFilePath(target: "project" | "global"): Promise<string> {
		if (target === "project") {
			const projectDir = getProjectRooDirectoryForCwd(this.cwd)
			await fs.mkdir(projectDir, { recursive: true })
			return path.join(projectDir, GlobalFileNames.plugins)
		}
		const settingsDir = await ensureSettingsDirectoryExists(this.extensionContext)
		return path.join(settingsDir, GlobalFileNames.plugins)
	}

	private async readPluginsFile(target: "project" | "global"): Promise<PluginsFile> {
		const filePath = await this.getPluginsFilePath(target)
		try {
			const content = await fs.readFile(filePath, "utf-8")
			const parsed = JSON.parse(content)
			const result = pluginsFileSchema.safeParse(parsed)
			if (result.success) {
				return result.data
			}
		} catch {
			// File doesn't exist or is invalid
		}
		return { installedPlugins: [] }
	}

	private async addPluginRecord(record: InstalledPlugin, target: "project" | "global"): Promise<void> {
		const filePath = await this.getPluginsFilePath(target)
		const pluginsFile = await this.readPluginsFile(target)

		// Remove existing record with same name (shouldn't happen but be safe)
		pluginsFile.installedPlugins = pluginsFile.installedPlugins.filter((p) => p.name !== record.name)
		pluginsFile.installedPlugins.push(record)

		await safeWriteJson(filePath, pluginsFile)
	}

	private async removePluginRecord(pluginName: string, target: "project" | "global"): Promise<void> {
		const filePath = await this.getPluginsFilePath(target)
		const pluginsFile = await this.readPluginsFile(target)

		pluginsFile.installedPlugins = pluginsFile.installedPlugins.filter((p) => p.name !== pluginName)

		await safeWriteJson(filePath, pluginsFile)
	}
}
