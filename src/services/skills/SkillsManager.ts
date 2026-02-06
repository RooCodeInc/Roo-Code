import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import matter from "gray-matter"

import type { ClineProvider } from "../../core/webview/ClineProvider"
import { getGlobalRooDirectory, getGlobalAgentsDirectory, getProjectAgentsDirectoryForCwd } from "../roo-config"
import { directoryExists, fileExists } from "../roo-config"
import { SkillMetadata, SkillContent } from "../../shared/skills"
import { modes, getAllModes } from "../../shared/modes"
import { getBuiltInSkills, getBuiltInSkillContent } from "./built-in-skills"

// Re-export for convenience
export type { SkillMetadata, SkillContent }

export class SkillsManager {
	private skills: Map<string, SkillMetadata> = new Map()
	private providerRef: WeakRef<ClineProvider>
	private disposables: vscode.Disposable[] = []
	private isDisposed = false

	constructor(provider: ClineProvider) {
		this.providerRef = new WeakRef(provider)
	}

	async initialize(): Promise<void> {
		await this.discoverSkills()
		await this.setupFileWatchers()
	}

	/**
	 * Discover all skills from global and project directories.
	 * Supports both generic skills (skills/) and mode-specific skills (skills-{mode}/).
	 * Also supports symlinks:
	 * - .roo/skills can be a symlink to a directory containing skill subdirectories
	 * - .roo/skills/[dirname] can be a symlink to a skill directory
	 */
	async discoverSkills(): Promise<void> {
		this.skills.clear()
		const skillsDirs = await this.getSkillsDirectories()

		for (const { dir, source, mode } of skillsDirs) {
			await this.scanSkillsDirectory(dir, source, mode)
		}
	}

	/**
	 * Scan a skills directory for skill subdirectories.
	 * Handles two symlink cases:
	 * 1. The skills directory itself is a symlink (resolved by directoryExists using realpath)
	 * 2. Individual skill subdirectories are symlinks
	 */
	private async scanSkillsDirectory(dirPath: string, source: "global" | "project", mode?: string): Promise<void> {
		if (!(await directoryExists(dirPath))) {
			return
		}

		try {
			// Get the real path (resolves if dirPath is a symlink)
			const realDirPath = await fs.realpath(dirPath)

			// Read directory entries
			const entries = await fs.readdir(realDirPath)

			for (const entryName of entries) {
				const entryPath = path.join(realDirPath, entryName)

				// Check if this entry is a directory (follows symlinks automatically)
				const stats = await fs.stat(entryPath).catch(() => null)
				if (!stats?.isDirectory()) continue

				// Load skill metadata - the skill name comes from the entry name (symlink name if symlinked)
				await this.loadSkillMetadata(entryPath, source, mode, entryName)
			}
		} catch {
			// Directory doesn't exist or can't be read - this is fine
		}
	}

	/**
	 * Load skill metadata from a skill directory.
	 * @param skillDir - The resolved path to the skill directory (target of symlink if symlinked)
	 * @param source - Whether this is a global or project skill
	 * @param mode - The mode this skill is specific to (undefined for generic skills)
	 * @param skillName - The skill name (from symlink name if symlinked, otherwise from directory name)
	 */
	private async loadSkillMetadata(
		skillDir: string,
		source: "global" | "project",
		mode?: string,
		skillName?: string,
	): Promise<void> {
		const skillMdPath = path.join(skillDir, "SKILL.md")
		if (!(await fileExists(skillMdPath))) return

		try {
			const fileContent = await fs.readFile(skillMdPath, "utf-8")

			// Use gray-matter to parse frontmatter
			const { data: frontmatter, content: body } = matter(fileContent)

			// Validate required fields (only name and description for now)
			if (!frontmatter.name || typeof frontmatter.name !== "string") {
				console.error(`Skill at ${skillDir} is missing required 'name' field`)
				return
			}
			if (!frontmatter.description || typeof frontmatter.description !== "string") {
				console.error(`Skill at ${skillDir} is missing required 'description' field`)
				return
			}

			// Validate that frontmatter name matches the skill name (directory name or symlink name)
			// Per the Agent Skills spec: "name field must match the parent directory name"
			const effectiveSkillName = skillName || path.basename(skillDir)
			if (frontmatter.name !== effectiveSkillName) {
				console.error(`Skill name "${frontmatter.name}" doesn't match directory "${effectiveSkillName}"`)
				return
			}

			// Strict spec validation (https://agentskills.io/specification)
			// Name constraints:
			// - 1-64 chars
			// - lowercase letters/numbers/hyphens only
			// - must not start/end with hyphen
			// - must not contain consecutive hyphens
			if (effectiveSkillName.length < 1 || effectiveSkillName.length > 64) {
				console.error(
					`Skill name "${effectiveSkillName}" is invalid: name must be 1-64 characters (got ${effectiveSkillName.length})`,
				)
				return
			}
			const nameFormat = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
			if (!nameFormat.test(effectiveSkillName)) {
				console.error(
					`Skill name "${effectiveSkillName}" is invalid: must be lowercase letters/numbers/hyphens only (no leading/trailing hyphen, no consecutive hyphens)`,
				)
				return
			}

			// Description constraints:
			// - 1-1024 chars
			// - non-empty (after trimming)
			const description = frontmatter.description.trim()
			if (description.length < 1 || description.length > 1024) {
				console.error(
					`Skill "${effectiveSkillName}" has an invalid description length: must be 1-1024 characters (got ${description.length})`,
				)
				return
			}

			// Create unique key combining name, source, and mode for override resolution
			const skillKey = this.getSkillKey(effectiveSkillName, source, mode)

			this.skills.set(skillKey, {
				name: effectiveSkillName,
				description,
				path: skillMdPath,
				source,
				mode, // undefined for generic skills, string for mode-specific
			})
		} catch (error) {
			console.error(`Failed to load skill at ${skillDir}:`, error)
		}
	}

	/**
	 * Get skills available for the current mode.
	 * Resolves overrides: project > global > built-in, mode-specific > generic.
	 *
	 * @param currentMode - The current mode slug (e.g., 'code', 'architect')
	 */
	getSkillsForMode(currentMode: string): SkillMetadata[] {
		const resolvedSkills = new Map<string, SkillMetadata>()

		// First, add built-in skills (lowest priority)
		for (const skill of getBuiltInSkills()) {
			resolvedSkills.set(skill.name, skill)
		}

		// Then, add discovered skills (will override built-in skills with same name)
		for (const skill of this.skills.values()) {
			// Skip mode-specific skills that don't match current mode
			if (skill.mode && skill.mode !== currentMode) continue

			const existingSkill = resolvedSkills.get(skill.name)

			if (!existingSkill) {
				resolvedSkills.set(skill.name, skill)
				continue
			}

			// Apply override rules
			const shouldOverride = this.shouldOverrideSkill(existingSkill, skill)
			if (shouldOverride) {
				resolvedSkills.set(skill.name, skill)
			}
		}

		return Array.from(resolvedSkills.values())
	}

	/**
	 * Determine if newSkill should override existingSkill based on priority rules.
	 * Priority: project > global > built-in, mode-specific > generic
	 */
	private shouldOverrideSkill(existing: SkillMetadata, newSkill: SkillMetadata): boolean {
		// Define source priority: project > global > built-in
		const sourcePriority: Record<string, number> = {
			project: 3,
			global: 2,
			"built-in": 1,
		}

		const existingPriority = sourcePriority[existing.source] ?? 0
		const newPriority = sourcePriority[newSkill.source] ?? 0

		// Higher priority source always wins
		if (newPriority > existingPriority) return true
		if (newPriority < existingPriority) return false

		// Same source: mode-specific overrides generic
		if (newSkill.mode && !existing.mode) return true
		if (!newSkill.mode && existing.mode) return false

		// Same source and same mode-specificity: keep existing (first wins)
		return false
	}

	/**
	 * Get all skills (for UI display, debugging, etc.)
	 */
	getAllSkills(): SkillMetadata[] {
		return Array.from(this.skills.values())
	}

	async getSkillContent(name: string, currentMode?: string): Promise<SkillContent | null> {
		// If mode is provided, try to find the best matching skill
		let skill: SkillMetadata | undefined

		if (currentMode) {
			const modeSkills = this.getSkillsForMode(currentMode)
			skill = modeSkills.find((s) => s.name === name)
		} else {
			// Fall back to any skill with this name (check discovered skills first, then built-in)
			skill = Array.from(this.skills.values()).find((s) => s.name === name)
			if (!skill) {
				skill = getBuiltInSkills().find((s) => s.name === name)
			}
		}

		if (!skill) return null

		// For built-in skills, use the built-in content
		if (skill.source === "built-in") {
			return getBuiltInSkillContent(name)
		}

		// For file-based skills, read from disk
		const fileContent = await fs.readFile(skill.path, "utf-8")
		const { content: body } = matter(fileContent)

		return {
			...skill,
			instructions: body.trim(),
		}
	}

	/**
	 * Get all skills directories to scan, including mode-specific directories.
	 */
	private async getSkillsDirectories(): Promise<
		Array<{
			dir: string
			source: "global" | "project"
			mode?: string
		}>
	> {
		const dirs: Array<{ dir: string; source: "global" | "project"; mode?: string }> = []
		const globalRooDir = getGlobalRooDirectory()
		const globalAgentsDir = getGlobalAgentsDirectory()
		const provider = this.providerRef.deref()
		const projectRooDir = provider?.cwd ? path.join(provider.cwd, ".roo") : null
		const projectAgentsDir = provider?.cwd ? getProjectAgentsDirectoryForCwd(provider.cwd) : null

		// Get list of modes to check for mode-specific skills
		const modesList = await this.getAvailableModes()

		// Priority rules for skills with the same name:
		// 1. Source level: project > global > built-in (handled by shouldOverrideSkill in getSkillsForMode)
		// 2. Within the same source level: later-processed directories override earlier ones
		//    (via Map.set replacement during discovery - same source+mode+name key gets replaced)
		//
		// Processing order (later directories override earlier ones at the same source level):
		// - Global: .agents/skills first, then .roo/skills (so .roo wins)
		// - Project: .agents/skills first, then .roo/skills (so .roo wins)

		// Global .agents directories (lowest priority - shared across agents)
		dirs.push({ dir: path.join(globalAgentsDir, "skills"), source: "global" })
		for (const mode of modesList) {
			dirs.push({ dir: path.join(globalAgentsDir, `skills-${mode}`), source: "global", mode })
		}

		// Project .agents directories
		if (projectAgentsDir) {
			dirs.push({ dir: path.join(projectAgentsDir, "skills"), source: "project" })
			for (const mode of modesList) {
				dirs.push({ dir: path.join(projectAgentsDir, `skills-${mode}`), source: "project", mode })
			}
		}

		// Global .roo directories (Roo-specific, higher priority than .agents)
		dirs.push({ dir: path.join(globalRooDir, "skills"), source: "global" })
		for (const mode of modesList) {
			dirs.push({ dir: path.join(globalRooDir, `skills-${mode}`), source: "global", mode })
		}

		// Project .roo directories (highest priority)
		if (projectRooDir) {
			dirs.push({ dir: path.join(projectRooDir, "skills"), source: "project" })
			for (const mode of modesList) {
				dirs.push({ dir: path.join(projectRooDir, `skills-${mode}`), source: "project", mode })
			}
		}

		return dirs
	}

	/**
	 * Get list of available modes (built-in + custom)
	 */
	private async getAvailableModes(): Promise<string[]> {
		const provider = this.providerRef.deref()
		const builtInModeSlugs = modes.map((m) => m.slug)

		if (!provider) {
			return builtInModeSlugs
		}

		try {
			const customModes = await provider.customModesManager.getCustomModes()
			const allModes = getAllModes(customModes)
			return allModes.map((m) => m.slug)
		} catch {
			return builtInModeSlugs
		}
	}

	private getSkillKey(name: string, source: string, mode?: string): string {
		return `${source}:${mode || "generic"}:${name}`
	}

	private async setupFileWatchers(): Promise<void> {
		// Skip if test environment is detected or VSCode APIs are not available
		if (process.env.NODE_ENV === "test" || !vscode.workspace.createFileSystemWatcher) {
			return
		}

		const provider = this.providerRef.deref()
		if (!provider?.cwd) return

		// Watch for changes in skills directories
		const globalRooDir = getGlobalRooDirectory()
		const globalAgentsDir = getGlobalAgentsDirectory()
		const projectRooDir = path.join(provider.cwd, ".roo")
		const projectAgentsDir = getProjectAgentsDirectoryForCwd(provider.cwd)

		// Watch global .roo skills directory
		this.watchDirectory(path.join(globalRooDir, "skills"))

		// Watch global .agents skills directory
		this.watchDirectory(path.join(globalAgentsDir, "skills"))

		// Watch project .roo skills directory
		this.watchDirectory(path.join(projectRooDir, "skills"))

		// Watch project .agents skills directory
		this.watchDirectory(path.join(projectAgentsDir, "skills"))

		// Watch mode-specific directories for all available modes
		const modesList = await this.getAvailableModes()
		for (const mode of modesList) {
			// .roo mode-specific
			this.watchDirectory(path.join(globalRooDir, `skills-${mode}`))
			this.watchDirectory(path.join(projectRooDir, `skills-${mode}`))
			// .agents mode-specific
			this.watchDirectory(path.join(globalAgentsDir, `skills-${mode}`))
			this.watchDirectory(path.join(projectAgentsDir, `skills-${mode}`))
		}
	}

	private watchDirectory(dirPath: string): void {
		if (process.env.NODE_ENV === "test" || !vscode.workspace.createFileSystemWatcher) {
			return
		}

		const pattern = new vscode.RelativePattern(dirPath, "**/SKILL.md")
		const watcher = vscode.workspace.createFileSystemWatcher(pattern)

		watcher.onDidChange(async (uri) => {
			if (this.isDisposed) return
			await this.discoverSkills()
		})

		watcher.onDidCreate(async (uri) => {
			if (this.isDisposed) return
			await this.discoverSkills()
		})

		watcher.onDidDelete(async (uri) => {
			if (this.isDisposed) return
			await this.discoverSkills()
		})

		this.disposables.push(watcher)
	}

	async dispose(): Promise<void> {
		this.isDisposed = true
		this.disposables.forEach((d) => d.dispose())
		this.disposables = []
		this.skills.clear()
	}
}
