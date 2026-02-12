import { Anthropic } from "@anthropic-ai/sdk"
import { createAzure } from "@ai-sdk/azure"
import { streamText, generateText, ToolSet } from "ai"

import { azureModels, azureDefaultModelInfo, type ModelInfo } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	consumeAiSdkStream,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { applyToolCacheOptions } from "../transform/cache-breakpoints"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import type { RooMessage } from "../../core/task-persistence/rooMessage"
import { sanitizeMessagesForProvider } from "../transform/sanitize-messages"

const AZURE_DEFAULT_TEMPERATURE = 0

/**
 * Azure AI Foundry provider using the dedicated @ai-sdk/azure package.
 * Provides native support for Azure OpenAI deployments with proper resource-based routing.
 */
export class AzureHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected provider: ReturnType<typeof createAzure>

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const rawApiVersion = (options.azureApiVersion ?? "").trim()
		const queryLikeApiVersion = rawApiVersion.replace(/^\?/, "").trim()
		const normalizedApiVersion = queryLikeApiVersion.toLowerCase().includes("api-version=")
			? (new URLSearchParams(queryLikeApiVersion).get("api-version") ?? "")
			: queryLikeApiVersion
		const apiVersion = normalizedApiVersion.replace(/^api-version=/i, "").trim()

		// Create the Azure provider using AI SDK
		// The @ai-sdk/azure package uses resourceName-based routing
		this.provider = createAzure({
			resourceName: options.azureResourceName ?? "",
			apiKey: options.azureApiKey, // Optional — Azure supports managed identity / Entra ID auth
			...(apiVersion ? { apiVersion } : {}),
			headers: DEFAULT_HEADERS,
		})
	}

	override getModel(): { id: string; info: ModelInfo; maxTokens?: number; temperature?: number } {
		// Azure uses deployment names for API calls, but apiModelId for model capabilities.
		// deploymentId is sent to the Azure API; modelId is used for capability lookup.
		const deploymentId = this.options.azureDeploymentName ?? this.options.apiModelId ?? ""
		const modelId = this.options.apiModelId ?? deploymentId
		const info: ModelInfo =
			(azureModels as Record<string, ModelInfo>)[modelId] ??
			(azureModels as Record<string, ModelInfo>)[deploymentId] ??
			azureDefaultModelInfo
		const params = getModelParams({
			format: "openai",
			modelId: deploymentId, // deployment name for the API
			model: info,
			settings: this.options,
			defaultTemperature: AZURE_DEFAULT_TEMPERATURE,
		})
		return { id: deploymentId, info, ...params }
	}

	/**
	 * Get the language model for the configured deployment name.
	 * Azure provider is wired to use the Responses API endpoint.
	 */
	protected getLanguageModel() {
		const { id } = this.getModel()
		return this.provider.responses(id)
	}

	/**
	 * Process usage metrics from the AI SDK response.
	 * Azure AI Foundry provides standard OpenAI-compatible usage metrics.
	 */
	protected processUsageMetrics(
		usage: {
			inputTokens?: number
			outputTokens?: number
			totalInputTokens?: number
			totalOutputTokens?: number
			cachedInputTokens?: number
			reasoningTokens?: number
			inputTokenDetails?: { cacheReadTokens?: number; cacheWriteTokens?: number }
			outputTokenDetails?: { reasoningTokens?: number }
			details?: {
				cachedInputTokens?: number
				reasoningTokens?: number
			}
		},
		providerMetadata?: {
			azure?: {
				promptCacheHitTokens?: number
				promptCacheMissTokens?: number
			}
		},
	): ApiStreamUsageChunk {
		// Extract cache metrics from Azure's providerMetadata, then v6 fields, then legacy
		const cacheReadTokens =
			providerMetadata?.azure?.promptCacheHitTokens ??
			usage.cachedInputTokens ??
			usage.inputTokenDetails?.cacheReadTokens ??
			usage.details?.cachedInputTokens
		// Azure uses OpenAI-compatible caching which does not report cache write tokens separately;
		// promptCacheMissTokens represents tokens NOT found in cache (processed from scratch), not tokens written to cache.
		const cacheWriteTokens = usage.inputTokenDetails?.cacheWriteTokens

		const inputTokens = usage.inputTokens || 0
		const outputTokens = usage.outputTokens || 0
		return {
			type: "usage",
			inputTokens,
			outputTokens,
			cacheReadTokens,
			cacheWriteTokens,
			reasoningTokens:
				usage.reasoningTokens ?? usage.outputTokenDetails?.reasoningTokens ?? usage.details?.reasoningTokens,
			totalInputTokens: inputTokens,
			totalOutputTokens: outputTokens,
		}
	}

	/**
	 * Get the max tokens parameter to include in the request.
	 * Returns undefined if no valid maxTokens is configured to let the API use its default.
	 */
	protected getMaxOutputTokens(): number | undefined {
		const { info } = this.getModel()
		const maxTokens = this.options.modelMaxTokens || info.maxTokens
		// Azure AI Foundry API requires maxOutputTokens >= 1, so filter out invalid values
		return maxTokens && maxTokens > 0 ? maxTokens : undefined
	}

	/**
	 * Create a message stream using the AI SDK.
	 */
	override async *createMessage(
		systemPrompt: string,
		messages: RooMessage[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { temperature } = this.getModel()
		const languageModel = this.getLanguageModel()

		// Sanitize messages for the provider API (allowlist: role, content, providerOptions).
		const aiSdkMessages = sanitizeMessagesForProvider(messages)

		// Convert tools to OpenAI format first, then to AI SDK format
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined
		applyToolCacheOptions(aiSdkTools as Parameters<typeof applyToolCacheOptions>[0], metadata?.toolProviderOptions)

		// Build the request options
		const requestOptions: Parameters<typeof streamText>[0] = {
			model: languageModel,
			system: systemPrompt || undefined,
			messages: aiSdkMessages,
			temperature: this.options.modelTemperature ?? temperature ?? AZURE_DEFAULT_TEMPERATURE,
			maxOutputTokens: this.getMaxOutputTokens(),
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
		}

		// Use streamText for streaming responses
		const result = streamText(requestOptions)

		try {
			const processUsage = this.processUsageMetrics.bind(this)
			yield* consumeAiSdkStream(result, async function* () {
				const [usage, providerMetadata] = await Promise.all([result.usage, result.providerMetadata])
				yield processUsage(usage, providerMetadata as Parameters<typeof processUsage>[1])
			})
		} catch (error) {
			// Handle AI SDK errors (AI_RetryError, AI_APICallError, etc.)
			throw handleAiSdkError(error, "Azure AI Foundry")
		}
	}

	/**
	 * Complete a prompt using the AI SDK generateText.
	 */
	async completePrompt(prompt: string): Promise<string> {
		const { temperature } = this.getModel()
		const languageModel = this.getLanguageModel()

		const { text } = await generateText({
			model: languageModel,
			prompt,
			maxOutputTokens: this.getMaxOutputTokens(),
			temperature: this.options.modelTemperature ?? temperature ?? AZURE_DEFAULT_TEMPERATURE,
		})

		return text
	}

	override isAiSdkProvider(): boolean {
		return true
	}
}
