import fs from "fs/promises"
import path from "path"
import * as yaml from "yaml"

export interface IntentRecord {
	intent_id: string
	title?: string
	constraints?: string[]
	related_files?: string[]
	recent_history?: string[]
	[key: string]: unknown
}

const DEFAULT_ACTIVE_INTENTS_YAML = "intents: []\n"

function normalizeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return []
	}

	return value
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter(Boolean)
}

export class OrchestrationStore {
	static readonly ORCHESTRATION_DIR = ".orchestration"
	static readonly ACTIVE_INTENTS_FILE = "active_intents.yaml"

	constructor(private readonly workspacePath: string) {}

	get orchestrationDirPath(): string {
		return path.join(this.workspacePath, OrchestrationStore.ORCHESTRATION_DIR)
	}

	get activeIntentsPath(): string {
		return path.join(this.orchestrationDirPath, OrchestrationStore.ACTIVE_INTENTS_FILE)
	}

	async ensureInitialized(): Promise<void> {
		await fs.mkdir(this.orchestrationDirPath, { recursive: true })

		try {
			await fs.access(this.activeIntentsPath)
		} catch {
			await fs.writeFile(this.activeIntentsPath, DEFAULT_ACTIVE_INTENTS_YAML, "utf8")
		}
	}

	async loadIntents(): Promise<IntentRecord[]> {
		await this.ensureInitialized()

		const raw = await fs.readFile(this.activeIntentsPath, "utf8")
		const parsed = yaml.parse(raw) as unknown

		return this.normalizeIntents(parsed)
	}

	async findIntentById(intentId: string): Promise<IntentRecord | undefined> {
		const normalizedIntentId = intentId.trim()
		const intents = await this.loadIntents()
		return intents.find((intent) => intent.intent_id === normalizedIntentId)
	}

	private normalizeIntents(parsed: unknown): IntentRecord[] {
		if (!parsed) {
			return []
		}

		if (Array.isArray(parsed)) {
			return parsed
				.map((entry) => this.normalizeIntentRecord(entry))
				.filter((entry): entry is IntentRecord => entry !== null)
		}

		if (typeof parsed === "object" && parsed !== null) {
			const root = parsed as Record<string, unknown>
			const explicitIntents = root.intents ?? root.active_intents

			if (Array.isArray(explicitIntents)) {
				return explicitIntents
					.map((entry) => this.normalizeIntentRecord(entry))
					.filter((entry): entry is IntentRecord => entry !== null)
			}

			// Support map format where intent IDs are keys.
			return Object.entries(root)
				.map(([intentId, entry]) => {
					if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
						return null
					}
					return this.normalizeIntentRecord({ intent_id: intentId, ...(entry as Record<string, unknown>) })
				})
				.filter((entry): entry is IntentRecord => entry !== null)
		}

		return []
	}

	private normalizeIntentRecord(raw: unknown): IntentRecord | null {
		if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
			return null
		}

		const entry = raw as Record<string, unknown>
		const intentId =
			typeof entry.intent_id === "string"
				? entry.intent_id.trim()
				: typeof entry.intentId === "string"
					? entry.intentId.trim()
					: ""

		if (!intentId) {
			return null
		}

		const normalized: IntentRecord = {
			...entry,
			intent_id: intentId,
		}

		const title = typeof entry.title === "string" ? entry.title.trim() : undefined
		if (title) {
			normalized.title = title
		}

		const constraints = normalizeStringArray(entry.constraints)
		if (constraints.length > 0) {
			normalized.constraints = constraints
		}

		const relatedFiles = normalizeStringArray(entry.related_files ?? entry.relatedFiles)
		if (relatedFiles.length > 0) {
			normalized.related_files = relatedFiles
		}

		const recentHistory = normalizeStringArray(entry.recent_history ?? entry.recentHistory)
		if (recentHistory.length > 0) {
			normalized.recent_history = recentHistory
		}

		return normalized
	}
}
