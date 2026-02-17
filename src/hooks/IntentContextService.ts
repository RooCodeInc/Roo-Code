import { type ActiveIntentRecord, OrchestrationStore } from "./OrchestrationStore"

export interface SelectedIntentContext {
	id: string
	name?: string
	status?: string
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
	recent_history: string[]
	related_files: string[]
}

export interface SelectIntentResult {
	found: boolean
	context?: SelectedIntentContext
	message: string
	availableIntentIds: string[]
}

function normalizeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return []
	}

	return value
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter(Boolean)
}

export class IntentContextService {
	constructor(private readonly store: OrchestrationStore) {}

	async selectIntent(intentId: string): Promise<SelectIntentResult> {
		const normalizedIntentId = intentId.trim()
		const intents = await this.store.loadIntents()
		const selected = intents.find((intent) => intent.id === normalizedIntentId)
		const availableIntentIds = intents.map((intent) => intent.id)

		if (!selected) {
			const available = availableIntentIds.length > 0 ? availableIntentIds.join(", ") : "(none)"
			return {
				found: false,
				availableIntentIds,
				message: `Intent '${normalizedIntentId}' was not found in .orchestration/active_intents.yaml. Available intent IDs: ${available}.`,
			}
		}

		const context = this.toContext(selected)
		return {
			found: true,
			context,
			availableIntentIds,
			message: this.formatContextMessage(context),
		}
	}

	async markIntentInProgress(intentId: string): Promise<void> {
		await this.store.setIntentStatus(intentId, "IN_PROGRESS")
	}

	async markIntentCompleted(intentId: string): Promise<void> {
		await this.store.setIntentStatus(intentId, "COMPLETED")
	}

	private toContext(intent: ActiveIntentRecord): SelectedIntentContext {
		return {
			id: intent.id,
			name: typeof intent.name === "string" && intent.name.trim().length > 0 ? intent.name : undefined,
			status: typeof intent.status === "string" ? intent.status : undefined,
			owned_scope: normalizeStringArray(intent.owned_scope),
			constraints: normalizeStringArray(intent.constraints),
			acceptance_criteria: normalizeStringArray(intent.acceptance_criteria),
			recent_history: normalizeStringArray(intent.recent_history),
			related_files: normalizeStringArray(intent.related_files),
		}
	}

	private formatContextMessage(context: SelectedIntentContext): string {
		const payload = {
			id: context.id,
			name: context.name ?? null,
			status: context.status ?? null,
			owned_scope: context.owned_scope,
			constraints: context.constraints,
			acceptance_criteria: context.acceptance_criteria,
			related_files: context.related_files,
			recent_history: context.recent_history,
		}

		return `Selected active intent context:\n${JSON.stringify(payload, null, 2)}`
	}
}
