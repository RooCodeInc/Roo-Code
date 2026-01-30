import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"

import { type HooksFile, type HookConfig, type HookEventType, type HookWithMetadata } from "@roo-code/types"

import { getGlobalRooDirectory, getProjectRooDirectoryForCwd, fileExists } from "../roo-config/index"
import {
	parseHooksFile,
	serializeHooksFile,
	createEmptyHooksFile,
	extractHooksWithMetadata,
	mergeHooks,
	stripHookMetadata,
	updateHookInFile,
	removeHookFromFile,
	reorderHooksInFile,
	moveHookInFile,
	HOOKS_FILE_EXTENSION,
} from "./hooks-file-parser"

/**
 * File locations for hooks configuration:
 * - Global: ~/.roo/hooks/.hooks.yaml
 * - Project: .roo/hooks/.hooks.yaml (within the workspace)
 */
const HOOKS_SUBDIR = "hooks"
const HOOKS_FILENAME = HOOKS_FILE_EXTENSION

/**
 * HooksService - Manages hook configuration files
 *
 * Responsibilities:
 * - Load hooks from global and project locations
 * - Save hooks to the appropriate location
 * - Watch for file changes and notify listeners
 * - Merge global and project hooks with project taking precedence
 */
export class HooksService {
	private globalHooksPath: string
	private projectHooksPath: string | null
	private fileWatchers: vscode.FileSystemWatcher[] = []
	private onHooksChangedEmitter = new vscode.EventEmitter<HookWithMetadata[]>()
	private outputChannel: vscode.OutputChannel | null = null

	/**
	 * Event that fires when hooks are changed (either externally or programmatically)
	 */
	public readonly onHooksChanged: vscode.Event<HookWithMetadata[]> = this.onHooksChangedEmitter.event

	constructor(globalStoragePath: string, workspacePath: string | null) {
		// Global hooks are in ~/.roo/hooks/.hooks.yaml
		this.globalHooksPath = path.join(getGlobalRooDirectory(), HOOKS_SUBDIR, HOOKS_FILENAME)

		// Project hooks are in <workspace>/.roo/hooks/.hooks.yaml
		this.projectHooksPath = workspacePath ? path.join(workspacePath, ".roo", HOOKS_SUBDIR, HOOKS_FILENAME) : null
	}

	/**
	 * Set the output channel for logging
	 */
	public setOutputChannel(outputChannel: vscode.OutputChannel): void {
		this.outputChannel = outputChannel
	}

	/**
	 * Log a message to the output channel
	 */
	private log(message: string): void {
		if (this.outputChannel) {
			this.outputChannel.appendLine(`[HooksService] ${message}`)
		}
	}

	/**
	 * Load hooks from both global and project locations
	 *
	 * @returns Merged array of hooks with project taking precedence
	 */
	public async loadHooks(): Promise<HookWithMetadata[]> {
		this.log("Loading hooks...")

		const globalHooks = await this.loadHooksFromFile(this.globalHooksPath, "global")
		const projectHooks = this.projectHooksPath ? await this.loadHooksFromFile(this.projectHooksPath, "project") : []

		const merged = mergeHooks(globalHooks, projectHooks)
		this.log(
			`Loaded ${globalHooks.length} global hooks, ${projectHooks.length} project hooks, ${merged.length} total`,
		)

		return merged
	}

	/**
	 * Load hooks from a specific file
	 */
	private async loadHooksFromFile(filePath: string, source: "global" | "project"): Promise<HookWithMetadata[]> {
		try {
			const exists = await fileExists(filePath)
			if (!exists) {
				this.log(`Hooks file not found: ${filePath}`)
				return []
			}

			const content = await fs.readFile(filePath, "utf-8")
			const hooksFile = parseHooksFile(content)
			return extractHooksWithMetadata(hooksFile, source, filePath)
		} catch (error) {
			this.log(`Error loading hooks from ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
			return []
		}
	}

	/**
	 * Save a hook to the appropriate file
	 *
	 * @param hook - The hook configuration to save
	 * @param eventType - The event type for the hook
	 * @param source - Whether to save to 'global' or 'project' location
	 */
	public async saveHook(hook: HookConfig, eventType: HookEventType, source: "global" | "project"): Promise<void> {
		const filePath = source === "global" ? this.globalHooksPath : this.projectHooksPath

		if (!filePath) {
			throw new Error("Cannot save to project hooks: no workspace is open")
		}

		this.log(`Saving hook ${hook.id} to ${source} (${eventType})`)

		// Ensure the hooks directory exists
		await this.ensureHooksFileExists(source)

		// Load existing file or create empty
		const hooksFile = await this.loadHooksFile(filePath)

		// Update the file with the new hook
		const updatedFile = updateHookInFile(hooksFile, hook, eventType)

		// Write the file
		await this.writeHooksFile(filePath, updatedFile)

		this.log(`Hook ${hook.id} saved successfully`)
	}

	/**
	 * Delete a hook from the specified location
	 *
	 * @param hookId - The ID of the hook to delete
	 * @param eventType - The event type of the hook
	 * @param source - Whether to delete from 'global' or 'project' location
	 */
	public async deleteHook(hookId: string, eventType: HookEventType, source: "global" | "project"): Promise<void> {
		const filePath = source === "global" ? this.globalHooksPath : this.projectHooksPath

		if (!filePath) {
			throw new Error("Cannot delete from project hooks: no workspace is open")
		}

		this.log(`Deleting hook ${hookId} from ${source} (${eventType})`)

		// Load existing file
		const hooksFile = await this.loadHooksFile(filePath)

		// Remove the hook
		const updatedFile = removeHookFromFile(hooksFile, hookId, eventType)

		// Write the file
		await this.writeHooksFile(filePath, updatedFile)

		this.log(`Hook ${hookId} deleted successfully`)
	}

	/**
	 * Reorder hooks within an event type
	 *
	 * @param eventType - The event type to reorder hooks in
	 * @param hookIds - Array of hook IDs in the new order
	 * @param source - Whether to reorder in 'global' or 'project' location
	 */
	public async reorderHooks(
		eventType: HookEventType,
		hookIds: string[],
		source: "global" | "project",
	): Promise<void> {
		const filePath = source === "global" ? this.globalHooksPath : this.projectHooksPath

		if (!filePath) {
			throw new Error("Cannot reorder project hooks: no workspace is open")
		}

		this.log(`Reordering hooks in ${source} (${eventType})`)

		// Load existing file
		const hooksFile = await this.loadHooksFile(filePath)

		// Reorder the hooks
		const updatedFile = reorderHooksInFile(hooksFile, eventType, hookIds)

		// Write the file
		await this.writeHooksFile(filePath, updatedFile)

		this.log(`Hooks reordered successfully`)
	}

	/**
	 * Move a hook from one event type to another (atomic operation)
	 *
	 * This is an atomic operation that removes the hook from the source event type
	 * and adds it to the target event type in a single file write, preventing
	 * race conditions that could occur with separate delete + save operations.
	 *
	 * @param hook - The hook configuration to move
	 * @param fromEventType - The source event type
	 * @param toEventType - The target event type
	 * @param source - Whether to modify 'global' or 'project' location
	 */
	public async moveHook(
		hook: HookConfig,
		fromEventType: HookEventType,
		toEventType: HookEventType,
		source: "global" | "project",
	): Promise<void> {
		const filePath = source === "global" ? this.globalHooksPath : this.projectHooksPath

		if (!filePath) {
			throw new Error("Cannot move hook in project hooks: no workspace is open")
		}

		this.log(`Moving hook ${hook.id} from ${fromEventType} to ${toEventType} in ${source}`)

		// Load existing file
		const hooksFile = await this.loadHooksFile(filePath)

		// Move the hook atomically
		const updatedFile = moveHookInFile(hooksFile, hook, fromEventType, toEventType)

		// Write the file
		await this.writeHooksFile(filePath, updatedFile)

		this.log(`Hook ${hook.id} moved successfully`)
	}

	/**
	 * Load a hooks file from disk
	 */
	private async loadHooksFile(filePath: string): Promise<HooksFile> {
		try {
			const exists = await fileExists(filePath)
			if (!exists) {
				return createEmptyHooksFile()
			}

			const content = await fs.readFile(filePath, "utf-8")
			return parseHooksFile(content)
		} catch (error) {
			this.log(`Error loading hooks file ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
			return createEmptyHooksFile()
		}
	}

	/**
	 * Write a hooks file to disk as YAML
	 */
	private async writeHooksFile(filePath: string, hooksFile: HooksFile): Promise<void> {
		const content = serializeHooksFile(hooksFile)
		// Ensure the directory exists
		const dir = path.dirname(filePath)
		await fs.mkdir(dir, { recursive: true })
		// Write YAML content directly
		await fs.writeFile(filePath, content, "utf-8")
	}

	/**
	 * Ensure the hooks file and directory exist
	 *
	 * @param source - Whether to ensure 'global' or 'project' hooks file
	 */
	public async ensureHooksFileExists(source: "global" | "project"): Promise<void> {
		const filePath = source === "global" ? this.globalHooksPath : this.projectHooksPath

		if (!filePath) {
			throw new Error("Cannot ensure project hooks file: no workspace is open")
		}

		const exists = await fileExists(filePath)
		if (!exists) {
			this.log(`Creating hooks file: ${filePath}`)
			const emptyFile = createEmptyHooksFile()
			const content = serializeHooksFile(emptyFile)
			// Ensure directory exists and write YAML content
			const dir = path.dirname(filePath)
			await fs.mkdir(dir, { recursive: true })
			await fs.writeFile(filePath, content, "utf-8")
		}
	}

	/**
	 * Get the path to a hooks file
	 *
	 * @param source - Whether to get 'global' or 'project' path
	 * @returns The file path
	 */
	public getHooksFilePath(source: "global" | "project"): string | null {
		return source === "global" ? this.globalHooksPath : this.projectHooksPath
	}

	/**
	 * Get the path to a hooks folder
	 *
	 * @param source - Whether to get 'global' or 'project' path
	 * @returns The folder path
	 */
	public getHooksFolderPath(source: "global" | "project"): string | null {
		const filePath = this.getHooksFilePath(source)
		return filePath ? path.dirname(filePath) : null
	}

	/**
	 * Open the hooks folder in the file explorer
	 *
	 * @param source - Whether to open 'global' or 'project' folder
	 */
	public async openHooksFolder(source: "global" | "project"): Promise<void> {
		const folderPath = this.getHooksFolderPath(source)

		if (!folderPath) {
			throw new Error(`Cannot open ${source} hooks folder: no workspace is open`)
		}

		// Ensure the directory exists
		await this.ensureHooksFileExists(source)

		// Open in VS Code file explorer
		const uri = vscode.Uri.file(folderPath)
		await vscode.commands.executeCommand("revealFileInOS", uri)
	}

	/**
	 * Start watching hooks files for external changes
	 */
	public startWatching(): void {
		this.stopWatching() // Clear any existing watchers

		const watchPaths = [this.globalHooksPath, this.projectHooksPath].filter(Boolean) as string[]

		for (const watchPath of watchPaths) {
			const pattern = new vscode.RelativePattern(path.dirname(watchPath), path.basename(watchPath))
			const watcher = vscode.workspace.createFileSystemWatcher(pattern)

			watcher.onDidChange(async () => {
				this.log(`Hooks file changed: ${watchPath}`)
				await this.notifyHooksChanged()
			})

			watcher.onDidCreate(async () => {
				this.log(`Hooks file created: ${watchPath}`)
				await this.notifyHooksChanged()
			})

			watcher.onDidDelete(async () => {
				this.log(`Hooks file deleted: ${watchPath}`)
				await this.notifyHooksChanged()
			})

			this.fileWatchers.push(watcher)
		}

		this.log(`Started watching ${watchPaths.length} hooks files`)
	}

	/**
	 * Stop watching hooks files
	 */
	public stopWatching(): void {
		for (const watcher of this.fileWatchers) {
			watcher.dispose()
		}
		this.fileWatchers = []
	}

	/**
	 * Notify listeners that hooks have changed
	 */
	private async notifyHooksChanged(): Promise<void> {
		try {
			const hooks = await this.loadHooks()
			this.onHooksChangedEmitter.fire(hooks)
		} catch (error) {
			this.log(`Error reloading hooks after change: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		this.stopWatching()
		this.onHooksChangedEmitter.dispose()
	}
}
