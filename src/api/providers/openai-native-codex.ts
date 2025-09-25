import type { Anthropic } from "@anthropic-ai/sdk"
import { promises as fs } from "node:fs"
import os from "node:os"

import type { ApiHandlerCreateMessageMetadata } from "../index"
import { BaseProvider } from "./base-provider"
// stream + params
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
// Provider prompt content as a TS string module (no loader required)
import codexPromptContent, { overridePrompt } from "./openai-native-codex.prompt"
import { getApiRequestTimeout } from "./utils/timeout-config"

import {
	type ModelInfo,
	type ReasoningEffortWithMinimal,
	type ServiceTier,
	type VerbosityLevel,
	openAiNativeCodexDefaultModelId,
	openAiNativeCodexModels,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { calculateApiCostOpenAI } from "../../shared/cost"

export type OpenAiNativeCodexModel = ReturnType<OpenAiNativeCodexHandler["getModel"]>

const GPT5_MODEL_PREFIX = "gpt-5"

/**
 * OpenAI Native (Codex) provider
 * - Uses ChatGPT auth.json tokens (no API key)
 * - Calls ChatGPT Responses endpoint: https://chatgpt.com/backend-api/codex/responses
 */
export class OpenAiNativeCodexHandler extends BaseProvider {
	protected options: ApiHandlerOptions
	private chatgptAccessToken!: string
	private chatgptAccountId?: string
	private lastResponseId: string | undefined
	private lastServiceTier: ServiceTier | undefined

	// Inline-loaded provider prompt (via esbuild text loader for .md files)

	// Provider prompt content is loaded via loadProviderPrompt()

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		if (this.options.enableGpt5ReasoningSummary === undefined) {
			this.options.enableGpt5ReasoningSummary = true
		}

		// Credentials are resolved lazily via ensureAuthenticated() on first use.
	}

	// Normalize usage to Roo's ApiStreamUsageChunk and compute totalCost
	private normalizeUsage(usage: any, model: OpenAiNativeCodexModel): ApiStreamUsageChunk | undefined {
		if (!usage) return undefined

		const inputDetails = usage.input_tokens_details ?? usage.prompt_tokens_details
		const hasCachedTokens = typeof inputDetails?.cached_tokens === "number"
		const hasCacheMissTokens = typeof inputDetails?.cache_miss_tokens === "number"
		const cachedFromDetails = hasCachedTokens ? inputDetails.cached_tokens : 0
		const missFromDetails = hasCacheMissTokens ? inputDetails.cache_miss_tokens : 0

		let totalInputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0
		if (totalInputTokens === 0 && inputDetails && (cachedFromDetails > 0 || missFromDetails > 0)) {
			totalInputTokens = cachedFromDetails + missFromDetails
		}

		const totalOutputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0
		const cacheWriteTokens = usage.cache_creation_input_tokens ?? usage.cache_write_tokens ?? 0
		const cacheReadTokens =
			usage.cache_read_input_tokens ?? usage.cache_read_tokens ?? usage.cached_tokens ?? cachedFromDetails ?? 0

		const totalCost = calculateApiCostOpenAI(
			model.info,
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
			inputTokens: totalInputTokens,
			outputTokens: totalOutputTokens,
			cacheWriteTokens,
			cacheReadTokens,
			...(typeof reasoningTokens === "number" ? { reasoningTokens } : {}),
			totalCost,
		}
		return out
	}

	private async ensureAuthenticated(): Promise<void> {
		if (this.chatgptAccessToken) return

		const configured = (this.options as any).openAiNativeCodexOauthPath as string | undefined
		const defaultPath = "~/.codex/auth.json"
		const expandHome = (p: string) => p.replace(/^~(?=\/|\\|$)/, os.homedir())
		const pathToUse = configured && configured.trim() ? configured.trim() : defaultPath
		const explicitPath = expandHome(pathToUse)

		let raw: string
		try {
			raw = await fs.readFile(explicitPath, "utf8")
		} catch (e: any) {
			throw new Error(
				`Failed to load ChatGPT OAuth credentials at ${explicitPath}: ${e?.message || e}. Tip: authenticate with the Codex CLI (e.g., "codex login") to create auth.json.`,
			)
		}

		let j: any
		try {
			j = JSON.parse(raw)
		} catch (e: any) {
			throw new Error(
				`Failed to parse ChatGPT OAuth credentials JSON at ${explicitPath}: ${e?.message || e}. Tip: ensure the file is valid JSON or re-authenticate with "codex login" to regenerate it.`,
			)
		}

		const tokens = (j?.tokens as any) || {}
		const access = typeof tokens.access_token === "string" ? tokens.access_token : undefined
		let account = typeof tokens.account_id === "string" ? tokens.account_id : undefined

		if (!account && typeof tokens.id_token === "string") {
			try {
				const parts = tokens.id_token.split(".")
				if (parts.length === 3) {
					const payload = parts[1]
					const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4)
					const claims = JSON.parse(Buffer.from(padded, "base64").toString("utf8"))
					const auth = claims?.["https://api.openai.com/auth"]
					if (auth && typeof auth.chatgpt_account_id === "string") {
						account = auth.chatgpt_account_id
					}
				}
			} catch {
				// ignore
			}
		}

		if (!access) {
			throw new Error("ChatGPT OAuth credentials are missing tokens.access_token")
		}

		this.chatgptAccessToken = access
		this.chatgptAccountId = account
	}

	override getModel() {
		const modelId = this.options.apiModelId
		const id =
			modelId && modelId in openAiNativeCodexModels
				? (modelId as keyof typeof openAiNativeCodexModels)
				: openAiNativeCodexDefaultModelId
		const info: ModelInfo = openAiNativeCodexModels[id]

		const params = getModelParams({
			format: "openai",
			modelId: id as string,
			model: info,
			settings: this.options,
		})

		const effort =
			(this.options.reasoningEffort as ReasoningEffortWithMinimal | undefined) ??
			(info.reasoningEffort as ReasoningEffortWithMinimal | undefined)
		if (effort) {
			;(params.reasoning as any) = { reasoning_effort: effort }
		}

		return { id: id as string, info, ...params, verbosity: params.verbosity }
	}

	// Expose last response id for conversation continuity consumers (e.g., Task.persistGpt5Metadata)
	getLastResponseId(): string | undefined {
		return this.lastResponseId
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		this.lastServiceTier = undefined
		const model = this.getModel()
		await this.ensureAuthenticated()

		// Format full conversation (Responses API expects structured input)
		const formattedInput: any[] = []
		// Inject provider overrides and dynamic instructions as a system role using <instructions_override> and <new_instructions> XML tags
		let injectedUserInstructions = false
		for (const message of messages) {
			const role = message.role === "user" ? "user" : "assistant"
			const content: any[] = []

			if (!injectedUserInstructions && typeof systemPrompt === "string" && systemPrompt.trim().length > 0) {
				// For ChatGPT Codex (Responses API), the top-level "instructions" payload is fixed and must be
				// provided from a canonical prompt file. We cannot programmatically modify that contents here.
				// Therefore, inject provider overrides and dynamic instructions as a separate system role message
				// using <instructions_override> and <new_instructions> tags before the first user/assistant turn.
				formattedInput.push({
					role: "system",
					content: [
						{
							type: "input_text",
							text: `<instructions_override>${overridePrompt}</instructions_override>`,
						},
						{ type: "input_text", text: `<new_instructions>${systemPrompt}</new_instructions>` },
					],
				})
				injectedUserInstructions = true
			}

			if (typeof message.content === "string") {
				if (role === "user") content.push({ type: "input_text", text: message.content })
				else content.push({ type: "output_text", text: message.content })
			} else if (Array.isArray(message.content)) {
				for (const block of message.content) {
					if (block.type === "text") {
						if (role === "user") content.push({ type: "input_text", text: (block as any).text })
						else content.push({ type: "output_text", text: (block as any).text })
					} else if (block.type === "image") {
						const image = block as Anthropic.Messages.ImageBlockParam
						const imageUrl = `data:${image.source.media_type};base64,${image.source.data}`
						content.push({ type: "input_image", image_url: imageUrl })
					}
				}
			}
			if (content.length > 0) formattedInput.push({ role, content })
		}

		// Use provider-local prompt content for top-level instructions (TS string module)
		// IMPORTANT: For ChatGPT Codex, we do not modify the "instructions" payload dynamically.
		// We import a TS string module to keep the default, required contents easy to update as Codex evolves.
		const codexPrompt = codexPromptContent

		// Codex (chatgpt.com codex/responses) is stateless and does NOT support previous_response_id.
		// We always send curated prior items in `input` to preserve continuity.
		const requestBody = this.buildRequestBody(
			model,
			formattedInput,
			codexPrompt,
			(model as any).verbosity,
			(model as any).reasoning?.reasoning_effort as ReasoningEffortWithMinimal | undefined,
			metadata,
		)

		yield* this.makeResponsesRequest(requestBody, model)
	}

	private buildRequestBody(
		model: OpenAiNativeCodexModel,
		formattedInput: any[],
		systemPrompt: string,
		verbosity: any,
		reasoningEffort: ReasoningEffortWithMinimal | undefined,
		metadata?: ApiHandlerCreateMessageMetadata,
	) {
		// For Codex provider:
		// - Regular "gpt-5" should default to minimal reasoning unless explicitly overridden in settings.
		// - The "gpt-5-codex" variant should NOT force minimal; use provided/default effort.
		let effectiveEffort: ReasoningEffortWithMinimal | undefined = reasoningEffort

		const body: any = {
			model: model.id,
			input: formattedInput,
			stream: true,
			// ChatGPT Responses requires store=false
			store: false,
			// Top-level instructions string passed in by caller (createMessage supplies provider prompt)
			instructions: systemPrompt,
			...(effectiveEffort && {
				reasoning: {
					effort: effectiveEffort,
					...(this.options.enableGpt5ReasoningSummary ? { summary: "auto" as const } : {}),
				},
			}),
			// ChatGPT codex/responses does not support previous_response_id (stateless).
			// Preserve continuity by sending curated prior items in `input`.
		}
		if (model.info.supportsVerbosity === true) {
			body.text = { verbosity: (verbosity || "medium") as VerbosityLevel }
		}
		return body
	}

	private async *makeResponsesRequest(requestBody: any, model: OpenAiNativeCodexModel): ApiStream {
		const apiKey = this.chatgptAccessToken
		const url = "https://chatgpt.com/backend-api/codex/responses"
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
			Accept: "text/event-stream",
			"OpenAI-Beta": "responses=experimental",
		}
		if (this.chatgptAccountId) headers["chatgpt-account-id"] = this.chatgptAccountId

		let timeoutId: ReturnType<typeof setTimeout> | undefined
		try {
			const timeoutMs = getApiRequestTimeout()
			const controller = new AbortController()
			timeoutId = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : undefined
			const response = await fetch(url, {
				method: "POST",
				headers,
				body: JSON.stringify(requestBody),
				signal: controller.signal,
			})

			if (!response.ok) {
				const text = await response.text().catch(() => "")
				const requestId =
					response.headers.get("x-request-id") || response.headers.get("openai-request-id") || undefined
				let userMessage: string | undefined
				try {
					const parsed = JSON.parse(text)
					userMessage = parsed?.error?.message || parsed?.message || parsed?.error || undefined
				} catch {
					// ignore parse error
				}
				const snippet = (text || "").slice(0, 500).replace(/\s+/g, " ").trim()
				const msg = `[Codex] HTTP ${response.status}${requestId ? ` req ${requestId}` : ""} model=${model.id}: ${userMessage || snippet}`
				const err = new Error(msg)
				;(err as any).status = response.status
				if (requestId) (err as any).requestId = requestId
				;(err as any).provider = "openai-native-codex"
				;(err as any).raw = snippet
				throw err
			}
			if (!response.body) {
				throw new Error("ChatGPT Responses error: No response body")
			}

			// Stream parse
			{
				const reader = response.body.getReader()
				const decoder = new TextDecoder()
				let buffer = ""
				let hasContent = false
				let sawTextDelta = false
				let sawReasoningDelta = false

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
									// Persist ids/tier when available (parity with openai-native)
									if (parsed.response?.id) {
										this.lastResponseId = parsed.response.id
									}
									if (parsed.response?.service_tier) {
										this.lastServiceTier = parsed.response.service_tier as ServiceTier
									}
									// Minimal content extraction similar to OpenAI Responses
									if (parsed?.type === "response.text.delta" && parsed?.delta) {
										hasContent = true
										sawTextDelta = true
										yield { type: "text", text: parsed.delta }
									} else if (parsed?.type === "response.output_text.delta" && parsed?.delta) {
										hasContent = true
										sawTextDelta = true
										yield { type: "text", text: parsed.delta }
									} else if (
										parsed?.type === "response.output_text.done" &&
										typeof parsed?.text === "string"
									) {
										if (!sawTextDelta) {
											hasContent = true
											yield { type: "text", text: parsed.text }
										}
									} else if (
										parsed?.type === "response.reasoning_summary_text.delta" &&
										typeof parsed?.delta === "string"
									) {
										hasContent = true
										sawReasoningDelta = true
										yield { type: "reasoning", text: parsed.delta }
									} else if (
										parsed?.type === "response.reasoning_summary_text.done" &&
										typeof parsed?.text === "string"
									) {
										if (!sawReasoningDelta) {
											hasContent = true
											yield { type: "reasoning", text: parsed.text }
										}
									} else if (parsed?.response?.output && Array.isArray(parsed.response.output)) {
										for (const item of parsed.response.output) {
											if (item.type === "text" && Array.isArray(item.content)) {
												for (const c of item.content) {
													if (c?.type === "text" && typeof c.text === "string") {
														hasContent = true
														yield { type: "text", text: c.text }
													}
												}
											} else if (item.type === "reasoning" && typeof item.text === "string") {
												hasContent = true
												yield { type: "reasoning", text: item.text }
											}
										}
										if (
											(parsed.type === "response.completed" || parsed.type === "response.done") &&
											parsed.response?.usage
										) {
											const usageData = this.normalizeUsage(parsed.response.usage, model)
											if (usageData) {
												yield usageData
											}
										}
									} else if (
										parsed.type === "response.completed" ||
										parsed.type === "response.done"
									) {
										const usageData = this.normalizeUsage(parsed.response?.usage, model)
										if (usageData) {
											yield usageData
										}
									} else if (parsed?.usage) {
										const usageData = this.normalizeUsage(parsed.usage, model)
										if (usageData) {
											yield usageData
										}
									}
								} catch {
									// ignore parse errors
								}
							} else if (line.trim() && !line.startsWith(":")) {
								try {
									const parsed = JSON.parse(line)
									if (parsed.content || parsed.text || parsed.message) {
										hasContent = true
										yield { type: "text", text: parsed.content || parsed.text || parsed.message }
									}
								} catch {
									// ignore
								}
							}
						}
					}
					if (!hasContent) {
						throw new Error(`[Codex] Empty stream: no content received for model=${model.id}`)
					}
				} finally {
					try {
						reader.releaseLock()
					} catch {}
				}
			}
		} catch (err) {
			throw err as Error
		} finally {
			// Clear timeout if set
			try {
				if (typeof timeoutId !== "undefined") {
					clearTimeout(timeoutId as any)
				}
			} catch {}
		}
	}
}
