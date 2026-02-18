/**
 * Intent-Code Traceability Hook System
 *
 * This module provides the core types and interfaces for the hook system
 * that intercepts tool executions to enforce intent context and trace code changes.
 */

import * as vscode from "vscode"
import * as path from "path"
import * as crypto from "crypto"
import * as fs from "fs"
import * as yaml from "yaml"

/**
 * Represents an active intent in the system
 */
export interface ActiveIntent {
	id: string
	name: string
	status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED"
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
	created_at: string
	updated_at: string
}

/**
 * The active intents data model
 */
export interface ActiveIntentsData {
	active_intents: ActiveIntent[]
}

/**
 * Represents a single file modification in the trace
 */
export interface TraceFileEntry {
	relative_path: string
	conversations: TraceConversation[]
}

/**
 * Represents a conversation/contribution to a file
 */
export interface TraceConversation {
	url: string // session_log_id
	contributor: {
		entity_type: "AI" | "HUMAN"
		model_identifier?: string
	}
	ranges: TraceRange[]
	related: TraceRelated[]
}

/**
 * A range of lines with content hash for spatial independence
 */
export interface TraceRange {
	start_line: number
	end_line: number
	content_hash: string
}

/**
 * Related specifications/intents
 */
export interface TraceRelated {
	type: "specification" | "intent" | "constraint"
	value: string
}

/**
 * A single trace entry in the ledger
 */
export interface AgentTraceEntry {
	id: string
	timestamp: string
	vcs: {
		revision_id: string
	}
	files: TraceFileEntry[]
}

/**
 * Mutation classification for distinguishing refactors from features
 */
export type MutationClass = "AST_REFACTOR" | "INTENT_EVOLUTION" | "DOCUMENTATION" | "UNKNOWN"

/**
 * Hook execution context
 */
export interface HookContext {
	taskId: string
	instanceId: string
	cwd: string
	activeIntentId: string | null
	toolName: string
	toolParams: Record<string, unknown>
}

/**
 * Result of a Pre-Hook check
 */
export interface PreHookResult {
	allowed: boolean
	errorMessage?: string
	modifiedParams?: Record<string, unknown>
	injectedContext?: string
}

/**
 * Result of a Post-Hook operation
 */
export interface PostHookResult {
	success: boolean
	traceEntry?: AgentTraceEntry
	errorMessage?: string
}

/**
 * Tool classification
 */
export type ToolClassification = "SAFE" | "DESTRUCTIVE" | "UNKNOWN"

/**
 * Classification of tools based on their potential impact
 */
export function classifyTool(toolName: string): ToolClassification {
	const safeTools = ["read_file", "list_files", "search_files", "codebase_search", "read_command_output"]

	const destructiveTools = [
		"write_to_file",
		"edit",
		"search_and_replace",
		"search_replace",
		"edit_file",
		"apply_patch",
		"apply_diff",
		"execute_command",
		"delete_file",
	]

	if (safeTools.includes(toolName)) return "SAFE"
	if (destructiveTools.includes(toolName)) return "DESTRUCTIVE"
	return "UNKNOWN"
}

/**
 * Compute SHA-256 hash of content for spatial independence
 */
export function computeContentHash(content: string): string {
	const hash = crypto.createHash("sha256")
	hash.update(content)
	return `sha256:${hash.digest("hex")}`
}

/**
 * Get the workspace orchestration directory path
 */
export function getOrchestrationDir(workspacePath: string): string {
	return path.join(workspacePath, ".orchestration")
}

/**
 * Ensure the orchestration directory exists
 */
export async function ensureOrchestrationDir(workspacePath: string): Promise<string> {
	const dir = getOrchestrationDir(workspacePath)
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true })
	}
	return dir
}

/**
 * Load active intents from YAML file
 */
export async function loadActiveIntents(workspacePath: string): Promise<ActiveIntentsData | null> {
	const filePath = path.join(getOrchestrationDir(workspacePath), "active_intents.yaml")
	try {
		if (fs.existsSync(filePath)) {
			const content = fs.readFileSync(filePath, "utf-8")
			return yaml.parse(content) as ActiveIntentsData
		}
	} catch (error) {
		console.error("[HookSystem] Failed to load active_intents.yaml:", error)
	}
	return null
}

/**
 * Save active intents to YAML file
 */
export async function saveActiveIntents(workspacePath: string, data: ActiveIntentsData): Promise<void> {
	const dir = await ensureOrchestrationDir(workspacePath)
	const filePath = path.join(dir, "active_intents.yaml")
	const content = yaml.stringify(data, { indent: 2 })
	fs.writeFileSync(filePath, content, "utf-8")
}

/**
 * Get a specific intent by ID
 */
export function getIntentById(data: ActiveIntentsData, intentId: string): ActiveIntent | null {
	return data.active_intents.find((intent) => intent.id === intentId) || null
}

/**
 * Check if a file path matches the intent's owned scope
 */
export function isFileInScope(filePath: string, scopePatterns: string[]): boolean {
	// Simple glob matching - can be enhanced with proper glob library
	for (const pattern of scopePatterns) {
		// Convert glob pattern to regex
		const regexPattern = pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*").replace(/\?/g, ".")

		const regex = new RegExp(`^${regexPattern}$`)
		if (regex.test(filePath)) {
			return true
		}
	}
	return false
}

/**
 * Get current git revision ID
 */
export function getGitRevision(workspacePath: string): string {
	try {
		// This is a simplified version - in production would use simple-git
		const headPath = path.join(workspacePath, ".git", "HEAD")
		if (fs.existsSync(headPath)) {
			const headContent = fs.readFileSync(headPath, "utf-8").trim()
			if (headContent.startsWith("ref: ")) {
				const refPath = path.join(workspacePath, ".git", headContent.slice(5))
				if (fs.existsSync(refPath)) {
					return fs.readFileSync(refPath, "utf-8").trim().slice(0, 7)
				}
			}
			return headContent.slice(0, 7)
		}
	} catch (error) {
		console.error("[HookSystem] Failed to get git revision:", error)
	}
	return "unknown"
}
