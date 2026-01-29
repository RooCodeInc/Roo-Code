import axios from "axios"
import { randomUUID } from "crypto"

type ChatMessage = { role: "user" | "assistant"; content: string }

export type KeywordsAiSpanLog = {
	log_type?: string
	trace_unique_id: string
	span_unique_id: string
	span_name: string
	span_parent_id?: string | null
	timestamp: string
	start_time?: string
	span_workflow_name?: string
	span_path?: string
	provider_id?: string
	model?: string
	input?: string
	output?: string
	encoding_format?: string
	latency?: number
	keywordsai_params?: Record<string, unknown>
	disable_log?: boolean
	disable_fallback?: boolean
	warnings?: string
	metadata?: Record<string, unknown>
	prompt_messages?: ChatMessage[]
	completion_message?: ChatMessage
	prompt_tokens?: number
	completion_tokens?: number
	cost?: number
	temperature?: number
	presence_penalty?: number
	frequency_penalty?: number
	max_tokens?: number
	stream?: boolean
}

export type KeywordsAiTraceIngestOptions = {
	apiKey: string
	baseUrl?: string
	traceUniqueId: string
	spanName: string
	workflowName: string
	model: string
	providerId: string
	startTimeMs: number
	endTimeMs: number
	promptMessages: ChatMessage[]
	completionMessage: ChatMessage
	promptTokens?: number
	completionTokens?: number
	cost?: number
	disableLog?: boolean
	metadata?: Record<string, unknown>
	environment?: string
}

function toRfc3339(ms: number): string {
	return new Date(ms).toISOString()
}

function getTracesIngestUrl(baseUrl?: string): string {
	// KeywordsAI "baseUrl" is typically "https://api.keywordsai.co/api/".
	// Traces ingest is at "/api/v1/traces/ingest".
	const normalizedBase = (baseUrl || "https://api.keywordsai.co/api/").replace(/\/$/, "")
	return `${normalizedBase}/v1/traces/ingest`
}

export async function ingestKeywordsAiTraceSpans(options: {
	apiKey: string
	baseUrl?: string
	spans: KeywordsAiSpanLog[]
}): Promise<void> {
	const { apiKey, baseUrl, spans } = options
	if (!spans || spans.length === 0) return

	await axios.post(getTracesIngestUrl(baseUrl), spans, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			"X-KeywordsAI-Source": "RooCode-Extension",
		},
	})
}

export async function ingestKeywordsAiChatTrace(options: KeywordsAiTraceIngestOptions): Promise<void> {
	const {
		apiKey,
		baseUrl,
		traceUniqueId,
		spanName,
		workflowName,
		model,
		providerId,
		startTimeMs,
		endTimeMs,
		promptMessages,
		completionMessage,
		promptTokens,
		completionTokens,
		cost,
		disableLog,
		metadata,
		environment,
	} = options

	const rootSpanId = randomUUID()
	const llmSpanId = randomUUID()

	const start = toRfc3339(startTimeMs)
	const end = toRfc3339(endTimeMs)
	const latencySeconds = Math.max(0, (endTimeMs - startTimeMs) / 1000)

	const payload: KeywordsAiSpanLog[] = [
		{
			trace_unique_id: traceUniqueId,
			span_unique_id: rootSpanId,
			span_name: `${workflowName}.workflow`,
			span_parent_id: null,
			start_time: start,
			timestamp: end,
			span_workflow_name: workflowName,
			span_path: "",
			provider_id: "",
			model: "vscode-extension",
			input: JSON.stringify({}),
			output: JSON.stringify({}),
			latency: latencySeconds,
			keywordsai_params: {
				has_webhook: false,
				environment: environment ?? "vscode-extension",
			},
			disable_log: disableLog ?? false,
			...(metadata ? { metadata } : {}),
		},
		{
			trace_unique_id: traceUniqueId,
			span_unique_id: llmSpanId,
			span_name: spanName,
			span_parent_id: rootSpanId,
			start_time: start,
			timestamp: end,
			span_workflow_name: workflowName,
			span_path: "",
			provider_id: providerId,
			model,
			input: JSON.stringify(promptMessages),
			output: JSON.stringify(completionMessage),
			prompt_messages: promptMessages,
			completion_message: completionMessage,
			...(typeof promptTokens === "number" ? { prompt_tokens: promptTokens } : {}),
			...(typeof completionTokens === "number" ? { completion_tokens: completionTokens } : {}),
			...(typeof cost === "number" ? { cost } : {}),
			latency: latencySeconds,
			keywordsai_params: {
				has_webhook: false,
				environment: environment ?? "vscode-extension",
			},
			disable_log: disableLog ?? false,
			...(metadata ? { metadata } : {}),
		},
	]

	await ingestKeywordsAiTraceSpans({ apiKey, baseUrl, spans: payload })
}
