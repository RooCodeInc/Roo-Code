import { z } from "zod"

/**
 * Plugin manifest command entry - references a markdown command file in the plugin repo.
 */
export const pluginCommandSchema = z.object({
	name: z.string().min(1).describe("Command name (used as /command-name)"),
	file: z.string().min(1).describe("Relative path to the command markdown file"),
	description: z.string().optional().describe("Human-readable description of the command"),
})

export type PluginCommand = z.infer<typeof pluginCommandSchema>

/**
 * Plugin manifest mode entry - references a YAML mode definition file.
 */
export const pluginModeSchema = z.object({
	file: z.string().min(1).describe("Relative path to the mode YAML file"),
})

export type PluginMode = z.infer<typeof pluginModeSchema>

/**
 * Plugin manifest skill entry - references a skill directory.
 */
export const pluginSkillSchema = z.object({
	name: z.string().min(1).describe("Skill name"),
	directory: z.string().min(1).describe("Relative path to the skill directory"),
})

export type PluginSkill = z.infer<typeof pluginSkillSchema>

/**
 * MCP server configuration within a plugin manifest.
 */
export const pluginMcpServerSchema = z.record(
	z.string(),
	z.object({
		command: z.string().min(1),
		args: z.array(z.string()).optional(),
		env: z.record(z.string(), z.string()).optional(),
	}),
)

export type PluginMcpServers = z.infer<typeof pluginMcpServerSchema>

/**
 * The plugin manifest (plugin.json) found at the root of a plugin repository.
 */
export const pluginManifestSchema = z.object({
	name: z
		.string()
		.min(1)
		.max(100)
		.regex(/^[a-zA-Z0-9_-]+$/, "Plugin name must contain only letters, numbers, hyphens, and underscores"),
	version: z
		.string()
		.regex(/^\d+\.\d+\.\d+$/, "Version must be in semver format (e.g. 1.0.0)")
		.default("1.0.0"),
	description: z.string().optional(),
	author: z.string().optional(),
	commands: z.array(pluginCommandSchema).optional().default([]),
	modes: z.array(pluginModeSchema).optional().default([]),
	mcpServers: pluginMcpServerSchema.optional(),
	skills: z.array(pluginSkillSchema).optional().default([]),
})

export type PluginManifest = z.infer<typeof pluginManifestSchema>

/**
 * Tracks which extension points were installed by a plugin.
 */
export const installedExtensionsSchema = z.object({
	commands: z.array(z.string()).default([]),
	modes: z.array(z.string()).default([]),
	mcpServers: z.array(z.string()).default([]),
	skills: z.array(z.string()).default([]),
})

export type InstalledExtensions = z.infer<typeof installedExtensionsSchema>

/**
 * Record of an installed plugin, stored in plugins.json.
 */
export const installedPluginSchema = z.object({
	name: z.string(),
	version: z.string(),
	source: z.string().describe("GitHub owner/repo format"),
	ref: z.string().default("main").describe("Git ref (branch, tag, or commit) used during install"),
	installedAt: z.string().describe("ISO 8601 timestamp"),
	target: z.enum(["project", "global"]),
	installedExtensions: installedExtensionsSchema,
})

export type InstalledPlugin = z.infer<typeof installedPluginSchema>

/**
 * The plugins tracking file schema (plugins.json).
 */
export const pluginsFileSchema = z.object({
	installedPlugins: z.array(installedPluginSchema).default([]),
})

export type PluginsFile = z.infer<typeof pluginsFileSchema>
