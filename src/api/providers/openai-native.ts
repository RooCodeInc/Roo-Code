import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import {
	type ModelInfo,
	openAiNativeDefaultModelId,
	OpenAiNativeModelId,
	openAiNativeModels,
	OPENAI_NATIVE_DEFAULT_TEMPERATURE,
	GPT5_DEFAULT_TEMPERATURE,
	type ReasoningEffort,
	type VerbosityLevel,
	type ReasoningEffortWithMinimal,
	type ServiceTier,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { calculateApiCostOpenAI } from "../../shared/cost"

import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

export type OpenAiNativeModel = ReturnType<OpenAiNativeHandler["getModel"]>

// GPT-5 specific types

// Constants for model identification
const GPT5_MODEL_PREFIX = "gpt-5"

// Marker for terminal background-mode failures so we don't attempt resume/poll fallbacks
function createTerminalBackgroundError(message: string): Error {
	const err = new Error(message)
	;(err as any).isTerminalBackgroundError = true
	err.name = "TerminalBackgroundError"
	return err
}
function isTerminalBackgroundError(err: any): boolean {
	return !!(err && (err as any).isTerminalBackgroundError)
}

export class OpenAiNativeHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	private lastResponseId: string | undefined
	private responseIdPromise: Promise<string | undefined> | undefined
	private responseIdResolver: ((value: string | undefined) => void) | undefined
	// Resolved service tier from Responses API (actual tier used by OpenAI)
	private lastServiceTier: ServiceTier | undefined
	private lastSequenceNumber: number | undefined
	// Track whether current request is in background mode for status chunk annotation
	private currentRequestIsBackground?: boolean
	private resumeCutoffSequence?: number
	// Per-request tracking to prevent stale resume attempts
	private currentRequestResponseId?: string
	private currentRequestSequenceNumber?: number

	// Event types handled by the shared event processor to avoid duplication
	private readonly coreHandledEventTypes = new Set<string>([
		"response.text.delta",
		"response.output_text.delta",
		"response.reasoning.delta",
		"response.reasoning_text.delta",
		"response.reasoning_summary.delta",
		"response.reasoning_summary_text.delta",
		"response.refusal.delta",
		"response.output_item.added",
		"response.done",
		"response.completed",
	])

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		// Default to including reasoning.summary: "auto" for GPT‑5 unless explicitly disabled
		if (this.options.enableGpt5ReasoningSummary === undefined) {
			this.options.enableGpt5ReasoningSummary = true
		}
		const apiKey = this.options.openAiNativeApiKey ?? "not-provided"
		this.client = new OpenAI({ baseURL: this.options.openAiNativeBaseUrl, apiKey })
	}

	private normalizeUsage(usage: any, model: OpenAiNativeModel): ApiStreamUsageChunk | undefined {
		if (!usage) return undefined

		// Prefer detailed shapes when available (Responses API)
		const inputDetails = usage.input_tokens_details ?? usage.prompt_tokens_details

		// Extract cache information from details with better readability
		const hasCachedTokens = typeof inputDetails?.cached_tokens === "number"
		const hasCacheMissTokens = typeof inputDetails?.cache_miss_tokens === "number"
		const cachedFromDetails = hasCachedTokens ? inputDetails.cached_tokens : 0
		const missFromDetails = hasCacheMissTokens ? inputDetails.cache_miss_tokens : 0

		// If total input tokens are missing but we have details, derive from them
		let totalInputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0
		if (totalInputTokens === 0 && inputDetails && (cachedFromDetails > 0 || missFromDetails > 0)) {
			totalInputTokens = cachedFromDetails + missFromDetails
		}

		const totalOutputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0

		// Note: missFromDetails is NOT used as fallback for cache writes
		// Cache miss tokens represent tokens that weren't found in cache (part of input)
		// Cache write tokens represent tokens being written to cache for future use
		const cacheWriteTokens = usage.cache_creation_input_tokens ?? usage.cache_write_tokens ?? 0

		const cacheReadTokens =
			usage.cache_read_input_tokens ?? usage.cache_read_tokens ?? usage.cached_tokens ?? cachedFromDetails ?? 0

		// Resolve effective tier: prefer actual tier from response; otherwise requested tier
		const effectiveTier =
			this.lastServiceTier || (this.options.openAiNativeServiceTier as ServiceTier | undefined) || undefined
		const effectiveInfo = this.applyServiceTierPricing(model.info, effectiveTier)

		// Pass total input tokens directly to calculateApiCostOpenAI
		// The function handles subtracting both cache reads and writes internally (see shared/cost.ts:46)
		const totalCost = calculateApiCostOpenAI(
			effectiveInfo,
			totalInputTokens,
			totalOutputTokens,
			cacheWriteTokens,
			cacheReadTokens,
		)

		const reasoningTokens =
			typeof usage.output_tokens_details?.reasoning_tokens === "number"
				? usage.output_tokens_details.reasoning_tokens
				: undefined

		const out: ApiStreamUsageChunk = {
			type: "usage",
			// Keep inputTokens as TOTAL input to preserve correct context length
			inputTokens: totalInputTokens,
			outputTokens: totalOutputTokens,
			cacheWriteTokens,
			cacheReadTokens,
			...(typeof reasoningTokens === "number" ? { reasoningTokens } : {}),
			totalCost,
		}
		return out
	}

	private resolveResponseId(responseId: string | undefined): void {
		if (responseId) {
			this.lastResponseId = responseId
		}
		// Resolve the promise so the next request can use this ID
		if (this.responseIdResolver) {
			this.responseIdResolver(responseId)
			this.responseIdResolver = undefined
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = this.getModel()

		// Use Responses API for ALL models
		yield* this.handleResponsesApiMessage(model, systemPrompt, messages, metadata)
	}

	private async *handleResponsesApiMessage(
		model: OpenAiNativeModel,
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// Reset resolved tier for this request; will be set from response if present
		this.lastServiceTier = undefined

		// Use Responses API for ALL models
		const { verbosity, reasoning } = this.getModel()

		// Resolve reasoning effort for models that support it
		const reasoningEffort = this.getReasoningEffort(model)

		// Wait for any pending response ID from a previous request to be available
		// This handles the race condition with fast nano model responses
		let effectivePreviousResponseId = metadata?.previousResponseId

		// Check if we should suppress previous response ID (e.g., after condense or message edit)
		if (metadata?.suppressPreviousResponseId) {
			// Clear the stored lastResponseId to prevent it from being used in future requests
			this.lastResponseId = undefined
			effectivePreviousResponseId = undefined
		} else {
			// Only try to get fallback response IDs if not suppressing

			// If we have a pending response ID promise, wait for it to resolve
			if (!effectivePreviousResponseId && this.responseIdPromise) {
				try {
					const resolvedId = await Promise.race([
						this.responseIdPromise,
						// Timeout after 100ms to avoid blocking too long
						new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 100)),
					])
					if (resolvedId) {
						effectivePreviousResponseId = resolvedId
					}
				} catch {
					// Non-fatal if promise fails
				}
			}

			// Fall back to the last known response ID if still not available
			if (!effectivePreviousResponseId && this.lastResponseId) {
				effectivePreviousResponseId = this.lastResponseId
			}
		}

		// Format input and capture continuity id
		const { formattedInput, previousResponseId } = this.prepareStructuredInput(systemPrompt, messages, metadata)
		const requestPreviousResponseId = effectivePreviousResponseId || previousResponseId

		// Create a new promise for this request's response ID
		this.responseIdPromise = new Promise<string | undefined>((resolve) => {
			this.responseIdResolver = resolve
		})

		// Build request body
		const requestBody = this.buildRequestBody(
			model,
			formattedInput,
			requestPreviousResponseId,
			systemPrompt,
			verbosity,
			reasoningEffort,
			metadata,
		)

		// Make the request (pass systemPrompt and messages for potential retry)
		yield* this.executeRequest(requestBody, model, metadata, systemPrompt, messages)
	}

	private buildRequestBody(
		model: OpenAiNativeModel,
		formattedInput: any,
		requestPreviousResponseId: string | undefined,
		systemPrompt: string,
		verbosity: any,
		reasoningEffort: ReasoningEffortWithMinimal | undefined,
		metadata?: ApiHandlerCreateMessageMetadata,
	): any {
		// Build a request body (also used for fallback)
		// Ensure we explicitly pass max_output_tokens for GPT‑5 based on Roo's reserved model response calculation
		// so requests do not default to very large limits (e.g., 120k).
		interface Gpt5RequestBody {
			model: string
			input: Array<{ role: "user" | "assistant"; content: any[] }>
			stream: boolean
			reasoning?: { effort: ReasoningEffortWithMinimal; summary?: "auto" }
			text?: { verbosity: VerbosityLevel }
			temperature?: number
			max_output_tokens?: number
			previous_response_id?: string
			store?: boolean
			instructions?: string
			service_tier?: ServiceTier
			background?: boolean
		}

		// Validate requested tier against model support; if not supported, omit.
		const requestedTier = (this.options.openAiNativeServiceTier as ServiceTier | undefined) || undefined
		const allowedTierNames = new Set(model.info.tiers?.map((t) => t.name).filter(Boolean) || [])

		const body: Gpt5RequestBody = {
			model: model.id,
			input: formattedInput,
			stream: true,
			store: metadata?.store !== false, // Default to true unless explicitly set to false
			// Always include instructions (system prompt) for Responses API.
			// Unlike Chat Completions, system/developer roles in input have no special semantics here.
			// The official way to set system behavior is the top-level `instructions` field.
			instructions: systemPrompt,
			...(reasoningEffort && {
				reasoning: {
					effort: reasoningEffort,
					...(this.options.enableGpt5ReasoningSummary ? { summary: "auto" as const } : {}),
				},
			}),
			// Only include temperature if the model supports it
			...(model.info.supportsTemperature !== false && {
				temperature:
					this.options.modelTemperature ??
					(model.id.startsWith(GPT5_MODEL_PREFIX)
						? GPT5_DEFAULT_TEMPERATURE
						: OPENAI_NATIVE_DEFAULT_TEMPERATURE),
			}),
			// Explicitly include the calculated max output tokens.
			// Use the per-request reserved output computed by Roo (params.maxTokens from getModelParams).
			...(model.maxTokens ? { max_output_tokens: model.maxTokens } : {}),
			...(requestPreviousResponseId && { previous_response_id: requestPreviousResponseId }),
			// Include tier when selected and supported by the model, or when explicitly "default"
			...(requestedTier &&
				(requestedTier === "default" || allowedTierNames.has(requestedTier)) && {
					service_tier: requestedTier,
				}),
		}

		// Include text.verbosity only when the model explicitly supports it
		if (model.info.supportsVerbosity === true) {
			body.text = { verbosity: (verbosity || "medium") as VerbosityLevel }
		}

		// Enable background mode when either explicitly opted in or required by model metadata
		if (this.options.openAiNativeBackgroundMode === true || model.info.backgroundMode === true) {
			body.background = true
			body.stream = true
			body.store = true
		}

		return body
	}

	private async *executeRequest(
		requestBody: any,
		model: OpenAiNativeModel,
		metadata?: ApiHandlerCreateMessageMetadata,
		systemPrompt?: string,
		messages?: Anthropic.Messages.MessageParam[],
	): ApiStream {
		// Annotate if this request uses background mode (used for status chunks)
		this.currentRequestIsBackground = !!requestBody?.background
		// Reset per-request tracking to prevent stale values from previous requests
		this.currentRequestResponseId = undefined
		this.currentRequestSequenceNumber = undefined

		const canAttemptResume = () =>
			this.currentRequestIsBackground &&
			(this.options.openAiNativeBackgroundAutoResume ?? true) &&
			!!this.currentRequestResponseId &&
			typeof this.currentRequestSequenceNumber === "number"

		try {
			// Use the official SDK
			const stream = (await (this.client as any).responses.create(requestBody)) as AsyncIterable<any>

			if (typeof (stream as any)[Symbol.asyncIterator] !== "function") {
				throw new Error(
					"OpenAI SDK did not return an AsyncIterable for Responses API streaming. Falling back to SSE.",
				)
			}

			try {
				for await (const event of stream) {
					for await (const outChunk of this.processEvent(event, model)) {
						yield outChunk
					}
				}
			} catch (iterErr) {
				// If terminal failure, propagate and do not attempt resume/poll
				if (isTerminalBackgroundError(iterErr)) {
					throw iterErr
				}
				// Stream dropped mid-flight; attempt resume for background requests
				if (canAttemptResume()) {
					for await (const chunk of this.attemptResumeOrPoll(
						this.currentRequestResponseId!,
						this.currentRequestSequenceNumber!,
						model,
					)) {
						yield chunk
					}
					return
				}
				throw iterErr
			}
		} catch (sdkErr: any) {
			// Propagate terminal background failures without fallback
			if (isTerminalBackgroundError(sdkErr)) {
				throw sdkErr
			}
			// Check if this is a 400 error about previous_response_id not found
			const errorMessage = sdkErr?.message || sdkErr?.error?.message || ""
			const is400Error = sdkErr?.status === 400 || sdkErr?.response?.status === 400
			const isPreviousResponseError =
				errorMessage.includes("Previous response") || errorMessage.includes("not found")

			if (is400Error && requestBody.previous_response_id && isPreviousResponseError) {
				// Clear the stored lastResponseId to prevent using it again
				this.lastResponseId = undefined

				// Re-prepare the full conversation without previous_response_id
				let retryRequestBody = { ...requestBody }
				delete retryRequestBody.previous_response_id

				// If we have the original messages, re-prepare the full conversation
				if (systemPrompt && messages) {
					const { formattedInput } = this.prepareStructuredInput(systemPrompt, messages, undefined)
					retryRequestBody.input = formattedInput
				}

				try {
					// Retry with the SDK
					const retryStream = (await (this.client as any).responses.create(
						retryRequestBody,
					)) as AsyncIterable<any>

					if (typeof (retryStream as any)[Symbol.asyncIterator] !== "function") {
						// If SDK fails, fall back to SSE
						try {
							yield* this.makeGpt5ResponsesAPIRequest(
								retryRequestBody,
								model,
								metadata,
								systemPrompt,
								messages,
							)
							return
						} catch (fallbackErr) {
							if (canAttemptResume()) {
								for await (const chunk of this.attemptResumeOrPoll(
									this.currentRequestResponseId!,
									this.currentRequestSequenceNumber!,
									model,
								)) {
									yield chunk
								}
								return
							}
							throw fallbackErr
						}
					}

					try {
						for await (const event of retryStream) {
							for await (const outChunk of this.processEvent(event, model)) {
								yield outChunk
							}
						}
						return
					} catch (iterErr) {
						if (isTerminalBackgroundError(iterErr)) {
							throw iterErr
						}
						if (canAttemptResume()) {
							for await (const chunk of this.attemptResumeOrPoll(
								this.currentRequestResponseId!,
								this.currentRequestSequenceNumber!,
								model,
							)) {
								yield chunk
							}
							return
						}
						throw iterErr
					}
				} catch (retryErr) {
					if (isTerminalBackgroundError(retryErr)) {
						throw retryErr
					}
					// If retry also fails, fall back to SSE
					try {
						yield* this.makeGpt5ResponsesAPIRequest(
							retryRequestBody,
							model,
							metadata,
							systemPrompt,
							messages,
						)
						return
					} catch (fallbackErr) {
						if (isTerminalBackgroundError(fallbackErr)) {
							throw fallbackErr
						}
						if (canAttemptResume()) {
							for await (const chunk of this.attemptResumeOrPoll(
								this.currentRequestResponseId!,
								this.currentRequestSequenceNumber!,
								model,
							)) {
								yield chunk
							}
							return
						}
						throw fallbackErr
					}
				}
			}

			// For other errors, fallback to manual SSE via fetch
			try {
				yield* this.makeGpt5ResponsesAPIRequest(requestBody, model, metadata, systemPrompt, messages)
			} catch (fallbackErr) {
				// If SSE fallback fails mid-stream and we can resume, try that
				if (isTerminalBackgroundError(fallbackErr)) {
					throw fallbackErr
				}
				if (canAttemptResume()) {
					for await (const chunk of this.attemptResumeOrPoll(
						this.currentRequestResponseId!,
						this.currentRequestSequenceNumber!,
						model,
					)) {
						yield chunk
					}
					return
				}
				throw fallbackErr
			}
		} finally {
			// Always clear background flag and per-request tracking at end of request lifecycle
			this.currentRequestIsBackground = undefined
			this.currentRequestResponseId = undefined
			this.currentRequestSequenceNumber = undefined
		}
	}

	private formatFullConversation(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): any {
		// Format the entire conversation history for the Responses API using structured format
		// This supports both text and images
		const formattedMessages: any[] = []

		// Do NOT embed the system prompt as a developer message in the Responses API input.
		// The Responses API treats roles as free-form; use the top-level `instructions` field instead.

		// Process each message
		for (const message of messages) {
			const role = message.role === "user" ? "user" : "assistant"
			const content: any[] = []

			if (typeof message.content === "string") {
				// For user messages, use input_text; for assistant messages, use output_text
				if (role === "user") {
					content.push({ type: "input_text", text: message.content })
				} else {
					content.push({ type: "output_text", text: message.content })
				}
			} else if (Array.isArray(message.content)) {
				// For array content with potential images, format properly
				for (const block of message.content) {
					if (block.type === "text") {
						// For user messages, use input_text; for assistant messages, use output_text
						if (role === "user") {
							content.push({ type: "input_text", text: (block as any).text })
						} else {
							content.push({ type: "output_text", text: (block as any).text })
						}
					} else if (block.type === "image") {
						const image = block as Anthropic.Messages.ImageBlockParam
						// Format image with proper data URL - images are always input_image
						const imageUrl = `data:${image.source.media_type};base64,${image.source.data}`
						content.push({ type: "input_image", image_url: imageUrl })
					}
				}
			}

			if (content.length > 0) {
				formattedMessages.push({ role, content })
			}
		}

		return formattedMessages
	}

	private formatSingleStructuredMessage(message: Anthropic.Messages.MessageParam): any {
		// Format a single message for the Responses API when using previous_response_id
		// When using previous_response_id, we only send the latest user message
		const role = message.role === "user" ? "user" : "assistant"

		if (typeof message.content === "string") {
			// For simple string content, return structured format with proper type
			return {
				role,
				content: [{ type: "input_text", text: message.content }],
			}
		} else if (Array.isArray(message.content)) {
			// Extract text and image content from blocks
			const content: any[] = []

			for (const block of message.content) {
				if (block.type === "text") {
					// User messages use input_text
					content.push({ type: "input_text", text: (block as any).text })
				} else if (block.type === "image") {
					const image = block as Anthropic.Messages.ImageBlockParam
					const imageUrl = `data:${image.source.media_type};base64,${image.source.data}`
					content.push({ type: "input_image", image_url: imageUrl })
				}
			}

			if (content.length > 0) {
				return { role, content }
			}
		}

		return null
	}

	private async *makeGpt5ResponsesAPIRequest(
		requestBody: any,
		model: OpenAiNativeModel,
		metadata?: ApiHandlerCreateMessageMetadata,
		systemPrompt?: string,
		messages?: Anthropic.Messages.MessageParam[],
	): ApiStream {
		const apiKey = this.options.openAiNativeApiKey ?? "not-provided"
		const baseUrl = this.options.openAiNativeBaseUrl || "https://api.openai.com"
		const url = `${baseUrl}/v1/responses`

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
					Accept: "text/event-stream",
				},
				body: JSON.stringify(requestBody),
			})

			if (!response.ok) {
				const errorText = await response.text()

				let errorMessage = `GPT-5 API request failed (${response.status})`
				let errorDetails = ""

				// Try to parse error as JSON for better error messages
				try {
					const errorJson = JSON.parse(errorText)
					if (errorJson.error?.message) {
						errorDetails = errorJson.error.message
					} else if (errorJson.message) {
						errorDetails = errorJson.message
					} else {
						errorDetails = errorText
					}
				} catch {
					// If not JSON, use the raw text
					errorDetails = errorText
				}

				// Check if this is a 400 error about previous_response_id not found
				const isPreviousResponseError =
					errorDetails.includes("Previous response") || errorDetails.includes("not found")

				if (response.status === 400 && requestBody.previous_response_id && isPreviousResponseError) {
					// Log the error and retry without the previous_response_id

					// Clear the stored lastResponseId to prevent using it again
					this.lastResponseId = undefined
					// Resolve the promise once to unblock any waiting requests
					this.resolveResponseId(undefined)

					// Re-prepare the full conversation without previous_response_id
					let retryRequestBody = { ...requestBody }
					delete retryRequestBody.previous_response_id

					// If we have the original messages, re-prepare the full conversation
					if (systemPrompt && messages) {
						const { formattedInput } = this.prepareStructuredInput(systemPrompt, messages, undefined)
						retryRequestBody.input = formattedInput
					}

					// Retry the request with full conversation context
					const retryResponse = await fetch(url, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${apiKey}`,
							Accept: "text/event-stream",
						},
						body: JSON.stringify(retryRequestBody),
					})

					if (!retryResponse.ok) {
						// If retry also fails, throw the original error
						throw new Error(`Responses API retry failed (${retryResponse.status})`)
					}

					if (!retryResponse.body) {
						throw new Error("Responses API error: No response body from retry request")
					}

					// Handle the successful retry response
					yield* this.handleStreamResponse(retryResponse.body, model)
					return
				}

				// Provide user-friendly error messages based on status code
				switch (response.status) {
					case 400:
						errorMessage = "Invalid request to Responses API. Please check your input parameters."
						break
					case 401:
						errorMessage = "Authentication failed. Please check your OpenAI API key."
						break
					case 403:
						errorMessage = "Access denied. Your API key may not have access to this endpoint."
						break
					case 404:
						errorMessage =
							"Responses API endpoint not found. The endpoint may not be available yet or requires a different configuration."
						break
					case 429:
						errorMessage = "Rate limit exceeded. Please try again later."
						break
					case 500:
					case 502:
					case 503:
						errorMessage = "OpenAI service error. Please try again later."
						break
					default:
						errorMessage = `Responses API error (${response.status})`
				}

				// Append details if available
				if (errorDetails) {
					errorMessage += ` - ${errorDetails}`
				}

				throw new Error(errorMessage)
			}

			if (!response.body) {
				throw new Error("Responses API error: No response body")
			}

			// Handle streaming response
			yield* this.handleStreamResponse(response.body, model)
		} catch (error) {
			if (error instanceof Error) {
				// Re-throw with the original error message if it's already formatted
				if (error.message.includes("Responses API")) {
					throw error
				}
				// Otherwise, wrap it with context
				throw new Error(`Failed to connect to Responses API: ${error.message}`)
			}
			// Handle non-Error objects
			throw new Error(`Unexpected error connecting to Responses API`)
		}
	}

	/**
	 * Prepares the input and conversation continuity parameters for a Responses API call.
	 * Decides whether to send full conversation or just the latest message based on previousResponseId.
	 *
	 * - If a `previousResponseId` is available (either from metadata or the handler's state),
	 *   it formats only the most recent user message for the input and returns the response ID
	 *   to maintain conversation context.
	 * - Otherwise, it formats the entire conversation history (system prompt + messages) for the input.
	 *
	 * @returns An object containing the formatted input and the previous response ID (if used).
	 */
	private prepareStructuredInput(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): { formattedInput: any; previousResponseId?: string } {
		// Note: suppressPreviousResponseId is handled in handleResponsesApiMessage
		// This method now only handles formatting based on whether we have a previous response ID

		// Check for previous response ID from metadata or fallback to lastResponseId
		const isFirstMessage = messages.length === 1 && messages[0].role === "user"
		const previousResponseId = metadata?.previousResponseId ?? (!isFirstMessage ? this.lastResponseId : undefined)

		if (previousResponseId) {
			// When using previous_response_id, only send the latest user message
			const lastUserMessage = [...messages].reverse().find((msg) => msg.role === "user")
			if (lastUserMessage) {
				const formattedMessage = this.formatSingleStructuredMessage(lastUserMessage)
				// formatSingleStructuredMessage now always returns an object with role and content
				if (formattedMessage) {
					return { formattedInput: [formattedMessage], previousResponseId }
				}
			}
			return { formattedInput: [], previousResponseId }
		} else {
			// Format full conversation history (returns an array of structured messages)
			const formattedInput = this.formatFullConversation(systemPrompt, messages)
			return { formattedInput }
		}
	}

	/**
	 * Handles the streaming response from the Responses API.
	 *
	 * This function iterates through the Server-Sent Events (SSE) stream, parses each event,
	 * and yields structured data chunks (`ApiStream`). It handles a wide variety of event types,
	 * including text deltas, reasoning, usage data, and various status/tool events.
	 */
	private async *handleStreamResponse(body: ReadableStream<Uint8Array>, model: OpenAiNativeModel): ApiStream {
		const reader = body.getReader()
		const decoder = new TextDecoder()
		let buffer = ""
		let hasContent = false
		let totalInputTokens = 0
		let totalOutputTokens = 0

		try {
			while (true) {
				const { done, value } = await reader.read()
				if (done) break

				buffer += decoder.decode(value, { stream: true })
				const lines = buffer.split("\n")
				buffer = lines.pop() || ""

				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const data = line.slice(6).trim()
						if (data === "[DONE]") {
							continue
						}

						try {
							const parsed = JSON.parse(data)

							// Skip stale events when resuming a dropped background stream
							if (
								typeof parsed?.sequence_number === "number" &&
								this.resumeCutoffSequence !== undefined &&
								parsed.sequence_number <= this.resumeCutoffSequence
							) {
								continue
							}

							// Record sequence number for cursor tracking
							if (typeof parsed?.sequence_number === "number") {
								this.lastSequenceNumber = parsed.sequence_number
								// Also track for per-request resume capability
								this.currentRequestSequenceNumber = parsed.sequence_number
							}

							// Store response ID for conversation continuity
							if (parsed.response?.id) {
								this.resolveResponseId(parsed.response.id)
								// Also track for per-request resume capability
								this.currentRequestResponseId = parsed.response.id
							}
							// Capture resolved service tier if present
							if (parsed.response?.service_tier) {
								this.lastServiceTier = parsed.response.service_tier as ServiceTier
							}

							// Delegate standard event types to the shared processor to avoid duplication
							if (parsed?.type && this.coreHandledEventTypes.has(parsed.type)) {
								for await (const outChunk of this.processEvent(parsed, model)) {
									// Track whether we've emitted any content so fallback handling can decide appropriately
									if (outChunk.type === "text" || outChunk.type === "reasoning") {
										hasContent = true
									}
									yield outChunk
								}
								continue
							}

							// Check if this is a complete response (non-streaming format)
							if (parsed.response && parsed.response.output && Array.isArray(parsed.response.output)) {
								// Handle complete response in the initial event
								for (const outputItem of parsed.response.output) {
									if (outputItem.type === "text" && outputItem.content) {
										for (const content of outputItem.content) {
											if (content.type === "text" && content.text) {
												hasContent = true
												yield {
													type: "text",
													text: content.text,
												}
											}
										}
									}
									// Additionally handle reasoning summaries if present (non-streaming summary output)
									if (outputItem.type === "reasoning" && Array.isArray(outputItem.summary)) {
										for (const summary of outputItem.summary) {
											if (summary?.type === "summary_text" && typeof summary.text === "string") {
												hasContent = true
												yield {
													type: "reasoning",
													text: summary.text,
												}
											}
										}
									}
								}
								// Check for usage in the complete response
								if (parsed.response.usage) {
									const usageData = this.normalizeUsage(parsed.response.usage, model)
									if (usageData) {
										yield usageData
									}
								}
							}
							// Handle streaming delta events for text content
							else if (
								parsed.type === "response.text.delta" ||
								parsed.type === "response.output_text.delta"
							) {
								// Primary streaming event for text deltas
								if (parsed.delta) {
									hasContent = true
									yield {
										type: "text",
										text: parsed.delta,
									}
								}
							} else if (
								parsed.type === "response.text.done" ||
								parsed.type === "response.output_text.done"
							) {
								// Text streaming completed - final text already streamed via deltas
							}
							// Handle reasoning delta events
							else if (
								parsed.type === "response.reasoning.delta" ||
								parsed.type === "response.reasoning_text.delta"
							) {
								// Streaming reasoning content
								if (parsed.delta) {
									hasContent = true
									yield {
										type: "reasoning",
										text: parsed.delta,
									}
								}
							} else if (
								parsed.type === "response.reasoning.done" ||
								parsed.type === "response.reasoning_text.done"
							) {
								// Reasoning streaming completed
							}
							// Handle reasoning summary events
							else if (
								parsed.type === "response.reasoning_summary.delta" ||
								parsed.type === "response.reasoning_summary_text.delta"
							) {
								// Streaming reasoning summary
								if (parsed.delta) {
									hasContent = true
									yield {
										type: "reasoning",
										text: parsed.delta,
									}
								}
							} else if (
								parsed.type === "response.reasoning_summary.done" ||
								parsed.type === "response.reasoning_summary_text.done"
							) {
								// Reasoning summary completed
							}
							// Handle refusal delta events
							else if (parsed.type === "response.refusal.delta") {
								// Model is refusing to answer
								if (parsed.delta) {
									hasContent = true
									yield {
										type: "text",
										text: `[Refusal] ${parsed.delta}`,
									}
								}
							} else if (parsed.type === "response.refusal.done") {
								// Refusal completed
							}
							// Handle audio delta events (for multimodal responses)
							else if (parsed.type === "response.audio.delta") {
								// Audio streaming - we'll skip for now as we focus on text
								// Could be handled in future for voice responses
							} else if (parsed.type === "response.audio.done") {
								// Audio completed
							}
							// Handle audio transcript delta events
							else if (parsed.type === "response.audio_transcript.delta") {
								// Audio transcript streaming
								if (parsed.delta) {
									hasContent = true
									yield {
										type: "text",
										text: parsed.delta,
									}
								}
							} else if (parsed.type === "response.audio_transcript.done") {
								// Audio transcript completed
							}
							// Handle content part events (for structured content)
							else if (parsed.type === "response.content_part.added") {
								// New content part added - could be text, image, etc.
								if (parsed.part?.type === "text" && parsed.part.text) {
									hasContent = true
									yield {
										type: "text",
										text: parsed.part.text,
									}
								}
							} else if (parsed.type === "response.content_part.done") {
								// Content part completed
							}
							// Handle output item events (alternative format)
							else if (parsed.type === "response.output_item.added") {
								// This is where the actual content comes through in some test cases
								if (parsed.item) {
									if (parsed.item.type === "text" && parsed.item.text) {
										hasContent = true
										yield { type: "text", text: parsed.item.text }
									} else if (parsed.item.type === "reasoning" && parsed.item.text) {
										hasContent = true
										yield { type: "reasoning", text: parsed.item.text }
									} else if (parsed.item.type === "message" && parsed.item.content) {
										// Handle message type items
										for (const content of parsed.item.content) {
											if (content.type === "text" && content.text) {
												hasContent = true
												yield { type: "text", text: content.text }
											}
										}
									}
								}
							} else if (parsed.type === "response.output_item.done") {
								// Output item completed
							}
							// Handle function/tool call events
							else if (parsed.type === "response.function_call_arguments.delta") {
								// Function call arguments streaming
								// We could yield this as a special type if needed for tool usage
							} else if (parsed.type === "response.function_call_arguments.done") {
								// Function call completed
							}
							// Handle MCP (Model Context Protocol) tool events
							else if (parsed.type === "response.mcp_call_arguments.delta") {
								// MCP tool call arguments streaming
							} else if (parsed.type === "response.mcp_call_arguments.done") {
								// MCP tool call completed
							} else if (parsed.type === "response.mcp_call.in_progress") {
								// MCP tool call in progress
							} else if (
								parsed.type === "response.mcp_call.completed" ||
								parsed.type === "response.mcp_call.failed"
							) {
								// MCP tool call status events
							} else if (parsed.type === "response.mcp_list_tools.in_progress") {
								// MCP list tools in progress
							} else if (
								parsed.type === "response.mcp_list_tools.completed" ||
								parsed.type === "response.mcp_list_tools.failed"
							) {
								// MCP list tools status events
							}
							// Handle web search events
							else if (parsed.type === "response.web_search_call.searching") {
								// Web search in progress
							} else if (parsed.type === "response.web_search_call.in_progress") {
								// Processing web search results
							} else if (parsed.type === "response.web_search_call.completed") {
								// Web search completed
							}
							// Handle code interpreter events
							else if (parsed.type === "response.code_interpreter_call_code.delta") {
								// Code interpreter code streaming
								if (parsed.delta) {
									// Could yield as a special code type if needed
								}
							} else if (parsed.type === "response.code_interpreter_call_code.done") {
								// Code interpreter code completed
							} else if (parsed.type === "response.code_interpreter_call.interpreting") {
								// Code interpreter running
							} else if (parsed.type === "response.code_interpreter_call.in_progress") {
								// Code execution in progress
							} else if (parsed.type === "response.code_interpreter_call.completed") {
								// Code interpreter completed
							}
							// Handle file search events
							else if (parsed.type === "response.file_search_call.searching") {
								// File search in progress
							} else if (parsed.type === "response.file_search_call.in_progress") {
								// Processing file search results
							} else if (parsed.type === "response.file_search_call.completed") {
								// File search completed
							}
							// Handle image generation events
							else if (parsed.type === "response.image_gen_call.generating") {
								// Image generation in progress
							} else if (parsed.type === "response.image_gen_call.in_progress") {
								// Processing image generation
							} else if (parsed.type === "response.image_gen_call.partial_image") {
								// Image partially generated
							} else if (parsed.type === "response.image_gen_call.completed") {
								// Image generation completed
							}
							// Handle computer use events
							else if (
								parsed.type === "response.computer_tool_call.output_item" ||
								parsed.type === "response.computer_tool_call.output_screenshot"
							) {
								// Computer use tool events
							}
							// Handle annotation events
							else if (
								parsed.type === "response.output_text_annotation.added" ||
								parsed.type === "response.text_annotation.added"
							) {
								// Text annotation events - could be citations, references, etc.
							}
							// Handle error events
							else if (parsed.type === "response.error" || parsed.type === "error") {
								// Error event from the API
								if (parsed.error || parsed.message) {
									const errMsg = `Responses API error: ${parsed.error?.message || parsed.message || "Unknown error"}`
									// For background mode, treat as terminal to avoid futile resume attempts
									if (this.currentRequestIsBackground) {
										// Surface a failed status for UI lifecycle before terminating
										yield {
											type: "status",
											mode: "background",
											status: "failed",
											...(parsed.response?.id ? { responseId: parsed.response.id } : {}),
										}
										throw createTerminalBackgroundError(errMsg)
									}
									// Non-background: propagate as a standard error
									throw new Error(errMsg)
								}
							}
							// Handle incomplete event
							else if (parsed.type === "response.incomplete") {
								// Response was incomplete - might need to handle specially
							}
							// Handle queued event
							else if (parsed.type === "response.queued") {
								yield {
									type: "status",
									mode: this.currentRequestIsBackground ? "background" : undefined,
									status: "queued",
									...(parsed.response?.id ? { responseId: parsed.response.id } : {}),
								}
							}
							// Handle in_progress event
							else if (parsed.type === "response.in_progress") {
								yield {
									type: "status",
									mode: this.currentRequestIsBackground ? "background" : undefined,
									status: "in_progress",
									...(parsed.response?.id ? { responseId: parsed.response.id } : {}),
								}
							}
							// Handle failed event
							else if (parsed.type === "response.failed") {
								// Emit failed status for UI lifecycle
								yield {
									type: "status",
									mode: this.currentRequestIsBackground ? "background" : undefined,
									status: "failed",
									...(parsed.response?.id ? { responseId: parsed.response.id } : {}),
								}
								// Response failed
								if (parsed.error || parsed.message) {
									throw createTerminalBackgroundError(
										`Response failed: ${parsed.error?.message || parsed.message || "Unknown failure"}`,
									)
								}
							} else if (parsed.type === "response.completed" || parsed.type === "response.done") {
								// Store response ID for conversation continuity
								if (parsed.response?.id) {
									this.resolveResponseId(parsed.response.id)
								}
								// Capture resolved service tier if present
								if (parsed.response?.service_tier) {
									this.lastServiceTier = parsed.response.service_tier as ServiceTier
								}

								// Emit completed status for UI lifecycle
								yield {
									type: "status",
									mode: this.currentRequestIsBackground ? "background" : undefined,
									status: "completed",
									...(parsed.response?.id ? { responseId: parsed.response.id } : {}),
								}
								// Clear background marker on completion
								this.currentRequestIsBackground = undefined

								// Check if the done event contains the complete output (as a fallback)
								if (
									!hasContent &&
									parsed.response &&
									parsed.response.output &&
									Array.isArray(parsed.response.output)
								) {
									for (const outputItem of parsed.response.output) {
										if (outputItem.type === "message" && outputItem.content) {
											for (const content of outputItem.content) {
												if (content.type === "output_text" && content.text) {
													hasContent = true
													yield {
														type: "text",
														text: content.text,
													}
												}
											}
										}
										// Also surface reasoning summaries if present in the final output
										if (outputItem.type === "reasoning" && Array.isArray(outputItem.summary)) {
											for (const summary of outputItem.summary) {
												if (
													summary?.type === "summary_text" &&
													typeof summary.text === "string"
												) {
													hasContent = true
													yield {
														type: "reasoning",
														text: summary.text,
													}
												}
											}
										}
									}
								}

								// Usage for done/completed is already handled by processGpt5Event in SDK path.
								// For SSE path, usage often arrives separately; avoid double-emitting here.
							}
							// These are structural or status events, we can just log them at a lower level or ignore.
							else if (
								parsed.type === "response.created" ||
								parsed.type === "response.in_progress" ||
								parsed.type === "response.output_item.done" ||
								parsed.type === "response.content_part.added" ||
								parsed.type === "response.content_part.done"
							) {
								// Status events - no action needed
							}
							// Fallback for older formats or unexpected responses
							else if (parsed.choices?.[0]?.delta?.content) {
								hasContent = true
								yield {
									type: "text",
									text: parsed.choices[0].delta.content,
								}
							}
							// Additional fallback: some events place text under 'item.text' even if type isn't matched above
							else if (
								parsed.item &&
								typeof parsed.item.text === "string" &&
								parsed.item.text.length > 0
							) {
								hasContent = true
								yield {
									type: "text",
									text: parsed.item.text,
								}
							} else if (parsed.usage) {
								// Handle usage if it arrives in a separate, non-completed event
								const usageData = this.normalizeUsage(parsed.usage, model)
								if (usageData) {
									yield usageData
								}
							}
						} catch (e) {
							// Only ignore JSON parsing errors, re-throw actual API errors
							if (!(e instanceof SyntaxError)) {
								throw e
							}
						}
					}
					// Also try to parse non-SSE formatted lines
					else if (line.trim() && !line.startsWith(":")) {
						try {
							const parsed = JSON.parse(line)

							// Try to extract content from various possible locations
							if (parsed.content || parsed.text || parsed.message) {
								hasContent = true
								yield {
									type: "text",
									text: parsed.content || parsed.text || parsed.message,
								}
							}
						} catch {
							// Not JSON, might be plain text - ignore
						}
					}
				}
			}

			// If we didn't get any content, don't throw - the API might have returned an empty response
			// This can happen in certain edge cases and shouldn't break the flow
		} catch (error) {
			if (error instanceof Error) {
				// Preserve terminal background errors so callers can avoid resume attempts
				if ((error as any).isTerminalBackgroundError) {
					throw error
				}
				throw new Error(`Error processing response stream: ${error.message}`)
			}
			throw new Error("Unexpected error processing response stream")
		} finally {
			reader.releaseLock()
		}
	}

	/**
	 * Attempt to resume a dropped background stream; if resume fails, fall back to polling.
	 */
	private async *attemptResumeOrPoll(responseId: string, lastSeq: number, model: OpenAiNativeModel): ApiStream {
		// Emit reconnecting status
		yield {
			type: "status",
			mode: "background",
			status: "reconnecting",
			responseId,
		}

		const apiKey = this.options.openAiNativeApiKey ?? "not-provided"
		const baseUrl = this.options.openAiNativeBaseUrl || "https://api.openai.com"
		const resumeMaxRetries = this.options.openAiNativeBackgroundResumeMaxRetries ?? 3
		const resumeBaseDelayMs = this.options.openAiNativeBackgroundResumeBaseDelayMs ?? 1000

		// Try streaming resume with exponential backoff
		for (let attempt = 0; attempt < resumeMaxRetries; attempt++) {
			try {
				const resumeUrl = `${baseUrl}/v1/responses/${responseId}?stream=true&starting_after=${lastSeq}`
				const res = await fetch(resumeUrl, {
					method: "GET",
					headers: {
						Authorization: `Bearer ${apiKey}`,
						Accept: "text/event-stream",
					},
				})

				if (!res.ok) {
					throw new Error(`Resume request failed (${res.status})`)
				}
				if (!res.body) {
					throw new Error("Resume request failed (no body)")
				}

				this.resumeCutoffSequence = lastSeq

				// Handshake accepted: immediately switch UI from reconnecting -> in_progress
				yield {
					type: "status",
					mode: "background",
					status: "in_progress",
					responseId,
				}

				try {
					for await (const chunk of this.handleStreamResponse(res.body, model)) {
						// Avoid double-emitting in_progress if the inner handler surfaces it
						if (chunk.type === "status" && (chunk as any).status === "in_progress") {
							continue
						}
						yield chunk
					}
					// Successful resume
					this.resumeCutoffSequence = undefined
					return
				} catch (e) {
					// Resume stream failed mid-flight; reset and throw to retry
					this.resumeCutoffSequence = undefined
					throw e
				}
			} catch (err: any) {
				// If terminal error, don't keep retrying resume; fall back to polling immediately
				const delay = resumeBaseDelayMs * Math.pow(2, attempt)
				const msg = err instanceof Error ? err.message : String(err)

				if (isTerminalBackgroundError(err)) {
					console.error(`[OpenAiNative][resume] terminal background error on attempt ${attempt + 1}: ${msg}`)
					break
				}

				// Otherwise retry with backoff (transient failure)
				console.warn(`[OpenAiNative][resume] attempt ${attempt + 1} failed; retrying in ${delay}ms: ${msg}`)
				if (delay > 0) {
					await new Promise((r) => setTimeout(r, delay))
				}
			}
		}

		// Resume failed - begin polling fallback
		yield {
			type: "status",
			mode: "background",
			status: "polling",
			responseId,
		}

		const pollIntervalMs = this.options.openAiNativeBackgroundPollIntervalMs ?? 2000
		const pollMaxMinutes = this.options.openAiNativeBackgroundPollMaxMinutes ?? 20
		const deadline = Date.now() + pollMaxMinutes * 60_000

		let lastEmittedStatus: "queued" | "in_progress" | "completed" | "failed" | "canceled" | undefined = undefined

		while (Date.now() <= deadline) {
			try {
				const pollRes = await fetch(`${baseUrl}/v1/responses/${responseId}`, {
					method: "GET",
					headers: {
						Authorization: `Bearer ${apiKey}`,
					},
				})

				if (!pollRes.ok) {
					// transient; wait and retry
					await new Promise((r) => setTimeout(r, pollIntervalMs))
					continue
				}

				let raw: any
				try {
					raw = await pollRes.json()
				} catch {
					await new Promise((r) => setTimeout(r, pollIntervalMs))
					continue
				}

				const resp = raw?.response ?? raw
				const status: string | undefined = resp?.status
				const respId: string | undefined = resp?.id ?? responseId

				// Capture resolved service tier if present
				if (resp?.service_tier) {
					this.lastServiceTier = resp.service_tier as ServiceTier
				}

				// Emit status transitions
				if (
					status &&
					(status === "queued" ||
						status === "in_progress" ||
						status === "completed" ||
						status === "failed" ||
						status === "canceled")
				) {
					if (status !== lastEmittedStatus) {
						yield {
							type: "status",
							mode: "background",
							status: status as any,
							...(respId ? { responseId: respId } : {}),
						}
						lastEmittedStatus = status as any
					}
				}

				if (status === "completed") {
					// Synthesize final output
					const output = resp?.output ?? raw?.output
					if (Array.isArray(output)) {
						for (const outputItem of output) {
							if (outputItem.type === "text" && Array.isArray(outputItem.content)) {
								for (const content of outputItem.content) {
									if (content?.type === "text" && typeof content.text === "string") {
										yield { type: "text", text: content.text }
									}
								}
							} else if (outputItem.type === "message" && Array.isArray(outputItem.content)) {
								for (const content of outputItem.content) {
									if (
										(content?.type === "output_text" || content?.type === "text") &&
										typeof content.text === "string"
									) {
										yield { type: "text", text: content.text }
									}
								}
							} else if (outputItem.type === "reasoning" && Array.isArray(outputItem.summary)) {
								for (const summary of outputItem.summary) {
									if (summary?.type === "summary_text" && typeof summary.text === "string") {
										yield { type: "reasoning", text: summary.text }
									}
								}
							}
						}
					}

					// Synthesize usage
					const usage = resp?.usage ?? raw?.usage
					const usageData = this.normalizeUsage(usage, model)
					if (usageData) {
						yield usageData
					}

					return
				}

				if (status === "failed" || status === "canceled") {
					const detail: string | undefined = resp?.error?.message ?? raw?.error?.message
					const msg = detail ? `Response ${status}: ${detail}` : `Response ${status}: ${respId || responseId}`
					throw createTerminalBackgroundError(msg)
				}
			} catch (err: any) {
				// If we've already emitted a terminal status, propagate to consumer to stop polling.
				if (lastEmittedStatus === "failed" || lastEmittedStatus === "canceled") {
					throw err
				}

				// Classify polling errors and log appropriately
				const statusCode = err?.status ?? err?.response?.status
				const msg = err instanceof Error ? err.message : String(err)

				// Permanent errors: stop polling
				if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
					console.error(`[OpenAiNative][poll] permanent error (status ${statusCode}); stopping: ${msg}`)
					throw createTerminalBackgroundError(`Polling failed with status ${statusCode}: ${msg}`)
				}

				// Rate limit: transient, will retry
				if (statusCode === 429) {
					console.warn(`[OpenAiNative][poll] rate limited; will retry: ${msg}`)
				} else {
					// Other transient/network errors
					console.warn(
						`[OpenAiNative][poll] transient error; will retry${statusCode ? ` (status ${statusCode})` : ""}: ${msg}`,
					)
				}
			}

			// Stop polling immediately on terminal background statuses
			if (lastEmittedStatus === "failed" || lastEmittedStatus === "canceled") {
				throw new Error(`Background polling terminated with status=${lastEmittedStatus} for ${responseId}`)
			}

			await new Promise((r) => setTimeout(r, pollIntervalMs))
		}

		throw new Error(`Background response polling timed out for ${responseId}`)
	}

	/**
	 * Shared processor for Responses API events.
	 */
	private async *processEvent(event: any, model: OpenAiNativeModel): ApiStream {
		// Persist response id for conversation continuity when available
		if (event?.response?.id) {
			this.resolveResponseId(event.response.id)
			// Also track for per-request resume capability
			this.currentRequestResponseId = event.response.id
		}
		// Capture resolved service tier when available
		if (event?.response?.service_tier) {
			this.lastServiceTier = event.response.service_tier as ServiceTier
		}
		// Record sequence number for cursor tracking
		if (typeof event?.sequence_number === "number") {
			this.lastSequenceNumber = event.sequence_number
			// Also track for per-request resume capability
			this.currentRequestSequenceNumber = event.sequence_number
		}

		// Map lifecycle events to status chunks
		const statusMap: Record<string, "queued" | "in_progress" | "completed" | "failed" | "canceled"> = {
			"response.queued": "queued",
			"response.in_progress": "in_progress",
			"response.completed": "completed",
			"response.done": "completed",
			"response.failed": "failed",
			"response.canceled": "canceled",
		}
		const mappedStatus = statusMap[event?.type as string]
		if (mappedStatus) {
			yield {
				type: "status",
				mode: this.currentRequestIsBackground ? "background" : undefined,
				status: mappedStatus,
				...(event?.response?.id ? { responseId: event.response.id } : {}),
			}
			// Clear background flag for terminal statuses
			if (mappedStatus === "completed" || mappedStatus === "failed" || mappedStatus === "canceled") {
				this.currentRequestIsBackground = undefined
			}
			// Throw terminal error to integrate with standard failure path (surfaced in UI)
			if (mappedStatus === "failed" || mappedStatus === "canceled") {
				const msg = (event as any)?.error?.message || (event as any)?.message || `Response ${mappedStatus}`
				throw createTerminalBackgroundError(msg)
			}
			// Do not return; allow further handling (e.g., usage on done/completed)
		}

		// Handle known streaming text deltas
		if (event?.type === "response.text.delta" || event?.type === "response.output_text.delta") {
			if (event?.delta) {
				yield { type: "text", text: event.delta }
			}
			return
		}

		// Handle reasoning deltas (including summary variants)
		if (
			event?.type === "response.reasoning.delta" ||
			event?.type === "response.reasoning_text.delta" ||
			event?.type === "response.reasoning_summary.delta" ||
			event?.type === "response.reasoning_summary_text.delta"
		) {
			if (event?.delta) {
				yield { type: "reasoning", text: event.delta }
			}
			return
		}

		// Handle refusal deltas
		if (event?.type === "response.refusal.delta") {
			if (event?.delta) {
				yield { type: "text", text: `[Refusal] ${event.delta}` }
			}
			return
		}

		// Handle output item additions (SDK or Responses API alternative format)
		if (event?.type === "response.output_item.added") {
			const item = event?.item
			if (item) {
				if (item.type === "text" && item.text) {
					yield { type: "text", text: item.text }
				} else if (item.type === "reasoning" && item.text) {
					yield { type: "reasoning", text: item.text }
				} else if (item.type === "message" && Array.isArray(item.content)) {
					for (const content of item.content) {
						// Some implementations send 'text'; others send 'output_text'
						if ((content?.type === "text" || content?.type === "output_text") && content?.text) {
							yield { type: "text", text: content.text }
						}
					}
				}
			}
			return
		}

		// Completion events that may carry usage
		if (event?.type === "response.done" || event?.type === "response.completed") {
			const usage = event?.response?.usage || event?.usage || undefined
			const usageData = this.normalizeUsage(usage, model)
			if (usageData) {
				yield usageData
			}
			return
		}

		// Fallbacks for older formats or unexpected objects
		if (event?.choices?.[0]?.delta?.content) {
			yield { type: "text", text: event.choices[0].delta.content }
			return
		}

		if (event?.usage) {
			const usageData = this.normalizeUsage(event.usage, model)
			if (usageData) {
				yield usageData
			}
		}
	}

	private getReasoningEffort(model: OpenAiNativeModel): ReasoningEffortWithMinimal | undefined {
		const { reasoning, info } = model

		// Check if reasoning effort is configured
		if (reasoning && "reasoning_effort" in reasoning) {
			const effort = reasoning.reasoning_effort as string
			// Support all effort levels
			if (effort === "minimal" || effort === "low" || effort === "medium" || effort === "high") {
				return effort as ReasoningEffortWithMinimal
			}
		}

		// Use the model's default from types if available
		return info.reasoningEffort as ReasoningEffortWithMinimal | undefined
	}

	/**
	 * Returns a shallow-cloned ModelInfo with pricing overridden for the given tier, if available.
	 * If no tier or no overrides exist, the original ModelInfo is returned.
	 */
	private applyServiceTierPricing(info: ModelInfo, tier?: ServiceTier): ModelInfo {
		if (!tier || tier === "default") return info

		// Find the tier with matching name in the tiers array
		const tierInfo = info.tiers?.find((t) => t.name === tier)
		if (!tierInfo) return info

		return {
			...info,
			inputPrice: tierInfo.inputPrice ?? info.inputPrice,
			outputPrice: tierInfo.outputPrice ?? info.outputPrice,
			cacheReadsPrice: tierInfo.cacheReadsPrice ?? info.cacheReadsPrice,
			cacheWritesPrice: tierInfo.cacheWritesPrice ?? info.cacheWritesPrice,
		}
	}

	// Removed isResponsesApiModel method as ALL models now use the Responses API

	override getModel() {
		const modelId = this.options.apiModelId

		let id =
			modelId && modelId in openAiNativeModels ? (modelId as OpenAiNativeModelId) : openAiNativeDefaultModelId

		const info: ModelInfo = openAiNativeModels[id]

		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: id.startsWith(GPT5_MODEL_PREFIX)
				? GPT5_DEFAULT_TEMPERATURE
				: OPENAI_NATIVE_DEFAULT_TEMPERATURE,
		})

		// For models using the Responses API, ensure we support reasoning effort
		const effort =
			(this.options.reasoningEffort as ReasoningEffortWithMinimal | undefined) ??
			(info.reasoningEffort as ReasoningEffortWithMinimal | undefined)

		if (effort) {
			;(params.reasoning as any) = { reasoning_effort: effort }
		}

		// The o3 models are named like "o3-mini-[reasoning-effort]", which are
		// not valid model ids, so we need to strip the suffix.
		return { id: id.startsWith("o3-mini") ? "o3-mini" : id, info, ...params, verbosity: params.verbosity }
	}

	/**
	 * Gets the last response ID captured from the Responses API stream.
	 * Used for maintaining conversation continuity across requests.
	 * @returns The response ID, or undefined if not available yet
	 */
	getLastResponseId(): string | undefined {
		return this.lastResponseId
	}

	/**
	 * Gets the last sequence number observed from streaming events.
	 * @returns The sequence number, or undefined if not available yet
	 */
	getLastSequenceNumber(): number | undefined {
		return this.lastSequenceNumber
	}

	/**
	 * Sets the last response ID for conversation continuity.
	 * Typically only used in tests or special flows.
	 * @param responseId The response ID to store
	 */
	setResponseId(responseId: string): void {
		this.lastResponseId = responseId
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const model = this.getModel()
			const { verbosity, reasoning } = model

			// Resolve reasoning effort for models that support it
			const reasoningEffort = this.getReasoningEffort(model)

			// Build request body for Responses API
			const requestBody: any = {
				model: model.id,
				input: [
					{
						role: "user",
						content: [{ type: "input_text", text: prompt }],
					},
				],
				stream: false, // Non-streaming for completePrompt
				store: false, // Don't store prompt completions
			}

			// Include service tier if selected and supported
			const requestedTier = (this.options.openAiNativeServiceTier as ServiceTier | undefined) || undefined
			const allowedTierNames = new Set(model.info.tiers?.map((t) => t.name).filter(Boolean) || [])
			if (requestedTier && (requestedTier === "default" || allowedTierNames.has(requestedTier))) {
				requestBody.service_tier = requestedTier
			}

			// Add reasoning if supported
			if (reasoningEffort) {
				requestBody.reasoning = {
					effort: reasoningEffort,
					...(this.options.enableGpt5ReasoningSummary ? { summary: "auto" as const } : {}),
				}
			}

			// Only include temperature if the model supports it
			if (model.info.supportsTemperature !== false) {
				requestBody.temperature =
					this.options.modelTemperature ??
					(model.id.startsWith(GPT5_MODEL_PREFIX)
						? GPT5_DEFAULT_TEMPERATURE
						: OPENAI_NATIVE_DEFAULT_TEMPERATURE)
			}

			// Include max_output_tokens if available
			if (model.maxTokens) {
				requestBody.max_output_tokens = model.maxTokens
			}

			// Include text.verbosity only when the model explicitly supports it
			if (model.info.supportsVerbosity === true) {
				requestBody.text = { verbosity: (verbosity || "medium") as VerbosityLevel }
			}

			// Make the non-streaming request
			const response = await (this.client as any).responses.create(requestBody)

			// Extract text from the response
			if (response?.output && Array.isArray(response.output)) {
				for (const outputItem of response.output) {
					if (outputItem.type === "message" && outputItem.content) {
						for (const content of outputItem.content) {
							if (content.type === "output_text" && content.text) {
								return content.text
							}
						}
					}
				}
			}

			// Fallback: check for direct text in response
			if (response?.text) {
				return response.text
			}

			return ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`OpenAI Native completion error: ${error.message}`)
			}
			throw error
		}
	}
}
