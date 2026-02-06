/**
 * Types for the SolidJS/opentui TUI layer.
 * Mirrors the existing ui/types.ts but adapted for the new architecture.
 */

import type { ClineAsk, ClineSay, TodoItem } from "@roo-code/types"

export type MessageRole = "system" | "user" | "assistant" | "tool" | "thinking"

export interface ToolData {
	/** Tool identifier (e.g., "readFile", "appliedDiff", "searchFiles") */
	tool: string

	// File operation fields
	path?: string
	isOutsideWorkspace?: boolean
	isProtected?: boolean
	diff?: string
	diffStats?: { added: number; removed: number }
	content?: string

	// Search operation fields
	regex?: string
	filePattern?: string
	query?: string

	// Mode operation fields
	mode?: string
	reason?: string

	// Command operation fields
	command?: string
	output?: string

	// Browser operation fields
	action?: string
	url?: string
	coordinate?: string

	// Batch operation fields
	batchFiles?: Array<{
		path: string
		lineSnippet?: string
		isOutsideWorkspace?: boolean
		key?: string
		content?: string
	}>
	batchDiffs?: Array<{
		path: string
		changeCount?: number
		key?: string
		content?: string
		diffStats?: { added: number; removed: number }
		diffs?: Array<{
			content: string
			startLine?: number
		}>
	}>

	// Question/completion fields
	question?: string
	result?: string

	// Additional display hints
	lineNumber?: number
	additionalFileCount?: number
}

export interface TUIMessage {
	id: string
	role: MessageRole
	content: string
	toolName?: string
	toolDisplayName?: string
	toolDisplayOutput?: string
	hasPendingToolCalls?: boolean
	partial?: boolean
	originalType?: ClineAsk | ClineSay
	todos?: TodoItem[]
	previousTodos?: TodoItem[]
	toolData?: ToolData
}

export interface PendingAsk {
	id: string
	type: ClineAsk
	content: string
	suggestions?: Array<{ answer: string; mode?: string | null }>
}

export type View = "UserInput" | "AgentResponse" | "ToolUse" | "Default"

export interface TaskHistoryItem {
	id: string
	task: string
	ts: number
	totalCost?: number
	workspace?: string
	mode?: string
	status?: "active" | "completed" | "delegated"
	tokensIn?: number
	tokensOut?: number
}

export type FileResult = { key: string; label: string; path: string }
export type SlashCommandResult = { key: string; label: string; description?: string }
export type ModeResult = { key: string; label: string; slug: string }
export type HistoryResult = { key: string; label: string; id: string; task: string; ts: number }

/** Route types for navigation */
export type HomeRoute = {
	type: "home"
	initialPrompt?: string
}

export type SessionRoute = {
	type: "session"
	initialPrompt?: string
}

export type Route = HomeRoute | SessionRoute
