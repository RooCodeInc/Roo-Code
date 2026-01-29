import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import * as vscode from "vscode"
import matter from "gray-matter"

import type { ClineProvider } from "../../core/webview/ClineProvider"
import { getGlobalRooDirectory } from "../roo-config"
import { directoryExists, fileExists } from "../roo-config"
import { SkillMetadata, SkillContent } from "../../shared/skills"
import { modes, getAllModes } from "../../shared/modes"
import {
	validateSkillName as validateSkillNameShared,
	SkillNameValidationError,
	SKILL_NAME_MAX_LENGTH,
} from "@roo-code/types"
import { t } from "../../i18n"

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

			// Validate skill name per agentskills.io spec using shared validation
			const nameValidation = validateSkillNameShared(effectiveSkillName)
			if (!nameValidation.valid) {
				const errorMessage = this.getSkillNameErrorMessage(effectiveSkillName, nameValidation.error!)
				console.error(`Skill name "${effectiveSkillName}" is invalid: ${errorMessage}`)
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
	 * Resolves overrides: project > global, mode-specific > generic.
	 *
	 * @param currentMode - The current mode slug (e.g., 'code', 'architect')
	 */
	getSkillsForMode(currentMode: string): SkillMetadata[] {
		const resolvedSkills = new Map<string, SkillMetadata>()

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
	 * Priority: project > global, mode-specific > generic
	 */
	private shouldOverrideSkill(existing: SkillMetadata, newSkill: SkillMetadata): boolean {
		// Project always overrides global
		if (newSkill.source === "project" && existing.source === "global") return true
		if (newSkill.source === "global" && existing.source === "project") return false

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
			// Fall back to any skill with this name
			skill = Array.from(this.skills.values()).find((s) => s.name === name)
		}

		if (!skill) return null

		const fileContent = await fs.readFile(skill.path, "utf-8")
		const { content: body } = matter(fileContent)

		return {
			...skill,
			instructions: body.trim(),
		}
	}

	/**
	 * Get all skills metadata (for UI display)
	 * Returns skills from all sources without content
	 */
	getSkillsMetadata(): SkillMetadata[] {
		return this.getAllSkills()
	}

	/**
	 * Get a skill by name, source, and optionally mode
	 */
	getSkill(name: string, source: "global" | "project", mode?: string): SkillMetadata | undefined {
		const skillKey = this.getSkillKey(name, source, mode)
		return this.skills.get(skillKey)
	}

	/**
	 * Validate skill name per agentskills.io spec using shared validation.
	 * Converts error codes to user-friendly error messages.
	 */
	private validateSkillName(name: string): { valid: boolean; error?: string } {
		const result = validateSkillNameShared(name)
		if (!result.valid) {
			return { valid: false, error: this.getSkillNameErrorMessage(name, result.error!) }
		}
		return { valid: true }
	}

	/**
	 * Convert skill name validation error code to a user-friendly error message.
	 */
	private getSkillNameErrorMessage(name: string, error: SkillNameValidationError): string {
		switch (error) {
			case SkillNameValidationError.Empty:
				return t("skills:errors.name_length", { maxLength: SKILL_NAME_MAX_LENGTH, length: name.length })
			case SkillNameValidationError.TooLong:
				return t("skills:errors.name_length", { maxLength: SKILL_NAME_MAX_LENGTH, length: name.length })
			case SkillNameValidationError.InvalidFormat:
				return t("skills:errors.name_format")
		}
	}

	/**
	 * Create a new skill
	 * @param name - Skill name (must be valid per agentskills.io spec)
	 * @param source - "global" or "project"
	 * @param description - Skill description
	 * @param mode - Optional mode restriction (creates in skills-{mode}/ directory)
	 * @returns Path to created SKILL.md file
	 */
	async createSkill(name: string, source: "global" | "project", description: string, mode?: string): Promise<string> {
		// Validate skill name
		const validation = this.validateSkillName(name)
		if (!validation.valid) {
			throw new Error(validation.error)
		}

		// Validate description
		const trimmedDescription = description.trim()
		if (trimmedDescription.length < 1 || trimmedDescription.length > 1024) {
			throw new Error(t("skills:errors.description_length", { length: trimmedDescription.length }))
		}

		// Determine base directory
		let baseDir: string
		if (source === "global") {
			baseDir = getGlobalRooDirectory()
		} else {
			const provider = this.providerRef.deref()
			if (!provider?.cwd) {
				throw new Error(t("skills:errors.no_workspace"))
			}
			baseDir = path.join(provider.cwd, ".roo")
		}

		// Determine skills directory (with optional mode suffix)
		const skillsDirName = mode ? `skills-${mode}` : "skills"
		const skillsDir = path.join(baseDir, skillsDirName)
		const skillDir = path.join(skillsDir, name)
		const skillMdPath = path.join(skillDir, "SKILL.md")

		// Check if skill already exists
		if (await fileExists(skillMdPath)) {
			throw new Error(t("skills:errors.already_exists", { name, path: skillMdPath }))
		}

		// Create the skill directory
		await fs.mkdir(skillDir, { recursive: true })

		// Generate SKILL.md content with frontmatter
		const titleName = name
			.split("-")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ")

		const skillContent = `---
name: ${name}
description: ${trimmedDescription}
---

# ${titleName}

## Instructions

Add your skill instructions here.
`

		// Write the SKILL.md file
		await fs.writeFile(skillMdPath, skillContent, "utf-8")

		// Refresh skills list
		await this.discoverSkills()

		return skillMdPath
	}

	/**
	 * Delete a skill
	 * @param name - Skill name to delete
	 * @param source - Where the skill is located
	 * @param mode - Optional mode (to locate in skills-{mode}/ directory)
	 */
	async deleteSkill(name: string, source: "global" | "project", mode?: string): Promise<void> {
		// Find the skill
		const skill = this.getSkill(name, source, mode)
		if (!skill) {
			const modeInfo = mode ? ` (mode: ${mode})` : ""
			throw new Error(t("skills:errors.not_found", { name, source, modeInfo }))
		}

		// Get the skill directory (parent of SKILL.md)
		const skillDir = path.dirname(skill.path)

		// Delete the entire skill directory
		await fs.rm(skillDir, { recursive: true, force: true })

		// Refresh skills list
		await this.discoverSkills()
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
		const provider = this.providerRef.deref()
		const projectRooDir = provider?.cwd ? path.join(provider.cwd, ".roo") : null

		// Get list of modes to check for mode-specific skills
		const modesList = await this.getAvailableModes()

		// Global directories
		dirs.push({ dir: path.join(globalRooDir, "skills"), source: "global" })
		for (const mode of modesList) {
			dirs.push({ dir: path.join(globalRooDir, `skills-${mode}`), source: "global", mode })
		}

		// Project directories
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
		const globalSkillsDir = path.join(getGlobalRooDirectory(), "skills")
		const projectSkillsDir = path.join(provider.cwd, ".roo", "skills")

		// Watch global skills directory
		this.watchDirectory(globalSkillsDir)

		// Watch project skills directory
		this.watchDirectory(projectSkillsDir)

		// Watch mode-specific directories for all available modes
		const modesList = await this.getAvailableModes()
		for (const mode of modesList) {
			this.watchDirectory(path.join(getGlobalRooDirectory(), `skills-${mode}`))
			this.watchDirectory(path.join(provider.cwd, ".roo", `skills-${mode}`))
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
