import fs from "fs/promises"
import path from "path"
import * as yaml from "yaml"

export type IntentStatus = "IN_PROGRESS" | "PENDING" | "COMPLETED" | "BLOCKED" | string

export interface ActiveIntentRecord {
	id: string
	name?: string
	status?: IntentStatus
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
	recent_history: string[]
	related_files: string[]
	[key: string]: unknown
}

export interface AgentTraceRange {
	start_line: number
	end_line: number
	content_hash: string
}

export interface AgentTraceConversation {
	url: string
	contributor: {
		entity_type: "AI" | "HUMAN"
		model_identifier: string
	}
	ranges: AgentTraceRange[]
	related: Array<{
		type: "specification"
		value: string
	}>
}

export interface AgentTraceFile {
	relative_path: string
	conversations: AgentTraceConversation[]
}

export interface AgentTraceRecord {
	id: string
	timestamp: string
	vcs: { revision_id: string }
	files: AgentTraceFile[]
}

const DEFAULT_ACTIVE_INTENTS_YAML = "active_intents: []\n"
const DEFAULT_INTENT_MAP_MD = [
	"# Intent Map",
	"",
	"Machine-managed mapping between intent IDs and touched code locations.",
	"",
].join("\n")
const DEFAULT_SHARED_BRAIN_MD = [
	"# AGENT",
	"",
	"Machine-managed shared memory for architectural decisions and recurring failures.",
	"",
].join("\n")

function normalizeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return []
	}

	return value
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter(Boolean)
}

function normalizeStatus(status: unknown): IntentStatus | undefined {
	if (typeof status !== "string") {
		return undefined
	}

	const normalized = status.trim()
	return normalized.length > 0 ? normalized : undefined
}

function normalizeIntentEntry(raw: unknown): ActiveIntentRecord | null {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
		return null
	}

	const entry = raw as Record<string, unknown>
	const rawId = entry.id ?? entry.intent_id ?? entry.intentId
	const id = typeof rawId === "string" ? rawId.trim() : ""

	if (!id) {
		return null
	}

	const nameCandidate = entry.name ?? entry.title
	const name = typeof nameCandidate === "string" && nameCandidate.trim().length > 0 ? nameCandidate.trim() : undefined
	const status = normalizeStatus(entry.status)

	const ownedScope = normalizeStringArray(entry.owned_scope ?? entry.ownedScope)
	const constraints = normalizeStringArray(entry.constraints)
	const acceptanceCriteria = normalizeStringArray(entry.acceptance_criteria ?? entry.acceptanceCriteria)
	const recentHistory = normalizeStringArray(entry.recent_history ?? entry.recentHistory)
	const relatedFiles = normalizeStringArray(entry.related_files ?? entry.relatedFiles)

	return {
		...entry,
		id,
		name,
		status,
		owned_scope: ownedScope,
		constraints,
		acceptance_criteria: acceptanceCriteria,
		recent_history: recentHistory,
		related_files: relatedFiles,
	}
}

function canonicalizeForYaml(intent: ActiveIntentRecord): Record<string, unknown> {
	return {
		id: intent.id,
		name: intent.name ?? null,
		status: intent.status ?? "PENDING",
		owned_scope: intent.owned_scope,
		constraints: intent.constraints,
		acceptance_criteria: intent.acceptance_criteria,
		recent_history: intent.recent_history,
		related_files: intent.related_files,
	}
}

export class OrchestrationStore {
	static readonly ORCHESTRATION_DIR = ".orchestration"
	static readonly ACTIVE_INTENTS_FILE = "active_intents.yaml"
	static readonly AGENT_TRACE_FILE = "agent_trace.jsonl"
	static readonly INTENT_MAP_FILE = "intent_map.md"
	static readonly SHARED_BRAIN_FILE = "AGENT.md"

	constructor(private readonly workspacePath: string) {}

	get orchestrationDirPath(): string {
		return path.join(this.workspacePath, OrchestrationStore.ORCHESTRATION_DIR)
	}

	get activeIntentsPath(): string {
		return path.join(this.orchestrationDirPath, OrchestrationStore.ACTIVE_INTENTS_FILE)
	}

	get agentTracePath(): string {
		return path.join(this.orchestrationDirPath, OrchestrationStore.AGENT_TRACE_FILE)
	}

	get intentMapPath(): string {
		return path.join(this.orchestrationDirPath, OrchestrationStore.INTENT_MAP_FILE)
	}

	get sharedBrainPath(): string {
		return path.join(this.workspacePath, OrchestrationStore.SHARED_BRAIN_FILE)
	}

	async ensureInitialized(): Promise<void> {
		await fs.mkdir(this.orchestrationDirPath, { recursive: true })
		await this.ensureFile(this.activeIntentsPath, DEFAULT_ACTIVE_INTENTS_YAML)
		await this.ensureFile(this.agentTracePath, "")
		await this.ensureFile(this.intentMapPath, DEFAULT_INTENT_MAP_MD)
		await this.ensureFile(this.sharedBrainPath, DEFAULT_SHARED_BRAIN_MD)
	}

	async loadIntents(): Promise<ActiveIntentRecord[]> {
		await this.ensureInitialized()
		const raw = await fs.readFile(this.activeIntentsPath, "utf8")
		const parsed = yaml.parse(raw) as unknown
		return this.normalizeIntents(parsed)
	}

	async findIntentById(intentId: string): Promise<ActiveIntentRecord | undefined> {
		const normalizedIntentId = intentId.trim()
		if (!normalizedIntentId) {
			return undefined
		}

		const intents = await this.loadIntents()
		return intents.find((intent) => intent.id === normalizedIntentId)
	}

	async upsertIntent(intent: ActiveIntentRecord): Promise<void> {
		const intents = await this.loadIntents()
		const next = [...intents]
		const index = next.findIndex((candidate) => candidate.id === intent.id)
		if (index >= 0) {
			next[index] = intent
		} else {
			next.push(intent)
		}

		await this.saveIntents(next)
	}

	async setIntentStatus(intentId: string, status: IntentStatus): Promise<void> {
		const intents = await this.loadIntents()
		const index = intents.findIndex((intent) => intent.id === intentId)
		if (index < 0) {
			return
		}

		intents[index] = {
			...intents[index],
			status,
		}

		await this.saveIntents(intents)
	}

	async appendRecentHistory(intentId: string, event: string): Promise<void> {
		const cleanedEvent = event.trim()
		if (!cleanedEvent) {
			return
		}

		const intents = await this.loadIntents()
		const index = intents.findIndex((intent) => intent.id === intentId)
		if (index < 0) {
			return
		}

		const previous = intents[index].recent_history ?? []
		const nextHistory = [cleanedEvent, ...previous].slice(0, 20)
		intents[index] = {
			...intents[index],
			recent_history: nextHistory,
		}

		await this.saveIntents(intents)
	}

	async appendTraceRecord(record: AgentTraceRecord): Promise<void> {
		await this.ensureInitialized()
		await fs.appendFile(this.agentTracePath, `${JSON.stringify(record)}\n`, "utf8")
	}

	async appendIntentMapEntry(intent: ActiveIntentRecord, filePaths: string[]): Promise<void> {
		await this.ensureInitialized()

		const normalizedPaths = Array.from(
			new Set(filePaths.map((filePath) => filePath.trim().replace(/\\/g, "/")).filter(Boolean)),
		)
		if (normalizedPaths.length === 0) {
			return
		}

		const header = `## ${intent.id}${intent.name ? ` - ${intent.name}` : ""} (${new Date().toISOString()})`
		const lines = ["", header, ...normalizedPaths.map((filePath) => `- \`${filePath}\``), ""]
		await fs.appendFile(this.intentMapPath, lines.join("\n"), "utf8")
	}

	async appendSharedBrainEntry(entry: string): Promise<void> {
		const cleanedEntry = entry.trim()
		if (!cleanedEntry) {
			return
		}

		await this.ensureInitialized()
		const line = `- ${new Date().toISOString()}: ${cleanedEntry}\n`
		await fs.appendFile(this.sharedBrainPath, line, "utf8")
	}

	private async saveIntents(intents: ActiveIntentRecord[]): Promise<void> {
		await this.ensureInitialized()
		const root = {
			active_intents: intents.map((intent) => canonicalizeForYaml(intent)),
		}
		const serialized = yaml.stringify(root, { lineWidth: 0 })
		await fs.writeFile(this.activeIntentsPath, serialized, "utf8")
	}

	private normalizeIntents(parsed: unknown): ActiveIntentRecord[] {
		if (!parsed) {
			return []
		}

		if (Array.isArray(parsed)) {
			return parsed
				.map((entry) => normalizeIntentEntry(entry))
				.filter((entry): entry is ActiveIntentRecord => entry !== null)
		}

		if (typeof parsed === "object" && parsed !== null) {
			const root = parsed as Record<string, unknown>
			const list = root.active_intents ?? root.intents

			if (Array.isArray(list)) {
				return list
					.map((entry) => normalizeIntentEntry(entry))
					.filter((entry): entry is ActiveIntentRecord => entry !== null)
			}

			return Object.entries(root)
				.map(([id, entry]) => {
					if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
						return null
					}
					return normalizeIntentEntry({ id, ...(entry as Record<string, unknown>) })
				})
				.filter((entry): entry is ActiveIntentRecord => entry !== null)
		}

		return []
	}

	private async ensureFile(filePath: string, initialContent: string): Promise<void> {
		try {
			await fs.access(filePath)
		} catch {
			await fs.writeFile(filePath, initialContent, "utf8")
		}
	}
}
