/**
 * Intent Context Loader - Reads and parses active_intents.yaml
 * Loads intent metadata and constructs context for LLM injection
 */

import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"
import { ActiveIntent, IntentMetadata } from "./types"

export class IntentContextLoader {
	private workspaceRoot: string
	private orchestrationDir: string

	constructor(workspaceRoot: string) {
		this.workspaceRoot = workspaceRoot
		this.orchestrationDir = path.join(workspaceRoot, ".orchestration")
	}

	/**
	 * Load all active intents from YAML file
	 * @returns Array of intent metadata
	 */
	async loadActiveIntents(): Promise<IntentMetadata[]> {
		try {
			const yamlPath = path.join(this.orchestrationDir, "active_intents.yaml")
			try {
				const content = await fs.readFile(yamlPath, "utf8")
				const data = yaml.parse(content) as ActiveIntent

				if (!data || !data.active_intents) {
					console.warn(`[IntentContextLoader] Malformed YAML at ${yamlPath}: missing active_intents key`)
					return []
				}
				return data.active_intents
			} catch (readError: any) {
				if (readError.code === "ENOENT") {
					// Expected if setup isn't done yet, but good to know WHERE it looked
					console.info(`[IntentContextLoader] No intents file found at ${yamlPath}`)
					return []
				}
				throw readError
			}
		} catch (error) {
			console.error(`[IntentContextLoader] Failed to load intents:`, error)
			throw error
		}
	}

	/**
	 * Load a specific intent by ID
	 * @param intentId The intent ID to load
	 * @returns Intent metadata or undefined if not found
	 */
	async loadIntent(intentId: string): Promise<IntentMetadata | undefined> {
		const intents = await this.loadActiveIntents()
		return intents.find((intent) => intent.id === intentId)
	}

	/**
	 * Construct XML context block for LLM injection
	 * @param intent The intent to create context for
	 * @returns XML string with intent context
	 */
	constructIntentContext(intent: IntentMetadata): string {
		const constraintsList = intent.constraints.map((c) => `  - ${c}`).join("\n")
		const scopeList = intent.owned_scope.map((s) => `  - ${s}`).join("\n")
		const criteriaList = intent.acceptance_criteria.map((c) => `  - ${c}`).join("\n")

		return `<intent_context>
<intent_id>${intent.id}</intent_id>
<intent_name>${intent.name}</intent_name>
<status>${intent.status}</status>

<architectural_constraints>
${constraintsList}
</architectural_constraints>

<owned_scope>
${scopeList}
</owned_scope>

<acceptance_criteria>
${criteriaList}
</acceptance_criteria>

<governance_rules>
- You MUST only modify files within the owned_scope
- All changes MUST respect the architectural_constraints
- Your work is complete when all acceptance_criteria are met
- If you need to edit files outside owned_scope, you MUST request scope expansion
</governance_rules>
</intent_context>`
	}

	/**
	 * Update intent status
	 * @param intentId The intent ID to update
	 * @param status New status
	 */
	async updateIntentStatus(intentId: string, status: "PENDING" | "IN_PROGRESS" | "DONE" | "BLOCKED"): Promise<void> {
		const intents = await this.loadActiveIntents()
		const intent = intents.find((i) => i.id === intentId)

		if (intent) {
			intent.status = status

			const yamlPath = path.join(this.orchestrationDir, "active_intents.yaml")
			const data: ActiveIntent = { active_intents: intents }
			await fs.writeFile(yamlPath, yaml.stringify(data), "utf8")
		}
	}

	/**
	 * Update intent's last trace reference
	 * @param intentId The intent ID to update
	 * @param traceId The trace record ID
	 */
	async updateLastTraceRef(intentId: string, traceId: string): Promise<void> {
		const intents = await this.loadActiveIntents()
		const intent = intents.find((i) => i.id === intentId)

		if (intent) {
			intent.last_trace_ref = traceId

			const yamlPath = path.join(this.orchestrationDir, "active_intents.yaml")
			const data: ActiveIntent = { active_intents: intents }
			await fs.writeFile(yamlPath, yaml.stringify(data), "utf8")
		}
	}

	/**
	 * Load shared brain (CLAUDE.md) content
	 * @returns Content of CLAUDE.md or empty string
	 */
	async loadSharedBrain(): Promise<string> {
		try {
			const claudePath = path.join(this.orchestrationDir, "CLAUDE.md")
			return await fs.readFile(claudePath, "utf8")
		} catch {
			return ""
		}
	}

	/**
	 * Append lesson learned to CLAUDE.md
	 * @param lesson The lesson to append
	 */
	async appendLesson(lesson: string): Promise<void> {
		const claudePath = path.join(this.orchestrationDir, "CLAUDE.md")
		const timestamp = new Date().toISOString()
		const entry = `\n- [${timestamp}] ${lesson}\n`

		try {
			await fs.appendFile(claudePath, entry, "utf8")
		} catch (error) {
			// If file doesn't exist, create it with header
			const header = `# Shared Brain — TRP1 Governed Workspace\n\n## Lessons Learned\n`
			await fs.writeFile(claudePath, header + entry, "utf8")
		}
	}

	/**
	 * Ensure .orchestration directory exists
	 */
	async ensureOrchestrationDir(): Promise<void> {
		try {
			await fs.mkdir(this.orchestrationDir, { recursive: true })
		} catch {
			// Directory already exists
		}
	}
}
