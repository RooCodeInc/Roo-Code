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
	 * Gets the path to the .orchestration directory at the workspace root.
	 * @returns The absolute path to the .orchestration directory
	 */
	async getOrchestrationDirectory(): Promise<string> {
		if (this.orchestrationDir) {
			return this.orchestrationDir
		}

		const workspaceRoot = getWorkspacePath()
		if (!workspaceRoot) {
			throw new Error("No workspace root found. Please open a workspace folder.")
		}

		this.orchestrationDir = path.join(workspaceRoot, ".orchestration")
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
	 * @returns The file content as a string
	 */
	async readFile(filePath: string): Promise<string> {
		await this.ensureOrchestrationDirectory()
		const dir = await this.getOrchestrationDirectory()
		const fullPath = path.join(dir, filePath)
		const uri = vscode.Uri.file(fullPath)

		const data = await vscode.workspace.fs.readFile(uri)
		return Buffer.from(data).toString("utf-8")
	}

	/**
	 * Writes a file to the .orchestration directory.
	 * @param filePath Relative path from .orchestration directory (e.g., "active_intents.yaml")
	 * @param content The content to write
	 */
	async writeFile(filePath: string, content: string): Promise<void> {
		await this.ensureOrchestrationDirectory()
		const dir = await this.getOrchestrationDirectory()
		const fullPath = path.join(dir, filePath)
		const uri = vscode.Uri.file(fullPath)

		await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"))
	}

	/**
	 * Appends content to a file in the .orchestration directory.
	 * Used for append-only logs like agent_trace.jsonl.
	 * @param filePath Relative path from .orchestration directory (e.g., "agent_trace.jsonl")
	 * @param content The content to append
	 */
	async appendFile(filePath: string, content: string): Promise<void> {
		await this.ensureOrchestrationDirectory()
		const dir = await this.getOrchestrationDirectory()
		const fullPath = path.join(dir, filePath)

		// Use Node.js fs.appendFile since VS Code workspace.fs doesn't have appendFile
		await fs.appendFile(fullPath, content, "utf-8")
	}

	/**
	 * Checks if a file exists in the .orchestration directory.
	 * @param filePath Relative path from .orchestration directory
	 * @returns true if the file exists, false otherwise
	 */
	async fileExists(filePath: string): Promise<boolean> {
		try {
			const dir = await this.getOrchestrationDirectory()
			const fullPath = path.join(dir, filePath)
			const uri = vscode.Uri.file(fullPath)

			await vscode.workspace.fs.stat(uri)
			return true
		} catch {
			return false
		}
	}
}
