import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { getWorkspacePath } from "../utils/path"

/**
 * OrchestrationStorage handles file I/O operations for the .orchestration/ directory.
 * This directory stores machine-managed data models including:
 * - active_intents.yaml: Intent specifications
 * - agent_trace.jsonl: Append-only action log
 * - intent_map.md: Spatial map of intents
 * - AGENT.md: Shared brain (lessons learned, future enhancement)
 */
export class OrchestrationStorage {
	private orchestrationDir: string | null = null

	/**
	 * Gets the path to the .orchestration directory.
	 * @param workspaceRoot Optional workspace root; when provided, returns that workspace's .orchestration path without caching
	 * @returns The absolute path to the .orchestration directory
	 */
	async getOrchestrationDirectory(workspaceRoot?: string): Promise<string> {
		if (workspaceRoot) {
			return path.join(workspaceRoot, ".orchestration")
		}
		if (this.orchestrationDir) {
			return this.orchestrationDir
		}

		const root = getWorkspacePath()
		if (!root) {
			throw new Error("No workspace root found. Please open a workspace folder.")
		}

		this.orchestrationDir = path.join(root, ".orchestration")
		return this.orchestrationDir
	}

	/**
	 * Ensures the .orchestration directory exists, creating it if necessary.
	 */
	async ensureOrchestrationDirectory(): Promise<void> {
		const dir = await this.getOrchestrationDirectory()
		const uri = vscode.Uri.file(dir)

		try {
			await vscode.workspace.fs.stat(uri)
			// Directory exists, no need to create
		} catch (error) {
			// Directory does not exist, create it
			await vscode.workspace.fs.createDirectory(uri)
		}
	}

	/**
	 * Reads a file from the .orchestration directory.
	 * @param filePath Relative path from .orchestration directory (e.g., "active_intents.yaml")
	 * @param workspaceRoot Optional workspace root; when provided, read from that workspace's .orchestration (used for task-scoped intent loading)
	 * @returns The file content as a string
	 */
	async readFile(filePath: string, workspaceRoot?: string): Promise<string> {
		const dir = await this.getOrchestrationDirectory(workspaceRoot)
		if (workspaceRoot) {
			await this.ensureOrchestrationDirectoryForPath(dir)
		} else {
			await this.ensureOrchestrationDirectory()
		}
		const fullPath = path.join(dir, filePath)
		const uri = vscode.Uri.file(fullPath)

		const data = await vscode.workspace.fs.readFile(uri)
		return Buffer.from(data).toString("utf-8")
	}

	/**
	 * Writes a file to the .orchestration directory.
	 * @param filePath Relative path from .orchestration directory (e.g., "active_intents.yaml")
	 * @param content The content to write
	 * @param workspaceRoot Optional workspace root; when provided, write to that workspace's .orchestration
	 */
	async writeFile(filePath: string, content: string, workspaceRoot?: string): Promise<void> {
		const dir = await this.getOrchestrationDirectory(workspaceRoot)
		if (workspaceRoot) {
			await this.ensureOrchestrationDirectoryForPath(dir)
		} else {
			await this.ensureOrchestrationDirectory()
		}
		const fullPath = path.join(dir, filePath)
		const uri = vscode.Uri.file(fullPath)

		await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"))
	}

	/**
	 * Appends content to a file in the .orchestration directory.
	 * Used for append-only logs like agent_trace.jsonl.
	 * @param filePath Relative path from .orchestration directory (e.g., "agent_trace.jsonl")
	 * @param content The content to append
	 * @param workspaceRoot Optional workspace root; when provided, use this instead of getOrchestrationDirectory() so trace is written to the task's workspace
	 */
	async appendFile(filePath: string, content: string, workspaceRoot?: string): Promise<void> {
		const dir = workspaceRoot
			? path.join(workspaceRoot, ".orchestration")
			: await this.getOrchestrationDirectory()
		if (workspaceRoot) {
			await this.ensureOrchestrationDirectoryForPath(dir)
		} else {
			await this.ensureOrchestrationDirectory()
		}
		const fullPath = path.join(dir, filePath)
		await fs.appendFile(fullPath, content, "utf-8")
	}

	/**
	 * Ensures a specific .orchestration directory exists (for workspace-scoped append).
	 */
	private async ensureOrchestrationDirectoryForPath(dir: string): Promise<void> {
		const uri = vscode.Uri.file(dir)
		try {
			await vscode.workspace.fs.stat(uri)
		} catch {
			await vscode.workspace.fs.createDirectory(uri)
		}
	}

	/**
	 * Checks if a file exists in the .orchestration directory.
	 * @param filePath Relative path from .orchestration directory
	 * @param workspaceRoot Optional workspace root; when provided, check in that workspace's .orchestration
	 * @returns true if the file exists, false otherwise
	 */
	async fileExists(filePath: string, workspaceRoot?: string): Promise<boolean> {
		try {
			const dir = await this.getOrchestrationDirectory(workspaceRoot)
			const fullPath = path.join(dir, filePath)
			const uri = vscode.Uri.file(fullPath)

			await vscode.workspace.fs.stat(uri)
			return true
		} catch {
			return false
		}
	}
}
