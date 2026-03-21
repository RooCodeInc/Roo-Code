import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"

import type { PluginManifest, InstalledExtensions } from "@roo-code/types"

import { GlobalFileNames } from "../../shared/globalFileNames"
import { ensureSettingsDirectoryExists } from "../../utils/globalContext"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { getGlobalRooDirectory, getProjectRooDirectoryForCwd } from "../roo-config"
import { fileExistsAtPath } from "../../utils/fs"
import type { PluginSourceRef } from "./GitHubSource"
import { fetchFileFromGitHub } from "./GitHubSource"

export interface PluginInstallContext {
	sourceRef: PluginSourceRef
	manifest: PluginManifest
	target: "project" | "global"
	cwd: string
	extensionContext: import("vscode").ExtensionContext
}

/**
 * Install all extension points defined in a plugin manifest.
 * Returns the record of what was installed for tracking purposes.
 */
export async function installPluginExtensions(ctx: PluginInstallContext): Promise<InstalledExtensions> {
	const installed: InstalledExtensions = {
		commands: [],
		modes: [],
		mcpServers: [],
		skills: [],
	}

	// Install commands
	if (ctx.manifest.commands && ctx.manifest.commands.length > 0) {
		const commandNames = await installCommands(ctx)
		installed.commands = commandNames
	}

	// Install modes
	if (ctx.manifest.modes && ctx.manifest.modes.length > 0) {
		const modeNames = await installModes(ctx)
		installed.modes = modeNames
	}

	// Install MCP servers
	if (ctx.manifest.mcpServers && Object.keys(ctx.manifest.mcpServers).length > 0) {
		const serverNames = await installMcpServers(ctx)
		installed.mcpServers = serverNames
	}

	// Install skills
	if (ctx.manifest.skills && ctx.manifest.skills.length > 0) {
		const skillNames = await installSkills(ctx)
		installed.skills = skillNames
	}

	return installed
}

/**
 * Remove all extension points installed by a plugin.
 */
export async function removePluginExtensions(
	installed: InstalledExtensions,
	target: "project" | "global",
	cwd: string,
	extensionContext: import("vscode").ExtensionContext,
): Promise<void> {
	// Remove commands
	for (const commandName of installed.commands) {
		await removeCommand(commandName, target, cwd)
	}

	// Remove modes
	for (const modeName of installed.modes) {
		await removeMode(modeName, target, cwd, extensionContext)
	}

	// Remove MCP servers
	for (const serverName of installed.mcpServers) {
		await removeMcpServer(serverName, target, cwd, extensionContext)
	}

	// Remove skills
	for (const skillName of installed.skills) {
		await removeSkill(skillName, target, cwd)
	}
}

// --- Commands ---

async function getCommandsDir(target: "project" | "global", cwd: string): Promise<string> {
	if (target === "project") {
		const projectDir = getProjectRooDirectoryForCwd(cwd)
		return path.join(projectDir, "commands")
	}
	const globalDir = getGlobalRooDirectory()
	return path.join(globalDir, "commands")
}

async function installCommands(ctx: PluginInstallContext): Promise<string[]> {
	const commandsDir = await getCommandsDir(ctx.target, ctx.cwd)
	await fs.mkdir(commandsDir, { recursive: true })

	const installed: string[] = []

	for (const cmd of ctx.manifest.commands!) {
		const content = await fetchFileFromGitHub(ctx.sourceRef, cmd.file)
		const targetPath = path.join(commandsDir, `${cmd.name}.md`)
		await fs.writeFile(targetPath, content, "utf-8")
		installed.push(cmd.name)
	}

	return installed
}

async function removeCommand(name: string, target: "project" | "global", cwd: string): Promise<void> {
	const commandsDir = await getCommandsDir(target, cwd)
	const filePath = path.join(commandsDir, `${name}.md`)
	try {
		await fs.unlink(filePath)
	} catch {
		// File may not exist - that's okay
	}
}

// --- Modes ---

async function getModeFilePath(
	target: "project" | "global",
	cwd: string,
	extensionContext: import("vscode").ExtensionContext,
): Promise<string> {
	if (target === "project") {
		return path.join(cwd, ".roomodes")
	}
	const settingsDir = await ensureSettingsDirectoryExists(extensionContext)
	return path.join(settingsDir, GlobalFileNames.customModes)
}

async function installModes(ctx: PluginInstallContext): Promise<string[]> {
	const installed: string[] = []

	for (const modeEntry of ctx.manifest.modes!) {
		const content = await fetchFileFromGitHub(ctx.sourceRef, modeEntry.file)

		// Parse the mode YAML to get the slug
		let modeData: Record<string, unknown>
		try {
			modeData = yaml.parse(content)
		} catch {
			throw new Error(`Invalid YAML in mode file: ${modeEntry.file}`)
		}

		const slug = modeData.slug as string
		if (!slug) {
			throw new Error(`Mode file ${modeEntry.file} is missing a "slug" field`)
		}

		// Merge into the target modes file
		const modesFilePath = await getModeFilePath(ctx.target, ctx.cwd, ctx.extensionContext)

		let existingData: { customModes: Record<string, unknown>[] } = { customModes: [] }
		try {
			const existingContent = await fs.readFile(modesFilePath, "utf-8")
			existingData = yaml.parse(existingContent) || { customModes: [] }
			if (!existingData.customModes) {
				existingData.customModes = []
			}
		} catch {
			// File doesn't exist yet - use defaults
		}

		// Remove existing mode with same slug
		existingData.customModes = existingData.customModes.filter((m) => m.slug !== slug)
		existingData.customModes.push(modeData)

		await fs.writeFile(modesFilePath, yaml.stringify(existingData, { lineWidth: 0 }), "utf-8")
		installed.push(slug)
	}

	return installed
}

async function removeMode(
	slug: string,
	target: "project" | "global",
	cwd: string,
	extensionContext: import("vscode").ExtensionContext,
): Promise<void> {
	const modesFilePath = await getModeFilePath(target, cwd, extensionContext)
	try {
		const content = await fs.readFile(modesFilePath, "utf-8")
		const data = yaml.parse(content) || { customModes: [] }
		if (data.customModes) {
			data.customModes = data.customModes.filter((m: Record<string, unknown>) => m.slug !== slug)
			await fs.writeFile(modesFilePath, yaml.stringify(data, { lineWidth: 0 }), "utf-8")
		}
	} catch {
		// File doesn't exist - nothing to remove
	}
}

// --- MCP Servers ---

async function getMcpSettingsPath(
	target: "project" | "global",
	cwd: string,
	extensionContext: import("vscode").ExtensionContext,
): Promise<string> {
	if (target === "project") {
		const rooDir = path.join(cwd, ".roo")
		await fs.mkdir(rooDir, { recursive: true })
		return path.join(rooDir, "mcp.json")
	}
	const settingsDir = await ensureSettingsDirectoryExists(extensionContext)
	return path.join(settingsDir, GlobalFileNames.mcpSettings)
}

async function installMcpServers(ctx: PluginInstallContext): Promise<string[]> {
	const mcpPath = await getMcpSettingsPath(ctx.target, ctx.cwd, ctx.extensionContext)

	let existingData: { mcpServers: Record<string, unknown> } = { mcpServers: {} }
	try {
		const content = await fs.readFile(mcpPath, "utf-8")
		existingData = JSON.parse(content)
		if (!existingData.mcpServers) {
			existingData.mcpServers = {}
		}
	} catch {
		// File doesn't exist yet
	}

	const installed: string[] = []
	for (const [serverName, serverConfig] of Object.entries(ctx.manifest.mcpServers!)) {
		existingData.mcpServers[serverName] = serverConfig
		installed.push(serverName)
	}

	await safeWriteJson(mcpPath, existingData)
	return installed
}

async function removeMcpServer(
	serverName: string,
	target: "project" | "global",
	cwd: string,
	extensionContext: import("vscode").ExtensionContext,
): Promise<void> {
	const mcpPath = await getMcpSettingsPath(target, cwd, extensionContext)
	try {
		const content = await fs.readFile(mcpPath, "utf-8")
		const data = JSON.parse(content)
		if (data.mcpServers && data.mcpServers[serverName]) {
			delete data.mcpServers[serverName]
			await safeWriteJson(mcpPath, data)
		}
	} catch {
		// File doesn't exist - nothing to remove
	}
}

// --- Skills ---

async function getSkillsDir(target: "project" | "global", cwd: string): Promise<string> {
	if (target === "project") {
		const projectDir = getProjectRooDirectoryForCwd(cwd)
		return path.join(projectDir, "skills")
	}
	const globalDir = getGlobalRooDirectory()
	return path.join(globalDir, "skills")
}

async function installSkills(ctx: PluginInstallContext): Promise<string[]> {
	const skillsDir = await getSkillsDir(ctx.target, ctx.cwd)
	const installed: string[] = []

	for (const skill of ctx.manifest.skills!) {
		const skillDir = path.join(skillsDir, skill.name)
		await fs.mkdir(skillDir, { recursive: true })

		// Fetch the SKILL.md file from the skill directory in the plugin repo
		const skillMdPath = path.posix.join(skill.directory, "SKILL.md")
		try {
			const content = await fetchFileFromGitHub(ctx.sourceRef, skillMdPath)
			await fs.writeFile(path.join(skillDir, "SKILL.md"), content, "utf-8")
			installed.push(skill.name)
		} catch (error) {
			throw new Error(
				`Failed to install skill "${skill.name}": ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	return installed
}

async function removeSkill(name: string, target: "project" | "global", cwd: string): Promise<void> {
	const skillsDir = await getSkillsDir(target, cwd)
	const skillDir = path.join(skillsDir, name)
	try {
		if (await fileExistsAtPath(skillDir)) {
			await fs.rm(skillDir, { recursive: true, force: true })
		}
	} catch {
		// Directory may not exist - that's okay
	}
}
