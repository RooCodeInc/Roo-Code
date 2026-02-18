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
			const lines = content.trim().split("\n").filter((line) => line.trim() && !line.startsWith("#"))

			const entries: AgentTraceEntry[] = []

			// Parse each line and filter by intent ID
			for (const line of lines) {
				try {
					const entry = JSON.parse(line) as AgentTraceEntry

					// Check if any file's conversation references this intent
					const referencesIntent = entry.files.some((file) =>
						file.conversations.some((conv) =>
							conv.related.some(
								(rel) => rel.type === "intent" && rel.value === intentId,
							),
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
	 * Get orchestration directory path
	 */
	getOrchestrationDir(): string {
		return this.orchestrationDir
	}
}
