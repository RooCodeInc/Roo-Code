export type ApiStream = AsyncGenerator<ApiStreamChunk>

export type ApiStreamChunk =
	| ApiStreamTextChunk
	| ApiStreamUsageChunk
	| ApiStreamReasoningChunk
	| ApiStreamGroundingChunk
	| ApiStreamToolCallsChunk
	| ApiStreamError

export interface ApiStreamError {
	type: "error"
	error: string
	message: string
}

export interface ApiStreamTextChunk {
	type: "text"
	text: string
}

export interface ApiStreamReasoningChunk {
	type: "reasoning"
	text: string
}

export interface ApiStreamUsageChunk {
	type: "usage"
	inputTokens: number
	outputTokens: number
	cacheWriteTokens?: number
	cacheReadTokens?: number
	reasoningTokens?: number
	totalCost?: number
}

export interface ApiStreamGroundingChunk {
	type: "grounding"
	sources: GroundingSource[]
}

export interface GroundingSource {
	title: string
	url: string
	snippet?: string
}

export interface ApiStreamToolCallsChunk {
	type: "tool_calls"
	tool_call: {
		function: {
			id: string
			name: string
			arguments: string
		}
	}
}
