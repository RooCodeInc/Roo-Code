import {
	internationalZAiModels,
	mainlandZAiModels,
	internationalZAiDefaultModelId,
	mainlandZAiDefaultModelId,
	type InternationalZAiModelId,
	type MainlandZAiModelId,
	type ModelInfo,
	ZAI_DEFAULT_TEMPERATURE,
	zaiApiLineConfigs,
} from "@roo-code/types"

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import type { ApiHandlerOptions } from "../../shared/api"
import { getModelMaxOutputTokens } from "../../shared/api"
import { convertToOpenAiMessages } from "../transform/openai-format"
import type { ApiHandlerCreateMessageMetadata } from "../index"
import { handleOpenAIError } from "./utils/openai-error-handler"
import { getApiRequestTimeout } from "./utils/timeout-config"
import { DEFAULT_HEADERS } from "./constants"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

export class ZAiHandler extends BaseOpenAiCompatibleProvider<string> {
	protected override client: OpenAI

	constructor(options: ApiHandlerOptions) {
		const isChina = zaiApiLineConfigs[options.zaiApiLine ?? "international_coding"].isChina
		const models = (isChina ? mainlandZAiModels : internationalZAiModels) as unknown as Record<string, ModelInfo>
		const defaultModelId = (isChina ? mainlandZAiDefaultModelId : internationalZAiDefaultModelId) as string

		super({
			...options,
			providerName: "Z AI",
			baseURL: zaiApiLineConfigs[options.zaiApiLine ?? "international_coding"].baseUrl,
			apiKey: options.zaiApiKey ?? "not-provided",
			defaultProviderModelId: defaultModelId,
			providerModels: models,
			defaultTemperature: ZAI_DEFAULT_TEMPERATURE,
		})

		// Override the client with proper timeout and retry configuration
		const timeout = getApiRequestTimeout()
		const baseURL = zaiApiLineConfigs[options.zaiApiLine ?? "international_coding"].baseUrl
		const apiKey = options.zaiApiKey ?? "not-provided"

		this.client = new OpenAI({
			baseURL,
			apiKey,
			defaultHeaders: DEFAULT_HEADERS,
			timeout,
			maxRetries: 3, // Add retry logic for transient connection issues
		})
	}

	protected override createStream(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
		requestOptions?: OpenAI.RequestOptions,
	) {
		const { id: model, info } = this.getModel()

		// Centralized cap: clamp to 20% of the context window (unless provider-specific exceptions apply)
		const max_tokens =
			getModelMaxOutputTokens({
				modelId: model,
				model: info,
				settings: this.options,
				format: "openai",
			}) ?? undefined

		const temperature = this.options.modelTemperature ?? this.defaultTemperature

		const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model,
			max_tokens,
			temperature,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
			stream_options: { include_usage: true },
		}

		// Add thinking parameter if reasoning is enabled and model supports it
		const { id: modelId, info: modelInfo } = this.getModel()
		if (this.options.enableReasoningEffort && modelInfo.supportsReasoningBinary) {
			;(params as any).thinking = { type: "enabled" }
		}

		try {
			return this.client.chat.completions.create(params, requestOptions)
		} catch (error) {
			// Enhanced error handling for Z AI connection issues
			if (error instanceof Error) {
				const errorMessage = error.message.toLowerCase()
				if (
					errorMessage.includes("econnreset") ||
					errorMessage.includes("econnrefused") ||
					errorMessage.includes("etimedout")
				) {
					throw new Error(
						`Z AI connection error: Unable to connect to Z AI API. Please check your network connection and API endpoint configuration. Original error: ${error.message}`,
					)
				}
				if (errorMessage.includes("certificate") || errorMessage.includes("ssl")) {
					throw new Error(
						`Z AI SSL/TLS error: Certificate validation failed. This may be due to network proxy settings or firewall restrictions. Original error: ${error.message}`,
					)
				}
			}
			throw handleOpenAIError(error, this.providerName)
		}
	}

	override async completePrompt(prompt: string): Promise<string> {
		const { id: modelId } = this.getModel()

		const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
			model: modelId,
			messages: [{ role: "user", content: prompt }],
		}

		// Add thinking parameter if reasoning is enabled and model supports it
		const { info: modelInfo } = this.getModel()
		if (this.options.enableReasoningEffort && modelInfo.supportsReasoningBinary) {
			;(params as any).thinking = { type: "enabled" }
		}

		try {
			const response = await this.client.chat.completions.create(params)
			return response.choices[0]?.message.content || ""
		} catch (error) {
			// Enhanced error handling for Z AI connection issues
			if (error instanceof Error) {
				const errorMessage = error.message.toLowerCase()
				if (
					errorMessage.includes("econnreset") ||
					errorMessage.includes("econnrefused") ||
					errorMessage.includes("etimedout")
				) {
					throw new Error(
						`Z AI connection error: Unable to connect to Z AI API. Please check your network connection and API endpoint configuration. Original error: ${error.message}`,
					)
				}
				if (errorMessage.includes("certificate") || errorMessage.includes("ssl")) {
					throw new Error(
						`Z AI SSL/TLS error: Certificate validation failed. This may be due to network proxy settings or firewall restrictions. Original error: ${error.message}`,
					)
				}
			}
			throw handleOpenAIError(error, this.providerName)
		}
	}
}
