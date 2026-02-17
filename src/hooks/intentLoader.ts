import fs from "fs/promises"
import path from "path"

import { parse, stringify } from "yaml"

export interface IntentDefinition {
	id: string
	title: string
	description: string
	scope: string[]
	acceptanceCriteria: string[]
}

interface IntentFileShape {
	intents: IntentDefinition[]
}

interface CacheEntry {
	mtimeMs: number
	data: IntentFileShape
}

const intentCache = new Map<string, CacheEntry>()
const selectedIntentByTask = new Map<string, string>()
const SELECTED_INTENT_SENTINEL_TASK = "__command_context__"

export class IntentLoadError extends Error {
	constructor(
		public readonly code:
			| "INTENT_FILE_MISSING"
			| "INTENT_YAML_INVALID"
			| "INTENT_SCHEMA_INVALID"
			| "INTENT_NOT_FOUND",
		message: string,
		public readonly details?: Record<string, unknown>,
	) {
		super(message)
	}
}

function filePath(cwd: string): string {
	return path.join(cwd, ".orchestration", "active_intents.yaml")
}

function normalizeIntent(raw: any): IntentDefinition {
	return {
		id: String(raw?.id ?? ""),
		title: String(raw?.title ?? ""),
		description: String(raw?.description ?? ""),
		scope: Array.isArray(raw?.scope) ? raw.scope.map((v: unknown) => String(v)) : [],
		acceptanceCriteria: Array.isArray(raw?.acceptanceCriteria)
			? raw.acceptanceCriteria.map((v: unknown) => String(v))
			: Array.isArray(raw?.acceptance_criteria)
				? raw.acceptance_criteria.map((v: unknown) => String(v))
				: [],
	}
}

function validateIntent(intent: IntentDefinition): boolean {
	return (
		intent.id.length > 0 &&
		intent.title.length > 0 &&
		intent.description.length > 0 &&
		Array.isArray(intent.scope) &&
		intent.scope.length > 0 &&
		Array.isArray(intent.acceptanceCriteria)
	)
}

function validateData(data: any): IntentFileShape {
	const intentsRaw = Array.isArray(data?.intents) ? data.intents : null
	if (!intentsRaw) {
		throw new IntentLoadError("INTENT_SCHEMA_INVALID", "Invalid active_intents.yaml: missing intents[]")
	}
	const intents = intentsRaw.map(normalizeIntent)
	if (!intents.every(validateIntent)) {
		throw new IntentLoadError("INTENT_SCHEMA_INVALID", "Invalid active_intents.yaml: malformed intent fields")
	}
	return { intents }
}

export async function loadIntentCatalog(cwd: string): Promise<IntentFileShape> {
	const target = filePath(cwd)
	let stat
	try {
		stat = await fs.stat(target)
	} catch (error: any) {
		if (error?.code === "ENOENT") {
			throw new IntentLoadError("INTENT_FILE_MISSING", "Missing .orchestration/active_intents.yaml", {
				path: target,
			})
		}
		throw error
	}

	const cached = intentCache.get(target)
	if (cached && cached.mtimeMs === stat.mtimeMs) {
		return cached.data
	}

	let parsed: any
	try {
		const raw = await fs.readFile(target, "utf-8")
		parsed = parse(raw)
	} catch (error) {
		throw new IntentLoadError("INTENT_YAML_INVALID", "Invalid YAML in active_intents.yaml", {
			path: target,
			error: error instanceof Error ? error.message : String(error),
		})
	}

	const validated = validateData(parsed)
	intentCache.set(target, { mtimeMs: stat.mtimeMs, data: validated })
	return validated
}

export async function selectActiveIntent(taskId: string, cwd: string, intentId: string): Promise<IntentDefinition> {
	const catalog = await loadIntentCatalog(cwd)
	const intent = catalog.intents.find((item) => item.id === intentId)
	if (!intent) {
		throw new IntentLoadError("INTENT_NOT_FOUND", `Intent '${intentId}' does not exist in active_intents.yaml`, {
			intent_id: intentId,
		})
	}
	selectedIntentByTask.set(taskId, intentId)
	return intent
}

export async function getSelectedIntent(taskId: string, cwd: string): Promise<IntentDefinition | null> {
	const selectedId = selectedIntentByTask.get(taskId)
	if (!selectedId) {
		return null
	}
	const catalog = await loadIntentCatalog(cwd)
	return catalog.intents.find((item) => item.id === selectedId) ?? null
}

export function clearSelectedIntent(taskId: string): void {
	selectedIntentByTask.delete(taskId)
}

export async function commandSelectActiveIntent(cwd: string, intentId: string): Promise<IntentDefinition> {
	return selectActiveIntent(SELECTED_INTENT_SENTINEL_TASK, cwd, intentId)
}

export async function commandGetSelectedIntent(cwd: string): Promise<IntentDefinition | null> {
	return getSelectedIntent(SELECTED_INTENT_SENTINEL_TASK, cwd)
}

export function commandClearSelectedIntent(): void {
	clearSelectedIntent(SELECTED_INTENT_SENTINEL_TASK)
}

export async function ensureIntentCatalogFile(cwd: string): Promise<void> {
	const target = filePath(cwd)
	await fs.mkdir(path.dirname(target), { recursive: true })
	try {
		await fs.access(target)
	} catch (error: any) {
		if (error?.code !== "ENOENT") {
			throw error
		}
		const example: IntentFileShape = {
			intents: [
				{
					id: "INT-001",
					title: "Governance Hook Layer",
					description: "Implement deterministic lifecycle hooks and policy checks.",
					scope: ["src/hooks/**", "src/core/assistant-message/**"],
					acceptanceCriteria: ["preToolUse and postToolUse run for every tool call"],
				},
			],
		}
		await fs.writeFile(target, stringify(example), "utf-8")
	}
}
