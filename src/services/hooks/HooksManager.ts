/**
 * HooksManager is responsible for loading and merging hook configurations from
 * project-level (.roo/hooks.json) and global-level (~/.roo/hooks.json) files.
 *
 * It watches for file changes and reloads automatically.
 */

import * as path from "path"
import * as vscode from "vscode"
import fs from "fs/promises"

import { type HooksConfig, type HookEventName, type HookDefinition, validateHooksConfig } from "../../shared/hooks"
import { getGlobalRooDirectory } from "../roo-config"

export class HooksManager implements vscode.Disposable {
	private projectConfig: HooksConfig | null = null
	private globalConfig: HooksConfig | null = null
	private disposables: vscode.Disposable[] = []
	private cwd: string

	constructor(cwd: string) {
		this.cwd = cwd
		this.setupFileWatchers()
	}

	/**
	 * Initializes the manager by loading both project and global configs.
	 */
	async initialize(): Promise<void> {
		await Promise.all([this.loadProjectConfig(), this.loadGlobalConfig()])
	}

	/**
	 * Returns the merged hooks for a given event. Project hooks take precedence
	 * and are appended after global hooks (so they run last and can override).
	 */
	getHooksForEvent(event: HookEventName): HookDefinition[] {
		const globalHooks = this.globalConfig?.hooks[event] ?? []
		const projectHooks = this.projectConfig?.hooks[event] ?? []
		return [...globalHooks, ...projectHooks]
	}

	/**
	 * Returns true if there are any hooks configured for the given event.
	 */
	hasHooksForEvent(event: HookEventName): boolean {
		return this.getHooksForEvent(event).length > 0
	}

	/**
	 * Gets hooks that match a specific tool name for PreToolUse / PostToolUse events.
	 */
	getMatchingHooks(event: HookEventName, toolName?: string): HookDefinition[] {
		const hooks = this.getHooksForEvent(event)

		if (!toolName) {
			return hooks
		}

		return hooks.filter((hook) => {
			if (!hook.matcher) {
				return true // No matcher means match all tools
			}

			try {
				const regex = new RegExp(hook.matcher)
				return regex.test(toolName)
			} catch {
				return false // Invalid regex, skip this hook
			}
		})
	}

	/**
	 * Returns the project-level hooks.json path.
	 */
	getProjectHooksPath(): string {
		return path.join(this.cwd, ".roo", "hooks.json")
	}

	/**
	 * Returns the global-level hooks.json path.
	 */
	getGlobalHooksPath(): string {
		return path.join(getGlobalRooDirectory(), "hooks.json")
	}

	private async loadProjectConfig(): Promise<void> {
		this.projectConfig = await this.loadConfigFromPath(this.getProjectHooksPath())
	}

	private async loadGlobalConfig(): Promise<void> {
		this.globalConfig = await this.loadConfigFromPath(this.getGlobalHooksPath())
	}

	private async loadConfigFromPath(filePath: string): Promise<HooksConfig | null> {
		try {
			const content = await fs.readFile(filePath, "utf-8")
			const parsed = JSON.parse(content)
			const validated = validateHooksConfig(parsed)

			if (!validated) {
				console.warn(`[HooksManager] Invalid hooks config at ${filePath}`)
				return null
			}

			return validated
		} catch (error: unknown) {
			// File not found is expected and not an error
			if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
				return null
			}

			console.warn(`[HooksManager] Failed to load hooks config from ${filePath}:`, error)
			return null
		}
	}

	private setupFileWatchers(): void {
		// Watch project-level hooks.json
		const projectPattern = new vscode.RelativePattern(this.cwd, ".roo/hooks.json")
		const projectWatcher = vscode.workspace.createFileSystemWatcher(projectPattern)

		projectWatcher.onDidChange(() => this.loadProjectConfig())
		projectWatcher.onDidCreate(() => this.loadProjectConfig())
		projectWatcher.onDidDelete(() => {
			this.projectConfig = null
		})

		this.disposables.push(projectWatcher)

		// Watch global-level hooks.json
		const globalDir = getGlobalRooDirectory()
		const globalPattern = new vscode.RelativePattern(globalDir, "hooks.json")
		const globalWatcher = vscode.workspace.createFileSystemWatcher(globalPattern)

		globalWatcher.onDidChange(() => this.loadGlobalConfig())
		globalWatcher.onDidCreate(() => this.loadGlobalConfig())
		globalWatcher.onDidDelete(() => {
			this.globalConfig = null
		})

		this.disposables.push(globalWatcher)
	}

	dispose(): void {
		for (const disposable of this.disposables) {
			disposable.dispose()
		}

		this.disposables = []
	}
}
