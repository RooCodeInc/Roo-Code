/**
 * ACP (Agent Client Protocol) Types for Claude Code integration
 *
 * Based on the Agent Client Protocol specification:
 * https://agentclientprotocol.com
 */

/**
 * JSON-RPC 2.0 Request structure
 */
export interface JsonRpcRequest {
	jsonrpc: "2.0"
	id: string | number
	method: string
	params?: unknown
}

/**
 * JSON-RPC 2.0 Response structure
 */
export interface JsonRpcResponse {
	jsonrpc: "2.0"
	id: string | number | null
	result?: unknown
	error?: JsonRpcError
}

/**
 * JSON-RPC 2.0 Notification structure (no id)
 */
export interface JsonRpcNotification {
	jsonrpc: "2.0"
	method: string
	params?: unknown
}

/**
 * JSON-RPC 2.0 Error structure
 */
export interface JsonRpcError {
	code: number
	message: string
	data?: unknown
}

/**
 * ACP Implementation Info
 */
export interface AcpImplementation {
	name: string
	title: string
	version: string
}

/**
 * ACP Initialize Request Parameters
 */
export interface AcpInitializeParams {
	protocolVersion: number
	clientCapabilities: AcpClientCapabilities
	clientInfo: AcpImplementation
}

/**
 * ACP Client Capabilities
 */
export interface AcpClientCapabilities {
	fs?: {
		readTextFile?: boolean
		writeTextFile?: boolean
	}
	terminal?: boolean
}

/**
 * ACP Initialize Response
 */
export interface AcpInitializeResult {
	protocolVersion: number
	agentCapabilities: AcpAgentCapabilities
	agentInfo: AcpImplementation
	authMethods?: AcpAuthMethod[]
}

/**
 * ACP Auth Method
 */
export interface AcpAuthMethod {
	type: string
	url?: string
}

/**
 * ACP Agent Capabilities
 */
export interface AcpAgentCapabilities {
	loadSession?: boolean
	promptCapabilities?: {
		image?: boolean
		audio?: boolean
		embeddedContext?: boolean
	}
	mcpCapabilities?: {
		http?: boolean
		sse?: boolean
	}
	sessionCapabilities?: Record<string, unknown>
}

/**
 * ACP MCP Server (stdio transport)
 */
export interface AcpMcpServer {
	name: string
	command: string
	args?: string[]
	env?: Array<{ name: string; value: string }>
}

/**
 * ACP Session Create Parameters
 */
export interface AcpSessionNewParams {
	cwd: string
	mcpServers: AcpMcpServer[]
}

/**
 * ACP Session
 */
export interface AcpSession {
	sessionId: string
}

/**
 * ACP Content Block Types (per ACP spec)
 */
export type AcpContentBlock = AcpTextContent | AcpImageContent | AcpResourceLinkContent | AcpResourceContent

export interface AcpTextContent {
	type: "text"
	text: string
}

export interface AcpImageContent {
	type: "image"
	source: {
		type: "base64"
		mediaType: string
		data: string
	}
}

export interface AcpResourceLinkContent {
	type: "resource_link"
	uri: string
}

export interface AcpResourceContent {
	type: "resource"
	uri: string
	mimeType: string
	text: string
}

/**
 * ACP Prompt Request Parameters
 */
export interface AcpPromptParams {
	sessionId: string
	prompt: AcpContentBlock[]
}

/**
 * ACP Prompt Response
 */
export interface AcpPromptResult {
	stopReason: AcpStopReason
}

/**
 * ACP Stop Reasons (per ACP spec)
 */
export type AcpStopReason = "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled"

/**
 * ACP Session Update Notification params
 */
export interface AcpSessionUpdateParams {
	sessionId: string
	update: AcpSessionUpdate
}

/**
 * ACP Session Update variants (tagged union)
 *
 * Per the ACP spec, updates use "sessionUpdate" as the discriminator field
 * with snake_case values.
 */
export type AcpSessionUpdate =
	| AcpAgentMessageChunk
	| AcpAgentThoughtChunk
	| AcpToolCallUpdate
	| AcpToolCallStatusUpdate
	| AcpPlanUpdate

/**
 * Agent message chunk - streamed text from the agent
 */
export interface AcpAgentMessageChunk {
	sessionUpdate: "agent_message_chunk"
	content: AcpContentBlock
}

/**
 * Agent thought chunk - streamed reasoning/thinking
 */
export interface AcpAgentThoughtChunk {
	sessionUpdate: "agent_thought_chunk"
	content: AcpContentBlock
}

/**
 * Tool call initiated
 */
export interface AcpToolCallUpdate {
	sessionUpdate: "tool_call"
	toolCallId: string
	title: string
	kind: AcpToolKind
	status: AcpToolCallStatus
	content?: AcpToolCallContent[]
	locations?: AcpToolCallLocation[]
	rawInput?: unknown
	rawOutput?: unknown
}

/**
 * Tool call status update
 */
export interface AcpToolCallStatusUpdate {
	sessionUpdate: "tool_call_update"
	toolCallId: string
	status?: AcpToolCallStatus
	content?: AcpToolCallContent[]
}

/**
 * Plan update
 */
export interface AcpPlanUpdate {
	sessionUpdate: "plan"
	entries: unknown[]
}

export type AcpToolKind =
	| "read"
	| "edit"
	| "delete"
	| "move"
	| "search"
	| "execute"
	| "think"
	| "fetch"
	| "switch_mode"
	| "other"

export type AcpToolCallStatus = "pending" | "in_progress" | "completed" | "failed"

export interface AcpToolCallContent {
	type: string
	[key: string]: unknown
}

export interface AcpToolCallLocation {
	uri: string
	range?: { start: { line: number; character: number }; end: { line: number; character: number } }
}

/**
 * ACP Permission Request (Agent --> Client, as a JSON-RPC request)
 */
export interface AcpPermissionRequestParams {
	sessionId: string
	toolCall: {
		toolCallId: string
		fields: Record<string, unknown>
	}
	options: AcpPermissionOption[]
}

export interface AcpPermissionOption {
	label: string
	outcome: AcpPermissionOutcome
}

export type AcpPermissionOutcome = "approved" | "denied" | "approved_for_session" | "approved_for_duration"

/**
 * ACP Permission Response (Client --> Agent)
 */
export interface AcpPermissionResult {
	outcome: AcpPermissionOutcome
}

/**
 * ACP Cancel Notification
 */
export interface AcpCancelParams {
	sessionId: string
}

/**
 * Connection state for the ACP client
 */
export type AcpConnectionState = "disconnected" | "connecting" | "connected" | "error"

/**
 * Events emitted by the ACP client
 */
export interface AcpClientEvents {
	connected: () => void
	disconnected: (error?: Error) => void
	error: (error: Error) => void
	sessionUpdate: (update: AcpSessionUpdateParams) => void
	permissionRequest: (request: AcpPermissionRequestParams) => Promise<AcpPermissionResult>
}
