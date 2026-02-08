import type { Anthropic } from "@anthropic-ai/sdk"
import { createAmazonBedrock, type AmazonBedrockProvider } from "@ai-sdk/amazon-bedrock"
import { streamText, generateText, ToolSet } from "ai"
import { fromIni } from "@aws-sdk/credential-providers"
import OpenAI from "openai"

import {
	type ModelInfo,
	type ProviderSettings,
	type BedrockModelId,
	bedrockDefaultModelId,
	bedrockModels,
	bedrockDefaultPromptRouterModelId,
	BEDROCK_DEFAULT_TEMPERATURE,
	BEDROCK_MAX_TOKENS,
	BEDROCK_DEFAULT_CONTEXT,
	AWS_INFERENCE_PROFILE_MAPPING,
	BEDROCK_1M_CONTEXT_MODEL_IDS,
	BEDROCK_GLOBAL_INFERENCE_MODEL_IDS,
	BEDROCK_SERVICE_TIER_MODEL_IDS,
	BEDROCK_SERVICE_TIER_PRICING,
	ApiProviderError,
} from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import type { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { getModelParams } from "../transform/model-params"
import { shouldUseReasoningBudget } from "../../shared/api"
import { BaseProvider } from "./base-provider"
import { DEFAULT_HEADERS } from "./constants"
import { logger } from "../../utils/logging"
import { Package } from "../../shared/package"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

/************************************************************************************
 *
 *     PROVIDER
 *
 *************************************************************************************/

export class AwsBedrockHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ProviderSettings
	protected provider: AmazonBedrockProvider
	private arnInfo: any
	private readonly providerName = "Bedrock"
	private lastThoughtSignature: string | undefined
	private lastRedactedThinkingBlocks: Array<{ type: "redacted_thinking"; data: string }> = []

	constructor(options: ProviderSettings) {
		super()
		this.options = options
		let region = this.options.awsRegion

		// Process custom ARN if provided
		if (this.options.awsCustomArn) {
			this.arnInfo = this.parseArn(this.options.awsCustomArn, region)

			if (!this.arnInfo.isValid) {
				logger.error("Invalid ARN format", {
					ctx: "bedrock",
					errorMessage: this.arnInfo.errorMessage,
				})
				const errorMessage =
					this.arnInfo.errorMessage ||
					"Invalid ARN format. ARN should follow the pattern: arn:aws:bedrock:region:account-id:resource-type/resource-name"
				throw new Error("INVALID_ARN_FORMAT:" + errorMessage)
			}

			if (this.arnInfo.region && this.arnInfo.region !== this.options.awsRegion) {
				logger.info(this.arnInfo.errorMessage, {
					ctx: "bedrock",
					selectedRegion: this.options.awsRegion,
					arnRegion: this.arnInfo.region,
				})
				this.options.awsRegion = this.arnInfo.region
			}

			this.options.apiModelId = this.arnInfo.modelId
			if (this.arnInfo.crossRegionInference) this.options.awsUseCrossRegionInference = true
		}

		if (!this.options.modelTemperature) {
			this.options.modelTemperature = BEDROCK_DEFAULT_TEMPERATURE
		}

		this.costModelConfig = this.getModel()

		// Build provider settings for AI SDK
		const providerSettings: Parameters<typeof createAmazonBedrock>[0] = {
			region: this.options.awsRegion,
			headers: {
				...DEFAULT_HEADERS,
				"User-Agent": `RooCode#${Package.version}`,
			},
			// Add VPC endpoint if specified and enabled
			...(this.options.awsBedrockEndpoint &&
				this.options.awsBedrockEndpointEnabled && { baseURL: this.options.awsBedrockEndpoint }),
		}

		if (this.options.awsUseApiKey && this.options.awsApiKey) {
			// Use API key/token-based authentication
			providerSettings.apiKey = this.options.awsApiKey
		} else if (this.options.awsUseProfile && this.options.awsProfile) {
			// Use profile-based credentials via credentialProvider
			const profile = this.options.awsProfile
			providerSettings.credentialProvider = async () => {
				const creds = await fromIni({ profile, ignoreCache: true })()
				return {
					accessKeyId: creds.accessKeyId,
					secretAccessKey: creds.secretAccessKey,
					...(creds.sessionToken ? { sessionToken: creds.sessionToken } : {}),
				}
			}
		} else if (this.options.awsAccessKey && this.options.awsSecretKey) {
			// Use direct credentials
			providerSettings.accessKeyId = this.options.awsAccessKey
			providerSettings.secretAccessKey = this.options.awsSecretKey
			if (this.options.awsSessionToken) {
				providerSettings.sessionToken = this.options.awsSessionToken
			}
		}

		this.provider = createAmazonBedrock(providerSettings)
	}

	// Helper to guess model info from custom modelId string if not in bedrockModels
	private guessModelInfoFromId(modelId: string): Partial<ModelInfo> {
		const modelConfigMap: Record<string, Partial<ModelInfo>> = {
			"claude-4": {
				maxTokens: 8192,
				contextWindow: 200_000,
				supportsImages: true,
				supportsPromptCache: true,
			},
			"claude-3-7": {
				maxTokens: 8192,
				contextWindow: 200_000,
				supportsImages: true,
				supportsPromptCache: true,
			},
			"claude-3-5": {
				maxTokens: 8192,
				contextWindow: 200_000,
				supportsImages: true,
				supportsPromptCache: true,
			},
			"claude-4-opus": {
				maxTokens: 4096,
				contextWindow: 200_000,
				supportsImages: true,
				supportsPromptCache: true,
			},
			"claude-3-opus": {
				maxTokens: 4096,
				contextWindow: 200_000,
				supportsImages: true,
				supportsPromptCache: true,
			},
			"claude-3-haiku": {
				maxTokens: 4096,
				contextWindow: 200_000,
				supportsImages: true,
				supportsPromptCache: true,
			},
		}

		const id = modelId.toLowerCase()
		for (const [pattern, config] of Object.entries(modelConfigMap)) {
			if (id.includes(pattern)) {
				return config
			}
		}

		return {
			maxTokens: BEDROCK_MAX_TOKENS,
			contextWindow: BEDROCK_DEFAULT_CONTEXT,
			supportsImages: false,
			supportsPromptCache: false,
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const modelConfig = this.getModel()

		// Reset thinking state for this request
		this.lastThoughtSignature = undefined
		this.lastRedactedThinkingBlocks = []

		// Filter out provider-specific meta entries (e.g., { type: "reasoning" })
		// that are not valid Anthropic MessageParam values
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

		// Convert tools to AI SDK format
		let openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined
		const toolChoice = mapToolChoice(metadata?.tool_choice)

		// Build provider options for reasoning, betas, etc.
		const bedrockProviderOptions: Record<string, unknown> = {}

		// Extended thinking / reasoning configuration
		const isThinkingEnabledBySettings =
			shouldUseReasoningBudget({ model: modelConfig.info, settings: this.options }) &&
			modelConfig.reasoning &&
			modelConfig.reasoningBudget

		if (isThinkingEnabledBySettings && modelConfig.info.supportsReasoningBudget) {
			bedrockProviderOptions.reasoningConfig = {
				type: "enabled",
				budgetTokens: modelConfig.reasoningBudget,
			}
		}

		// Anthropic beta headers for various features
		const anthropicBetas: string[] = []
		const baseModelId = this.parseBaseModelId(modelConfig.id)

		// Add 1M context beta if enabled
		if (BEDROCK_1M_CONTEXT_MODEL_IDS.includes(baseModelId as any) && this.options.awsBedrock1MContext) {
			anthropicBetas.push("context-1m-2025-08-07")
		}

		if (anthropicBetas.length > 0) {
			bedrockProviderOptions.anthropicBeta = anthropicBetas
		}

		// Additional model request fields (service tier, etc.)
		// Note: The AI SDK may not directly support service_tier as a top-level param,
		// so we pass it through additionalModelRequestFields
		if (this.options.awsBedrockServiceTier && BEDROCK_SERVICE_TIER_MODEL_IDS.includes(baseModelId as any)) {
			bedrockProviderOptions.additionalModelRequestFields = {
				...(bedrockProviderOptions.additionalModelRequestFields as Record<string, unknown> | undefined),
				service_tier: this.options.awsBedrockServiceTier,
			}
		}

		// Prompt caching: use AI SDK's cachePoint mechanism
		// The AI SDK's @ai-sdk/amazon-bedrock supports cachePoint in providerOptions per message.
		//
		// Strategy: Bedrock allows up to 4 cache checkpoints. We use them as:
		//   1. System prompt (via systemProviderOptions below)
		//   2-4. Up to 3 user messages in the conversation history
		//
		// For the message cache points, we target the last 2 user messages (matching
		// Anthropic's strategy: write-to-cache + read-from-cache) PLUS an earlier "anchor"
		// user message near the middle of the conversation. This anchor ensures the 20-block
		// lookback window has a stable cache entry to hit, covering all assistant/tool messages
		// between the anchor and the recent messages.
		//
		// We identify targets in the ORIGINAL Anthropic messages (before AI SDK conversion)
		// because convertToAiSdkMessages() splits user messages containing tool_results into
		// separate "tool" + "user" role messages, which would skew naive counting.
		const usePromptCache = Boolean(this.options.awsUsePromptCache && this.supportsAwsPromptCache(modelConfig))

		if (usePromptCache) {
			const cachePointOption = { bedrock: { cachePoint: { type: "default" as const } } }

			// Find all user message indices in the original (pre-conversion) message array.
			const originalUserIndices = filteredMessages.reduce<number[]>(
				(acc, msg, idx) => (msg.role === "user" ? [...acc, idx] : acc),
				[],
			)

			// Select up to 3 user messages for cache points (system prompt uses the 4th):
			// - Last user message: write to cache for next request
			// - Second-to-last user message: read from cache for current request
			// - An "anchor" message earlier in the conversation for 20-block window coverage
			const targetOriginalIndices = new Set<number>()
			const numUserMsgs = originalUserIndices.length

			if (numUserMsgs >= 1) {
				// Always cache the last user message
				targetOriginalIndices.add(originalUserIndices[numUserMsgs - 1])
			}
			if (numUserMsgs >= 2) {
				// Cache the second-to-last user message
				targetOriginalIndices.add(originalUserIndices[numUserMsgs - 2])
			}
			if (numUserMsgs >= 5) {
				// Add an anchor cache point roughly in the first third of user messages.
				// This ensures that the 20-block lookback from the second-to-last breakpoint
				// can find a stable cache entry, covering all the assistant and tool messages
				// in the middle of the conversation. We pick the user message at ~1/3 position.
				const anchorIdx = Math.floor(numUserMsgs / 3)
				// Only add if it's not already one of the last-2 targets
				if (!targetOriginalIndices.has(originalUserIndices[anchorIdx])) {
					targetOriginalIndices.add(originalUserIndices[anchorIdx])
				}
			}

			// Apply cachePoint to the correct AI SDK messages by walking both arrays in parallel.
			// A single original user message with tool_results becomes [tool-role msg, user-role msg]
			// in the AI SDK array, while a plain user message becomes [user-role msg].
			if (targetOriginalIndices.size > 0) {
				this.applyCachePointsToAiSdkMessages(
					filteredMessages,
					aiSdkMessages,
					targetOriginalIndices,
					cachePointOption,
				)
			}
		}

		// Build streamText request
		// Cast providerOptions to any to bypass strict JSONObject typing — the AI SDK accepts the correct runtime values
		const requestOptions: Parameters<typeof streamText>[0] = {
			model: this.provider(modelConfig.id),
			system: systemPrompt,
			...(usePromptCache && {
				systemProviderOptions: { bedrock: { cachePoint: { type: "default" } } } as Record<string, unknown>,
			}),
			messages: aiSdkMessages,
			temperature: modelConfig.temperature ?? (this.options.modelTemperature as number),
			maxOutputTokens: modelConfig.maxTokens || (modelConfig.info.maxTokens as number),
			tools: aiSdkTools,
			toolChoice,
			...(Object.keys(bedrockProviderOptions).length > 0 && {
				providerOptions: { bedrock: bedrockProviderOptions } as any,
			}),
		}

		try {
			const result = streamText(requestOptions)

			// Process the full stream
			for await (const part of result.fullStream) {
				// Capture thinking signature from stream events.
				// The AI SDK's @ai-sdk/amazon-bedrock emits the signature as a reasoning-delta
				// event with providerMetadata.bedrock.signature (empty delta text, signature in metadata).
				// Also check tool-call events for thoughtSignature (Gemini pattern).
				const partAny = part as any
				if (partAny.providerMetadata?.bedrock?.signature) {
					this.lastThoughtSignature = partAny.providerMetadata.bedrock.signature
					logger.info("Captured thinking signature from stream", {
						ctx: "bedrock",
						signatureLength: this.lastThoughtSignature?.length,
					})
				} else if (partAny.providerMetadata?.bedrock?.thoughtSignature) {
					this.lastThoughtSignature = partAny.providerMetadata.bedrock.thoughtSignature
				} else if (partAny.providerMetadata?.anthropic?.thoughtSignature) {
					this.lastThoughtSignature = partAny.providerMetadata.anthropic.thoughtSignature
				}

				// Capture redacted reasoning data from stream events
				if (partAny.providerMetadata?.bedrock?.redactedData) {
					this.lastRedactedThinkingBlocks.push({
						type: "redacted_thinking",
						data: partAny.providerMetadata.bedrock.redactedData,
					})
				}

				for (const chunk of processAiSdkStreamPart(part)) {
					yield chunk
				}
			}

			// Yield usage metrics at the end
			const usage = await result.usage
			const providerMetadata = await result.providerMetadata
			if (usage) {
				yield this.processUsageMetrics(usage, modelConfig.info, providerMetadata)
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, modelConfig.id, "createMessage")
			TelemetryService.instance.captureException(apiError)

			// Check for throttling errors that should trigger retry (re-throw original to preserve status)
			if (this.isThrottlingError(error)) {
				if (error instanceof Error) {
					throw error
				}
				throw new Error("Throttling error occurred")
			}

			// Handle AI SDK errors (AI_RetryError, AI_APICallError, etc.)
			throw handleAiSdkError(error, this.providerName)
		}
	}

	/**
	 * Process usage metrics from the AI SDK response.
	 */
	private processUsageMetrics(
		usage: { inputTokens?: number; outputTokens?: number },
		info: ModelInfo,
		providerMetadata?: Record<string, Record<string, unknown>>,
	): ApiStreamUsageChunk {
		const inputTokens = usage.inputTokens ?? 0
		const outputTokens = usage.outputTokens ?? 0

		// The AI SDK exposes reasoningTokens as a top-level field on usage, and also
		// under outputTokenDetails.reasoningTokens — there is no .details property.
		const reasoningTokens =
			(usage as any).reasoningTokens ?? (usage as any).outputTokenDetails?.reasoningTokens ?? 0

		// Extract cache metrics primarily from usage (AI SDK standard locations),
		// falling back to providerMetadata.bedrock.usage for provider-specific fields.
		const bedrockUsage = providerMetadata?.bedrock?.usage as
			| { cacheReadInputTokens?: number; cacheWriteInputTokens?: number }
			| undefined
		const cacheReadTokens =
			(usage as any).inputTokenDetails?.cacheReadTokens ??
			(usage as any).cachedInputTokens ??
			bedrockUsage?.cacheReadInputTokens ??
			0
		const cacheWriteTokens =
			(usage as any).inputTokenDetails?.cacheWriteTokens ?? bedrockUsage?.cacheWriteInputTokens ?? 0

		// For prompt routers, the AI SDK surfaces the invoked model ID in
		// providerMetadata.bedrock.trace.promptRouter.invokedModelId.
		// When present, look up that model's pricing info for accurate cost calculation.
		const invokedModelId = (providerMetadata?.bedrock as any)?.trace?.promptRouter?.invokedModelId as
			| string
			| undefined
		let costInfo = info
		if (invokedModelId) {
			try {
				const invokedArnInfo = this.parseArn(invokedModelId)
				const invokedModel = this.getModelById(invokedArnInfo.modelId as string, invokedArnInfo.modelType)
				if (invokedModel) {
					// Update costModelConfig so subsequent requests use the invoked model's pricing,
					// but keep the router's ID so requests continue through the router.
					invokedModel.id = this.costModelConfig.id || invokedModel.id
					this.costModelConfig = invokedModel
					costInfo = invokedModel.info
				}
			} catch (error) {
				logger.error("Error handling Bedrock invokedModelId", {
					ctx: "bedrock",
					error: error instanceof Error ? error : String(error),
				})
			}
		}

		return {
			type: "usage",
			inputTokens,
			outputTokens,
			cacheReadTokens: cacheReadTokens > 0 ? cacheReadTokens : undefined,
			cacheWriteTokens: cacheWriteTokens > 0 ? cacheWriteTokens : undefined,
			reasoningTokens: reasoningTokens > 0 ? reasoningTokens : undefined,
			totalCost: this.calculateCost({
				inputTokens,
				outputTokens,
				cacheWriteTokens,
				cacheReadTokens,
				reasoningTokens,
				info: costInfo,
			}),
		}
	}

	/**
	 * Check if an error is a throttling/rate limit error
	 */
	private isThrottlingError(error: unknown): boolean {
		if (!(error instanceof Error)) return false
		if ((error as any).status === 429 || (error as any).$metadata?.httpStatusCode === 429) return true
		if ((error as any).name === "ThrottlingException") return true
		const msg = error.message.toLowerCase()
		return (
			msg.includes("throttl") ||
			msg.includes("rate limit") ||
			msg.includes("too many requests") ||
			msg.includes("bedrock is unable to process your request")
		)
	}

	async completePrompt(prompt: string): Promise<string> {
		const modelConfig = this.getModel()

		try {
			const result = await generateText({
				model: this.provider(modelConfig.id),
				prompt,
				temperature: modelConfig.temperature ?? (this.options.modelTemperature as number),
				maxOutputTokens: modelConfig.maxTokens || (modelConfig.info.maxTokens as number),
			})

			return result.text
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, modelConfig.id, "completePrompt")
			TelemetryService.instance.captureException(apiError)

			// Handle AI SDK errors (AI_RetryError, AI_APICallError, etc.)
			throw handleAiSdkError(error, this.providerName)
		}
	}

	/************************************************************************************
	 *
	 *     MODEL CONFIGURATION
	 *
	 *************************************************************************************/

	private costModelConfig: { id: BedrockModelId | string; info: ModelInfo } = {
		id: "",
		info: { maxTokens: 0, contextWindow: 0, supportsPromptCache: false },
	}

	private parseArn(arn: string, region?: string) {
		const arnRegex = /^arn:[^:]+:(?:bedrock|sagemaker):([^:]+):([^:]*):(?:([^\/]+)\/([\w\.\-:]+)|([^\/]+))$/
		let match = arn.match(arnRegex)

		if (match && match[1] && match[3] && match[4]) {
			const result: {
				isValid: boolean
				region?: string
				modelType?: string
				modelId?: string
				errorMessage?: string
				crossRegionInference: boolean
			} = {
				isValid: true,
				crossRegionInference: false,
			}

			result.modelType = match[3]
			const originalModelId = match[4]
			result.modelId = this.parseBaseModelId(originalModelId)

			const arnRegion = match[1]
			result.region = arnRegion

			if (originalModelId && result.modelId !== originalModelId) {
				let prefix = originalModelId.replace(result.modelId, "")
				result.crossRegionInference = AwsBedrockHandler.isSystemInferenceProfile(prefix)
			}

			if (region && arnRegion !== region) {
				result.errorMessage = `Region mismatch: The region in your ARN (${arnRegion}) does not match your selected region (${region}). This may cause access issues. The provider will use the region from the ARN.`
				result.region = arnRegion
			}

			return result
		}

		return {
			isValid: false,
			region: undefined,
			modelType: undefined,
			modelId: undefined,
			errorMessage: "Invalid ARN format. ARN should follow the Amazon Bedrock ARN pattern.",
			crossRegionInference: false,
		}
	}

	private parseBaseModelId(modelId: string): string {
		if (!modelId) return modelId

		for (const [_, inferenceProfile] of AWS_INFERENCE_PROFILE_MAPPING) {
			if (modelId.startsWith(inferenceProfile)) {
				return modelId.substring(inferenceProfile.length)
			}
		}

		if (modelId.startsWith("global.")) {
			return modelId.substring("global.".length)
		}

		return modelId
	}

	getModelById(modelId: string, modelType?: string): { id: BedrockModelId | string; info: ModelInfo } {
		const baseModelId = this.parseBaseModelId(modelId) as BedrockModelId

		let model
		if (baseModelId in bedrockModels) {
			model = { id: baseModelId, info: JSON.parse(JSON.stringify(bedrockModels[baseModelId])) }
		} else if (modelType && modelType.includes("router")) {
			model = {
				id: bedrockDefaultPromptRouterModelId,
				info: JSON.parse(JSON.stringify(bedrockModels[bedrockDefaultPromptRouterModelId])),
			}
		} else {
			const guessed = this.guessModelInfoFromId(modelId)
			model = {
				id: bedrockDefaultModelId,
				info: {
					...JSON.parse(JSON.stringify(bedrockModels[bedrockDefaultModelId])),
					...guessed,
				},
			}
		}

		if (this.options.modelMaxTokens && this.options.modelMaxTokens > 0) {
			model.info.maxTokens = this.options.modelMaxTokens
		}
		if (this.options.awsModelContextWindow && this.options.awsModelContextWindow > 0) {
			model.info.contextWindow = this.options.awsModelContextWindow
		}

		return model
	}

	override getModel(): {
		id: BedrockModelId | string
		info: ModelInfo
		maxTokens?: number
		temperature?: number
		reasoning?: any
		reasoningBudget?: number
	} {
		if (this.costModelConfig?.id?.trim().length > 0) {
			const params = getModelParams({
				format: "anthropic",
				modelId: this.costModelConfig.id,
				model: this.costModelConfig.info,
				settings: this.options,
				defaultTemperature: BEDROCK_DEFAULT_TEMPERATURE,
			})
			return { ...this.costModelConfig, ...params }
		}

		let modelConfig = undefined

		if (this.options.awsCustomArn) {
			modelConfig = this.getModelById(this.arnInfo.modelId, this.arnInfo.modelType)
			if (this.arnInfo.modelType !== "foundation-model") modelConfig.id = this.options.awsCustomArn
		} else {
			modelConfig = this.getModelById(this.options.apiModelId as string)

			const baseIdForGlobal = this.parseBaseModelId(modelConfig.id)
			if (
				this.options.awsUseGlobalInference &&
				BEDROCK_GLOBAL_INFERENCE_MODEL_IDS.includes(baseIdForGlobal as any)
			) {
				modelConfig.id = `global.${baseIdForGlobal}`
			} else if (this.options.awsUseCrossRegionInference && this.options.awsRegion) {
				const prefix = AwsBedrockHandler.getPrefixForRegion(this.options.awsRegion)
				if (prefix) {
					modelConfig.id = `${prefix}${modelConfig.id}`
				}
			}
		}

		// Check if 1M context is enabled
		const baseModelId = this.parseBaseModelId(modelConfig.id)
		if (BEDROCK_1M_CONTEXT_MODEL_IDS.includes(baseModelId as any) && this.options.awsBedrock1MContext) {
			const tier = modelConfig.info.tiers?.[0]
			modelConfig.info = {
				...modelConfig.info,
				contextWindow: tier?.contextWindow ?? 1_000_000,
				inputPrice: tier?.inputPrice ?? modelConfig.info.inputPrice,
				outputPrice: tier?.outputPrice ?? modelConfig.info.outputPrice,
				cacheWritesPrice: tier?.cacheWritesPrice ?? modelConfig.info.cacheWritesPrice,
				cacheReadsPrice: tier?.cacheReadsPrice ?? modelConfig.info.cacheReadsPrice,
			}
		}

		const params = getModelParams({
			format: "anthropic",
			modelId: modelConfig.id,
			model: modelConfig.info,
			settings: this.options,
			defaultTemperature: BEDROCK_DEFAULT_TEMPERATURE,
		})

		// Apply service tier pricing
		const baseModelIdForTier = this.parseBaseModelId(modelConfig.id)
		if (this.options.awsBedrockServiceTier && BEDROCK_SERVICE_TIER_MODEL_IDS.includes(baseModelIdForTier as any)) {
			const pricingMultiplier = BEDROCK_SERVICE_TIER_PRICING[this.options.awsBedrockServiceTier]
			if (pricingMultiplier && pricingMultiplier !== 1.0) {
				modelConfig.info = {
					...modelConfig.info,
					inputPrice: modelConfig.info.inputPrice
						? modelConfig.info.inputPrice * pricingMultiplier
						: undefined,
					outputPrice: modelConfig.info.outputPrice
						? modelConfig.info.outputPrice * pricingMultiplier
						: undefined,
					cacheWritesPrice: modelConfig.info.cacheWritesPrice
						? modelConfig.info.cacheWritesPrice * pricingMultiplier
						: undefined,
					cacheReadsPrice: modelConfig.info.cacheReadsPrice
						? modelConfig.info.cacheReadsPrice * pricingMultiplier
						: undefined,
				}
			}
		}

		return { ...modelConfig, ...params } as {
			id: BedrockModelId | string
			info: ModelInfo
			maxTokens?: number
			temperature?: number
			reasoning?: any
			reasoningBudget?: number
		}
	}

	/************************************************************************************
	 *
	 *     CACHE
	 *
	 *************************************************************************************/

	private supportsAwsPromptCache(modelConfig: { id: BedrockModelId | string; info: ModelInfo }): boolean | undefined {
		return (
			modelConfig?.info?.supportsPromptCache &&
			(modelConfig?.info as any)?.cachableFields &&
			(modelConfig?.info as any)?.cachableFields?.length > 0
		)
	}

	/**
	 * Apply cachePoint providerOptions to the correct AI SDK messages by walking
	 * the original Anthropic messages and converted AI SDK messages in parallel.
	 *
	 * convertToAiSdkMessages() can split a single Anthropic user message (containing
	 * tool_results + text) into 2 AI SDK messages (tool role + user role). This method
	 * accounts for that split so cache points land on the right message.
	 */
	private applyCachePointsToAiSdkMessages(
		originalMessages: Anthropic.Messages.MessageParam[],
		aiSdkMessages: { role: string; providerOptions?: Record<string, Record<string, unknown>> }[],
		targetOriginalIndices: Set<number>,
		cachePointOption: Record<string, Record<string, unknown>>,
	): void {
		let aiSdkIdx = 0
		for (let origIdx = 0; origIdx < originalMessages.length; origIdx++) {
			const origMsg = originalMessages[origIdx]

			if (typeof origMsg.content === "string") {
				// Simple string content → 1 AI SDK message
				if (targetOriginalIndices.has(origIdx) && aiSdkIdx < aiSdkMessages.length) {
					aiSdkMessages[aiSdkIdx].providerOptions = {
						...aiSdkMessages[aiSdkIdx].providerOptions,
						...cachePointOption,
					}
				}
				aiSdkIdx++
			} else if (origMsg.role === "user") {
				// User message with array content may split into tool + user messages.
				const hasToolResults = origMsg.content.some((part) => (part as { type: string }).type === "tool_result")
				const hasNonToolContent = origMsg.content.some(
					(part) => (part as { type: string }).type === "text" || (part as { type: string }).type === "image",
				)

				if (hasToolResults && hasNonToolContent) {
					// Split into tool msg + user msg — cache the user msg (the second one)
					const userMsgIdx = aiSdkIdx + 1
					if (targetOriginalIndices.has(origIdx) && userMsgIdx < aiSdkMessages.length) {
						aiSdkMessages[userMsgIdx].providerOptions = {
							...aiSdkMessages[userMsgIdx].providerOptions,
							...cachePointOption,
						}
					}
					aiSdkIdx += 2
				} else if (hasToolResults) {
					// Only tool results → 1 tool msg
					if (targetOriginalIndices.has(origIdx) && aiSdkIdx < aiSdkMessages.length) {
						aiSdkMessages[aiSdkIdx].providerOptions = {
							...aiSdkMessages[aiSdkIdx].providerOptions,
							...cachePointOption,
						}
					}
					aiSdkIdx++
				} else {
					// Only text/image content → 1 user msg
					if (targetOriginalIndices.has(origIdx) && aiSdkIdx < aiSdkMessages.length) {
						aiSdkMessages[aiSdkIdx].providerOptions = {
							...aiSdkMessages[aiSdkIdx].providerOptions,
							...cachePointOption,
						}
					}
					aiSdkIdx++
				}
			} else {
				// Assistant message → 1 AI SDK message
				aiSdkIdx++
			}
		}
	}

	/************************************************************************************
	 *
	 *     AMAZON REGIONS
	 *
	 *************************************************************************************/

	private static getPrefixForRegion(region: string): string | undefined {
		for (const [regionPattern, inferenceProfile] of AWS_INFERENCE_PROFILE_MAPPING) {
			if (region.startsWith(regionPattern)) {
				return inferenceProfile
			}
		}
		return undefined
	}

	private static isSystemInferenceProfile(prefix: string): boolean {
		for (const [_, inferenceProfile] of AWS_INFERENCE_PROFILE_MAPPING) {
			if (prefix === inferenceProfile) {
				return true
			}
		}
		return false
	}

	/************************************************************************************
	 *
	 *     COST CALCULATION
	 *
	 *************************************************************************************/

	private calculateCost({
		inputTokens,
		outputTokens,
		cacheWriteTokens = 0,
		cacheReadTokens = 0,
		reasoningTokens = 0,
		info,
	}: {
		inputTokens: number
		outputTokens: number
		cacheWriteTokens?: number
		cacheReadTokens?: number
		reasoningTokens?: number
		info: ModelInfo
	}): number {
		const inputPrice = info.inputPrice ?? 0
		const outputPrice = info.outputPrice ?? 0
		const cacheWritesPrice = info.cacheWritesPrice ?? 0
		const cacheReadsPrice = info.cacheReadsPrice ?? 0

		const uncachedInputTokens = Math.max(0, inputTokens - cacheWriteTokens - cacheReadTokens)
		const billedOutputTokens = outputTokens + reasoningTokens

		const cacheWriteCost = cacheWriteTokens > 0 ? cacheWritesPrice * (cacheWriteTokens / 1_000_000) : 0
		const cacheReadCost = cacheReadTokens > 0 ? cacheReadsPrice * (cacheReadTokens / 1_000_000) : 0
		const inputTokensCost = inputPrice * (uncachedInputTokens / 1_000_000)
		const outputTokensCost = outputPrice * (billedOutputTokens / 1_000_000)

		return inputTokensCost + outputTokensCost + cacheWriteCost + cacheReadCost
	}

	/************************************************************************************
	 *
	 *     THINKING SIGNATURE ROUND-TRIP
	 *
	 *************************************************************************************/

	/**
	 * Returns the thinking signature captured from the last Bedrock response.
	 * Claude models with extended thinking return a cryptographic signature
	 * which must be round-tripped back for multi-turn conversations with tool use.
	 */
	getThoughtSignature(): string | undefined {
		return this.lastThoughtSignature
	}

	/**
	 * Returns any redacted thinking blocks captured from the last Bedrock response.
	 * Anthropic returns these when safety filters trigger on reasoning content.
	 */
	getRedactedThinkingBlocks(): Array<{ type: "redacted_thinking"; data: string }> | undefined {
		return this.lastRedactedThinkingBlocks.length > 0 ? this.lastRedactedThinkingBlocks : undefined
	}

	override isAiSdkProvider(): boolean {
		return true
	}
}
