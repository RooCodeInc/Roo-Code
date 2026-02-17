import * as fs from "fs"
import * as path from "path"
import * as crypto from "crypto"
import * as vscode from "vscode"
import { v4 as uuidv4 } from "uuid"
import { IntentStore } from "./IntentStore"
import { TraceLogger } from "./TraceLogger"

// ============================================================
// Types
// ============================================================

export type MutationClass = "AST_REFACTOR" | "INTENT_EVOLUTION" | "SAFE_READ" | "CONFIG_CHANGE"
export type CommandClass = "safe" | "destructive"

export interface PreHookContext {
	toolName: string
	params: Record<string, any>
	activeIntentId: string | null
	cwd: string
}

export interface PostHookContext extends PreHookContext {
	result: any
	elapsedMs: number
}

export interface HookResult {
	allowed: boolean
	reason?: string
	injectedContext?: string
}

// ============================================================
// HookEngine - The Middleware Boundary for Intent-Driven Tool Execution
// ============================================================

/**
 * The Hook Engine is the strict middleware boundary that intercepts
 * every tool execution. It enforces:
 *  - Intent declaration before any destructive action (Pre-Hook)
 *  - Scope validation against active_intents.yaml
 *  - Trace logging to agent_trace.jsonl (Post-Hook)
 *  - Concurrency control via content hashing
 */
export class HookEngine {
	private intentStore: IntentStore
	private traceLogger: TraceLogger
	private activeIntentId: string | null = null
	private fileHashCache: Map<string, string> = new Map()

	// Tools that require an active intent before execution
	private readonly DESTRUCTIVE_TOOLS = new Set([
		"write_to_file",
		"apply_diff",
		"apply_patch",
		"search_and_replace",
		"execute_command",
		"edit_file",
	])

	// Tools that are always safe (read-only)
	private readonly SAFE_TOOLS = new Set([
		"read_file",
		"list_files",
		"search_files",
		"codebase_search",
		"list_code_definition_names",
	])

	constructor(private readonly cwd: string) {
		const orchestrationDir = path.join(cwd, ".orchestration")
		this.intentStore = new IntentStore(orchestrationDir)
		this.traceLogger = new TraceLogger(orchestrationDir)
		this.ensureOrchestrationDir(orchestrationDir)
	}

	// ============================================================
	// Public API
	// ============================================================

	/**
	 * Called by select_active_intent tool.
	 * Loads intent context and injects it into the agent's prompt.
	 */
	async selectIntent(intentId: string): Promise<string> {
		const intent = await this.intentStore.getIntent(intentId)

		if (!intent) {
			return `ERROR: Intent ID "${intentId}" not found in active_intents.yaml. Valid IDs: ${(await this.intentStore.listIntentIds()).join(", ")}`
		}

		this.activeIntentId = intentId

		// Build the XML context block to inject
		const context = `
<intent_context>
  <id>${intent.id}</id>
  <name>${intent.name}</name>
  <status>${intent.status}</status>
  <owned_scope>
    ${intent.owned_scope.map((s: string) => `<scope>${s}</scope>`).join("\n    ")}
  </owned_scope>
  <constraints>
    ${intent.constraints.map((c: string) => `<constraint>${c}</constraint>`).join("\n    ")}
  </constraints>
  <acceptance_criteria>
    ${intent.acceptance_criteria.map((a: string) => `<criterion>${a}</criterion>`).join("\n    ")}
  </acceptance_criteria>
</intent_context>

You have checked out intent ${intentId}. All subsequent file writes will be validated against its owned_scope. You may now proceed with contextualized actions.
`.trim()

		return context
	}

	/**
	 * PRE-HOOK: Called before any tool executes.
	 * Enforces intent declaration and scope validation.
	 */
	async preHook(ctx: PreHookContext): Promise<HookResult> {
		const { toolName, params } = ctx

		// Safe tools always pass
		if (this.SAFE_TOOLS.has(toolName)) {
			return { allowed: true }
		}

		// select_active_intent is always allowed (it's how you declare intent)
		if (toolName === "select_active_intent") {
			return { allowed: true }
		}

		// Destructive tools require an active intent
		if (this.DESTRUCTIVE_TOOLS.has(toolName)) {
			if (!this.activeIntentId) {
				return {
					allowed: false,
					reason: `INTENT_REQUIRED: You must call select_active_intent(intent_id) before executing "${toolName}". Load an intent to provide context for this action.`,
				}
			}

			// For file writes: validate scope
			if (toolName === "write_to_file" || toolName === "apply_diff" || toolName === "edit_file") {
				const targetPath = params.path
				if (targetPath) {
					const scopeCheck = await this.validateScope(targetPath, this.activeIntentId)
					if (!scopeCheck.valid) {
						return {
							allowed: false,
							reason: scopeCheck.reason,
						}
					}
				}

				// Concurrency check: detect stale files
				if (toolName === "write_to_file" && params.path) {
					const staleCheck = await this.checkConcurrency(params.path, params.content)
					if (!staleCheck.ok) {
						return {
							allowed: false,
							reason: staleCheck.reason,
						}
					}
				}
			}

			// For execute_command: show HITL approval via VS Code
			if (toolName === "execute_command") {
				const approved = await this.requestHumanApproval(
					`Allow command execution under intent ${this.activeIntentId}?`,
					params.command || "<unknown command>",
				)
				if (!approved) {
					return {
						allowed: false,
						reason: `HUMAN_REJECTED: The user rejected execution of command "${params.command}". Please reconsider the approach or ask for clarification.`,
					}
				}
			}
		}

		return { allowed: true }
	}

	/**
	 * POST-HOOK: Called after a tool executes successfully.
	 * Logs the trace entry to agent_trace.jsonl.
	 */
	async postHook(ctx: PostHookContext): Promise<void> {
		if (!this.DESTRUCTIVE_TOOLS.has(ctx.toolName)) return
		if (!this.activeIntentId) return

		if (ctx.toolName === "write_to_file" && ctx.params.path) {
			const relPath = ctx.params.path
			const content = ctx.params.content || ""
			const contentHash = this.hashContent(content)
			const mutationClass = this.classifyMutation(ctx.params)

			// Update file hash cache for future concurrency checks
			this.fileHashCache.set(relPath, contentHash)

			await this.traceLogger.appendTrace({
				id: uuidv4(),
				timestamp: new Date().toISOString(),
				intent_id: this.activeIntentId,
				tool: ctx.toolName,
				mutation_class: mutationClass,
				files: [
					{
						relative_path: relPath,
						content_hash: `sha256:${contentHash}`,
						contributor: {
							entity_type: "AI",
							model_identifier: "claude-sonnet",
						},
					},
				],
			})
		}
	}

	// ============================================================
	// Private Helpers
	// ============================================================

	private async validateScope(
		targetPath: string,
		intentId: string,
	): Promise<{ valid: boolean; reason?: string }> {
		const intent = await this.intentStore.getIntent(intentId)
		if (!intent) return { valid: true } // no intent loaded, skip check

		const normalizedTarget = targetPath.replace(/\\/g, "/")

		for (const scopePattern of intent.owned_scope) {
			if (this.matchesGlob(normalizedTarget, scopePattern)) {
				return { valid: true }
			}
		}

		return {
			valid: false,
			reason: `SCOPE_VIOLATION: Intent "${intentId}" is not authorized to write to "${targetPath}". Authorized scope: [${intent.owned_scope.join(", ")}]. Request scope expansion or select a different intent.`,
		}
	}

	private async checkConcurrency(
		relPath: string,
		newContent: string,
	): Promise<{ ok: boolean; reason?: string }> {
		const absolutePath = path.join(this.cwd, relPath)

		try {
			const diskContent = await fs.promises.readFile(absolutePath, "utf-8")
			const diskHash = this.hashContent(diskContent)
			const cachedHash = this.fileHashCache.get(relPath)

			// If we have a cached hash and disk differs from it, another agent modified the file
			if (cachedHash && diskHash !== cachedHash) {
				return {
					ok: false,
					reason: `STALE_FILE: "${relPath}" was modified by another agent since you last read it. Re-read the file to get the current state before writing.`,
				}
			}

			// Cache current disk hash as the baseline
			this.fileHashCache.set(relPath, diskHash)
		} catch {
			// File doesn't exist yet — new file, no concurrency issue
		}

		return { ok: true }
	}

	private async requestHumanApproval(title: string, detail: string): Promise<boolean> {
		const choice = await vscode.window.showWarningMessage(title, { detail, modal: true }, "Approve", "Reject")
		return choice === "Approve"
	}

	private hashContent(content: string): string {
		return crypto.createHash("sha256").update(content, "utf-8").digest("hex")
	}

	private classifyMutation(params: Record<string, any>): MutationClass {
		// Heuristic: if content contains structural markers like class/function definitions
		// without logic changes, it's a refactor; otherwise it's an evolution
		const content: string = params.content || ""
		const hasNewExports = /export\s+(class|function|const|interface)/.test(content)
		const hasNewRoutes = /(app\.|router\.)(get|post|put|delete|patch)/.test(content)

		if (hasNewExports || hasNewRoutes) {
			return "INTENT_EVOLUTION"
		}
		return "AST_REFACTOR"
	}

	private matchesGlob(filePath: string, pattern: string): boolean {
		// Simple glob matching: support ** and * wildcards
		const regexStr = pattern
			.replace(/\./g, "\\.")
			.replace(/\*\*/g, "(.+)")
			.replace(/\*/g, "([^/]+)")
		const regex = new RegExp(`^${regexStr}$`)
		return regex.test(filePath)
	}

	private ensureOrchestrationDir(dir: string): void {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true })
		}
	}

	// Expose for external use (e.g., injecting into system prompt)
	getActiveIntentId(): string | null {
		return this.activeIntentId
	}

	clearIntent(): void {
		this.activeIntentId = null
	}
}
