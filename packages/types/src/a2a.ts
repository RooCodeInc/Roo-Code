import { z } from "zod"

// ============================================================================
// A2A Agent Configuration (stored in a2a_settings.json)
// ============================================================================

/**
 * Configuration for an A2A agent, stored in settings files.
 * Follows the same pattern as MCP server configuration.
 */
export const a2aAgentConfigSchema = z.object({
	/** The URL endpoint for the A2A agent */
	url: z.string().url(),
	/** Optional custom headers for authentication (JSON key-value pairs) */
	headers: z.record(z.string()).optional(),
	/** Whether this agent is disabled */
	disabled: z.boolean().optional(),
	/** Timeout in seconds for task operations (default: 300 for long-running tasks) */
	timeout: z.number().min(1).max(7200).optional().default(300),
	/** Human-readable description of what this agent does */
	description: z.string().optional(),
})

export type A2aAgentConfig = z.infer<typeof a2aAgentConfigSchema>

/**
 * The full A2A settings file schema (maps agent names to configs).
 */
export const a2aSettingsSchema = z.object({
	a2aAgents: z.record(z.string(), a2aAgentConfigSchema).default({}),
})

export type A2aSettings = z.infer<typeof a2aSettingsSchema>

// ============================================================================
// A2A Agent Card (fetched from the agent's /.well-known/agent.json)
// ============================================================================

/**
 * Represents an A2A Agent Card as defined in the A2A protocol spec.
 * Contains metadata about an agent's capabilities.
 */
export type A2aAgentCard = {
	name: string
	description?: string
	url: string
	version?: string
	capabilities?: {
		streaming?: boolean
		pushNotifications?: boolean
		stateTransitionHistory?: boolean
	}
	skills?: A2aSkill[]
}

export type A2aSkill = {
	id: string
	name: string
	description?: string
	tags?: string[]
	examples?: string[]
}

// ============================================================================
// A2A Task Types (JSON-RPC based protocol)
// ============================================================================

/**
 * A2A message part - text, file, or data.
 */
export type A2aTextPart = {
	type: "text"
	text: string
}

export type A2aFilePart = {
	type: "file"
	file: {
		name?: string
		mimeType?: string
		bytes?: string // base64 encoded
		uri?: string
	}
}

export type A2aDataPart = {
	type: "data"
	data: Record<string, unknown>
}

export type A2aPart = A2aTextPart | A2aFilePart | A2aDataPart

/**
 * A2A Message - a message in a task conversation.
 */
export type A2aMessage = {
	role: "user" | "agent"
	parts: A2aPart[]
	metadata?: Record<string, unknown>
}

/**
 * A2A Artifact - output produced by an agent.
 */
export type A2aArtifact = {
	name?: string
	description?: string
	parts: A2aPart[]
	index?: number
	append?: boolean
	lastChunk?: boolean
	metadata?: Record<string, unknown>
}

/**
 * A2A Task state as defined in the protocol.
 */
export const a2aTaskStates = ["submitted", "working", "input-required", "completed", "canceled", "failed"] as const

export type A2aTaskState = (typeof a2aTaskStates)[number]

/**
 * A2A Task Status
 */
export type A2aTaskStatus = {
	state: A2aTaskState
	message?: A2aMessage
	timestamp?: string
}

/**
 * A2A Task - represents a delegated unit of work.
 */
export type A2aTask = {
	id: string
	sessionId?: string
	status: A2aTaskStatus
	history?: A2aMessage[]
	artifacts?: A2aArtifact[]
	metadata?: Record<string, unknown>
}

// ============================================================================
// A2A JSON-RPC Types
// ============================================================================

export type A2aJsonRpcRequest = {
	jsonrpc: "2.0"
	id: string | number
	method: string
	params?: Record<string, unknown>
}

export type A2aJsonRpcResponse = {
	jsonrpc: "2.0"
	id: string | number
	result?: A2aTask
	error?: {
		code: number
		message: string
		data?: unknown
	}
}

// ============================================================================
// A2A Agent Runtime State (for UI display)
// ============================================================================

/**
 * Runtime state of an A2A agent, used for display in the UI.
 * Mirrors the pattern of McpServer type.
 */
export type A2aAgent = {
	name: string
	config: string // JSON stringified config
	status: "connected" | "connecting" | "disconnected"
	error?: string
	disabled?: boolean
	agentCard?: A2aAgentCard
	activeTasks?: A2aTask[]
	source?: "global" | "project"
	projectPath?: string
}

/**
 * ClineAsk type for A2A agent delegation approval.
 */
export type ClineAskDelegateToAgent = {
	type: "delegate_to_agent"
	agentName: string
	message: string
}
