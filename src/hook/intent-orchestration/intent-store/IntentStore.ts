/**
 * IntentStore - Manages loading and querying of active_intents.yaml
 */

import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "js-yaml"
import { OrchestrationPaths } from "./OrchestrationPaths"
import { ActiveIntentsSchema } from "./ActiveIntentsSchema"
import type { IntentDefinition, ActiveIntentsSpec, SelectedIntent } from "../types/IntentTypes"
import { ValidationError } from "../errors/ValidationError"

export class IntentStore {
	private spec: ActiveIntentsSpec | null = null
	private selectedIntent: SelectedIntent | null = null
	private readonly workspaceRoot: string

	constructor(workspaceRoot: string = process.cwd()) {
		this.workspaceRoot = workspaceRoot
	}

	/**
	 * Load active_intents.yaml from disk
	 */
	async load(): Promise<ActiveIntentsSpec> {
		const filePath = path.join(this.workspaceRoot, OrchestrationPaths.activeIntents())

		try {
			const content = await fs.readFile(filePath, "utf-8")
			const parsed = yaml.load(content)
			this.spec = ActiveIntentsSchema.validate(parsed)
			return this.spec
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				throw new ValidationError(
					`active_intents.yaml not found at ${filePath}. Please create the orchestration configuration.`,
				)
			}
			throw new ValidationError(`Failed to parse active_intents.yaml: ${(error as Error).message}`)
		}
	}

	/**
	 * Reload the spec from disk
	 */
	async reload(): Promise<ActiveIntentsSpec> {
		return this.load()
	}

	/**
	 * Get all active intents
	 */
	getActiveIntents(): IntentDefinition[] {
		if (!this.spec) {
			throw new ValidationError("IntentStore not loaded. Call load() first.")
		}
		return this.spec.active_intents.filter((intent) => intent.status === "active")
	}

	/**
	 * Get a specific intent by ID
	 */
	getIntentById(id: string): IntentDefinition | undefined {
		if (!this.spec) {
			throw new ValidationError("IntentStore not loaded. Call load() first.")
		}
		return this.spec.active_intents.find((intent) => intent.id === id)
	}

	/**
	 * Check if an intent exists
	 */
	hasIntent(id: string): boolean {
		if (!this.spec) {
			throw new ValidationError("IntentStore not loaded. Call load() first.")
		}
		return this.spec.active_intents.some((intent) => intent.id === id)
	}

	/**
	 * Select an active intent
	 */
	selectIntent(intentId: string): SelectedIntent {
		if (!this.spec) {
			throw new ValidationError("IntentStore not loaded. Call load() first.")
		}

		const intent = this.getIntentById(intentId)
		if (!intent) {
			throw new ValidationError(`Intent '${intentId}' not found in active_intents.yaml`)
		}

		if (intent.status !== "active") {
			throw new ValidationError(`Intent '${intentId}' is not active (status: ${intent.status})`)
		}

		this.selectedIntent = {
			intent_id: intentId,
			selected_at: new Date().toISOString(),
			context_injected: false,
		}

		return this.selectedIntent
	}

	/**
	 * Get the currently selected intent
	 */
	getSelectedIntent(): SelectedIntent | null {
		return this.selectedIntent
	}

	/**
	 * Mark context as injected for the selected intent
	 */
	markContextInjected(): void {
		if (this.selectedIntent) {
			this.selectedIntent.context_injected = true
		}
	}

	/**
	 * Build an XML context block for the selected intent
	 */
	buildContextBlock(intentId?: string): string {
		const targetId = intentId || this.selectedIntent?.intent_id
		if (!targetId) {
			throw new ValidationError("No intent selected or provided")
		}

		const intent = this.getIntentById(targetId)
		if (!intent) {
			throw new ValidationError(`Intent '${targetId}' not found`)
		}

		const constraintsXml = intent.constraints
			.map((c) => `    <constraint type="${c.type}" pattern="${c.pattern}">${c.description || ""}</constraint>`)
			.join("\n")

		const criteriaXml = intent.acceptance_criteria.map((c) => `    <criteria>${c}</criteria>`).join("\n")

		return `<intent_context>
  <intent_id>${intent.id}</intent_id>
  <title>${intent.title}</title>
  <description>${intent.description}</description>
  <status>${intent.status}</status>
  <scope>
    <include>${intent.scope.include.join(", ")}</include>
    <exclude>${intent.scope.exclude.join(", ")}</exclude>
  </scope>
  <constraints>
${constraintsXml}
  </constraints>
  <acceptance_criteria>
${criteriaXml}
  </acceptance_criteria>
</intent_context>`
	}

	/**
	 * Get the raw spec
	 */
	getSpec(): ActiveIntentsSpec | null {
		return this.spec
	}
}

// Singleton instance
export const intentStore = new IntentStore()
