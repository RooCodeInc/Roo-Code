import type { Anthropic } from "@anthropic-ai/sdk"
import { createVertex, type GoogleVertexProvider } from "@ai-sdk/google-vertex"
import { streamText, generateText, ToolSet } from "ai"

import {
	type ModelInfo,
	type VertexModelId,
	vertexDefaultModelId,
	vertexModels,
	ApiProviderError,
} from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import type { ApiHandlerOptions } from "../../shared/api"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	mapToolChoice,
} from "../transform/ai-sdk"
import { t } from "i18next"
import type { ApiStream, ApiStreamUsageChunk, GroundingSource } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { BaseProvider } from "./base-provider"
import { DEFAULT_HEADERS } from "./constants"

/**
 * Vertex AI provider using the dedicated @ai-sdk/google-vertex package.
 * Provides native support for Google's Vertex AI with proper authentication.
 */
export class VertexHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected provider: GoogleVertexProvider
	private readonly providerName = "Vertex"

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		// Build googleAuthOptions based on provided credentials
		let googleAuthOptions: { credentials?: object; keyFile?: string } | undefined
		if (options.vertexJsonCredentials) {
			try {
				googleAuthOptions = { credentials: JSON.parse(options.vertexJsonCredentials) }
			} catch {
				// If JSON parsing fails, ignore and try other auth methods
			}
		} else if (options.vertexKeyFile) {
			googleAuthOptions = { keyFile: options.vertexKeyFile }
		}

		// Create the Vertex AI provider using AI SDK
		this.provider = createVertex({
			project: options.vertexProjectId,
			location: options.vertexRegion,
			googleAuthOptions,
			headers: DEFAULT_HEADERS,
		})
	}

	async *createMessage(
		systemInstruction: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: modelId, info, reasoning: thinkingConfig, maxTokens } = this.getModel()

		// For hybrid/budget reasoning models (e.g. Gemini 2.5 Pro), respect user-configured
		// modelMaxTokens so the ThinkingBudget slider can control the cap. For effort-only or
		// standard models (like gemini-3-pro-preview), ignore any stale modelMaxTokens and
		// default to the model's computed maxTokens from getModelMaxOutputTokens.
		const isHybridReasoningModel = info.supportsReasoningBudget || info.requiredReasoningBudget
		const maxOutputTokens = isHybridReasoningModel
			? (this.options.modelMaxTokens ?? maxTokens ?? undefined)
			: (maxTokens ?? undefined)

		// Determine temperature respecting model capabilities and defaults:
		// - If supportsTemperature is explicitly false, ignore user overrides
		//   and pin to the model's defaultTemperature (or omit if undefined).
		// - Otherwise, allow the user setting to override, falling back to model default,
		//   then to 1 for Gemini provider default.
		const supportsTemperature = info.supportsTemperature !== false
		const temperatureConfig: number | undefined = supportsTemperature
			? (this.options.modelTemperature ?? info.defaultTemperature ?? 1)
			: info.defaultTemperature

		// The message list can include provider-specific meta entries such as
		// `{ type: "reasoning", ... }` that are intended only for providers like
		// openai-native. Vertex should never see those; they are not valid
		// Anthropic.MessageParam values and will cause failures.
		type ReasoningMetaLike = { type?: string }

		const filteredMessages = messages.filter((message): message is Anthropic.Messages.MessageParam => {
			const meta = message as ReasoningMetaLike
			if (meta.type === "reasoning") {
				return false
			}
			return true
		})

		// Convert messages to AI SDK format
		const aiSdkMessages = convertToAiSdkMessages(filteredMessages)

		// Convert tools to OpenAI format first, then to AI SDK format
		let openAiTools = this.convertToolsForOpenAI(metadata?.tools)

		// Filter tools based on allowedFunctionNames for mode-restricted tool access
		if (metadata?.allowedFunctionNames && metadata.allowedFunctionNames.length > 0 && openAiTools) {
			const allowedSet = new Set(metadata.allowedFunctionNames)
			openAiTools = openAiTools.filter((tool) => tool.type === "function" && allowedSet.has(tool.function.name))
		}

		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		// Build tool choice - use 'required' when allowedFunctionNames restricts available tools
		const toolChoice =
			metadata?.allowedFunctionNames && metadata.allowedFunctionNames.length > 0
				? "required"
				: mapToolChoice(metadata?.tool_choice)

		// Build the request options
		const requestOptions: Parameters<typeof streamText>[0] = {
			model: this.provider(modelId),
			system: systemInstruction,
			messages: aiSdkMessages,
			temperature: temperatureConfig,
			maxOutputTokens,
			tools: aiSdkTools,
			toolChoice,
			// Add thinking/reasoning configuration if present
			// Cast to any to bypass strict JSONObject typing - the AI SDK accepts the correct runtime values
			...(thinkingConfig && {
				providerOptions: { google: { thinkingConfig } } as any,
			}),
		}

		try {
			// Use streamText for streaming responses
			const result = streamText(requestOptions)

			// Process the full stream to get all events including reasoning
			for await (const part of result.fullStream) {
				for (const chunk of processAiSdkStreamPart(part)) {
					yield chunk
				}
			}

			// Extract grounding sources from providerMetadata if available
			const providerMetadata = await result.providerMetadata
			const groundingMetadata = providerMetadata?.google as
				| {
						groundingMetadata?: {
							groundingChunks?: Array<{
								web?: { uri?: string; title?: string }
							}>
						}
				  }
				| undefined

			if (groundingMetadata?.groundingMetadata) {
				const sources = this.extractGroundingSources(groundingMetadata.groundingMetadata)
				if (sources.length > 0) {
					yield { type: "grounding", sources }
				}
			}

			// Yield usage metrics at the end
			const usage = await result.usage
			if (usage) {
				yield this.processUsageMetrics(usage, info, providerMetadata)
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, modelId, "createMessage")
			TelemetryService.instance.captureException(apiError)

			if (error instanceof Error) {
				throw new Error(t("common:errors.gemini.generate_stream", { error: error.message }))
			}

			throw error
		}
	}

	override getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in vertexModels ? (modelId as VertexModelId) : vertexDefaultModelId
		let info: ModelInfo = vertexModels[id]

		const params = getModelParams({
			format: "gemini",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: info.defaultTemperature ?? 1,
		})

		// The `:thinking` suffix indicates that the model is a "Hybrid"
		// reasoning model and that reasoning is required to be enabled.
		// The actual model ID honored by Gemini's API does not have this
		// suffix.
		return { id: id.endsWith(":thinking") ? id.replace(":thinking", "") : id, info, ...params }
	}

	/**
	 * Process usage metrics from the AI SDK response.
	 */
	protected processUsageMetrics(
		usage: {
			inputTokens?: number
			outputTokens?: number
			details?: {
				cachedInputTokens?: number
				reasoningTokens?: number
			}
		},
		info: ModelInfo,
		providerMetadata?: Record<string, unknown>,
	): ApiStreamUsageChunk {
		const inputTokens = usage.inputTokens || 0
		const outputTokens = usage.outputTokens || 0
		const cacheReadTokens = usage.details?.cachedInputTokens
		const reasoningTokens = usage.details?.reasoningTokens

		return {
			type: "usage",
			inputTokens,
			outputTokens,
			cacheReadTokens,
			reasoningTokens,
			totalCost: this.calculateCost({
				info,
				inputTokens,
				outputTokens,
				cacheReadTokens,
				reasoningTokens,
			}),
		}
	}

	private extractGroundingSources(groundingMetadata?: {
		groundingChunks?: Array<{
			web?: { uri?: string; title?: string }
		}>
	}): GroundingSource[] {
		const chunks = groundingMetadata?.groundingChunks

		if (!chunks) {
			return []
		}

		return chunks
			.map((chunk): GroundingSource | null => {
				const uri = chunk.web?.uri
				const title = chunk.web?.title || uri || "Unknown Source"

				if (uri) {
					return {
						title,
						url: uri,
					}
				}
				return null
			})
			.filter((source): source is GroundingSource => source !== null)
	}

	private extractCitationsOnly(groundingMetadata?: {
		groundingChunks?: Array<{
			web?: { uri?: string; title?: string }
		}>
	}): string | null {
		const sources = this.extractGroundingSources(groundingMetadata)

		if (sources.length === 0) {
			return null
		}

		const citationLinks = sources.map((source, i) => `[${i + 1}](${source.url})`)
		return citationLinks.join(", ")
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId, info } = this.getModel()

		try {
			// Build tools for grounding - cast to any to bypass strict typing
			// Google provider tools have a different shape than standard ToolSet
			const tools: Record<string, any> = {}

			// Add URL context tool if enabled
			if (this.options.enableUrlContext) {
				tools.url_context = this.provider.tools.urlContext({})
			}

			// Add Google Search grounding tool if enabled
			if (this.options.enableGrounding) {
				tools.google_search = this.provider.tools.googleSearch({})
			}

			const supportsTemperature = info.supportsTemperature !== false
			const temperatureConfig: number | undefined = supportsTemperature
				? (this.options.modelTemperature ?? info.defaultTemperature ?? 1)
				: info.defaultTemperature

			const result = await generateText({
				model: this.provider(modelId),
				prompt,
				temperature: temperatureConfig,
				...(Object.keys(tools).length > 0 && { tools: tools as ToolSet }),
			})

			let text = result.text ?? ""

			// Extract grounding citations from providerMetadata if available
			const providerMetadata = result.providerMetadata
			const groundingMetadata = providerMetadata?.google as
				| {
						groundingMetadata?: {
							groundingChunks?: Array<{
								web?: { uri?: string; title?: string }
							}>
						}
				  }
				| undefined

			if (groundingMetadata?.groundingMetadata) {
				const citations = this.extractCitationsOnly(groundingMetadata.groundingMetadata)
				if (citations) {
					text += `\n\n${t("common:errors.gemini.sources")} ${citations}`
				}
			}

			return text
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, modelId, "completePrompt")
			TelemetryService.instance.captureException(apiError)

			if (error instanceof Error) {
				throw new Error(t("common:errors.gemini.generate_complete_prompt", { error: error.message }))
			}

			throw error
		}
	}

	public calculateCost({
		info,
		inputTokens,
		outputTokens,
		cacheReadTokens = 0,
		reasoningTokens = 0,
	}: {
		info: ModelInfo
		inputTokens: number
		outputTokens: number
		cacheReadTokens?: number
		reasoningTokens?: number
	}) {
		// For models with tiered pricing, prices might only be defined in tiers
		let inputPrice = info.inputPrice
		let outputPrice = info.outputPrice
		let cacheReadsPrice = info.cacheReadsPrice

		// If there's tiered pricing then adjust the input and output token prices
		// based on the input tokens used.
		if (info.tiers) {
			const tier = info.tiers.find((tier) => inputTokens <= tier.contextWindow)

			if (tier) {
				inputPrice = tier.inputPrice ?? inputPrice
				outputPrice = tier.outputPrice ?? outputPrice
				cacheReadsPrice = tier.cacheReadsPrice ?? cacheReadsPrice
			}
		}

		// Check if we have the required prices after considering tiers
		if (!inputPrice || !outputPrice) {
			return undefined
		}

		// cacheReadsPrice is optional - if not defined, treat as 0
		if (!cacheReadsPrice) {
			cacheReadsPrice = 0
		}

		// Subtract the cached input tokens from the total input tokens.
		const uncachedInputTokens = inputTokens - cacheReadTokens

		// Bill both completion and reasoning ("thoughts") tokens as output.
		const billedOutputTokens = outputTokens + reasoningTokens

		let cacheReadCost = cacheReadTokens > 0 ? cacheReadsPrice * (cacheReadTokens / 1_000_000) : 0

		const inputTokensCost = inputPrice * (uncachedInputTokens / 1_000_000)
		const outputTokensCost = outputPrice * (billedOutputTokens / 1_000_000)
		const totalCost = inputTokensCost + outputTokensCost + cacheReadCost

		return totalCost
	}
}
