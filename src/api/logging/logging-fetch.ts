import { ApiInferenceLogger } from "./ApiInferenceLogger"

export type LoggingFetchOptions = {
	provider: string
	/**
	 * Maximum number of bytes to buffer from request/response bodies.
	 * This protects against OOM when logging is enabled.
	 */
	maxBodySizeBytes?: number
}

const DEFAULT_MAX_BODY_SIZE_BYTES = 512 * 1024

function getMaxBodySizeBytes(maxBodySizeBytes?: number): number {
	return typeof maxBodySizeBytes === "number" && maxBodySizeBytes > 0 ? maxBodySizeBytes : DEFAULT_MAX_BODY_SIZE_BYTES
}

function tryParseJson(text: string): unknown {
	try {
		return JSON.parse(text)
	} catch {
		return undefined
	}
}

function extractModelId(payload: unknown): string | undefined {
	if (!payload || typeof payload !== "object") return undefined

	const rec = payload as Record<string, unknown>
	const model = rec["model"]
	return typeof model === "string" && model.trim().length > 0 ? model : undefined
}

type OpenAiToolCall = {
	id: string
	type: "function"
	function: { name: string; arguments: string }
}

type OpenAiAssembledChoice = {
	index: number
	message: {
		role: string
		content: string
		reasoning?: string
		reasoning_details?: unknown
		tool_calls?: OpenAiToolCall[]
	}
	finish_reason: string | null
}

type OpenAiAssembledResponse = {
	id?: string
	object: "chat.completion"
	created?: number
	model?: string
	choices: OpenAiAssembledChoice[]
	usage?: unknown
}

type ParsedSsePayload = {
	model?: string
	payload: unknown
}

type SseDebugInfo = {
	format: "sse"
	/** Total SSE blocks (event groups) in the raw stream */
	blocks: number
	/** Number of parsed blocks included in `events` (capped) */
	loggedBlocks: number
	/** Bounded raw SSE (comments/keepalives stripped) */
	__rawSse: string | TruncatedStringSummary
	/** Parsed events (best-effort; data may be JSON or a truncated string summary) */
	events: Array<{ event?: string; data?: unknown }>
}

const DEFAULT_SSE_PREVIEW_CHARS = 1500
const DEFAULT_SSE_MAX_EVENTS = 50

type TruncatedStringSummary = {
	truncated: true
	length: number
	head: string
	tail: string
}

function summarizeLongString(
	text: string,
	maxChars: number = DEFAULT_SSE_PREVIEW_CHARS,
): string | TruncatedStringSummary {
	if (text.length <= maxChars * 2) return text
	return {
		truncated: true,
		length: text.length,
		head: text.slice(0, maxChars),
		tail: text.slice(-maxChars),
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null
}

type AnthropicUsage = {
	input_tokens?: number
	output_tokens?: number
	cache_creation_input_tokens?: number
	cache_read_input_tokens?: number
}

type AnthropicContentBlock =
	| { type: "text"; text: string; [key: string]: unknown }
	| { type: "thinking"; thinking: string; [key: string]: unknown }
	| { type: "tool_use"; id?: string; name?: string; input?: unknown; [key: string]: unknown }
	| { type: string; [key: string]: unknown }

type AnthropicAssembledMessage = {
	id?: string
	type: "message"
	role?: string
	model?: string
	content: AnthropicContentBlock[]
	stop_reason?: string | null
	stop_sequence?: string | null
	usage?: AnthropicUsage
}

function parseAnthropicStreamingSse(text: string): AnthropicAssembledMessage | undefined {
	// Assemble Anthropic Messages SSE into a final message object.
	// Reference: https://docs.anthropic.com/en/api/messages-streaming

	const blocks = text
		.split(/\n\n+/g)
		.map((b) => b.trim())
		.filter(Boolean)

	let message: AnthropicAssembledMessage | undefined
	const contentByIndex = new Map<number, AnthropicContentBlock>()
	const toolInputJsonByIndex = new Map<number, string[]>()

	type AnthropicUnhandledDelta = {
		sseBlockIndex: number
		event?: string
		delta: Record<string, unknown>
	}

	function pushUnhandledDelta(index: number, entry: AnthropicUnhandledDelta) {
		const current = contentByIndex.get(index)
		if (!current) return
		const rec = current as Record<string, unknown>
		const existing = rec["__unhandled_deltas"]
		const next = Array.isArray(existing) ? (existing as unknown[]).slice(0, DEFAULT_SSE_MAX_EVENTS) : []
		next.push(entry)
		rec["__unhandled_deltas"] = next
	}

	let sseBlockIndex = 0
	for (const block of blocks) {
		let eventName: string | undefined
		const dataParts: string[] = []

		for (const line of block.split("\n")) {
			const trimmed = line.trimEnd()
			if (trimmed.startsWith(":")) continue
			if (trimmed.startsWith("event:")) {
				eventName = trimmed.slice("event:".length).trim() || undefined
				continue
			}
			if (trimmed.startsWith("data:")) {
				dataParts.push(trimmed.slice("data:".length).trim())
			}
		}

		if (dataParts.length === 0) {
			sseBlockIndex++
			continue
		}
		const dataText = dataParts.join("\n")
		if (dataText === "[DONE]") break

		const parsed = tryParseJson(dataText)
		if (!parsed || !isRecord(parsed)) {
			sseBlockIndex++
			continue
		}

		const typeFromData = typeof parsed["type"] === "string" ? (parsed["type"] as string) : undefined
		const event = eventName ?? typeFromData
		if (!event) {
			sseBlockIndex++
			continue
		}

		if (event === "message_start") {
			const m = isRecord(parsed["message"]) ? (parsed["message"] as Record<string, unknown>) : undefined
			if (!m) continue

			// Preserve the raw message_start.message object as much as possible.
			// We'll replace content with the assembled content blocks below.
			message = {
				...(m as Omit<AnthropicAssembledMessage, "content" | "type">),
				type: "message",
				content: [],
			}
			sseBlockIndex++
			continue
		}

		if (!message) {
			// Not an Anthropic message stream.
			return undefined
		}

		if (event === "content_block_start") {
			const index = typeof parsed["index"] === "number" ? (parsed["index"] as number) : 0
			const cb = isRecord(parsed["content_block"])
				? (parsed["content_block"] as Record<string, unknown>)
				: undefined
			if (!cb) continue

			const cbType = typeof cb["type"] === "string" ? (cb["type"] as string) : "unknown"
			const block: Record<string, unknown> = { ...cb, type: cbType }
			if (cbType === "text") {
				block["text"] = typeof cb["text"] === "string" ? (cb["text"] as string) : ""
			}
			if (cbType === "thinking") {
				block["thinking"] = typeof cb["thinking"] === "string" ? (cb["thinking"] as string) : ""
			}
			if (cbType === "tool_use") {
				toolInputJsonByIndex.set(index, [])
			}
			contentByIndex.set(index, block as AnthropicContentBlock)
			sseBlockIndex++
			continue
		}

		if (event === "content_block_delta") {
			const index = typeof parsed["index"] === "number" ? (parsed["index"] as number) : 0
			const delta = isRecord(parsed["delta"]) ? (parsed["delta"] as Record<string, unknown>) : undefined
			if (!delta) continue
			const deltaType = typeof delta["type"] === "string" ? (delta["type"] as string) : "unknown"

			const current = contentByIndex.get(index)
			if (!current) {
				sseBlockIndex++
				continue
			}

			const currentRec = current as Record<string, unknown>
			if (current.type === "text" && deltaType === "text_delta" && typeof delta["text"] === "string") {
				const prev = typeof currentRec["text"] === "string" ? (currentRec["text"] as string) : ""
				currentRec["text"] = prev + (delta["text"] as string)
			} else if (
				current.type === "thinking" &&
				deltaType === "thinking_delta" &&
				typeof delta["thinking"] === "string"
			) {
				const prev = typeof currentRec["thinking"] === "string" ? (currentRec["thinking"] as string) : ""
				currentRec["thinking"] = prev + (delta["thinking"] as string)
			} else if (deltaType === "signature_delta" && typeof delta["signature"] === "string") {
				// Interleaved thinking uses signature deltas that must be preserved alongside thinking blocks.
				// Some streams initialize signature as "" in content_block_start and then send the real value via signature_delta.
				const prev = typeof currentRec["signature"] === "string" ? (currentRec["signature"] as string) : ""
				currentRec["signature"] = prev + (delta["signature"] as string)
			} else if (
				current.type === "tool_use" &&
				deltaType === "input_json_delta" &&
				(typeof delta["partial_json"] === "string" || typeof (delta as any)["partial_json"] === "string")
			) {
				const partial = (delta["partial_json"] ?? (delta as any)["partial_json"]) as string
				const acc = toolInputJsonByIndex.get(index)
				if (acc) acc.push(partial)
			} else {
				pushUnhandledDelta(index, {
					sseBlockIndex,
					event,
					delta,
				})
			}
			sseBlockIndex++
			continue
		}

		if (event === "content_block_stop") {
			const index = typeof parsed["index"] === "number" ? (parsed["index"] as number) : 0
			const current = contentByIndex.get(index)
			if (current?.type === "tool_use") {
				const parts = toolInputJsonByIndex.get(index)
				if (parts && parts.length > 0) {
					const joined = parts.join("")
					const parsedJson = tryParseJson(joined)
					current.input = typeof parsedJson === "undefined" ? joined : parsedJson
				}
			}
			sseBlockIndex++
			continue
		}

		if (event === "message_delta") {
			const delta = isRecord(parsed["delta"]) ? (parsed["delta"] as Record<string, unknown>) : undefined
			if (delta) {
				// Preserve all message-level delta fields (except content/type) so we don't drop
				// new/unknown fields introduced by Anthropic.
				for (const [k, v] of Object.entries(delta)) {
					if (k === "content" || k === "type") continue
					;(message as unknown as Record<string, unknown>)[k] = v
				}
			}

			if (isRecord(parsed["usage"])) {
				message.usage = { ...(message.usage ?? {}), ...(parsed["usage"] as AnthropicUsage) }
			}
			sseBlockIndex++
			continue
		}

		if (event === "message_stop") {
			break
		}

		sseBlockIndex++
	}

	if (!message) return undefined

	// Finalize content array in index order.
	message.content = Array.from(contentByIndex.entries())
		.sort(([a], [b]) => a - b)
		.map(([, block]) => block)

	return message
}

function parseOpenAiStreamingSse(text: string): OpenAiAssembledResponse | undefined {
	// Parse SSE text and attempt to assemble an OpenAI-style chat completion response.
	// If the stream isn't OpenAI-like, return undefined and fall back to raw text logging.

	const byChoiceIndex = new Map<
		number,
		{
			role?: string
			contentParts: string[]
			reasoningParts: string[]
			finishReason: string | null
			toolCallsById: Map<string, { id: string; name?: string; argsParts: string[] }>
			reasoningDetails: Map<
				string,
				{ type: string; index: number; text?: string; summary?: string; data?: string }
			>
		}
	>()

	let sawChoices = false
	let id: string | undefined
	let created: number | undefined
	let model: string | undefined
	let usage: unknown = undefined

	const blocks = text.split(/\n\n+/g)
	for (const block of blocks) {
		if (!block.trim()) continue

		const lines = block.split("\n")
		const dataParts: string[] = []
		for (const line of lines) {
			const trimmed = line.trimEnd()
			// Ignore SSE comment/keepalive lines like ": OPENROUTER PROCESSING".
			if (trimmed.startsWith(":")) continue
			if (trimmed.startsWith("data:")) {
				dataParts.push(trimmed.slice("data:".length).trim())
			}
		}

		if (dataParts.length === 0) continue

		const data = dataParts.join("\n")
		if (data === "[DONE]") break

		const parsed = tryParseJson(data)
		if (!parsed || !isRecord(parsed)) continue

		const choices = parsed["choices"]
		if (!Array.isArray(choices)) continue

		sawChoices = true
		if (typeof parsed["id"] === "string") id = parsed["id"] as string
		if (typeof parsed["created"] === "number") created = parsed["created"] as number
		if (typeof parsed["model"] === "string") model = parsed["model"] as string
		if ("usage" in parsed) usage = parsed["usage"]

		for (const choiceAny of choices) {
			if (!isRecord(choiceAny)) continue
			const index = typeof choiceAny["index"] === "number" ? (choiceAny["index"] as number) : 0
			const finishReason =
				choiceAny["finish_reason"] === null || typeof choiceAny["finish_reason"] === "string"
					? (choiceAny["finish_reason"] as string | null)
					: null

			const delta = isRecord(choiceAny["delta"]) ? (choiceAny["delta"] as Record<string, unknown>) : undefined
			if (!delta) continue

			let state = byChoiceIndex.get(index)
			if (!state) {
				state = {
					contentParts: [],
					reasoningParts: [],
					finishReason: null,
					toolCallsById: new Map(),
					reasoningDetails: new Map(),
				}
				byChoiceIndex.set(index, state)
			}

			if (!state.role && typeof delta["role"] === "string") state.role = delta["role"] as string

			if (typeof delta["content"] === "string") {
				state.contentParts.push(delta["content"] as string)
			}

			for (const key of ["reasoning", "reasoning_content"] as const) {
				if (typeof delta[key] === "string") {
					state.reasoningParts.push(delta[key] as string)
					break
				}
			}

			const toolCalls = delta["tool_calls"]
			if (Array.isArray(toolCalls)) {
				for (const tcAny of toolCalls) {
					if (!isRecord(tcAny)) continue
					const tcId = typeof tcAny["id"] === "string" ? (tcAny["id"] as string) : undefined
					const tcIndex = typeof tcAny["index"] === "number" ? (tcAny["index"] as number) : undefined
					const idKey = tcId ?? `index-${tcIndex ?? 0}`
					const fn = isRecord(tcAny["function"]) ? (tcAny["function"] as Record<string, unknown>) : undefined
					const name = typeof fn?.["name"] === "string" ? (fn?.["name"] as string) : undefined
					const args = typeof fn?.["arguments"] === "string" ? (fn?.["arguments"] as string) : undefined

					let existing = state.toolCallsById.get(idKey)
					if (!existing) {
						existing = { id: idKey, name, argsParts: [] }
						state.toolCallsById.set(idKey, existing)
					}
					if (!existing.name && name) existing.name = name
					if (args) existing.argsParts.push(args)
				}
			}

			const reasoningDetailsAny = delta["reasoning_details"]
			if (Array.isArray(reasoningDetailsAny)) {
				for (const detailAny of reasoningDetailsAny) {
					if (!isRecord(detailAny)) continue
					const type = typeof detailAny["type"] === "string" ? (detailAny["type"] as string) : "unknown"
					const rIndex = typeof detailAny["index"] === "number" ? (detailAny["index"] as number) : 0
					const key = `${type}-${rIndex}`
					const existing = state.reasoningDetails.get(key)
					const textPart = typeof detailAny["text"] === "string" ? (detailAny["text"] as string) : undefined
					const summaryPart =
						typeof detailAny["summary"] === "string" ? (detailAny["summary"] as string) : undefined
					const dataPart = typeof detailAny["data"] === "string" ? (detailAny["data"] as string) : undefined

					if (existing) {
						if (textPart) existing.text = (existing.text ?? "") + textPart
						if (summaryPart) existing.summary = (existing.summary ?? "") + summaryPart
						if (dataPart) existing.data = (existing.data ?? "") + dataPart
					} else {
						state.reasoningDetails.set(key, {
							type,
							index: rIndex,
							...(textPart ? { text: textPart } : {}),
							...(summaryPart ? { summary: summaryPart } : {}),
							...(dataPart ? { data: dataPart } : {}),
						})
					}
				}
			}

			if (finishReason !== null) state.finishReason = finishReason
		}
	}

	if (!sawChoices) return undefined

	const choicesOut: OpenAiAssembledChoice[] = Array.from(byChoiceIndex.entries())
		.sort(([a], [b]) => a - b)
		.map(([index, state]) => {
			const toolCallsOut: OpenAiToolCall[] = Array.from(state.toolCallsById.values())
				.filter((tc) => typeof tc.name === "string" && tc.name.length > 0)
				.map((tc) => ({
					id: tc.id,
					type: "function",
					function: { name: tc.name!, arguments: tc.argsParts.join("") },
				}))

			const reasoningDetailsOut =
				state.reasoningDetails.size > 0
					? Array.from(state.reasoningDetails.values()).sort((a, b) => a.index - b.index)
					: undefined

			return {
				index,
				message: {
					role: state.role ?? "assistant",
					content: state.contentParts.join(""),
					...(state.reasoningParts.length > 0 ? { reasoning: state.reasoningParts.join("") } : {}),
					...(reasoningDetailsOut ? { reasoning_details: reasoningDetailsOut } : {}),
					...(toolCallsOut.length > 0 ? { tool_calls: toolCallsOut } : {}),
				},
				finish_reason: state.finishReason,
			}
		})

	return {
		id,
		object: "chat.completion",
		created,
		model,
		choices: choicesOut,
		...(typeof usage === "undefined" ? {} : { usage }),
	}
}

function parseSsePayload(text: string): ParsedSsePayload {
	// Log SSE in a structured way so callers can see the *actual* wire format.
	// We always include `events` + `__rawSse`, and optionally include an `assembled` object
	// for convenience when we recognize a stream format.
	const stripped = text
		.split("\n")
		.filter((line) => !line.trimStart().startsWith(":"))
		.join("\n")

	const blocks = stripped.split(/\n\n+/g)
	const events: Array<{ event?: string; data?: unknown }> = []
	let totalBlocks = 0

	for (const block of blocks) {
		if (!block.trim()) continue
		totalBlocks++
		if (events.length >= DEFAULT_SSE_MAX_EVENTS) continue

		let eventName: string | undefined
		const dataParts: string[] = []
		for (const line of block.split("\n")) {
			const trimmed = line.trimEnd()
			if (trimmed.startsWith("event:")) {
				eventName = trimmed.slice("event:".length).trim() || undefined
				continue
			}
			if (trimmed.startsWith("data:")) {
				dataParts.push(trimmed.slice("data:".length).trim())
			}
		}

		if (dataParts.length === 0) continue
		const dataText = dataParts.join("\n")
		if (dataText === "[DONE]") break

		const maybeJson = tryParseJson(dataText)
		const dataPayload = typeof maybeJson === "undefined" ? summarizeLongString(dataText) : maybeJson
		events.push({ ...(eventName ? { event: eventName } : {}), data: dataPayload })
	}

	const debug: SseDebugInfo = {
		format: "sse",
		blocks: totalBlocks,
		loggedBlocks: events.length,
		__rawSse: summarizeLongString(stripped),
		events,
	}

	const openAi = parseOpenAiStreamingSse(text)
	if (openAi) {
		return {
			model: openAi.model,
			payload: {
				...openAi,
				__sse: debug,
			},
		}
	}

	const anthropic = parseAnthropicStreamingSse(text)
	if (anthropic) {
		return {
			model: anthropic.model,
			payload: {
				...anthropic,
				__sse: debug,
			},
		}
	}

	return { payload: debug }
}

async function readStreamToText(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<string> {
	const reader = stream.getReader()
	const decoder = new TextDecoder()
	let bytesRead = 0
	const parts: string[] = []

	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			if (!value || value.length === 0) continue

			const remaining = maxBytes - bytesRead
			if (remaining <= 0) break

			const slice = value.length > remaining ? value.subarray(0, remaining) : value
			bytesRead += slice.length
			parts.push(decoder.decode(slice, { stream: true }))

			if (bytesRead >= maxBytes) break
		}
	} finally {
		reader.releaseLock()
	}

	parts.push(decoder.decode())
	return parts.join("")
}

async function getRequestBodyForLogging(input: RequestInfo | URL, init: RequestInit | undefined, maxBytes: number) {
	// Prefer init.body because that's the most common usage.
	const body = init?.body
	if (typeof body === "string") {
		const maybeJson = tryParseJson(body)
		return { payload: maybeJson ?? body, model: extractModelId(maybeJson) }
	}

	if (body instanceof URLSearchParams) {
		return { payload: body.toString(), model: undefined }
	}

	// If fetch was called with a Request and no init, try to read its body.
	if (!body && typeof Request !== "undefined" && input instanceof Request) {
		try {
			const cloned = input.clone()
			if (cloned.body) {
				const text = await readStreamToText(cloned.body as ReadableStream<Uint8Array>, maxBytes)
				const maybeJson = tryParseJson(text)
				return { payload: maybeJson ?? text, model: extractModelId(maybeJson) }
			}
		} catch {
			// Ignore body read errors.
		}
	}

	if (body) {
		return {
			payload: `[Unlogged body type=${Object.prototype.toString.call(body)}]`,
			model: undefined,
		}
	}

	return { payload: undefined, model: undefined }
}

async function logNonStreamingResponse(
	response: Response,
	provider: string,
	model: string,
	durationMs: number,
	maxBytes: number,
): Promise<void> {
	try {
		const clone = response.clone()
		const contentType = clone.headers.get("content-type") ?? ""

		let payload: unknown = undefined
		if (clone.body) {
			const text = await readStreamToText(clone.body as ReadableStream<Uint8Array>, maxBytes)
			if (contentType.includes("application/json") || contentType.includes("+json")) {
				payload = tryParseJson(text) ?? text
			} else {
				payload = text
			}
		}

		ApiInferenceLogger.logRaw(`[API][response][${provider}][${model}][${durationMs}ms]`, payload)
	} catch (error) {
		ApiInferenceLogger.logRawError(`[API][error][${provider}][${model}][${durationMs}ms]`, error)
	}
}

async function logSseResponse(
	stream: ReadableStream<Uint8Array>,
	provider: string,
	fallbackModel: string,
	startedAt: number,
	maxBytes: number,
): Promise<void> {
	try {
		const text = await readStreamToText(stream, maxBytes)
		const { payload, model: modelFromStream } = parseSsePayload(text)
		const durationMs = Date.now() - startedAt
		const model = modelFromStream ?? fallbackModel
		ApiInferenceLogger.logRaw(`[API][response][${provider}][${model}][${durationMs}ms][streaming]`, payload)
	} catch (error) {
		const durationMs = Date.now() - startedAt
		ApiInferenceLogger.logRawError(`[API][error][${provider}][${fallbackModel}][${durationMs}ms]`, error)
	}
}

export function createLoggingFetch(options: LoggingFetchOptions, baseFetch: typeof fetch = fetch): typeof fetch {
	return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		// Fast path: no overhead when disabled.
		if (!ApiInferenceLogger.isEnabled()) {
			return baseFetch(input, init)
		}

		const maxBytes = getMaxBodySizeBytes(options.maxBodySizeBytes)
		const startedAt = Date.now()

		const { payload: requestPayload, model: requestModel } = await getRequestBodyForLogging(input, init, maxBytes)
		const model = requestModel ?? "unknown"

		ApiInferenceLogger.logRaw(`[API][request][${options.provider}][${model}]`, requestPayload)

		try {
			const response = await baseFetch(input, init)
			const durationMs = Date.now() - startedAt

			const contentType = response.headers.get("content-type") ?? ""
			const isSse = contentType.includes("text/event-stream")

			if (!isSse) {
				await logNonStreamingResponse(response, options.provider, model, durationMs, maxBytes)
				return response
			}

			if (!response.body) {
				ApiInferenceLogger.logRaw(
					`[API][response][${options.provider}][${model}][${durationMs}ms][streaming]`,
					undefined,
				)
				return response
			}

			// Tee the stream so the consumer can read one branch while we buffer the other.
			const [consumerStream, logStream] = response.body.tee()
			// Note: returning a new Response means some Response properties (e.g. `url`) are not preserved.
			const responseForConsumer = new Response(consumerStream, {
				status: response.status,
				statusText: response.statusText,
				headers: new Headers(response.headers),
			})
			void logSseResponse(logStream, options.provider, model, startedAt, maxBytes)
			return responseForConsumer
		} catch (error) {
			const durationMs = Date.now() - startedAt
			ApiInferenceLogger.logRawError(`[API][error][${options.provider}][${model}][${durationMs}ms]`, error)
			throw error
		}
	}
}
