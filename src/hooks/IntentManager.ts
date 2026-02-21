import * as yaml from "yaml"
import { OrchestrationStorage } from "./OrchestrationStorage"
import type { ActiveIntent, ActiveIntentsYaml, IntentStatus } from "./types"

/**
 * IntentManager manages active intents loaded from active_intents.yaml.
 * It handles loading, querying, and managing the active intent per task.
 */
export class IntentManager {
	private storage: OrchestrationStorage
	/** Cache per workspace root so intent lookup uses the task's .orchestration/active_intents.yaml */
	private intentsCacheByWorkspace: Map<string, ActiveIntent[]> = new Map()
	private activeIntentsByTask: Map<string, string> = new Map() // taskId -> intentId

	constructor(storage: OrchestrationStorage) {
		this.storage = storage
	}

	/**
	 * Loads all intents from active_intents.yaml for the given workspace.
	 * When workspaceRoot is provided, reads from workspaceRoot/.orchestration/ so the task's project is used.
	 * @param workspaceRoot Optional workspace root (e.g. task.workspacePath); when omitted, uses default getWorkspacePath()
	 * @returns Array of all intents
	 */
	async loadIntents(workspaceRoot?: string): Promise<ActiveIntent[]> {
		const cacheKey = workspaceRoot ?? ""
		const cached = this.intentsCacheByWorkspace.get(cacheKey)
		if (cached !== undefined) {
			return cached
		}

		const exists = await this.storage.fileExists("active_intents.yaml", workspaceRoot)
		if (!exists) {
			await this.initializeIntentsFile(workspaceRoot)
			this.intentsCacheByWorkspace.set(cacheKey, [])
			return []
		}

		try {
			const content = await this.storage.readFile("active_intents.yaml", workspaceRoot)
			const parsed = yaml.parse(content) as ActiveIntentsYaml

			if (!parsed || !Array.isArray(parsed.intents)) {
				this.intentsCacheByWorkspace.set(cacheKey, [])
				return []
			}

			const intents = parsed.intents.map((intent) => ({
				id: intent.id,
				name: intent.name || "",
				description: intent.description || "",
				status: (intent.status || "PENDING") as IntentStatus,
				ownedScope: Array.isArray(intent.ownedScope) ? intent.ownedScope : [],
				constraints: Array.isArray(intent.constraints) ? intent.constraints : [],
				acceptanceCriteria: Array.isArray(intent.acceptanceCriteria) ? intent.acceptanceCriteria : [],
				metadata: intent.metadata || {},
			}))
			this.intentsCacheByWorkspace.set(cacheKey, intents)
			return intents
		} catch (error) {
			throw new Error(
				`Failed to parse active_intents.yaml: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * Gets an intent by ID from the given workspace's active_intents.yaml.
	 * @param intentId The intent ID to look up
	 * @param workspaceRoot Optional workspace root (e.g. task.workspacePath); when provided, intents are loaded from that workspace's .orchestration/
	 * @returns The intent if found, null otherwise
	 */
	async getIntent(intentId: string, workspaceRoot?: string): Promise<ActiveIntent | null> {
		const intents = await this.loadIntents(workspaceRoot)
		return intents.find((intent) => intent.id === intentId) || null
	}

	/**
	 * Sets the active intent for a task.
	 * Only one intent can be active per task at a time.
	 * @param taskId The task ID
	 * @param intentId The intent ID to activate
	 */
	async setActiveIntent(taskId: string, intentId: string, workspaceRoot?: string): Promise<void> {
		const intent = await this.getIntent(intentId, workspaceRoot)
		if (!intent) {
			throw new Error(`Intent ${intentId} not found`)
		}

		this.activeIntentsByTask.set(taskId, intentId)
	}

	/**
	 * Gets the active intent for a task.
	 * @param taskId The task ID
	 * @returns The active intent if one is set, null otherwise
	 */
	async getActiveIntent(taskId: string): Promise<ActiveIntent | null> {
		const intentId = this.activeIntentsByTask.get(taskId)
		if (!intentId) {
			return null
		}

		return await this.getIntent(intentId)
	}

	/**
	 * Clears the active intent for a task.
	 * @param taskId The task ID
	 */
	async clearActiveIntent(taskId: string): Promise<void> {
		this.activeIntentsByTask.delete(taskId)
	}

	/**
	 * Invalidates the intents cache for a workspace (or all if no key given), forcing a reload on next access.
	 * Useful when active_intents.yaml is modified externally.
	 */
	invalidateCache(workspaceRoot?: string): void {
		if (workspaceRoot !== undefined) {
			this.intentsCacheByWorkspace.delete(workspaceRoot)
		} else {
			this.intentsCacheByWorkspace.clear()
		}
	}

	/**
	 * Formats intent context for injection into system prompt.
	 * @param intent The intent to format
	 * @returns XML-formatted intent context string
	 */
	formatIntentContext(intent: ActiveIntent): string {
		const scopePatterns = intent.ownedScope.join(", ")
		const constraints = intent.constraints.length > 0 ? intent.constraints.join("\n  - ") : "None"

		return `<intent_context>
<intent_id>${intent.id}</intent_id>
<name>${intent.name}</name>
<description>${intent.description}</description>
<owned_scope>${scopePatterns}</owned_scope>
<constraints>
  - ${constraints}
</constraints>
<acceptance_criteria>
${intent.acceptanceCriteria.map((criteria) => `  - ${criteria}`).join("\n")}
</acceptance_criteria>
</intent_context>`
	}

	/**
	 * Initializes the active_intents.yaml file with an empty structure if it doesn't exist.
	 */
	private async initializeIntentsFile(workspaceRoot?: string): Promise<void> {
		const defaultContent = `# Active Intents Configuration
# This file defines the available intents for this workspace.
# Each intent specifies what files/areas can be modified and what constraints apply.

intents: []
`
		try {
			await this.storage.writeFile("active_intents.yaml", defaultContent, workspaceRoot)
		} catch (error) {
			console.warn("[IntentManager] Failed to initialize active_intents.yaml:", error)
		}
	}
}
