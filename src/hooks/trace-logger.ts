/**
 * Agent trace logger for agent_trace.jsonl
 *
 * This module prepares structured trace records for logging agent behavior.
 * Traces are written in JSONL format (one JSON object per line) for easy
 * analysis and replay.
 *
 * Use cases:
 * - Debugging agent behavior
 * - Compliance auditing
 * - Performance analysis
 * - Training data collection
 */

import * as vscode from "vscode"
import * as path from "path"
import * as crypto from "crypto"
import { exec } from "child_process"
import type { ToolName } from "@roo-code/types"
import type { AgentTraceRecord, TraceRecord } from "./types"

/**
 * Extended trace record matching Agent Trace specification
 */
interface TraceRecord {
	timestamp: string
	event_type: "tool_use" | "tool_result" | "approval_requested" | "approval_received"
	tool_name: ToolName
	task_id: string
	params?: Record<string, unknown>
	result?: unknown
	duration_ms?: number
	requires_approval?: boolean
	approved?: boolean
	content_hash?: string
	file_path?: string
	intent_id?: string
	model_id?: string
	mutation_type?: "new_feature" | "bug_fix" | "refactor" | "enhancement" | "deletion" | "unknown"
	contributor?: {
		type: "human" | "ai"
		id: string
	}
	related?: Array<{
		type: "intent" | "spec" | "parent_task"
		id: string
	}>
}

/**
 * Creates a trace record for a tool_use event.
 *
 * @param toolName - Name of the tool being invoked
 * @param params - Tool parameters (will be sanitized)
 * @param taskId - Task ID for correlation
 * @param requiresApproval - Whether the tool requires user approval
 * @returns Trace record ready for logging
 *
 * @example
 * const record = createToolUseTrace("write_to_file", { path: "test.ts" }, "task-123", true)
 * await appendToTraceLog(record)
 */
export function createToolUseTrace(
	toolName: ToolName,
	params: Record<string, unknown>,
	taskId: string,
	requiresApproval: boolean = false,
): AgentTraceRecord {
	// TODO: Implementation for Phase 1
	// Sanitize sensitive data from params (API keys, passwords, etc.)

	return {
		timestamp: new Date().toISOString(),
		eventType: "tool_use",
		toolName,
		params: sanitizeParams(params),
		requiresApproval,
		taskId,
	}
}

/**
 * Creates a trace record for a tool_result event.
 *
 * @param toolName - Name of the tool that was executed
 * @param result - Tool result (will be sanitized)
 * @param taskId - Task ID for correlation
 * @param duration - Execution duration in milliseconds
 * @returns Trace record ready for logging
 *
 * @example
 * const record = createToolResultTrace("execute_command", { output: "..." }, "task-123", 1500)
 * await appendToTraceLog(record)
 */
export function createToolResultTrace(
	toolName: ToolName,
	result: unknown,
	taskId: string,
	duration: number,
): AgentTraceRecord {
	// TODO: Implementation for Phase 1
	// Sanitize sensitive data from result

	return {
		timestamp: new Date().toISOString(),
		eventType: "tool_result",
		toolName,
		result: sanitizeResult(result),
		duration,
		taskId,
	}
}

/**
 * Creates a trace record for an approval request event.
 *
 * @param toolName - Name of the tool requiring approval
 * @param params - Tool parameters
 * @param taskId - Task ID for correlation
 * @returns Trace record ready for logging
 *
 * @example
 * const record = createApprovalRequestedTrace("execute_command", { command: "rm -rf" }, "task-123")
 * await appendToTraceLog(record)
 */
export function createApprovalRequestedTrace(
	toolName: ToolName,
	params: Record<string, unknown>,
	taskId: string,
): AgentTraceRecord {
	// TODO: Implementation for Phase 1

	return {
		timestamp: new Date().toISOString(),
		eventType: "approval_requested",
		toolName,
		params: sanitizeParams(params),
		requiresApproval: true,
		taskId,
	}
}

/**
 * Creates a trace record for an approval response event.
 *
 * @param toolName - Name of the tool that was approved/rejected
 * @param approved - Whether the user approved the action
 * @param taskId - Task ID for correlation
 * @returns Trace record ready for logging
 *
 * @example
 * const record = createApprovalReceivedTrace("execute_command", true, "task-123")
 * await appendToTraceLog(record)
 */
export function createApprovalReceivedTrace(toolName: ToolName, approved: boolean, taskId: string): AgentTraceRecord {
	// TODO: Implementation for Phase 1

	return {
		timestamp: new Date().toISOString(),
		eventType: "approval_received",
		toolName,
		approved,
		taskId,
	}
}

/**
 * Computes SHA-256 content hash for code spatial independence
 *
 * @param code - Code block to hash
 * @returns SHA-256 hash as hex string
 *
 * @example
 * const hash = computeContentHash("function hello() { return 'world' }")
 * // Returns: "a3c8f9e2..."
 */
export function computeContentHash(code: string): string {
	return crypto.createHash("sha256").update(code).digest("hex")
}

/**
 * Gets the current Git commit SHA
 *
 * @param cwd - Workspace root directory
 * @returns Git commit SHA or "unknown" if not in a git repo
 */
export async function computeGitSha(cwd?: string): Promise<string> {
	try {
		const workspaceFolder = cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
		if (!workspaceFolder) {
			return "unknown"
		}

		// Try to read .git/HEAD
		const gitHeadPath = path.join(workspaceFolder, ".git", "HEAD")
		const uri = vscode.Uri.file(gitHeadPath)

		try {
			const content = await vscode.workspace.fs.readFile(uri)
			const headContent = Buffer.from(content).toString("utf-8").trim()

			// If HEAD points to a ref, read that ref
			if (headContent.startsWith("ref: ")) {
				const refPath = headContent.substring(5)
				const refUri = vscode.Uri.file(path.join(workspaceFolder, ".git", refPath))
				const refContent = await vscode.workspace.fs.readFile(refUri)
				return Buffer.from(refContent).toString("utf-8").trim()
			}

			// Otherwise HEAD is a direct SHA
			return headContent
		} catch {
			return "unknown"
		}
	} catch (error) {
		console.error("[computeGitSha] Error:", error)
		return "unknown"
	}
}

/**
 * Classifies the type of code mutation based on heuristics
 *
 * @param filePath - File path being modified
 * @param oldCode - Previous code content (empty string for new files)
 * @param newCode - New code content
 * @returns Mutation classification
 */
function classifyMutation(filePath: string, oldCode: string, newCode: string): string {
	// New file creation
	if (!oldCode || oldCode.trim().length === 0) {
		return "new_feature"
	}

	// File deletion
	if (!newCode || newCode.trim().length === 0) {
		return "deletion"
	}

	// Calculate similarity metrics
	const oldLines = oldCode.split("\n").filter((l) => l.trim().length > 0)
	const newLines = newCode.split("\n").filter((l) => l.trim().length > 0)

	const oldLineCount = oldLines.length
	const newLineCount = newLines.length
	const deltaLines = Math.abs(newLineCount - oldLineCount)
	const deltaPercent = oldLineCount > 0 ? (deltaLines / oldLineCount) * 100 : 100

	// Small changes (< 20% line delta) = Bug fix or minor edit
	if (deltaPercent < 20 && deltaLines < 10) {
		return "bug_fix"
	}

	// Moderate changes (20-50% delta) = Enhancement
	if (deltaPercent < 50) {
		return "enhancement"
	}

	// Large changes or structural shifts = Refactor or new feature
	// Check if old code is substantially preserved (simple heuristic: line overlap)
	const oldSet = new Set(oldLines.map((l) => l.trim()))
	const preservedLines = newLines.filter((l) => oldSet.has(l.trim())).length
	const preservationRate = oldLineCount > 0 ? (preservedLines / oldLineCount) * 100 : 0

	// High preservation (>60%) with large changes = Refactor
	if (preservationRate > 60) {
		return "refactor"
	}

	// Low preservation = New feature
	return "new_feature"
}

/**
 * Builds a complete trace record with content hash and intent correlation
 *
 * @param filePath - File path being modified
 * @param code - Code content being written (full file or block)
 * @param intentId - Intent ID from active_intents.yaml
 * @param modelId - LLM model identifier
 * @param taskId - Task ID for correlation
 * @param startLine - Optional: starting line of the code block (for block-level hashing)
 * @param endLine - Optional: ending line of the code block (for block-level hashing)
 * @param oldCode - Optional: previous code content for mutation classification
 * @returns Complete TraceRecord
 */
export function buildTraceRecord(
	filePath: string,
	code: string,
	intentId: string,
	modelId: string,
	taskId: string,
	startLine?: number,
	endLine?: number,
	oldCode?: string,
): TraceRecord {
	// Extract code block if line ranges are provided
	let codeBlock = code
	if (startLine !== undefined && endLine !== undefined) {
		const lines = code.split("\n")
		codeBlock = lines.slice(startLine, endLine).join("\n")
	}

	// Classify mutation type
	const mutationType = oldCode !== undefined ? classifyMutation(filePath, oldCode, code) : "unknown"

	return {
		timestamp: new Date().toISOString(),
		event_type: "tool_result",
		tool_name: "write_to_file",
		task_id: taskId,
		file_path: filePath,
		content_hash: computeContentHash(codeBlock),
		intent_id: intentId,
		model_id: modelId,
		mutation_type: mutationType,
		contributor: {
			type: "ai",
			id: modelId,
		},
		related: [
			{
				type: "intent",
				id: intentId,
			},
		],
	}
}

/**
 * Appends a trace record to agent_trace.jsonl
 *
 * @param record - Trace record to append
 * @param logPath - Optional custom path for the log file
 *
 * @example
 * const record = createToolUseTrace("read_file", { path: "test.ts" }, "task-123")
 * await appendToTraceLog(record, "/workspace/.orchestration/agent_trace.jsonl")
 */
export async function appendToTraceLog(record: AgentTraceRecord, logPath?: string): Promise<void> {
	try {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
		if (!workspaceFolder) {
			console.warn("[appendToTraceLog] No workspace folder found")
			return
		}

		// Determine log path
		const traceLogPath = logPath || path.join(workspaceFolder, ".orchestration", "agent_trace.jsonl")
		const uri = vscode.Uri.file(traceLogPath)

		// Ensure .orchestration directory exists
		const dirUri = vscode.Uri.file(path.dirname(traceLogPath))
		try {
			await vscode.workspace.fs.createDirectory(dirUri)
		} catch {
			// Directory already exists, ignore
		}

		// Convert record to JSONL format (one line)
		const jsonLine = JSON.stringify(record) + "\n"

		// Append to file
		try {
			// Read existing content
			const existingContent = await vscode.workspace.fs.readFile(uri)
			const newContent = Buffer.concat([existingContent, Buffer.from(jsonLine, "utf-8")])
			await vscode.workspace.fs.writeFile(uri, newContent)
		} catch {
			// File doesn't exist, create it
			await vscode.workspace.fs.writeFile(uri, Buffer.from(jsonLine, "utf-8"))
		}
	} catch (error) {
		console.error("[appendToTraceLog] Error:", error)
	}
}

/**
 * Appends a TraceRecord (extended format) to agent_trace.jsonl
 *
 * @param record - Extended trace record
 * @param cwd - Workspace root directory
 */
export async function appendTraceRecord(record: TraceRecord, cwd?: string): Promise<void> {
	try {
		const workspaceFolder = cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
		if (!workspaceFolder) {
			console.warn("[appendTraceRecord] No workspace folder found")
			return
		}

		const traceLogPath = path.join(workspaceFolder, ".orchestration", "agent_trace.jsonl")
		const uri = vscode.Uri.file(traceLogPath)

		// Ensure directory exists
		const dirUri = vscode.Uri.file(path.dirname(traceLogPath))
		try {
			await vscode.workspace.fs.createDirectory(dirUri)
		} catch {
			// Already exists
		}

		// Append JSONL line
		const jsonLine = JSON.stringify(record) + "\n"

		try {
			const existingContent = await vscode.workspace.fs.readFile(uri)
			const newContent = Buffer.concat([existingContent, Buffer.from(jsonLine, "utf-8")])
			await vscode.workspace.fs.writeFile(uri, newContent)
		} catch {
			await vscode.workspace.fs.writeFile(uri, Buffer.from(jsonLine, "utf-8"))
		}
	} catch (error) {
		console.error("[appendTraceRecord] Error:", error)
	}
}

/**
 * Sanitizes tool parameters before logging.
 * Removes sensitive data like API keys, passwords, tokens.
 *
 * @internal
 */
function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
	const redacted: Record<string, unknown> = {}
	const SENSITIVE_KEYS = [
		/api[_-]?key/i,
		/anthropic/i,
		/openai/i,
		/password/i,
		/passwd/i,
		/pwd/i,
		/token/i,
		/auth[_-]?token/i,
		/secret/i,
		/client[_-]?secret/i,
		/bearer/i,
	]
	for (const [k, v] of Object.entries(params || {})) {
		if (SENSITIVE_KEYS.some((rx) => rx.test(k))) {
			redacted[k] = "[REDACTED]"
			continue
		}

		if (typeof v === "string") {
			if (v.length > 1000) {
				redacted[k] = v.substring(0, 1000) + "..."
			} else {
				redacted[k] = v
			}
		} else if (typeof v === "object" && v !== null) {
			try {
				// shallow clone and redact nested sensitive keys
				const obj: Record<string, unknown> = {}
				for (const [nk, nv] of Object.entries(v as Record<string, unknown>)) {
					if (SENSITIVE_KEYS.some((rx) => rx.test(nk))) {
						obj[nk] = "[REDACTED]"
					} else if (typeof nv === "string" && (nv as string).length > 1000) {
						obj[nk] = (nv as string).substring(0, 1000) + "..."
					} else {
						obj[nk] = nv
					}
				}
				redacted[k] = obj
			} catch {
				redacted[k] = "[UNSERIALIZABLE]"
			}
		} else {
			redacted[k] = v
		}
	}

	return redacted
}

/**
 * Sanitizes tool results before logging.
 * Removes sensitive data and truncates large outputs.
 *
 * @internal
 */
function sanitizeResult(result: unknown): unknown {
	const SENSITIVE_PATTERNS = [/api[_-]?key/i, /anthropic/i, /openai/i, /password/i, /token/i, /secret/i]

	if (typeof result === "string") {
		let out = result
		// redact patterns
		for (const rx of SENSITIVE_PATTERNS) {
			out = out.replace(rx, "[REDACTED]")
		}
		if (out.length > 5000) {
			return out.substring(0, 5000) + "..."
		}
		return out
	}

	if (Array.isArray(result)) {
		return result.map((r) => sanitizeResult(r))
	}

	if (typeof result === "object" && result !== null) {
		const out: Record<string, unknown> = {}
		for (const [k, v] of Object.entries(result as Record<string, unknown>)) {
			if (SENSITIVE_PATTERNS.some((rx) => rx.test(k))) {
				out[k] = "[REDACTED]"
			} else {
				out[k] = sanitizeResult(v)
			}
		}
		return out
	}

	return result
}

/**
 * Reads trace records from agent_trace.jsonl
 *
 * @param logPath - Path to the trace log file
 * @param filter - Optional filter function
 * @returns Array of trace records
 *
 * @example
 * const records = await readTraceLog("/workspace/.orchestration/agent_trace.jsonl")
 * const writeFileRecords = records.filter(r => r.toolName === "write_to_file")
 */
export async function readTraceLog(
	logPath: string,
	filter?: (record: AgentTraceRecord) => boolean,
): Promise<AgentTraceRecord[]> {
	try {
		const uri = vscode.Uri.file(logPath)
		const buf = await vscode.workspace.fs.readFile(uri)
		const content = Buffer.from(buf).toString("utf8")
		const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
		const records: AgentTraceRecord[] = []
		for (const line of lines) {
			try {
				const obj = JSON.parse(line) as AgentTraceRecord
				if (!filter || filter(obj)) records.push(obj)
			} catch (e) {
				// skip invalid lines
			}
		}
		return records
	} catch (error) {
		console.warn("[readTraceLog] Failed to read trace log:", error)
		return []
	}
}

/**
 * Analyzes trace records to generate metrics.
 *
 * @param records - Array of trace records to analyze
 * @returns Metrics object with tool usage statistics
 *
 * @example
 * const records = await readTraceLog("/workspace/.orchestration/agent_trace.jsonl")
 * const metrics = analyzeTraceMetrics(records)
 * console.log(`Average tool execution time: ${metrics.avgDuration}ms`)
 */
export function analyzeTraceMetrics(records: AgentTraceRecord[]): {
	totalTools: number
	toolCounts: Record<ToolName, number>
	avgDuration: number
	approvalRate: number
} {
	const totals = records.length
	const toolCounts = {} as Record<ToolName, number>
	let durationSum = 0
	let durationCount = 0
	let approvals = 0
	let approvalReq = 0

	for (const r of records) {
		const name = r.toolName as ToolName
		toolCounts[name] = (toolCounts[name] || 0) + 1
		if (typeof r.duration === "number") {
			durationSum += r.duration
			durationCount++
		}
		if (r.requiresApproval) approvalReq++
		if (r.approved) approvals++
	}

	return {
		totalTools: totals,
		toolCounts,
		avgDuration: durationCount > 0 ? durationSum / durationCount : 0,
		approvalRate: approvalReq > 0 ? approvals / approvalReq : 0,
	}
}
