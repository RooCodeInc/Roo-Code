import { type IntentRecord, OrchestrationStore } from "./OrchestrationStore"

export interface SelectedIntentContext {
	intent_id: string
	title?: string
	constraints: string[]
	related_files: string[]
	recent_history: string[]
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
		const intents = await this.store.loadIntents()
		const normalizedIntentId = intentId.trim()
		const selected = intents.find((intent) => intent.intent_id === normalizedIntentId)
		const availableIntentIds = intents.map((intent) => intent.intent_id)

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

	private toContext(intent: IntentRecord): SelectedIntentContext {
		return {
			intent_id: intent.intent_id,
			title: typeof intent.title === "string" && intent.title.trim().length > 0 ? intent.title : undefined,
			constraints: normalizeStringArray(intent.constraints),
			related_files: normalizeStringArray(intent.related_files),
			recent_history: normalizeStringArray(intent.recent_history),
		}
	}

	private formatContextMessage(context: SelectedIntentContext): string {
		const payload = {
			intent_id: context.intent_id,
			title: context.title ?? null,
			constraints: context.constraints,
			related_files: context.related_files,
			recent_history: context.recent_history,
		}

		return `Selected active intent context:\n${JSON.stringify(payload, null, 2)}`
	}
}
