/**
 * Post-Hook: Trace Ledger
 *
 * After every file write, this hook:
 * 1. Computes a SHA-256 hash of the written content (spatial independence)
 * 2. Gets the current git commit SHA for VCS linkage
 * 3. Classifies the change (AST_REFACTOR vs INTENT_EVOLUTION)
 * 4. Appends a JSON record to .orchestration/agent_trace.jsonl
 *
 * This is the cryptographic proof that links:
 *   Business Intent → AI Action → Code Hash
 */

import fs from "fs/promises"
import { execSync } from "child_process"
import { v4 as uuidv4 } from "uuid"
import { MutationClass, TraceRecord } from "../types"
import { computeContentHash, countLines } from "../utils/contentHash"
import { getTraceLedgerPath, getOrchestrationDir } from "../utils/orchestrationPaths"

interface TraceLedgerContext {
	taskId: string
	cwd: string
	intentId: string | null
	filePath: string // relative path of the written file
	content: string // the content that was written
	modelId: string // e.g. "claude-3-5-sonnet"
	mutationClass?: MutationClass
}

/**
 * Get the current git revision SHA (short).
 * Returns "unknown" if git is not available.
 */
function getGitRevision(cwd: string): string {
	try {
		return execSync("git rev-parse --short HEAD", { cwd, stdio: ["pipe", "pipe", "pipe"] })
			.toString()
			.trim()
	} catch {
		return "unknown"
	}
}

/**
 * Classify the mutation type based on simple heuristics.
 * A real implementation would use AST diffing.
 *
 * - INTENT_EVOLUTION: file is new (didn't exist before) → new feature
 * - AST_REFACTOR: file existed → structural change preserving intent
 */
function classifyMutation(filePath: string, isNewFile: boolean): MutationClass {
	if (isNewFile) {
		return "INTENT_EVOLUTION"
	}
	return "AST_REFACTOR"
}

/**
 * Append a trace record to agent_trace.jsonl.
 * Each line is a self-contained JSON object (JSONL format).
 */
export async function appendTraceRecord(ctx: TraceLedgerContext): Promise<void> {
	try {
		// Ensure .orchestration/ directory exists
		const orchestrationDir = getOrchestrationDir(ctx.cwd)
		await fs.mkdir(orchestrationDir, { recursive: true })

		const ledgerPath = getTraceLedgerPath(ctx.cwd)

		// Determine if this is a new file (for mutation classification)
		let isNewFile = false
		try {
			await fs.access(`${ctx.cwd}/${ctx.filePath}`)
		} catch {
			isNewFile = true
		}

		const contentHash = computeContentHash(ctx.content)
		const lineCount = countLines(ctx.content)
		const mutationClass = ctx.mutationClass ?? classifyMutation(ctx.filePath, isNewFile)
		const gitRevision = getGitRevision(ctx.cwd)

		const record: TraceRecord = {
			id: uuidv4(),
			timestamp: new Date().toISOString(),
			intent_id: ctx.intentId,
			vcs: { revision_id: gitRevision },
			files: [
				{
					relative_path: ctx.filePath,
					contributor: {
						entity_type: "AI",
						model_identifier: ctx.modelId,
					},
					ranges: [
						{
							start_line: 1,
							end_line: lineCount,
							content_hash: contentHash,
						},
					],
					mutation_class: mutationClass,
					related: ctx.intentId ? [{ type: "specification", value: ctx.intentId }] : [],
				},
			],
		}

		// Append one JSON line (JSONL = one record per line, append-only)
		await fs.appendFile(ledgerPath, JSON.stringify(record) + "\n", "utf-8")
	} catch (error) {
		// Trace failure must NOT crash the agent — log and continue
		console.error("[TraceLedger] Failed to append trace record:", error)
	}
}
