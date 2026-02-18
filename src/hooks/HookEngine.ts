import crypto from "crypto"
import fs from "fs/promises"
import path from "path"
import { execFile } from "child_process"
import { promisify } from "util"

import type { ToolName } from "@roo-code/types"

import type { ToolUse } from "../shared/tools"
import { Task } from "../core/task/Task"
import { type ActiveIntentRecord, type AgentTraceRecord, OrchestrationStore } from "./OrchestrationStore"
import { IntentContextService } from "./IntentContextService"

const execFileAsync = promisify(execFile)

const MUTATING_TOOLS = new Set<ToolName>([
	"write_to_file",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
	"apply_patch",
	"generate_image",
])

const APPLY_PATCH_FILE_MARKERS = ["*** Add File: ", "*** Delete File: ", "*** Update File: ", "*** Move to: "] as const

interface ExtractedPaths {
	insideWorkspacePaths: string[]
	outsideWorkspacePaths: string[]
}

export interface HookPreToolUseContext {
	toolName: string
	isMutatingTool: boolean
	intentId?: string
	intent?: ActiveIntentRecord
	touchedPaths: string[]
	hadToolFailureBefore: boolean
}

export interface HookPreToolUseResult {
	allowExecution: boolean
	errorMessage?: string
	context: HookPreToolUseContext
}

function normalizePathLike(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined
	}

	const normalized = value.trim()
	return normalized.length > 0 ? normalized : undefined
}

function globToRegExp(globPattern: string): RegExp {
	const normalized = globPattern.trim().replace(/\\/g, "/").replace(/^\.\//, "")
	const escaped = normalized
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*\*/g, "__DOUBLE_STAR__")
		.replace(/\*/g, "[^/]*")
		.replace(/__DOUBLE_STAR__/g, ".*")

	return new RegExp(`^${escaped}$`)
}

function toUnique(values: string[]): string[] {
	return Array.from(new Set(values))
}

export class HookEngine {
	async preToolUse(task: Task, block: ToolUse): Promise<HookPreToolUseResult> {
		const toolName = String(block.name)
		const isMutatingTool = MUTATING_TOOLS.has(block.name as ToolName)
		const workspacePath = this.getWorkspacePath(task)
		if (!workspacePath) {
			return {
				allowExecution: true,
				context: {
					toolName,
					isMutatingTool,
					touchedPaths: [],
					hadToolFailureBefore: task.didToolFailInCurrentTurn,
				},
			}
		}

		const store = new OrchestrationStore(workspacePath)
		await store.ensureInitialized()

		const extractedPaths = this.extractTouchedPaths(workspacePath, block)
		const context: HookPreToolUseContext = {
			toolName,
			isMutatingTool,
			touchedPaths: extractedPaths.insideWorkspacePaths,
			hadToolFailureBefore: task.didToolFailInCurrentTurn,
		}

		if (toolName === "select_active_intent") {
			const requestedIntentId = this.extractRequestedIntentId(block)
			if (requestedIntentId) {
				const intentContextService = new IntentContextService(store)
				await intentContextService.markIntentInProgress(requestedIntentId)
			}

			return { allowExecution: true, context }
		}

		if (!isMutatingTool) {
			return { allowExecution: true, context }
		}

		if (extractedPaths.outsideWorkspacePaths.length > 0) {
			return {
				allowExecution: false,
				context,
				errorMessage:
					`PreToolUse denied ${toolName}: attempted to mutate paths outside the workspace boundary. ` +
					`Paths: ${extractedPaths.outsideWorkspacePaths.join(", ")}`,
			}
		}

		const activeIntentId = task.activeIntentId?.trim()
		if (!activeIntentId) {
			return {
				allowExecution: false,
				context,
				errorMessage: `PreToolUse denied ${toolName}: no active intent selected. Call select_active_intent before mutating code.`,
			}
		}

		const intent = await store.findIntentById(activeIntentId)
		if (!intent) {
			return {
				allowExecution: false,
				context,
				errorMessage: `PreToolUse denied ${toolName}: active intent '${activeIntentId}' not found in .orchestration/active_intents.yaml.`,
			}
		}

		context.intentId = intent.id
		context.intent = intent

		if (intent.owned_scope.length > 0 && extractedPaths.insideWorkspacePaths.length > 0) {
			const disallowedPaths = extractedPaths.insideWorkspacePaths.filter(
				(filePath) => !this.pathMatchesOwnedScope(filePath, intent.owned_scope),
			)

			if (disallowedPaths.length > 0) {
				await store.appendSharedBrainEntry(
					`Scope violation blocked for intent ${intent.id}. Disallowed paths: ${disallowedPaths.join(", ")}`,
				)
				return {
					allowExecution: false,
					context,
					errorMessage:
						`PreToolUse denied ${toolName}: path(s) outside owned_scope for intent ${intent.id}. ` +
						`Disallowed: ${disallowedPaths.join(", ")}`,
				}
			}
		}

		await store.appendRecentHistory(intent.id, `PRE_HOOK ${toolName}`)
		return { allowExecution: true, context }
	}

	async postToolUse(
		task: Task,
		block: ToolUse,
		context: HookPreToolUseContext,
		executionSucceeded: boolean,
	): Promise<void> {
		const workspacePath = this.getWorkspacePath(task)
		if (!workspacePath) {
			return
		}

		const store = new OrchestrationStore(workspacePath)
		await store.ensureInitialized()

		if (context.intentId) {
			const statusLabel = executionSucceeded ? "OK" : "FAILED"
			await store.appendRecentHistory(context.intentId, `POST_HOOK ${context.toolName} ${statusLabel}`)
		}

		if (context.toolName === "attempt_completion" && executionSucceeded && task.activeIntentId) {
			const intentContextService = new IntentContextService(store)
			await intentContextService.markIntentCompleted(task.activeIntentId)
			await store.appendSharedBrainEntry(`Intent ${task.activeIntentId} marked COMPLETED by attempt_completion.`)
			return
		}

		if (!context.isMutatingTool || !context.intentId) {
			return
		}

		if (!executionSucceeded) {
			await store.appendSharedBrainEntry(
				`Mutating tool ${context.toolName} failed for intent ${context.intentId}. Verification or retry needed.`,
			)
			return
		}

		const traceRecord = await this.buildTraceRecord(task, context)
		if (traceRecord.files.length === 0) {
			return
		}

		await store.appendTraceRecord(traceRecord)
		if (context.intent) {
			await store.appendIntentMapEntry(context.intent, context.touchedPaths)
		}
	}

	private getWorkspacePath(task: Task): string | undefined {
		const fromWorkspacePath = (task as Task & { workspacePath?: string }).workspacePath
		if (typeof fromWorkspacePath === "string" && fromWorkspacePath.trim().length > 0) {
			return fromWorkspacePath.trim()
		}

		const cwd = task.cwd
		if (typeof cwd === "string" && cwd.trim().length > 0) {
			return cwd.trim()
		}

		return undefined
	}

	private extractRequestedIntentId(block: ToolUse): string | undefined {
		const nativeArgs = block.nativeArgs as Record<string, unknown> | undefined
		const fromNative = normalizePathLike(nativeArgs?.intent_id)
		if (fromNative) {
			return fromNative
		}

		return normalizePathLike(block.params.intent_id)
	}

	private extractTouchedPaths(cwd: string, block: ToolUse): ExtractedPaths {
		const nativeArgs = (block.nativeArgs as Record<string, unknown> | undefined) ?? {}
		const fallbackParams = block.params
		const pathCandidates: string[] = []

		const add = (value: unknown) => {
			const normalized = normalizePathLike(value)
			if (normalized) {
				pathCandidates.push(normalized)
			}
		}

		switch (block.name) {
			case "write_to_file":
			case "apply_diff":
				add(nativeArgs.path ?? fallbackParams.path)
				break

			case "edit":
			case "search_and_replace":
			case "search_replace":
			case "edit_file":
				add(nativeArgs.file_path ?? fallbackParams.file_path ?? fallbackParams.path)
				break

			case "generate_image":
				add(nativeArgs.path ?? fallbackParams.path)
				break

			case "apply_patch": {
				const patch = normalizePathLike(nativeArgs.patch ?? fallbackParams.patch)
				if (patch) {
					for (const line of patch.split(/\r?\n/)) {
						for (const marker of APPLY_PATCH_FILE_MARKERS) {
							if (line.startsWith(marker)) {
								add(line.slice(marker.length))
								break
							}
						}
					}
				}
				break
			}

			default:
				break
		}

		const insideWorkspacePaths: string[] = []
		const outsideWorkspacePaths: string[] = []

		for (const candidate of toUnique(pathCandidates)) {
			const normalized = this.normalizeWorkspaceRelativePath(cwd, candidate)
			if (normalized) {
				insideWorkspacePaths.push(normalized)
			} else {
				outsideWorkspacePaths.push(candidate)
			}
		}

		return {
			insideWorkspacePaths,
			outsideWorkspacePaths,
		}
	}

	private normalizeWorkspaceRelativePath(cwd: string, candidatePath: string): string | null {
		const resolved = path.isAbsolute(candidatePath) ? path.resolve(candidatePath) : path.resolve(cwd, candidatePath)
		const relative = path.relative(cwd, resolved)
		if (relative.startsWith("..") || path.isAbsolute(relative)) {
			return null
		}

		return relative.replace(/\\/g, "/")
	}

	private pathMatchesOwnedScope(relativePath: string, ownedScope: string[]): boolean {
		const normalizedPath = relativePath.replace(/\\/g, "/").replace(/^\.\//, "")
		return ownedScope.some((pattern) => {
			const normalizedPattern = pattern.replace(/\\/g, "/").replace(/^\.\//, "")
			const regex = globToRegExp(normalizedPattern)
			return regex.test(normalizedPath)
		})
	}

	private async buildTraceRecord(task: Task, context: HookPreToolUseContext): Promise<AgentTraceRecord> {
		const files = []
		for (const relativePath of toUnique(context.touchedPaths)) {
			const absolutePath = path.join(task.cwd, relativePath)

			let fileBuffer: Buffer
			try {
				fileBuffer = await fs.readFile(absolutePath)
			} catch {
				// Deleted/non-text files still emit a stable empty hash range.
				fileBuffer = Buffer.alloc(0)
			}

			const contentHash = `sha256:${crypto.createHash("sha256").update(fileBuffer).digest("hex")}`
			const text = fileBuffer.toString("utf8")
			const lineCount = text.length === 0 ? 0 : text.split(/\r?\n/).length

			files.push({
				relative_path: relativePath,
				conversations: [
					{
						url: task.taskId,
						contributor: {
							entity_type: "AI" as const,
							model_identifier: task.api.getModel().id,
						},
						ranges: [
							{
								start_line: lineCount > 0 ? 1 : 0,
								end_line: lineCount,
								content_hash: contentHash,
							},
						],
						related: [{ type: "specification" as const, value: context.intentId! }],
					},
				],
			})
		}

		return {
			id: crypto.randomUUID(),
			timestamp: new Date().toISOString(),
			vcs: {
				revision_id: await this.getGitRevision(task.cwd),
			},
			files,
		}
	}

	private async getGitRevision(cwd: string): Promise<string> {
		try {
			const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd })
			const revision = stdout.trim()
			return revision.length > 0 ? revision : "UNKNOWN"
		} catch {
			return "UNKNOWN"
		}
	}
}

export const hookEngine = new HookEngine()

// hook-smoke
