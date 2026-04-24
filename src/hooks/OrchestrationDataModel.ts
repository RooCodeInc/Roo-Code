import * as fs from "fs/promises"
import * as path from "path"
import * as crypto from "crypto"
import * as yaml from "yaml"

/**
 * Intent specification structure matching the architecture spec
 */
export interface ActiveIntent {
	id: string
	name: string
	status: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED"
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
	created_at?: string
	updated_at?: string
}

export interface ActiveIntentsData {
	active_intents: ActiveIntent[]
}

/**
 * Agent trace entry structure matching the architecture spec
 */
export interface AgentTraceRange {
	start_line: number
	end_line: number
	content_hash: string
}

/**
 * Mutation classification types (Phase 3 requirement)
 */
export type MutationClass = "AST_REFACTOR" | "INTENT_EVOLUTION"

/**
 * Mutation classification result
 */
export interface MutationClassification {
	mutation_class: MutationClass
	confidence: "high" | "medium" | "low"
	reason?: string
}

export interface AgentTraceConversation {
	url: string
	contributor: {
		entity_type: "AI" | "HUMAN"
		model_identifier?: string
	}
	ranges: AgentTraceRange[]
	related: Array<{
		type: "specification" | "intent" | "requirement"
		value: string
	}>
}

export interface AgentTraceFile {
	relative_path: string
	conversations: AgentTraceConversation[]
}

export interface AgentTraceEntry {
	id: string
	timestamp: string
	tool_name?: string // Phase 3: Track which tool made the change
	mutation_class?: MutationClass // Phase 3: AST_REFACTOR or INTENT_EVOLUTION
	vcs: {
		revision_id: string
	}
	files: AgentTraceFile[]
}

/**
 * Orchestration Data Model
 * Manages the .orchestration/ directory and its files
 */
export class OrchestrationDataModel {
	private orchestrationDir: string

	constructor(workspaceRoot: string) {
		this.orchestrationDir = path.join(workspaceRoot, ".orchestration")
	}

	/**
	 * Initialize the .orchestration/ directory structure
	 */
	async initialize(): Promise<void> {
		try {
			await fs.mkdir(this.orchestrationDir, { recursive: true })

			// Initialize active_intents.yaml if it doesn't exist
			const intentsPath = path.join(this.orchestrationDir, "active_intents.yaml")
			try {
				await fs.access(intentsPath)
			} catch {
				// File doesn't exist, create it
				const initialData: ActiveIntentsData = { active_intents: [] }
				await fs.writeFile(intentsPath, yaml.stringify(initialData), "utf-8")
			}

			// Initialize agent_trace.jsonl if it doesn't exist
			const tracePath = path.join(this.orchestrationDir, "agent_trace.jsonl")
			try {
				await fs.access(tracePath)
			} catch {
				// File doesn't exist, create empty file
				await fs.writeFile(tracePath, "", "utf-8")
			}

			// Initialize intent_map.md if it doesn't exist
			const mapPath = path.join(this.orchestrationDir, "intent_map.md")
			try {
				await fs.access(mapPath)
			} catch {
				// File doesn't exist, create it with header
				const header = `# Intent Map

This file maps high-level business intents to physical files and AST nodes.

## Intents

`
				await fs.writeFile(mapPath, header, "utf-8")
			}

			// Initialize AGENT.md if it doesn't exist
			const agentPath = path.join(this.orchestrationDir, "AGENT.md")
			try {
				await fs.access(agentPath)
			} catch {
				// File doesn't exist, create it with header
				const header = `# Shared Knowledge Base

This file contains persistent knowledge shared across parallel sessions (Architect/Builder/Tester).

## Lessons Learned

`
				await fs.writeFile(agentPath, header, "utf-8")
			}

			// Initialize .intentignore if it doesn't exist (Phase 2 requirement)
			const intentIgnorePath = path.join(this.orchestrationDir, ".intentignore")
			try {
				await fs.access(intentIgnorePath)
			} catch {
				// File doesn't exist, create it with header
				const header = `# Intent Ignore File
# List intent IDs that should be protected from modifications
# One intent ID per line
# Lines starting with # are comments
#
# Example:
# INT-005  # Legacy system - deprecated
# INT-010  # Production critical - manual changes only

`
				await fs.writeFile(intentIgnorePath, header, "utf-8")
			}
		} catch (error) {
			console.error("Failed to initialize orchestration directory:", error)
			throw error
		}
	}

	/**
	 * Read active intents from YAML file
	 */
	async readActiveIntents(): Promise<ActiveIntentsData> {
		const intentsPath = path.join(this.orchestrationDir, "active_intents.yaml")
		try {
			const content = await fs.readFile(intentsPath, "utf-8")
			return yaml.parse(content) as ActiveIntentsData
		} catch (error) {
			console.error("Failed to read active_intents.yaml:", error)
			return { active_intents: [] }
		}
	}

	/**
	 * Write active intents to YAML file
	 */
	async writeActiveIntents(data: ActiveIntentsData): Promise<void> {
		const intentsPath = path.join(this.orchestrationDir, "active_intents.yaml")
		await fs.writeFile(intentsPath, yaml.stringify(data), "utf-8")
	}

	/**
	 * Get a specific intent by ID
	 */
	async getIntent(intentId: string): Promise<ActiveIntent | null> {
		const data = await this.readActiveIntents()
		return data.active_intents.find((intent) => intent.id === intentId) || null
	}

	/**
	 * Update an intent (create if doesn't exist)
	 */
	async updateIntent(intent: ActiveIntent): Promise<void> {
		const data = await this.readActiveIntents()
		const index = data.active_intents.findIndex((i) => i.id === intent.id)

		intent.updated_at = new Date().toISOString()
		if (!intent.created_at) {
			intent.created_at = intent.updated_at
		}

		if (index >= 0) {
			data.active_intents[index] = intent
		} else {
			data.active_intents.push(intent)
		}

		await this.writeActiveIntents(data)
	}

	/**
	 * Append a trace entry to agent_trace.jsonl
	 */
	async appendTraceEntry(entry: AgentTraceEntry): Promise<void> {
		const tracePath = path.join(this.orchestrationDir, "agent_trace.jsonl")
		const line = JSON.stringify(entry) + "\n"
		await fs.appendFile(tracePath, line, "utf-8")
	}

	/**
	 * Get recent trace entries for a specific intent ID
	 * Returns the most recent entries (up to limit) that reference this intent
	 * This is used for Phase 1: Context Loader to provide recent history
	 */
	async getTraceEntriesForIntent(intentId: string, limit: number = 10): Promise<AgentTraceEntry[]> {
		const tracePath = path.join(this.orchestrationDir, "agent_trace.jsonl")

		try {
			const content = await fs.readFile(tracePath, "utf-8")
			const lines = content
				.trim()
				.split("\n")
				.filter((line) => line.trim() && !line.startsWith("#"))

			const entries: AgentTraceEntry[] = []

			// Parse each line and filter by intent ID
			for (const line of lines) {
				try {
					const entry = JSON.parse(line) as AgentTraceEntry

					// Check if any file's conversation references this intent
					const referencesIntent = entry.files.some((file) =>
						file.conversations.some((conv) =>
							conv.related.some((rel) => rel.type === "intent" && rel.value === intentId),
						),
					)

					if (referencesIntent) {
						entries.push(entry)
					}
				} catch (error) {
					// Skip invalid JSON lines (comments, etc.)
					continue
				}
			}

			// Sort by timestamp (most recent first) and return up to limit
			entries.sort((a, b) => {
				const timeA = new Date(a.timestamp).getTime()
				const timeB = new Date(b.timestamp).getTime()
				return timeB - timeA // Descending order (newest first)
			})

			return entries.slice(0, limit)
		} catch (error) {
			// File doesn't exist or can't be read - return empty array
			console.error("Failed to read agent_trace.jsonl:", error)
			return []
		}
	}

	/**
	 * Compute SHA-256 hash of content for spatial independence
	 */
	computeContentHash(content: string): string {
		return crypto.createHash("sha256").update(content).digest("hex")
	}

	/**
	 * Classify mutation type: AST_REFACTOR vs INTENT_EVOLUTION (Phase 3 requirement)
	 *
	 * Heuristics:
	 * - AST_REFACTOR: Same semantic meaning, structural changes (renames, formatting, reorganization)
	 * - INTENT_EVOLUTION: New functionality, feature additions, behavior changes
	 *
	 * This is a simplified heuristic - in production, this could use AST diffing or ML models
	 */
	classifyMutation(oldContent: string | null, newContent: string, filePath: string): MutationClassification {
		// If file didn't exist before, it's always INTENT_EVOLUTION
		if (!oldContent || oldContent === "") {
			return {
				mutation_class: "INTENT_EVOLUTION",
				confidence: "high",
				reason: "New file creation",
			}
		}

		// Normalize whitespace for comparison
		const oldNormalized = oldContent.replace(/\s+/g, " ").trim()
		const newNormalized = newContent.replace(/\s+/g, " ").trim()

		// If content is identical (after normalization), it's not a mutation
		if (oldNormalized === newNormalized) {
			return {
				mutation_class: "AST_REFACTOR",
				confidence: "high",
				reason: "No semantic changes detected",
			}
		}

		// Calculate similarity ratio
		const similarity = this.calculateSimilarity(oldNormalized, newNormalized)

		// Heuristic: If >80% similar, likely a refactor
		if (similarity > 0.8) {
			// Check if it's mostly structural changes
			const oldLines = oldContent.split("\n")
			const newLines = newContent.split("\n")
			const lineCountDiff = Math.abs(oldLines.length - newLines.length) / Math.max(oldLines.length, 1)

			// If line count changed significantly, might be evolution
			if (lineCountDiff > 0.3) {
				return {
					mutation_class: "INTENT_EVOLUTION",
					confidence: "medium",
					reason: `Significant line count change (${Math.round(lineCountDiff * 100)}%) despite high similarity`,
				}
			}

			return {
				mutation_class: "AST_REFACTOR",
				confidence: similarity > 0.9 ? "high" : "medium",
				reason: `High similarity (${Math.round(similarity * 100)}%) suggests refactoring`,
			}
		}

		// Check for new function/class definitions (strong indicator of evolution)
		const newFunctionPattern = /(?:function|class|const|let|var)\s+\w+\s*[=:\(]/g
		const oldMatches = (oldContent.match(newFunctionPattern) || []).length
		const newMatches = (newContent.match(newFunctionPattern) || []).length

		if (newMatches > oldMatches) {
			return {
				mutation_class: "INTENT_EVOLUTION",
				confidence: "high",
				reason: `New code definitions detected (${newMatches - oldMatches} new)`,
			}
		}

		// Check for significant content addition
		const contentGrowth = (newContent.length - oldContent.length) / Math.max(oldContent.length, 1)
		if (contentGrowth > 0.5) {
			return {
				mutation_class: "INTENT_EVOLUTION",
				confidence: "medium",
				reason: `Significant content growth (${Math.round(contentGrowth * 100)}%)`,
			}
		}

		// Default: if similarity is low, likely evolution
		return {
			mutation_class: similarity < 0.5 ? "INTENT_EVOLUTION" : "AST_REFACTOR",
			confidence: "low",
			reason: `Similarity: ${Math.round(similarity * 100)}%`,
		}
	}

	/**
	 * Calculate similarity ratio between two strings using Levenshtein distance
	 */
	private calculateSimilarity(str1: string, str2: string): number {
		const maxLen = Math.max(str1.length, str2.length)
		if (maxLen === 0) return 1.0

		const distance = this.levenshteinDistance(str1, str2)
		return 1 - distance / maxLen
	}

	/**
	 * Calculate Levenshtein distance between two strings
	 */
	private levenshteinDistance(str1: string, str2: string): number {
		const m = str1.length
		const n = str2.length
		const dp: number[][] = []

		for (let i = 0; i <= m; i++) {
			dp[i] = [i]
		}
		for (let j = 0; j <= n; j++) {
			dp[0][j] = j
		}

		for (let i = 1; i <= m; i++) {
			for (let j = 1; j <= n; j++) {
				if (str1[i - 1] === str2[j - 1]) {
					dp[i][j] = dp[i - 1][j - 1]
				} else {
					dp[i][j] = Math.min(
						dp[i - 1][j] + 1, // deletion
						dp[i][j - 1] + 1, // insertion
						dp[i - 1][j - 1] + 1, // substitution
					)
				}
			}
		}

		return dp[m][n]
	}

	/**
	 * Append lesson learned to AGENT.md (Phase 4 requirement)
	 */
	async appendLesson(lesson: string, context?: { tool?: string; error?: string; file?: string }): Promise<void> {
		const agentPath = path.join(this.orchestrationDir, "AGENT.md")
		try {
			let content = await fs.readFile(agentPath, "utf-8")

			// Ensure Lessons Learned section exists
			if (!content.includes("## Lessons Learned")) {
				content += "\n\n## Lessons Learned\n\n"
			}

			// Append new lesson with timestamp
			const timestamp = new Date().toISOString()
			const contextInfo = context
				? `\n**Context:** ${context.tool ? `Tool: ${context.tool}` : ""}${context.file ? ` | File: ${context.file}` : ""}${context.error ? ` | Error: ${context.error}` : ""}\n`
				: ""
			const lessonEntry = `### ${timestamp}\n${contextInfo}${lesson}\n\n---\n\n`

			// Find the Lessons Learned section and append
			const lessonsIndex = content.indexOf("## Lessons Learned")
			if (lessonsIndex !== -1) {
				const afterHeader = content.indexOf("\n", lessonsIndex) + 1
				content = content.slice(0, afterHeader) + lessonEntry + content.slice(afterHeader)
			} else {
				content += `\n## Lessons Learned\n\n${lessonEntry}`
			}

			await fs.writeFile(agentPath, content, "utf-8")
		} catch (error) {
			console.error("Failed to append lesson to AGENT.md:", error)
			// Don't throw - lesson recording shouldn't break execution
		}
	}

	/**
	 * Get orchestration directory path
	 */
	getOrchestrationDir(): string {
		return this.orchestrationDir
	}

	/**
	 * Read .intentignore file and return list of ignored intent IDs (Phase 2 requirement)
	 */
	async readIntentIgnore(): Promise<string[]> {
		const intentIgnorePath = path.join(this.orchestrationDir, ".intentignore")
		try {
			const content = await fs.readFile(intentIgnorePath, "utf-8")
			const lines = content.split("\n")
			const ignoredIntents: string[] = []

			for (const line of lines) {
				// Remove comments and trim
				const cleanLine = line.split("#")[0].trim()
				if (cleanLine && !cleanLine.startsWith("#")) {
					ignoredIntents.push(cleanLine)
				}
			}

			return ignoredIntents
		} catch (error) {
			// File doesn't exist or can't be read - return empty array
			return []
		}
	}

	/**
	 * Check if an intent ID is in the ignore list
	 */
	async isIntentIgnored(intentId: string): Promise<boolean> {
		const ignoredIntents = await this.readIntentIgnore()
		return ignoredIntents.includes(intentId)
	}
}
