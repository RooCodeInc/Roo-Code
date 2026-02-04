import { Anthropic } from "@anthropic-ai/sdk"
import { randomUUID } from "crypto"

import type { ApiHandlerOptions } from "../../shared/api"
import type { ApiHandlerCreateMessageMetadata } from "../index"
import type { ApiStream, ApiStreamUsageChunk } from "../transform/stream"

import { OpenAiHandler } from "./openai"
import { ingestKeywordsAiTraceSpans, type KeywordsAiSpanLog } from "./keywordsaiTracing"

function extractLatestUserMessageText(messages: Anthropic.Messages.MessageParam[]): string | undefined {
	const re = /<user_message>\s*([\s\S]*?)\s*<\/user_message>/g
	const lastUser = [...messages].reverse().find((m) => m.role === "user")
	if (!lastUser) return undefined

	const content = lastUser.content
	const all: string[] = []

	if (typeof content === "string") {
		for (const match of content.matchAll(re)) {
			const txt = (match[1] ?? "").trim()
			if (txt) all.push(txt)
		}
		return all.join("\n\n").trim() || undefined
	}

	if (Array.isArray(content)) {
		for (const block of content) {
			if (block.type !== "text" || typeof (block as any).text !== "string") continue
			const text = (block as Anthropic.TextBlockParam).text
			for (const match of text.matchAll(re)) {
				const txt = (match[1] ?? "").trim()
				if (txt) all.push(txt)
			}
		}
		return all.join("\n\n").trim() || undefined
	}

	return undefined
}

type TraceContext = {
	traceUniqueId: string
	rootSpanId: string
	workflowName: string
	traceStartTimeMs: number
	traceEndTimeMs: number
	loggedToolResultIds: Set<string>
}

/**
 * Keywords AI gateway handler. Uses the OpenAI-compatible gateway;
 * only adds disable_log when logging is disabled (enable-logging option).
 */
export class KeywordsAiHandler extends OpenAiHandler {
	private traceContext?: TraceContext

	constructor(options: ApiHandlerOptions) {
		const baseUrl = options.keywordsaiBaseUrl || "https://api.keywordsai.co/api/"
		super({
			...options,
			openAiApiKey: options.keywordsaiApiKey ?? "not-provided",
			openAiBaseUrl: baseUrl,
			openAiModelId: options.apiModelId,
			openAiStreamingEnabled: true,
			openAiHeaders: {
				"X-KeywordsAI-Source": "RooCode-Extension",
				...(options.openAiHeaders || {}),
			},
		})
	}

	protected override getExtraRequestParams(): Record<string, unknown> {
		if (this.options.keywordsaiEnableLogging === false) {
			return { disable_log: true }
		}
		return {}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const tracingEnabled = this.options.keywordsaiEnableTracing === true
		const apiKey = this.options.keywordsaiApiKey

		// Only trace when explicitly enabled and we have an API key.
		if (!tracingEnabled || !apiKey) {
			yield* super.createMessage(systemPrompt, messages, metadata)
			return
		}

		const question = extractLatestUserMessageText(messages)
		const isNewTurn = Boolean(question)

		// Start a new trace when we detect a new user turn (<user_message>).
		if (isNewTurn || !this.traceContext) {
			const now = Date.now()
			this.traceContext = {
				traceUniqueId: randomUUID(),
				rootSpanId: randomUUID(),
				workflowName: "roo_code_chat",
				traceStartTimeMs: now,
				traceEndTimeMs: now,
				loggedToolResultIds: new Set<string>(),
			}
		}

		const ctx = this.traceContext
		const requestStartTimeMs = Date.now()
		// Keep root span start pinned to the earliest request in the trace.
		if (requestStartTimeMs < ctx.traceStartTimeMs) {
			ctx.traceStartTimeMs = requestStartTimeMs
		}

		let assistantText = ""
		let usage: ApiStreamUsageChunk | undefined
		const toolCalls: Map<string, { name?: string; args: string; startMs: number; endMs: number }> = new Map()
		const promptToolResults: Array<{
			toolUseId: string
			toolName?: string
			toolInput?: unknown
			toolOutput: string
		}> = []

		// Extract tool results that are being fed back to the model in this request.
		// These often contain terminal output (stdout/stderr) and are the best place
		// to attribute tool execution output WITHOUT touching core tool execution code.
		{
			const toolUseMap = new Map<string, { name?: string; input?: unknown }>()
			for (const msg of messages) {
				if (msg.role !== "assistant") continue
				const content = msg.content
				if (!Array.isArray(content)) continue
				for (const block of content as any[]) {
					if (block?.type === "tool_use" && typeof block?.id === "string") {
						toolUseMap.set(block.id, { name: block?.name, input: block?.input })
					}
				}
			}

			const lastUser = [...messages].reverse().find((m) => m.role === "user")
			const userContent = lastUser?.content
			if (Array.isArray(userContent)) {
				for (const block of userContent as any[]) {
					if (block?.type === "tool_result" && typeof block?.tool_use_id === "string") {
						const toolUseId = block.tool_use_id as string
						// "content" can be a string or array of blocks; normalize to string.
						const rawContent = block.content
						const contentString =
							typeof rawContent === "string"
								? rawContent
								: Array.isArray(rawContent)
									? rawContent
											.filter((b: any) => b?.type === "text" && typeof b?.text === "string")
											.map((b: any) => b.text)
											.join("\n")
									: ""

						// Deduplicate within the trace (the same tool results can be replayed on retries/resumes).
						if (!contentString.trim() || ctx.loggedToolResultIds.has(toolUseId)) {
							continue
						}
						ctx.loggedToolResultIds.add(toolUseId)

						const toolMeta = toolUseMap.get(toolUseId)
						const toolName = toolMeta?.name
						const toolInput = toolMeta?.input

						promptToolResults.push({
							toolUseId,
							toolName,
							toolInput,
							toolOutput: contentString,
						})
					}
				}
			}
		}

		for await (const chunk of super.createMessage(systemPrompt, messages, metadata)) {
			if (chunk.type === "text" && chunk.text) {
				assistantText += chunk.text
			}
			if (chunk.type === "usage") {
				usage = chunk
			}
			// OpenAI-compatible providers emit tool call chunks during streaming.
			if (chunk.type === "tool_call_partial") {
				const id = chunk.id ?? `index:${chunk.index}`
				const now = Date.now()
				const current = toolCalls.get(id) ?? { name: undefined, args: "", startMs: now, endMs: now }
				if (chunk.name) current.name = chunk.name
				if (chunk.arguments) current.args += chunk.arguments
				current.endMs = now
				toolCalls.set(id, current)
			}
			if (chunk.type === "tool_call_end") {
				const now = Date.now()
				const current = toolCalls.get(chunk.id) ?? { name: undefined, args: "", startMs: now, endMs: now }
				current.endMs = now
				toolCalls.set(chunk.id, current)
			}
			yield chunk
		}

		// We trace if we have an active trace context AND this request produced either:
		// - assistant text, OR
		// - one or more tool calls.
		//
		// This fixes the common agentic case where the model replies with only tool calls.
		const hasAssistantText = Boolean(assistantText.trim())
		const hasToolCalls = toolCalls.size > 0

		// If there's no explicit user message AND we somehow have no active context, don't trace.
		// (This avoids creating traces from internal/system-only prompts.)
		if (!ctx) return
		if (!isNewTurn && !ctx.traceUniqueId) return
		if (!hasAssistantText && !hasToolCalls) return

		const requestEndTimeMs = Date.now()
		// Place tool_result spans at the END of this request so they appear as the latest step(s)
		// in the trace tree UI. Extend the workflow span to cover them.
		const toolResultSpanEndMs = requestEndTimeMs + Math.max(0, promptToolResults.length * 2)
		ctx.traceEndTimeMs = Math.max(ctx.traceEndTimeMs, toolResultSpanEndMs)

		const disableLog = this.options.keywordsaiEnableLogging === false
		const model = this.options.apiModelId ?? this.options.openAiModelId ?? ""
		const spanWorkflowName = ctx.workflowName

		const spans: KeywordsAiSpanLog[] = []

		// Root workflow span for the trace (covers the whole turn, including tool-loop requests).
		// We include it on every ingest with the SAME span_unique_id, so the latest one always
		// reflects the most up-to-date end time.
		{
			const startIso = new Date(ctx.traceStartTimeMs).toISOString()
			const endIso = new Date(ctx.traceEndTimeMs).toISOString()
			const latencySeconds = Math.max(0, (ctx.traceEndTimeMs - ctx.traceStartTimeMs) / 1000)
			spans.push({
				log_type: "workflow",
				trace_unique_id: ctx.traceUniqueId,
				span_unique_id: ctx.rootSpanId,
				span_name: `${spanWorkflowName}.workflow`,
				span_parent_id: null,
				start_time: startIso,
				timestamp: endIso,
				span_workflow_name: spanWorkflowName,
				span_path: "",
				provider_id: "",
				model: "vscode-extension",
				input: JSON.stringify({}),
				output: JSON.stringify({}),
				latency: latencySeconds,
				keywordsai_params: { has_webhook: false, environment: "vscode-extension" },
				disable_log: disableLog,
				metadata: {
					source: "roo-code-vscode-extension",
					taskId: metadata?.taskId,
				},
			})
		}

		// LLM span (prompt/response). If this was not a new user turn, question can be undefined;
		// in that case we still record the LLM span but omit prompt_messages.
		{
			const startIso = new Date(requestStartTimeMs).toISOString()
			const endIso = new Date(requestEndTimeMs).toISOString()
			const latencySeconds = Math.max(0, (requestEndTimeMs - requestStartTimeMs) / 1000)
			spans.push({
				log_type: "chat",
				trace_unique_id: ctx.traceUniqueId,
				span_unique_id: randomUUID(),
				span_name: "keywordsai.chat",
				span_parent_id: ctx.rootSpanId,
				start_time: startIso,
				timestamp: endIso,
				span_workflow_name: spanWorkflowName,
				span_path: "",
				provider_id: "keywordsai",
				model,
				input: JSON.stringify(
					question ? [{ role: "user", content: question }] : [{ role: "user", content: "" }],
				),
				output: JSON.stringify({ role: "assistant", content: assistantText.trim() }),
				...(question ? { prompt_messages: [{ role: "user", content: question }] } : {}),
				completion_message: { role: "assistant", content: assistantText.trim() },
				...(typeof usage?.inputTokens === "number" ? { prompt_tokens: usage.inputTokens } : {}),
				...(typeof usage?.outputTokens === "number" ? { completion_tokens: usage.outputTokens } : {}),
				...(typeof usage?.totalCost === "number" ? { cost: usage.totalCost } : {}),
				latency: latencySeconds,
				keywordsai_params: { has_webhook: false, environment: "vscode-extension" },
				disable_log: disableLog,
				metadata: {
					source: "roo-code-vscode-extension",
					taskId: metadata?.taskId,
					mode: metadata?.mode,
					tool_call_count: toolCalls.size,
				},
			})
		}

		// Tool-call spans (these represent the model's tool calls; execution happens elsewhere).
		let toolIndex = 0
		for (const [id, tc] of toolCalls.entries()) {
			// Ensure tool spans don't all share identical timestamps (can happen if streamed quickly).
			const startMs = Math.min(tc.startMs, tc.endMs, requestEndTimeMs)
			const endMs = Math.max(tc.endMs, startMs)
			const startIso = new Date(startMs + toolIndex).toISOString()
			const endIso = new Date(endMs + toolIndex).toISOString()
			const latencySeconds = Math.max(0, (endMs - startMs) / 1000)
			toolIndex++

			spans.push({
				log_type: "tool",
				trace_unique_id: ctx.traceUniqueId,
				span_unique_id: randomUUID(),
				span_name: `tool_call.${tc.name ?? "unknown"}`,
				span_parent_id: ctx.rootSpanId,
				start_time: startIso,
				timestamp: endIso,
				span_workflow_name: spanWorkflowName,
				span_path: "",
				provider_id: "roo-code",
				model: "tool_call",
				input: JSON.stringify({ id, name: tc.name, arguments: tc.args }),
				output: JSON.stringify({}),
				latency: latencySeconds,
				keywordsai_params: { has_webhook: false, environment: "vscode-extension" },
				disable_log: disableLog,
				metadata: {
					source: "roo-code-vscode-extension",
					taskId: metadata?.taskId,
				},
			})
		}

		// Tool-result spans (these represent actual tool execution output, e.g. terminal stdout/stderr).
		// We attach them to the same trace/root span.
		let toolResultIndex = 0
		for (const tr of promptToolResults) {
			// Ensure these are later than the chat/tool_call spans for this request.
			const startMs = requestEndTimeMs + toolResultIndex * 2 + 1
			const endMs = startMs + 1
			toolResultIndex++

			spans.push({
				log_type: "tool",
				trace_unique_id: ctx.traceUniqueId,
				span_unique_id: randomUUID(),
				span_name: `tool_result.${tr.toolName ?? "unknown"}`,
				span_parent_id: ctx.rootSpanId,
				start_time: new Date(startMs).toISOString(),
				timestamp: new Date(endMs).toISOString(),
				span_workflow_name: spanWorkflowName,
				span_path: "",
				provider_id: "roo-code",
				model: "tool_result",
				// Put tool_input in input (not output) per KeywordsAI log model.
				input: JSON.stringify({
					tool_use_id: tr.toolUseId,
					tool_name: tr.toolName,
					tool_input: tr.toolInput,
				}),
				// Output should be the tool/terminal response.
				output: tr.toolOutput,
				latency: Math.max(0, (endMs - startMs) / 1000),
				keywordsai_params: { has_webhook: false, environment: "vscode-extension" },
				disable_log: disableLog,
				metadata: {
					source: "roo-code-vscode-extension",
					taskId: metadata?.taskId,
				},
			})
		}

		void ingestKeywordsAiTraceSpans({
			apiKey,
			baseUrl: this.options.keywordsaiBaseUrl,
			spans,
		}).catch(() => {})
	}
}
