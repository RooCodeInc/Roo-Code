import type { Anthropic } from "@anthropic-ai/sdk"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"

import type { ApiHandlerCreateMessageMetadata } from "../index"
import { BaseProvider } from "./base-provider"
// stream + params
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
// Provider prompt content as a TS string module (no loader required)
import codexPromptContent, { overridePrompt } from "./openai-native-codex.prompt"
import { getApiRequestTimeout } from "./utils/timeout-config"
import { t } from "i18next"

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

// Codex input typing for safer transforms and tests
type CodexRole = "system" | "user" | "assistant"
interface CodexInputText {
	type: "input_text"
	text: string
}
interface CodexOutputText {
	type: "output_text"
	text: string
}
interface CodexInputImage {
	type: "input_image"
	image_url: string
}
type CodexContent = CodexInputText | CodexOutputText | CodexInputImage
interface CodexMessage {
	role: CodexRole
	content: CodexContent[]
}

interface AuthTokens {
	access_token?: string
	account_id?: string
	id_token?: string
}
interface AuthJson {
	tokens?: AuthTokens
}

/**
 * OpenAI Native (Codex) provider
 * - Uses ChatGPT auth.json tokens (no API key)
 * - Calls ChatGPT Responses endpoint: https://chatgpt.com/backend-api/codex/responses
 */
export class OpenAiNativeCodexHandler extends BaseProvider {
	protected options: ApiHandlerOptions
	private chatgptAccessToken!: string
	private chatgptAccountId?: string
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
		const resolvedPath = path.resolve(explicitPath)

		// Guard file size before reading to prevent loading unexpectedly large files
		const MAX_OAUTH_SIZE = 1_000_000 // 1 MB
		try {
			const stat = await fs.stat(resolvedPath)
			if (stat.size > MAX_OAUTH_SIZE) {
				throw new Error(
					t("common:errors.openaiNativeCodex.oauthFileTooLarge", {
						path: resolvedPath,
						size: stat.size,
						max: MAX_OAUTH_SIZE,
					}),
				)
			}
		} catch (e: any) {
			// Surface read failure with localized error (e.g., file missing or inaccessible)
			const base = t("common:errors.openaiNativeCodex.oauthReadFailed", {
				path: resolvedPath,
				error: e?.message || String(e),
			})
			throw new Error(base)
		}

		let raw: string
		try {
			raw = await fs.readFile(resolvedPath, "utf8")
		} catch (e: any) {
			const base = t("common:errors.openaiNativeCodex.oauthReadFailed", {
				path: resolvedPath,
				error: e?.message || String(e),
			})
			throw new Error(base)
		}

		// Post-read size check using byte length
		if (Buffer.byteLength(raw, "utf8") > MAX_OAUTH_SIZE) {
			throw new Error(
				t("common:errors.openaiNativeCodex.oauthFileTooLarge", {
					path: resolvedPath,
					size: Buffer.byteLength(raw, "utf8"),
					max: MAX_OAUTH_SIZE,
				}),
			)
		}

		let j: AuthJson
		try {
			j = JSON.parse(raw) as AuthJson
		} catch (e: any) {
			const base = t("common:errors.openaiNativeCodex.oauthParseFailed", {
				path: resolvedPath,
				error: e?.message || String(e),
			})
			throw new Error(base)
		}

		const tokens: AuthTokens = j?.tokens ?? {}
		const access = typeof tokens.access_token === "string" ? tokens.access_token : undefined
		let account = typeof tokens.account_id === "string" ? tokens.account_id : undefined

		if (!account && typeof tokens.id_token === "string") {
			const decoded = this.extractAccountIdFromIdToken(tokens.id_token)
			if (decoded) {
				account = decoded
			}
		}

		if (!access) {
			throw new Error(t("common:errors.openaiNativeCodex.missingAccessToken"))
		}

		this.chatgptAccessToken = access
		this.chatgptAccountId = account
	}

	// Extract ChatGPT account id from id_token without verifying signature (local decode for UX only)
	protected extractAccountIdFromIdToken(idToken: string): string | undefined {
		try {
			const parts = idToken.split(".")
			if (parts.length !== 3) return undefined
			const payload = parts[1]
			const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4)
			const claims = JSON.parse(Buffer.from(padded, "base64").toString("utf8"))
			const auth = claims?.["https://api.openai.com/auth"]
			return typeof auth?.chatgpt_account_id === "string" ? auth.chatgpt_account_id : undefined
		} catch {
			return undefined
		}
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

		// Reasoning effort is computed by getModelParams based on model + settings
		return { id: id as string, info, ...params, verbosity: params.verbosity }
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		this.lastServiceTier = undefined
		const model = this.getModel()
		await this.ensureAuthenticated()

		// Transform messages to Codex input with strong typing
		const formattedInput = this.buildCodexInput(messages, systemPrompt)

		// Use provider-local prompt content for top-level instructions (TS string module)
		const codexPrompt = codexPromptContent

		// Codex (chatgpt.com codex/responses) is stateless and does NOT support previous_response_id.
		// We always send curated prior items in `input` to preserve continuity.
		const requestBody = this.buildRequestBody(
			model,
			formattedInput,
			codexPrompt,
			(model as any).verbosity as VerbosityLevel | undefined,
			(model as any).reasoning?.reasoning_effort as ReasoningEffortWithMinimal | undefined,
		)

		yield* this.makeResponsesRequest(requestBody, model)
	}

	// Split out for unit testing and clearer typing
	protected buildCodexInput(messages: Anthropic.Messages.MessageParam[], systemPrompt: string): CodexMessage[] {
		const formatted: CodexMessage[] = []
		// Inject provider overrides and dynamic instructions as a system role using <instructions_override> and <new_instructions> XML tags
		let injectedUserInstructions = false

		for (const message of messages) {
			const role: CodexRole = message.role === "user" ? "user" : "assistant"
			const content: CodexContent[] = []

			if (!injectedUserInstructions && typeof systemPrompt === "string" && systemPrompt.trim().length > 0) {
				// Codex system prompt immutability:
				// - The top-level "instructions" field sent to codex/responses is immutable on the server.
				// - We cannot dynamically alter the default system prompt that Codex applies.
				// Strategy and rationale:
				// - We inject two system-role items before the first user/assistant turn:
				//   1) <instructions_override> — explains to the model how Roo’s rules supersede Codex defaults.
				//   2) <new_instructions> — the current task/systemPrompt, asking Codex to prioritize these rules/tools.
				// - This pattern reduces the impact of Codex’s default prompt without trying to replace it (not possible).
				// - We also keep these separate from user messages to avoid tool execution bias.
				formatted.push({
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
						const text = (block as any).text as string
						if (typeof text === "string") {
							if (role === "user") content.push({ type: "input_text", text })
							else content.push({ type: "output_text", text })
						}
					} else if (block.type === "image") {
						const image = block as Anthropic.Messages.ImageBlockParam
						const imageUrl = `data:${image.source.media_type};base64,${image.source.data}`
						content.push({ type: "input_image", image_url: imageUrl })
					}
				}
			}
			if (content.length > 0) formatted.push({ role, content })
		}

		return formatted
	}

	private buildRequestBody(
		model: OpenAiNativeCodexModel,
		formattedInput: CodexMessage[],
		providerPrompt: string,
		verbosity: VerbosityLevel | undefined,
		reasoningEffort: ReasoningEffortWithMinimal | undefined,
	) {
		// For Codex provider:
		// - Use the model's default reasoning effort (currently "medium") unless explicitly overridden in settings.
		// - Both "gpt-5" and "gpt-5-codex" follow the provided/default effort without forcing "minimal".
		let effectiveEffort: ReasoningEffortWithMinimal | undefined = reasoningEffort

		const body: {
			model: string
			input: CodexMessage[]
			stream: true
			store: false
			instructions: string
			reasoning?: {
				effort: ReasoningEffortWithMinimal
				summary?: "auto"
			}
			text?: { verbosity: VerbosityLevel }
		} = {
			model: model.id,
			input: formattedInput,
			stream: true,
			// ChatGPT Responses requires store=false
			store: false,
			// Top-level instructions string passed in by caller (createMessage supplies provider prompt)
			instructions: providerPrompt,
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
				const msg = t("common:errors.openaiNativeCodex.httpError", {
					status: response.status,
					requestId: requestId || "n/a",
					modelId: model.id,
					message: userMessage || snippet,
				})
				const err = new Error(msg)
				;(err as any).status = response.status
				if (requestId) (err as any).requestId = requestId
				;(err as any).provider = "openai-native-codex"
				;(err as any).raw = snippet
				throw err
			}
			if (!response.body) {
				throw new Error(t("common:errors.openaiNativeCodex.noResponseBody"))
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
									// Persist tier when available (parity with openai-native)
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
						throw new Error(t("common:errors.openaiNativeCodex.emptyStream", { modelId: model.id }))
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
