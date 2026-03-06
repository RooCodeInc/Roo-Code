/**
 * Trace Logger
 *
 * Handles logging of agent actions to the append-only ledger (agent_trace.jsonl).
 * Part of the Post-Hook system for AI-Native Git Layer.
 */

import * as path from "path"
import * as fs from "fs"
import { v4 as uuidv4 } from "uuid"
import {
	type AgentTraceEntry,
	type TraceFileEntry,
	type TraceConversation,
	type MutationClass,
	computeContentHash,
	getOrchestrationDir,
	getGitRevision,
} from "./types"

export interface LogTraceParams {
	workspacePath: string
	taskId: string
	instanceId: string
	intentId: string
	filePath: string
	content: string
	startLine: number
	endLine: number
	modelIdentifier?: string
	mutationClass: MutationClass
}

/**
 * Log a trace entry to the append-only ledger
 */
export async function logTrace(params: LogTraceParams): Promise<AgentTraceEntry> {
	const {
		workspacePath,
		taskId,
		intentId,
		filePath,
		content,
		startLine,
		endLine,
		modelIdentifier = "claude-3-5-sonnet",
	} = params

	// Ensure orchestration directory exists
	const orchDir = getOrchestrationDir(workspacePath)
	if (!fs.existsSync(orchDir)) {
		fs.mkdirSync(orchDir, { recursive: true })
	}

	// Compute content hash
	const contentHash = computeContentHash(content)

	// Get git revision
	const gitRevision = getGitRevision(workspacePath)

	// Create trace entry
	const traceEntry: AgentTraceEntry = {
		id: uuidv4(),
		timestamp: new Date().toISOString(),
		vcs: {
			revision_id: gitRevision,
		},
		files: [
			{
				relative_path: filePath,
				conversations: [
					{
						url: taskId,
						contributor: {
							entity_type: "AI",
							model_identifier: modelIdentifier,
						},
						ranges: [
							{
								start_line: startLine,
								end_line: endLine,
								content_hash: contentHash,
							},
						],
						related: [
							{
								type: "intent",
								value: intentId,
							},
						],
					},
				],
			},
		],
	}

	// Append to trace file (JSONL format)
	const tracePath = path.join(orchDir, "agent_trace.jsonl")
	const traceLine = JSON.stringify(traceEntry) + "\n"
	fs.appendFileSync(tracePath, traceLine, "utf-8")

	console.log(`[TraceLogger] Logged trace for ${filePath} with intent ${intentId}`)

	return traceEntry
}

/**
 * Classify the mutation based on context
 * This is a simplified version - in production would use AST analysis
 */
export function classifyMutation(originalContent: string, newContent: string, intent?: string): MutationClass {
	// If the content is very similar, it's likely a refactor
	const similarity = calculateSimilarity(originalContent, newContent)

	if (similarity > 0.8) {
		return "AST_REFACTOR"
	}

	// If significantly different, it's likely a new feature/evolution
	if (similarity < 0.5) {
		return "INTENT_EVOLUTION"
	}

	return "UNKNOWN"
}

/**
 * Calculate simple similarity between two strings
 */
function calculateSimilarity(str1: string, str2: string): number {
	if (str1 === str2) return 1
	if (!str1 || !str2) return 0

	const longer = str1.length > str2.length ? str1 : str2
	const shorter = str1.length > str2.length ? str2 : str1

	if (longer.length === 0) return 1

	const editDistance = levenshteinDistance(longer, shorter)
	return (longer.length - editDistance) / longer.length
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
	const matrix: number[][] = []

	for (let i = 0; i <= str2.length; i++) {
		matrix[i] = [i]
	}

	for (let j = 0; j <= str1.length; j++) {
		matrix[0][j] = j
	}

	for (let i = 1; i <= str2.length; i++) {
		for (let j = 1; j <= str1.length; j++) {
			if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1]
			} else {
				matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
			}
		}
	}

	return matrix[str2.length][str1.length]
}

/**
 * Read the trace history for a specific intent
 */
export async function getTraceHistoryForIntent(workspacePath: string, intentId: string): Promise<AgentTraceEntry[]> {
	const tracePath = path.join(getOrchestrationDir(workspacePath), "agent_trace.jsonl")
	const entries: AgentTraceEntry[] = []

	if (!fs.existsSync(tracePath)) {
		return entries
	}

	const content = fs.readFileSync(tracePath, "utf-8")
	const lines = content.split("\n").filter((line) => line.trim())

	for (const line of lines) {
		try {
			const entry = JSON.parse(line) as AgentTraceEntry
			// Check if this entry is related to the intent
			for (const file of entry.files) {
				for (const conv of file.conversations) {
					for (const related of conv.related) {
						if (related.value === intentId) {
							entries.push(entry)
							break
						}
					}
				}
			}
		} catch {
			// Skip malformed lines
		}
	}

	return entries
}
