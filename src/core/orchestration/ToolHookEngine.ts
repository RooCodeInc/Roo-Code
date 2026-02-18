import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import { execSync } from "child_process"
import * as yaml from "yaml"

import type { AskApproval, ToolResponse } from "../../shared/tools"
import type { Task } from "../task/Task"

type MutationClass = "AST_REFACTOR" | "INTENT_EVOLUTION"
type CommandClass = "SAFE" | "DESTRUCTIVE"

interface ActiveIntent {
	id: string
	name?: string
	status?: string
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
}

interface ActiveIntentsYaml {
	active_intents?: ActiveIntent[]
}

interface RuntimeState {
	turnStartedAtMs: number
	turnIntentSelected: boolean
	activeIntent?: ActiveIntent
	activeIntentContext?: string
	observedFileHashes: Map<string, string | null>
	writtenFilesThisTurn: Set<string>
}

interface FileSnapshot {
	absolutePath: string
	relativePath: string
	existed: boolean
	beforeHash: string | null
	beforeContent: string
}

export interface OrchestrationPreHookContext {
	toolName: string
	intentId?: string
	mutationClass?: MutationClass
	relatedRequirementIds: string[]
	targets: FileSnapshot[]
	command?: string
	commandClass?: CommandClass
}

export interface OrchestrationPreHookResult {
	blocked: boolean
	errorResult?: string
	alreadyHandled?: boolean
	preApproved?: boolean
	context?: OrchestrationPreHookContext
}

interface OrchestrationPreHookInput {
	task: Task
	toolName: string
	toolArgs?: Record<string, unknown>
	askApproval: AskApproval
}

interface OrchestrationPostHookInput {
	task: Task
	context: OrchestrationPreHookContext
	toolResult?: ToolResponse
}

const runtimeStates = new WeakMap<Task, RuntimeState>()

const ORCHESTRATION_DIR = ".orchestration"
const ACTIVE_INTENTS_FILE = "active_intents.yaml"
const TRACE_LEDGER_FILE = "agent_trace.jsonl"
const INTENT_MAP_FILE = "intent_map.md"
const INTENT_IGNORE_FILE = ".intentignore"
const DEFAULT_TRACE_REQUIREMENT_IDS = ["REQ-TRACE-001", "REQ-TRACE-002", "REQ-TRACE-003", "REQ-TRACE-004"]
const ALLOWED_MUTATION_CLASSES = new Set<MutationClass>(["AST_REFACTOR", "INTENT_EVOLUTION"])

const WRITE_TOOLS = new Set<string>([
	"write_to_file",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
	"apply_patch",
	"generate_image",
])

function getRuntimeState(task: Task): RuntimeState {
	const existing = runtimeStates.get(task)
	if (existing) {
		return existing
	}

	const created: RuntimeState = {
		turnStartedAtMs: Date.now(),
		turnIntentSelected: false,
		observedFileHashes: new Map(),
		writtenFilesThisTurn: new Set(),
	}
	runtimeStates.set(task, created)
	return created
}

export function markOrchestrationTurnStart(task: Task): void {
	const state = getRuntimeState(task)
	state.turnStartedAtMs = Date.now()
	state.turnIntentSelected = false
	state.observedFileHashes.clear()
	state.writtenFilesThisTurn.clear()
}

export async function selectActiveIntentForTask(
	task: Task,
	intentId: string,
): Promise<{ ok: true; context: string } | { ok: false; errorResult: string }> {
	if (!intentId || !intentId.trim()) {
		return {
			ok: false,
			errorResult: createStructuredError(
				"invalid_intent",
				"Missing required intent_id. Call select_active_intent with a valid intent identifier.",
			),
		}
	}

	await ensureOrchestrationScaffold(task.cwd)
	const intentsResult = await loadActiveIntents(task.cwd)
	if (!intentsResult.ok) {
		return { ok: false, errorResult: intentsResult.errorResult }
	}

	const selected = intentsResult.intents.find((intent) => intent.id === intentId)
	if (!selected) {
		const availableIds = intentsResult.intents.map((intent) => intent.id)
		return {
			ok: false,
			errorResult: createStructuredError(
				"invalid_intent",
				`Intent '${intentId}' was not found in .orchestration/${ACTIVE_INTENTS_FILE}.`,
				availableIds.length > 0
					? {
							available_intents: availableIds,
						}
					: undefined,
			),
		}
	}

	const recentTraceEntries = await loadRecentTraceForIntent(task.cwd, selected.id, 12)
	const context = buildIntentContext(selected, recentTraceEntries)

	const state = getRuntimeState(task)
	state.activeIntent = selected
	state.activeIntentContext = context
	state.turnIntentSelected = true

	return { ok: true, context }
}

export async function runOrchestrationPreToolHook(
	input: OrchestrationPreHookInput,
): Promise<OrchestrationPreHookResult> {
	const { task, toolName, toolArgs, askApproval } = input
	const state = getRuntimeState(task)

	const context: OrchestrationPreHookContext = {
		toolName,
		intentId: state.activeIntent?.id,
		relatedRequirementIds: DEFAULT_TRACE_REQUIREMENT_IDS,
		targets: [],
	}

	if (toolName === "select_active_intent") {
		return { blocked: false, preApproved: false, context }
	}

	const commandClass =
		toolName === "execute_command" ? classifyCommand((toolArgs?.command as string | undefined) ?? "") : "SAFE"
	const isCommandMutation = toolName === "execute_command" && commandClass === "DESTRUCTIVE"
	const isWriteMutation = WRITE_TOOLS.has(toolName)
	const isMutation = isWriteMutation || isCommandMutation

	if (isMutation && (!state.activeIntent || !state.turnIntentSelected)) {
		return {
			blocked: true,
			errorResult: createStructuredError(
				"intent_required",
				"Valid intent_id required. Call select_active_intent(intent_id) as the first tool action before mutation.",
			),
		}
	}

	if (isMutation && state.activeIntent?.id) {
		const ignoredIntents = await loadIgnoredIntents(task.cwd)
		if (ignoredIntents.has(state.activeIntent.id)) {
			return {
				blocked: true,
				errorResult: createStructuredError(
					"intent_ignored",
					`Intent '${state.activeIntent.id}' is excluded by ${INTENT_IGNORE_FILE} and cannot perform mutations. Remove it from ${INTENT_IGNORE_FILE} or select another intent.`,
				),
			}
		}
	}

	if (toolName === "execute_command") {
		context.command = (toolArgs?.command as string | undefined) ?? ""
		context.commandClass = commandClass
	}

	if (!isMutation) {
		return { blocked: false, preApproved: false, context }
	}

	if (isWriteMutation) {
		const declaredIntentId = asString(toolArgs?.intent_id)?.trim()
		if (!declaredIntentId) {
			return {
				blocked: true,
				errorResult: createStructuredError(
					"intent_required",
					`Write tool '${toolName}' requires intent_id in tool arguments.`,
				),
			}
		}

		if (declaredIntentId !== state.activeIntent?.id) {
			return {
				blocked: true,
				errorResult: createStructuredError(
					"intent_mismatch",
					`Intent mismatch: active intent is '${state.activeIntent?.id ?? "UNKNOWN"}' but tool declared '${declaredIntentId}'.`,
				),
			}
		}

		const declaredMutationClassValue = asString(toolArgs?.mutation_class)?.trim()
		if (!declaredMutationClassValue || !ALLOWED_MUTATION_CLASSES.has(declaredMutationClassValue as MutationClass)) {
			return {
				blocked: true,
				errorResult: createStructuredError(
					"mutation_class_required",
					`Write tool '${toolName}' requires mutation_class in {AST_REFACTOR, INTENT_EVOLUTION}.`,
				),
			}
		}

		context.intentId = declaredIntentId
		context.mutationClass = declaredMutationClassValue as MutationClass

		const rawTargets = extractWriteTargets(toolName, toolArgs)
		if (rawTargets.length === 0) {
			return {
				blocked: true,
				errorResult: createStructuredError(
					"scope_validation_failed",
					`Unable to determine write targets for tool '${toolName}'.`,
				),
			}
		}

		for (const rawTarget of rawTargets) {
			const absolutePath = path.resolve(task.cwd, rawTarget)
			const relativePath = normalizeToPosix(path.relative(task.cwd, absolutePath))

			if (!isInOwnedScope(relativePath, state.activeIntent?.owned_scope ?? [])) {
				return {
					blocked: true,
					errorResult: createStructuredError(
						"scope_violation",
						`Scope Violation: ${state.activeIntent?.id ?? "UNKNOWN"} is not authorized to edit ${relativePath}. Request scope expansion.`,
					),
				}
			}

			const snapshot = await readSnapshot(absolutePath, relativePath)
			const staleError = await checkStaleFile(state, snapshot)
			if (staleError) {
				return {
					blocked: true,
					errorResult: createStructuredError("stale_file", staleError, {
						file: relativePath,
					}),
				}
			}

			context.targets.push(snapshot)
		}
	}

	const destructive = isWriteMutation || isCommandMutation
	if (!destructive) {
		return { blocked: false, preApproved: false, context }
	}

	const approvalPayload = JSON.stringify({
		tool: "orchestration_pre_hook",
		tool_name: toolName,
		classification: "DESTRUCTIVE",
		intent_id: state.activeIntent?.id ?? null,
		targets: context.targets.map((target) => target.relativePath),
		command_class: context.commandClass,
		command: context.command,
	})

	const didApprove = await askApproval("tool", approvalPayload)
	if (!didApprove) {
		return { blocked: true, alreadyHandled: true }
	}

	return {
		blocked: false,
		preApproved: true,
		context,
	}
}

export async function runOrchestrationPostToolHook(input: OrchestrationPostHookInput): Promise<void> {
	const { task, context, toolResult } = input
	if (didToolResultFail(toolResult)) {
		return
	}

	const state = getRuntimeState(task)

	if (WRITE_TOOLS.has(context.toolName) && context.targets.length > 0 && context.intentId) {
		await ensureOrchestrationScaffold(task.cwd)

		const modifiedRanges: Array<{
			file: string
			old_range: { start_line: number; end_line: number }
			new_range: { start_line: number; end_line: number }
			content_hash: string
			before_hash: string | null
			after_hash: string | null
		}> = []

		for (const target of context.targets) {
			const afterSnapshot = await readSnapshot(target.absolutePath, target.relativePath)

			state.writtenFilesThisTurn.add(target.absolutePath)
			state.observedFileHashes.set(target.absolutePath, afterSnapshot.beforeHash)

			if (target.beforeHash === afterSnapshot.beforeHash) {
				continue
			}

			const range = computeModifiedRange(target.beforeContent, afterSnapshot.beforeContent)
			modifiedRanges.push({
				file: target.relativePath,
				old_range: range.oldRange,
				new_range: range.newRange,
				content_hash: range.contentHash,
				before_hash: target.beforeHash,
				after_hash: afterSnapshot.beforeHash,
			})
		}

		if (modifiedRanges.length > 0) {
			const traceEntry = {
				id: crypto.randomUUID(),
				timestamp: new Date().toISOString(),
				revision_id: await getRevisionId(task.cwd),
				intent_id: context.intentId,
				related_requirements: context.relatedRequirementIds,
				mutation_class: context.mutationClass ?? "AST_REFACTOR",
				tool_name: context.toolName,
				modified_ranges: modifiedRanges,
			}

			await appendJsonLine(path.join(task.cwd, ORCHESTRATION_DIR, TRACE_LEDGER_FILE), traceEntry)

			if (traceEntry.mutation_class === "INTENT_EVOLUTION") {
				await appendIntentMapUpdate(
					task.cwd,
					context.intentId,
					modifiedRanges.map((entry) => entry.file),
				)
			}
		}
	}

	if (context.toolName === "execute_command" && context.command) {
		const lowerCommand = context.command.toLowerCase()
		const verificationCommand = /(test|lint|typecheck|check-types|ci)/.test(lowerCommand)
		if (verificationCommand && didCommandOutputFail(toolResult)) {
			await appendLessonLearned(task.cwd, context.command)
		}
	}
}

function createStructuredError(type: string, message: string, extra?: Record<string, unknown>): string {
	return JSON.stringify({
		status: "error",
		type,
		message,
		...(extra ?? {}),
	})
}

async function ensureOrchestrationScaffold(cwd: string): Promise<void> {
	const orchestrationDir = path.join(cwd, ORCHESTRATION_DIR)
	await fs.mkdir(orchestrationDir, { recursive: true })

	await ensureFile(path.join(orchestrationDir, TRACE_LEDGER_FILE), "")
	await ensureFile(path.join(orchestrationDir, INTENT_MAP_FILE), "# Intent Map\n\n")
}

async function ensureFile(filePath: string, defaultContent: string): Promise<void> {
	try {
		await fs.access(filePath)
	} catch {
		await fs.writeFile(filePath, defaultContent, "utf-8")
	}
}

async function loadActiveIntents(
	cwd: string,
): Promise<{ ok: true; intents: ActiveIntent[] } | { ok: false; errorResult: string }> {
	const intentsPath = path.join(cwd, ORCHESTRATION_DIR, ACTIVE_INTENTS_FILE)
	try {
		const raw = await fs.readFile(intentsPath, "utf-8")
		const parsed = (yaml.parse(raw) as ActiveIntentsYaml | null) ?? {}
		const intents = Array.isArray(parsed.active_intents) ? parsed.active_intents : []

		const normalized = intents
			.filter((intent) => typeof intent?.id === "string" && intent.id.trim().length > 0)
			.map((intent) => ({
				id: intent.id,
				name: intent.name,
				status: intent.status,
				owned_scope: Array.isArray(intent.owned_scope) ? intent.owned_scope.filter(Boolean) : [],
				constraints: Array.isArray(intent.constraints) ? intent.constraints.filter(Boolean) : [],
				acceptance_criteria: Array.isArray(intent.acceptance_criteria)
					? intent.acceptance_criteria.filter(Boolean)
					: [],
			}))

		return { ok: true, intents: normalized }
	} catch (error: any) {
		if (error?.code === "ENOENT") {
			return {
				ok: false,
				errorResult: createStructuredError(
					"missing_intents",
					`Missing required .orchestration/${ACTIVE_INTENTS_FILE}. Define at least one intent before mutation.`,
				),
			}
		}

		return {
			ok: false,
			errorResult: createStructuredError(
				"intent_parse_failed",
				`Failed to parse .orchestration/${ACTIVE_INTENTS_FILE}: ${error instanceof Error ? error.message : String(error)}`,
			),
		}
	}
}

function buildIntentContext(intent: ActiveIntent, recentTrace: Array<Record<string, unknown>>): string {
	const ownedScopeXml = intent.owned_scope.map((scope) => `    <path>${escapeXml(scope)}</path>`).join("\n")
	const constraintsXml = intent.constraints
		.map((constraint) => `    <rule>${escapeXml(constraint)}</rule>`)
		.join("\n")
	const recentTraceXml = recentTrace
		.map((entry) => {
			const timestamp = escapeXml(String(entry.timestamp ?? ""))
			const mutationClass = escapeXml(String(entry.mutation_class ?? ""))
			const files = Array.isArray(entry.modified_ranges)
				? (entry.modified_ranges as Array<Record<string, unknown>>)
						.map((range) => String(range.file ?? ""))
						.filter(Boolean)
						.join(", ")
				: ""
			return `    <entry timestamp="${timestamp}" mutation_class="${mutationClass}" files="${escapeXml(files)}" />`
		})
		.join("\n")

	return `<intent_context>
  <intent id="${escapeXml(intent.id)}">
  <owned_scope>
${ownedScopeXml || "    <path />"}
  </owned_scope>
  <constraints>
${constraintsXml || "    <rule />"}
  </constraints>
  <recent_trace>
${recentTraceXml || "    <entry />"}
  </recent_trace>
  </intent>
</intent_context>`
}

async function loadRecentTraceForIntent(
	cwd: string,
	intentId: string,
	limit: number,
): Promise<Array<Record<string, unknown>>> {
	const tracePath = path.join(cwd, ORCHESTRATION_DIR, TRACE_LEDGER_FILE)
	try {
		const raw = await fs.readFile(tracePath, "utf-8")
		const lines = raw
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean)

		const parsed = lines
			.map((line) => {
				try {
					return JSON.parse(line) as Record<string, unknown>
				} catch {
					return undefined
				}
			})
			.filter((entry): entry is Record<string, unknown> => !!entry)
			.filter((entry) => entry.intent_id === intentId)

		return parsed.slice(-limit)
	} catch {
		return []
	}
}

async function loadIgnoredIntents(cwd: string): Promise<Set<string>> {
	const intentIgnorePath = path.join(cwd, INTENT_IGNORE_FILE)
	try {
		const raw = await fs.readFile(intentIgnorePath, "utf-8")
		const entries = raw
			.split(/\r?\n/)
			.map((line) => line.split("#")[0]?.trim() ?? "")
			.filter(Boolean)
			.map((line) => {
				const [intentId] = line.split(":")
				return (intentId ?? "").trim()
			})
			.filter(Boolean)
		return new Set(entries)
	} catch (error: any) {
		if (error?.code === "ENOENT") {
			return new Set()
		}
		return new Set()
	}
}

function normalizeToPosix(filePath: string): string {
	return filePath.replaceAll("\\", "/")
}

function isInOwnedScope(relativePath: string, ownedScope: string[]): boolean {
	const normalizedPath = normalizeToPosix(relativePath)
	return ownedScope.some((pattern) => globMatch(normalizedPath, normalizeToPosix(pattern)))
}

function globMatch(filePath: string, pattern: string): boolean {
	const escaped = pattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*\*/g, "___DOUBLE_STAR___")
		.replace(/\*/g, "[^/]*")
		.replace(/___DOUBLE_STAR___/g, ".*")
	const regex = new RegExp(`^${escaped}$`)
	return regex.test(filePath)
}

async function readSnapshot(absolutePath: string, relativePath: string): Promise<FileSnapshot> {
	try {
		const beforeContent = await fs.readFile(absolutePath, "utf-8")
		return {
			absolutePath,
			relativePath,
			existed: true,
			beforeHash: sha256(beforeContent),
			beforeContent,
		}
	} catch (error: any) {
		if (error?.code === "ENOENT") {
			return {
				absolutePath,
				relativePath,
				existed: false,
				beforeHash: null,
				beforeContent: "",
			}
		}
		throw error
	}
}

async function checkStaleFile(state: RuntimeState, snapshot: FileSnapshot): Promise<string | undefined> {
	if (state.writtenFilesThisTurn.has(snapshot.absolutePath)) {
		return undefined
	}

	try {
		const stat = await fs.stat(snapshot.absolutePath)
		if (stat.mtimeMs > state.turnStartedAtMs + 1) {
			return `Stale File: ${snapshot.relativePath} changed since the start of this turn. Re-read the file before writing.`
		}
	} catch {
		// Ignore stat failures for non-existent files.
	}

	const observed = state.observedFileHashes.get(snapshot.absolutePath)
	if (observed === undefined) {
		state.observedFileHashes.set(snapshot.absolutePath, snapshot.beforeHash)
		return undefined
	}

	if (observed !== snapshot.beforeHash) {
		return `Stale File: ${snapshot.relativePath} hash changed during the turn. Re-read before writing.`
	}

	return undefined
}

function extractWriteTargets(toolName: string, toolArgs?: Record<string, unknown>): string[] {
	switch (toolName) {
		case "write_to_file":
		case "apply_diff":
		case "generate_image":
			return asString(toolArgs?.path) ? [asString(toolArgs?.path)!] : []
		case "edit":
		case "search_and_replace":
		case "search_replace":
		case "edit_file":
			return asString(toolArgs?.file_path) ? [asString(toolArgs?.file_path)!] : []
		case "apply_patch":
			return parseApplyPatchTargets(asString(toolArgs?.patch) ?? "")
		default:
			return []
	}
}

function parseApplyPatchTargets(patch: string): string[] {
	const targets: string[] = []
	if (!patch) {
		return targets
	}

	const lines = patch.split(/\r?\n/)
	for (const line of lines) {
		if (line.startsWith("*** Add File: ")) {
			targets.push(line.slice("*** Add File: ".length).trim())
		} else if (line.startsWith("*** Update File: ")) {
			targets.push(line.slice("*** Update File: ".length).trim())
		} else if (line.startsWith("*** Delete File: ")) {
			targets.push(line.slice("*** Delete File: ".length).trim())
		}
	}

	return targets.filter(Boolean)
}

function asString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined
}

function classifyCommand(command: string): CommandClass {
	const normalized = command.toLowerCase()
	const destructivePatterns = [
		/[>|]{1,2}/,
		/\b(rm|del|remove-item|mv|move-item|cp|copy-item|mkdir|rmdir|touch|chmod|chown)\b/,
		/\b(git\s+(commit|push|reset|checkout|clean))\b/,
		/\b(npm|pnpm|yarn)\s+(install|add|remove|uninstall|update|upgrade)\b/,
		/\bsed\s+-i\b/,
	]
	return destructivePatterns.some((pattern) => pattern.test(normalized)) ? "DESTRUCTIVE" : "SAFE"
}

function sha256(content: string): string {
	return crypto.createHash("sha256").update(content).digest("hex")
}

function computeModifiedRange(
	beforeContent: string,
	afterContent: string,
): {
	oldRange: { start_line: number; end_line: number }
	newRange: { start_line: number; end_line: number }
	contentHash: string
} {
	const beforeLines = beforeContent.split("\n")
	const afterLines = afterContent.split("\n")

	let prefix = 0
	while (prefix < beforeLines.length && prefix < afterLines.length && beforeLines[prefix] === afterLines[prefix]) {
		prefix++
	}

	let suffix = 0
	while (
		suffix < beforeLines.length - prefix &&
		suffix < afterLines.length - prefix &&
		beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
	) {
		suffix++
	}

	const oldStart = prefix + 1
	const oldEnd = Math.max(prefix, beforeLines.length - suffix)
	const newStart = prefix + 1
	const newEnd = Math.max(prefix, afterLines.length - suffix)
	const changedSegment = afterLines.slice(prefix, Math.max(prefix, afterLines.length - suffix)).join("\n")

	return {
		oldRange: { start_line: oldStart, end_line: oldEnd },
		newRange: { start_line: newStart, end_line: newEnd },
		contentHash: sha256(changedSegment),
	}
}

async function appendJsonLine(filePath: string, value: Record<string, unknown>): Promise<void> {
	await fs.appendFile(filePath, `${JSON.stringify(value)}\n`, "utf-8")
}

async function getRevisionId(cwd: string): Promise<string> {
	try {
		const output = execSync("git rev-parse HEAD", {
			cwd,
			stdio: ["ignore", "pipe", "ignore"],
			encoding: "utf-8",
		})
		return output.trim()
	} catch {
		return "unknown"
	}
}

async function appendIntentMapUpdate(cwd: string, intentId: string, files: string[]): Promise<void> {
	const filePath = path.join(cwd, ORCHESTRATION_DIR, INTENT_MAP_FILE)
	const timestamp = new Date().toISOString()
	const uniqueFiles = [...new Set(files)]
	const lines = [`## ${timestamp} - ${intentId}`, ...uniqueFiles.map((file) => `- ${file}`), ""]
	await fs.appendFile(filePath, `${lines.join("\n")}\n`, "utf-8")
}

async function appendLessonLearned(cwd: string, command: string): Promise<void> {
	const claudePath = path.join(cwd, "CLAUDE.md")
	const agentPath = path.join(cwd, "AGENT.md")
	let target = agentPath

	try {
		await fs.access(claudePath)
		target = claudePath
	} catch {
		target = agentPath
	}

	const heading = "## Lessons Learned"
	const timestamp = new Date().toISOString()
	const line = `- ${timestamp}: Verification command failed (\`${command}\`). Re-run after fixing root cause and capture remediation notes.`

	let existing = ""
	try {
		existing = await fs.readFile(target, "utf-8")
	} catch {
		existing = ""
	}

	if (!existing.includes(heading)) {
		const seed =
			existing.trim().length > 0 ? `${existing.trim()}\n\n${heading}\n${line}\n` : `${heading}\n${line}\n`
		await fs.writeFile(target, seed, "utf-8")
		return
	}

	await fs.appendFile(target, `${line}\n`, "utf-8")
}

function didToolResultFail(toolResult?: ToolResponse): boolean {
	if (!toolResult) {
		return false
	}

	const text = normalizeToolResponseText(toolResult)
	if (!text) {
		return false
	}

	const normalized = text.toLowerCase()
	return normalized.includes('"status":"error"') || normalized.includes('"status":"denied"')
}

function didCommandOutputFail(toolResult?: ToolResponse): boolean {
	if (!toolResult) {
		return false
	}
	const text = normalizeToolResponseText(toolResult).toLowerCase()
	return (
		text.includes("command failed") ||
		text.includes("exit code: 1") ||
		text.includes("exit code: 2") ||
		text.includes("error") ||
		text.includes("failed")
	)
}

function normalizeToolResponseText(toolResult: ToolResponse): string {
	if (typeof toolResult === "string") {
		return toolResult
	}

	return toolResult
		.filter((block) => block.type === "text")
		.map((block) => (block as { text: string }).text)
		.join("\n")
}

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;")
}
