import fs from "fs/promises"
import path from "path"
import * as yaml from "yaml"

import { hashContent } from "./ContentHasher"
import { classifySemanticChange, type SemanticChangeType } from "./SemanticClassifier"

const ACTIVE_INTENTS_PATH = path.join(".orchestration", "active_intents.yaml")
const AGENT_TRACE_PATH = path.join(".orchestration", "agent_trace.jsonl")

interface IntentRecord {
	intent_id?: unknown
	id?: unknown
	title?: unknown
	scope?: {
		operations?: unknown
	}
}

function normalizeIntentRecords(data: unknown): IntentRecord[] {
	if (Array.isArray(data)) {
		return data as IntentRecord[]
	}

	if (data && typeof data === "object") {
		const root = data as Record<string, unknown>

		if (Array.isArray(root.active_intents)) {
			return root.active_intents as IntentRecord[]
		}

		if (Array.isArray(root.intents)) {
			return root.intents as IntentRecord[]
		}
	}

	return []
}

function normalizeIntentId(record: IntentRecord): string {
	return String(record.intent_id ?? record.id ?? "").trim()
}

async function loadIntentMetadata(workspaceRoot: string, activeIntentId: string): Promise<IntentRecord | undefined> {
	if (!activeIntentId) {
		return undefined
	}

	try {
		const content = await fs.readFile(path.join(workspaceRoot, ACTIVE_INTENTS_PATH), "utf8")
		const parsed = yaml.parse(content)
		const intents = normalizeIntentRecords(parsed)
		return intents.find((record) => normalizeIntentId(record) === activeIntentId)
	} catch {
		return undefined
	}
}

export interface AgentTraceAppendInput {
	workspaceRoot: string
	activeIntentId: string
	filePath: string
	content: string
	toolName: string
}

interface AgentTraceEntry {
	timestamp: string
	intent_id: string
	file_path: string
	content_sha256: string
	semantic_change: SemanticChangeType
	tool: string
}

export async function appendAgentTrace(input: AgentTraceAppendInput): Promise<void> {
	const intent = await loadIntentMetadata(input.workspaceRoot, input.activeIntentId)
	const semanticChange = classifySemanticChange({
		intentTitle: intent?.title,
		intentOperations: intent?.scope?.operations,
		filePath: input.filePath,
	})

	const entry: AgentTraceEntry = {
		timestamp: new Date().toISOString(),
		intent_id: input.activeIntentId,
		file_path: input.filePath,
		content_sha256: hashContent(input.content),
		semantic_change: semanticChange,
		tool: input.toolName,
	}

	const tracePath = path.join(input.workspaceRoot, AGENT_TRACE_PATH)
	await fs.mkdir(path.dirname(tracePath), { recursive: true })
	await fs.appendFile(tracePath, `${JSON.stringify(entry)}\n`, "utf8")
}
