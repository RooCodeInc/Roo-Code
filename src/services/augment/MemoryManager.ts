/**
 * MemoryManager — Augment-style persistent cross-session memory engine.
 *
 * Stores summaries of files edited, decisions made, and patterns discovered
 * so Joe AI can recall context across sessions — just like Augment Code does.
 *
 * Storage: VSCode globalState (per-user, cross-workspace) +
 *          workspace-local JSON for file-level memory.
 */

import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"

export interface FileMemory {
	filePath: string
	summary: string
	lastEditedAt: number
	editCount: number
	keyPatterns: string[]
	language: string
}

export interface SessionMemory {
	sessionId: string
	startedAt: number
	endedAt?: number
	taskSummary: string
	filesChanged: string[]
	decisions: string[]
	mode: string
}

export interface WorkspaceMemory {
	workspacePath: string
	projectSummary: string
	techStack: string[]
	keyConventions: string[]
	frequentlyEditedFiles: string[]
	sessions: SessionMemory[]
	fileMemories: Record<string, FileMemory>
	lastUpdatedAt: number
}

const MEMORY_FILE_NAME = ".joe-memory.json"
const MAX_SESSIONS_STORED = 20
const MAX_FILE_MEMORIES = 200

export class MemoryManager {
	private static instances = new Map<string, MemoryManager>()
	private memory: WorkspaceMemory
	private memoryFilePath: string
	private saveDebounceTimer: NodeJS.Timeout | undefined
	private currentSessionId: string
	private context: vscode.ExtensionContext

	static getInstance(context: vscode.ExtensionContext, workspacePath: string): MemoryManager {
		if (!this.instances.has(workspacePath)) {
			this.instances.set(workspacePath, new MemoryManager(context, workspacePath))
		}
		return this.instances.get(workspacePath)!
	}

	static disposeAll(): void {
		for (const instance of this.instances.values()) {
			instance.dispose()
		}
		this.instances.clear()
	}

	private constructor(context: vscode.ExtensionContext, workspacePath: string) {
		this.context = context
		this.memoryFilePath = path.join(workspacePath, MEMORY_FILE_NAME)
		this.currentSessionId = `session-${Date.now()}`
		this.memory = this.emptyMemory(workspacePath)
	}

	// --- Public API ---

	async initialize(): Promise<void> {
		await this.loadFromDisk()
		this.startSession()
	}

	/**
	 * Record that a file was edited. Call this whenever a tool writes/edits a file.
	 */
	recordFileEdit(filePath: string, language: string, summary: string, patterns: string[] = []): void {
		const existing = this.memory.fileMemories[filePath]
		this.memory.fileMemories[filePath] = {
			filePath,
			summary,
			lastEditedAt: Date.now(),
			editCount: (existing?.editCount ?? 0) + 1,
			keyPatterns: patterns.length > 0 ? patterns : (existing?.keyPatterns ?? []),
			language,
		}

		// Track in current session
		const session = this.currentSession
		if (session && !session.filesChanged.includes(filePath)) {
			session.filesChanged.push(filePath)
		}

		// Update frequently edited files
		this.updateFrequentFiles()
		this.scheduleSave()
	}

	/**
	 * Record a decision or convention discovered during the session.
	 */
	recordDecision(decision: string): void {
		const session = this.currentSession
		if (session) {
			session.decisions.push(decision)
		}
		// Add to workspace-level conventions if it looks like a convention
		if (decision.toLowerCase().includes("convention") || decision.toLowerCase().includes("pattern")) {
			if (!this.memory.keyConventions.includes(decision)) {
				this.memory.keyConventions.push(decision)
				// Keep only the most recent 10 conventions
				if (this.memory.keyConventions.length > 10) {
					this.memory.keyConventions = this.memory.keyConventions.slice(-10)
				}
			}
		}
		this.scheduleSave()
	}

	/**
	 * Update the project-level summary (call this periodically or at session end).
	 */
	updateProjectSummary(summary: string, techStack?: string[]): void {
		this.memory.projectSummary = summary
		if (techStack) {
			this.memory.techStack = techStack
		}
		this.scheduleSave()
	}

	/**
	 * End current session with a summary of what was accomplished.
	 */
	endSession(taskSummary: string): void {
		const session = this.currentSession
		if (session) {
			session.endedAt = Date.now()
			session.taskSummary = taskSummary
		}
		this.scheduleSave()
	}

	/**
	 * Build a rich memory context string to inject into prompts.
	 * This is what makes Joe AI "remember" like Augment Code.
	 */
	buildMemoryContext(relevantFiles?: string[]): string {
		const parts: string[] = []

		// Project summary
		if (this.memory.projectSummary) {
			parts.push(`## Project Memory\n${this.memory.projectSummary}`)
		}

		// Tech stack
		if (this.memory.techStack.length > 0) {
			parts.push(`## Tech Stack\n${this.memory.techStack.join(", ")}`)
		}

		// Key conventions
		if (this.memory.keyConventions.length > 0) {
			parts.push(`## Codebase Conventions\n${this.memory.keyConventions.map((c) => `- ${c}`).join("\n")}`)
		}

		// Recent sessions (last 3)
		const recentSessions = this.memory.sessions
			.filter((s) => s.endedAt && s.taskSummary)
			.slice(-3)
		if (recentSessions.length > 0) {
			const sessionLines = recentSessions.map((s) => {
				const date = new Date(s.startedAt).toLocaleDateString()
				return `- [${date}] ${s.taskSummary} (files: ${s.filesChanged.slice(0, 3).join(", ")}${s.filesChanged.length > 3 ? "..." : ""})`
			})
			parts.push(`## Recent Work Sessions\n${sessionLines.join("\n")}`)
		}

		// Relevant file memories
		const filesToInclude = relevantFiles ?? this.memory.frequentlyEditedFiles.slice(0, 5)
		const fileMemoryLines: string[] = []
		for (const fp of filesToInclude) {
			const fm = this.memory.fileMemories[fp]
			if (fm?.summary) {
				fileMemoryLines.push(`- \`${path.basename(fp)}\`: ${fm.summary}`)
			}
		}
		if (fileMemoryLines.length > 0) {
			parts.push(`## Key File Context\n${fileMemoryLines.join("\n")}`)
		}

		if (parts.length === 0) {
			return ""
		}

		return `\n\n---\n### Joe AI Memory (Cross-Session Context)\n${parts.join("\n\n")}\n---\n`
	}

	/**
	 * Get file memory for a specific file.
	 */
	getFileMemory(filePath: string): FileMemory | undefined {
		return this.memory.fileMemories[filePath]
	}

	/**
	 * Get list of most frequently edited files.
	 */
	getFrequentlyEditedFiles(limit = 10): string[] {
		return this.memory.frequentlyEditedFiles.slice(0, limit)
	}

	/**
	 * Get recent decisions.
	 */
	getRecentDecisions(limit = 5): string[] {
		const allDecisions: string[] = []
		for (const session of this.memory.sessions.slice(-5)) {
			allDecisions.push(...session.decisions)
		}
		return allDecisions.slice(-limit)
	}

	dispose(): void {
		if (this.saveDebounceTimer) {
			clearTimeout(this.saveDebounceTimer)
		}
		// Synchronously save on dispose
		this.saveToDisk().catch(console.error)
	}

	// --- Private Helpers ---

	private get currentSession(): SessionMemory | undefined {
		return this.memory.sessions.find((s) => s.sessionId === this.currentSessionId)
	}

	private startSession(): void {
		const session: SessionMemory = {
			sessionId: this.currentSessionId,
			startedAt: Date.now(),
			taskSummary: "",
			filesChanged: [],
			decisions: [],
			mode: "code",
		}
		this.memory.sessions.push(session)

		// Prune old sessions
		if (this.memory.sessions.length > MAX_SESSIONS_STORED) {
			this.memory.sessions = this.memory.sessions.slice(-MAX_SESSIONS_STORED)
		}
	}

	private updateFrequentFiles(): void {
		// Count edit frequencies
		const counts = Object.entries(this.memory.fileMemories)
			.sort(([, a], [, b]) => b.editCount - a.editCount)
			.map(([fp]) => fp)
		this.memory.frequentlyEditedFiles = counts.slice(0, 20)

		// Prune old file memories if over limit
		if (Object.keys(this.memory.fileMemories).length > MAX_FILE_MEMORIES) {
			const toKeep = new Set(counts.slice(0, MAX_FILE_MEMORIES))
			for (const key of Object.keys(this.memory.fileMemories)) {
				if (!toKeep.has(key)) {
					delete this.memory.fileMemories[key]
				}
			}
		}
	}

	private scheduleSave(): void {
		if (this.saveDebounceTimer) {
			clearTimeout(this.saveDebounceTimer)
		}
		this.saveDebounceTimer = setTimeout(() => {
			this.saveToDisk().catch(console.error)
		}, 2000)
	}

	private async loadFromDisk(): Promise<void> {
		try {
			const raw = await fs.readFile(this.memoryFilePath, "utf-8")
			const parsed = JSON.parse(raw) as WorkspaceMemory
			this.memory = { ...this.emptyMemory(this.memory.workspacePath), ...parsed }
		} catch {
			// File doesn't exist yet — start fresh
			this.memory = this.emptyMemory(this.memory.workspacePath)
		}
	}

	private async saveToDisk(): Promise<void> {
		try {
			this.memory.lastUpdatedAt = Date.now()
			await fs.writeFile(this.memoryFilePath, JSON.stringify(this.memory, null, 2), "utf-8")
		} catch (err) {
			console.error("[MemoryManager] Failed to save memory to disk:", err)
		}
	}

	private emptyMemory(workspacePath: string): WorkspaceMemory {
		return {
			workspacePath,
			projectSummary: "",
			techStack: [],
			keyConventions: [],
			frequentlyEditedFiles: [],
			sessions: [],
			fileMemories: {},
			lastUpdatedAt: Date.now(),
		}
	}
}
