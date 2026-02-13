import type { ModelInfo } from "../model.js"

/**
 * Claude Code ACP Provider
 *
 * This provider integrates with Claude Code through the Agent Client Protocol (ACP),
 * using the @zed-industries/claude-code-acp adapter.
 *
 * Authentication is handled by the Claude Code CLI, supporting:
 * - Claude.ai login (Pro, Max, Teams, Enterprise subscriptions)
 * - API key authentication
 * - Bedrock/Vertex/Azure authentication
 */

export type ClaudeCodeAcpModelId = keyof typeof claudeCodeAcpModels

/**
 * Available models through Claude Code ACP
 * These are the latest models available through the Claude Code infrastructure
 */
export const claudeCodeAcpModels: Record<string, ModelInfo> = {
	"claude-opus-4-6": {
		maxTokens: 128_000,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 5.0,
		outputPrice: 25.0,
		cacheWritesPrice: 6.25,
		cacheReadsPrice: 0.5,
		supportsReasoningBudget: true,
		description: "Opus 4.6 - Most intelligent for agents and coding",
	},
	"claude-sonnet-4-5": {
		maxTokens: 64_000,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 3.0,
		outputPrice: 15.0,
		cacheWritesPrice: 3.75,
		cacheReadsPrice: 0.3,
		supportsReasoningBudget: true,
		description: "Sonnet 4.5 - Best combination of speed and intelligence (recommended)",
	},
	"claude-haiku-4-5": {
		maxTokens: 64_000,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 1.0,
		outputPrice: 5.0,
		cacheWritesPrice: 1.25,
		cacheReadsPrice: 0.1,
		supportsReasoningBudget: true,
		description: "Haiku 4.5 - Fastest with near-frontier intelligence",
	},
} as const

export const claudeCodeAcpDefaultModelId: ClaudeCodeAcpModelId = "claude-sonnet-4-5"

/**
 * ACP Session state
 */
export interface ClaudeCodeAcpSession {
	/** Unique session identifier */
	sessionId: string
	/** Working directory for the session */
	workingDirectory: string
	/** Whether the session is active */
	isActive: boolean
	/** Timestamp when the session was created */
	createdAt: number
	/** Timestamp of last activity */
	lastActivityAt: number
	/** Current model being used */
	modelId: string
}

/**
 * ACP Connection status
 */
export type ClaudeCodeAcpConnectionStatus = "disconnected" | "connecting" | "connected" | "error"

/**
 * ACP Authentication status
 */
export interface ClaudeCodeAcpAuthStatus {
	/** Whether the user is authenticated */
	isAuthenticated: boolean
	/** Authentication method used */
	authMethod?: "claude-ai" | "api-key" | "bedrock" | "vertex" | "azure"
	/** User email if available */
	email?: string
	/** Error message if authentication failed */
	error?: string
}
