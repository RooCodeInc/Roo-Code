import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import * as yaml from "yaml"
import { z } from "zod"

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
	ast_fingerprint?: {
		parser: "tree-sitter"
		summary_hash: string
	}
	conversations: AgentTraceConversation[]
}

export interface AgentTraceRecord {
	id: string
	timestamp: string
	vcs: { revision_id: string }
	files: AgentTraceFile[]
	integrity?: {
		chain: "sha256"
		prev_record_hash: string | null
		record_hash: string
	}
}

export interface SidecarDenyMutationRule {
	path_glob: string
	reason?: string
}

export interface SidecarPolicy {
	version: number
	architectural_constraints: string[]
	blocked_tools: string[]
	deny_mutations: SidecarDenyMutationRule[]
}

export interface GovernanceEntry {
	intent_id?: string
	tool_name: string
	status: "OK" | "FAILED" | "DENIED"
	task_id: string
	model_identifier: string
	revision_id: string
	touched_paths: string[]
	sidecar_constraints: string[]
}

export interface OrchestrationDirectoryContractStatus {
	isCompliant: boolean
	missingRequiredFiles: string[]
	unexpectedEntries: string[]
}

const sha256HashRegex = /^sha256:[a-f0-9]{64}$/i
const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const traceRangeSchema = z
	.object({
		start_line: z.number().int().nonnegative(),
		end_line: z.number().int().nonnegative(),
		content_hash: z.string().regex(sha256HashRegex),
	})
	.refine((value) => value.end_line >= value.start_line, { message: "end_line must be >= start_line" })

const traceConversationSchema = z.object({
	url: z.string().min(1),
	contributor: z.object({
		entity_type: z.enum(["AI", "HUMAN"]),
		model_identifier: z.string().min(1),
	}),
	ranges: z.array(traceRangeSchema).min(1),
	related: z
		.array(
			z.object({
				type: z.literal("specification"),
				value: z.string().min(1),
			}),
		)
		.min(1),
})

const traceFileSchema = z.object({
	relative_path: z.string().min(1),
	ast_fingerprint: z
		.object({
			parser: z.literal("tree-sitter"),
			summary_hash: z.string().regex(sha256HashRegex),
		})
		.optional(),
	conversations: z.array(traceConversationSchema).min(1),
})

const traceRecordSchema = z.object({
	id: z.string().regex(uuidV4Regex),
	timestamp: z.string().datetime({ offset: true }),
	vcs: z.object({
		revision_id: z.string().min(1),
	}),
	files: z.array(traceFileSchema).min(1),
	integrity: z
		.object({
			chain: z.literal("sha256"),
			prev_record_hash: z.string().regex(sha256HashRegex).nullable(),
			record_hash: z.string().regex(sha256HashRegex),
		})
		.optional(),
})

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
const DEFAULT_GOVERNANCE_LEDGER_MD = [
	"# Governance Ledger",
	"",
	"Machine-managed audit of intent, tool use, attribution, and sidecar constraint context.",
	"",
].join("\n")
const DEFAULT_SIDECAR_POLICY_YAML = [
	"sidecar:",
	"  version: 1",
	"  architectural_constraints:",
	'    - "All mutating tool calls must map to an active intent and remain inside owned scope."',
	'    - "Architectural invariants are enforced by deterministic hooks, not prompt-only instructions."',
	"  blocked_tools: []",
	"  deny_mutations:",
	'    - path_glob: ".orchestration/**"',
	'      reason: "Orchestration control-plane files are hook-managed."',
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
	static readonly GOVERNANCE_LEDGER_FILE = "governance_ledger.md"
	static readonly SIDECAR_POLICY_FILE = "constraints.sidecar.yaml"
	static readonly REQUIRED_ORCHESTRATION_FILES = [
		OrchestrationStore.ACTIVE_INTENTS_FILE,
		OrchestrationStore.AGENT_TRACE_FILE,
		OrchestrationStore.INTENT_MAP_FILE,
		OrchestrationStore.GOVERNANCE_LEDGER_FILE,
		OrchestrationStore.SIDECAR_POLICY_FILE,
	] as const

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

	get governanceLedgerPath(): string {
		return path.join(this.orchestrationDirPath, OrchestrationStore.GOVERNANCE_LEDGER_FILE)
	}

	get sidecarPolicyPath(): string {
		return path.join(this.orchestrationDirPath, OrchestrationStore.SIDECAR_POLICY_FILE)
	}

	async ensureInitialized(): Promise<void> {
		await fs.mkdir(this.orchestrationDirPath, { recursive: true })
		await this.ensureFile(this.activeIntentsPath, DEFAULT_ACTIVE_INTENTS_YAML)
		await this.ensureFile(this.agentTracePath, "")
		await this.ensureFile(this.intentMapPath, DEFAULT_INTENT_MAP_MD)
		await this.ensureFile(this.sharedBrainPath, DEFAULT_SHARED_BRAIN_MD)
		await this.ensureFile(this.governanceLedgerPath, DEFAULT_GOVERNANCE_LEDGER_MD)
		await this.ensureFile(this.sidecarPolicyPath, DEFAULT_SIDECAR_POLICY_YAML)
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
		this.validateTraceRecord(record)
		const prevHash = await this.getLastTraceRecordHash()
		const canonicalPayload = this.getTraceCanonicalPayload(record, prevHash)
		const recordHash = this.computeSha256(canonicalPayload)
		const recordWithIntegrity: AgentTraceRecord = {
			...record,
			integrity: {
				chain: "sha256",
				prev_record_hash: prevHash,
				record_hash: recordHash,
			},
		}
		this.validateTraceRecord(recordWithIntegrity)
		await fs.appendFile(this.agentTracePath, `${JSON.stringify(recordWithIntegrity)}\n`, "utf8")
	}

	async appendIntentMapEntry(
		intent: ActiveIntentRecord,
		filePaths: string[],
		astFingerprints?: Record<string, string | undefined>,
	): Promise<void> {
		await this.ensureInitialized()

		const normalizedPaths = Array.from(
			new Set(filePaths.map((filePath) => filePath.trim().replace(/\\/g, "/")).filter(Boolean)),
		)
		if (normalizedPaths.length === 0) {
			return
		}

		const header = `## ${intent.id}${intent.name ? ` - ${intent.name}` : ""} (${new Date().toISOString()})`
		const lines = [
			"",
			header,
			...normalizedPaths.map((filePath) => {
				const astFingerprint = astFingerprints?.[filePath]
				return astFingerprint
					? `- \`${filePath}\` (ast_fingerprint: \`${astFingerprint}\`)`
					: `- \`${filePath}\``
			}),
			"",
		]
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

	async loadSidecarPolicy(): Promise<SidecarPolicy> {
		await this.ensureInitialized()
		const raw = await fs.readFile(this.sidecarPolicyPath, "utf8")
		const parsed = yaml.parse(raw) as unknown
		const root =
			typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
				? (parsed as Record<string, unknown>)
				: {}
		const sidecarRaw =
			typeof root.sidecar === "object" && root.sidecar !== null && !Array.isArray(root.sidecar)
				? (root.sidecar as Record<string, unknown>)
				: root

		const version =
			typeof sidecarRaw.version === "number" && Number.isFinite(sidecarRaw.version) ? sidecarRaw.version : 1

		const blockedTools = normalizeStringArray(sidecarRaw.blocked_tools ?? sidecarRaw.blockedTools)
		const architecturalConstraints = normalizeStringArray(
			sidecarRaw.architectural_constraints ?? sidecarRaw.architecturalConstraints,
		)
		const denyMutationsRaw = Array.isArray(sidecarRaw.deny_mutations)
			? sidecarRaw.deny_mutations
			: Array.isArray(sidecarRaw.denyMutations)
				? sidecarRaw.denyMutations
				: []
		const denyMutationsMapped = denyMutationsRaw.map((entry): SidecarDenyMutationRule | null => {
			if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
				return null
			}
			const record = entry as Record<string, unknown>
			const pathGlob = typeof record.path_glob === "string" ? record.path_glob.trim() : ""
			if (!pathGlob) {
				return null
			}
			const reason =
				typeof record.reason === "string" && record.reason.trim().length > 0 ? record.reason : undefined
			return { path_glob: pathGlob, reason }
		})
		const denyMutations = denyMutationsMapped.filter((entry): entry is SidecarDenyMutationRule => entry !== null)

		return {
			version,
			architectural_constraints: architecturalConstraints,
			blocked_tools: blockedTools,
			deny_mutations: denyMutations,
		}
	}

	async appendGovernanceEntry(entry: GovernanceEntry): Promise<void> {
		await this.ensureInitialized()
		const touched =
			entry.touched_paths.length > 0 ? entry.touched_paths.map((p) => `\`${p}\``).join(", ") : "(none)"
		const constraints =
			entry.sidecar_constraints.length > 0 ? entry.sidecar_constraints.map((c) => `"${c}"`).join(" | ") : "(none)"
		const line = [
			`- ${new Date().toISOString()} | status=${entry.status} | tool=${entry.tool_name} | intent=${entry.intent_id ?? "none"} | task=${entry.task_id} | model=${entry.model_identifier} | rev=${entry.revision_id}`,
			`  touched_paths=${touched}`,
			`  sidecar_constraints=${constraints}`,
		].join("\n")
		await fs.appendFile(this.governanceLedgerPath, `${line}\n`, "utf8")
	}

	async getDirectoryContractStatus(): Promise<OrchestrationDirectoryContractStatus> {
		await this.ensureInitialized()
		const requiredFiles = new Set<string>(OrchestrationStore.REQUIRED_ORCHESTRATION_FILES)

		const entries = await fs.readdir(this.orchestrationDirPath, { withFileTypes: true })
		const unexpectedEntries = entries
			.filter((entry) => !requiredFiles.has(entry.name) || !entry.isFile())
			.map((entry) => entry.name)
			.sort()

		const missingRequiredFiles: string[] = []
		for (const fileName of requiredFiles) {
			const filePath = path.join(this.orchestrationDirPath, fileName)
			try {
				const stat = await fs.stat(filePath)
				if (!stat.isFile()) {
					missingRequiredFiles.push(fileName)
				}
			} catch {
				missingRequiredFiles.push(fileName)
			}
		}

		return {
			isCompliant: unexpectedEntries.length === 0 && missingRequiredFiles.length === 0,
			missingRequiredFiles,
			unexpectedEntries,
		}
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

	private validateTraceRecord(record: AgentTraceRecord): void {
		const parsed = traceRecordSchema.safeParse(record)
		if (!parsed.success) {
			const detail = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
			throw new Error(`Invalid AgentTraceRecord schema: ${detail}`)
		}
	}

	private computeSha256(payload: string): string {
		return `sha256:${crypto.createHash("sha256").update(payload).digest("hex")}`
	}

	private getTraceCanonicalPayload(record: AgentTraceRecord, prevHash: string | null): string {
		const payload = {
			id: record.id,
			timestamp: record.timestamp,
			vcs: record.vcs,
			files: record.files,
			prev_record_hash: prevHash,
		}
		return JSON.stringify(payload)
	}

	private async getLastTraceRecordHash(): Promise<string | null> {
		await this.ensureInitialized()
		const raw = await fs.readFile(this.agentTracePath, "utf8")
		const lines = raw
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean)
		if (lines.length === 0) {
			return null
		}
		const lastLine = lines[lines.length - 1]
		try {
			const parsed = JSON.parse(lastLine) as AgentTraceRecord
			if (parsed.integrity?.record_hash && sha256HashRegex.test(parsed.integrity.record_hash)) {
				return parsed.integrity.record_hash
			}
		} catch {
			// Fall through to hash the raw line.
		}
		return this.computeSha256(lastLine)
	}
}
