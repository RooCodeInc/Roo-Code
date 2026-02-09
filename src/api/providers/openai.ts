import { createOpenAI } from "@ai-sdk/openai"
import { streamText, generateText, ToolSet } from "ai"
import axios from "axios"

import { type ModelInfo, openAiModelInfoSaneDefaults, azureOpenAiDefaultApiVersion } from "@roo-code/types"

import type { NeutralMessageParam } from "../../core/task-persistence"
import type { ApiHandlerOptions } from "../../shared/api"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

/**
 * OpenAI-compatible provider using the AI SDK (@ai-sdk/openai).
 * Supports regular OpenAI, Azure OpenAI, Azure AI Inference, and Grok xAI.
 */
export class OpenAiHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
	}

	override getModel() {
		const id = this.options.openAiModelId ?? ""
		const info: ModelInfo = this.options.openAiCustomModelInfo ?? openAiModelInfoSaneDefaults
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})
		return { id, info, ...params }
	}

	override isAiSdkProvider(): boolean {
		return true
	}

	/**
	 * Create the AI SDK OpenAI provider with appropriate configuration.
	 * Handles regular OpenAI, Azure OpenAI, and Azure AI Inference.
	 */
	protected createProvider() {
		const baseUrl = this.options.openAiBaseUrl || "https://api.openai.com/v1"
		const apiKey = this.options.openAiApiKey ?? "not-provided"
		const isAzureAiInference = this._isAzureAiInference(baseUrl)
		const urlHost = this._getUrlHost(baseUrl)
		const isAzureOpenAi = urlHost === "azure.com" || urlHost.endsWith(".azure.com") || this.options.openAiUseAzure

		const customHeaders: Record<string, string> = {
			...DEFAULT_HEADERS,
			...(this.options.openAiHeaders || {}),
		}

		if (isAzureAiInference) {
			// Azure AI Inference Service: adjust baseURL so AI SDK appends /chat/completions correctly
			const apiVersion = this.options.azureApiVersion || "2024-05-01-preview"
			return createOpenAI({
				apiKey,
				baseURL: `${baseUrl}/models`,
				headers: customHeaders,
				fetch: async (url, init) => {
					const urlObj = new URL(url as string)
					urlObj.searchParams.set("api-version", apiVersion)
					return globalThis.fetch(urlObj.toString(), init)
				},
			})
		}

		if (isAzureOpenAi) {
			// Azure OpenAI uses api-key header and Azure-specific API versioning
			return createOpenAI({
				apiKey,
				baseURL: baseUrl || undefined,
				headers: {
					"api-key": apiKey,
					...customHeaders,
				},
			})
		}

		return createOpenAI({
			apiKey,
			baseURL: baseUrl || undefined,
			headers: customHeaders,
		})
	}

	override async *createMessage(
		systemPrompt: string,
		messages: NeutralMessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: modelId, info: modelInfo, temperature, reasoning } = this.getModel()
		const isO3Family = modelId.includes("o1") || modelId.includes("o3") || modelId.includes("o4")

		const provider = this.createProvider()
		const model = provider.chat(modelId)

		// Convert messages and tools
		const aiSdkMessages = convertToAiSdkMessages(messages)
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		// O3/O4 family uses developer role with modified prompt
		const system = isO3Family ? `Formatting re-enabled\n${systemPrompt}` : systemPrompt

		// Build provider options for OpenAI-specific features
		const openaiProviderOptions: Record<string, string> = {}

		if (isO3Family) {
			openaiProviderOptions.systemMessageMode = "developer"
		}

		if (reasoning?.reasoning_effort) {
			openaiProviderOptions.reasoningEffort = reasoning.reasoning_effort
		}

		// maxOutputTokens: only include when includeMaxTokens is true
		const maxOutputTokens =
			this.options.includeMaxTokens === true
				? this.options.modelMaxTokens || modelInfo.maxTokens || undefined
				: undefined

		const result = streamText({
			model,
			system,
			messages: aiSdkMessages,
			temperature: isO3Family ? undefined : (this.options.modelTemperature ?? temperature ?? 0),
			maxOutputTokens,
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
			providerOptions:
				Object.keys(openaiProviderOptions).length > 0 ? { openai: openaiProviderOptions } : undefined,
		})

		try {
			for await (const part of result.fullStream) {
				for (const chunk of processAiSdkStreamPart(part)) {
					yield chunk
				}
			}

			const usage = await result.usage
			const providerMetadata = await result.providerMetadata
			if (usage) {
				yield this.processUsageMetrics(usage, providerMetadata)
			}
		} catch (error) {
			throw handleAiSdkError(error, "OpenAI")
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId, temperature } = this.getModel()
		const provider = this.createProvider()
		const model = provider.chat(modelId)

		try {
			const { text } = await generateText({
				model,
				prompt,
				temperature: this.options.modelTemperature ?? temperature ?? 0,
			})
			return text
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`OpenAI completion error: ${error.message}`)
			}
			throw error
		}
	}

	/**
	 * Process usage metrics from the AI SDK response, including OpenAI's cache metrics.
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
		providerMetadata?: Record<string, Record<string, unknown>>,
	): ApiStreamUsageChunk {
		const openaiMeta = providerMetadata?.openai as Record<string, unknown> | undefined
		return {
			type: "usage",
			inputTokens: usage.inputTokens || 0,
			outputTokens: usage.outputTokens || 0,
			cacheWriteTokens: (openaiMeta?.cacheCreationInputTokens as number) ?? undefined,
			cacheReadTokens: usage.details?.cachedInputTokens ?? (openaiMeta?.cachedInputTokens as number) ?? undefined,
		}
	}

	protected _getUrlHost(baseUrl?: string): string {
		try {
			return new URL(baseUrl ?? "").host
		} catch (error) {
			return ""
		}
	}

	protected _isAzureAiInference(baseUrl?: string): boolean {
		const urlHost = this._getUrlHost(baseUrl)
		return urlHost.endsWith(".services.ai.azure.com")
	}
}

export async function getOpenAiModels(baseUrl?: string, apiKey?: string, openAiHeaders?: Record<string, string>) {
	try {
		if (!baseUrl) {
			return []
		}

		// Trim whitespace from baseUrl to handle cases where users accidentally include spaces
		const trimmedBaseUrl = baseUrl.trim()

		if (!URL.canParse(trimmedBaseUrl)) {
			return []
		}

		const config: Record<string, any> = {}
		const headers: Record<string, string> = {
			...DEFAULT_HEADERS,
			...(openAiHeaders || {}),
		}

		if (apiKey) {
			headers["Authorization"] = `Bearer ${apiKey}`
		}

		if (Object.keys(headers).length > 0) {
			config["headers"] = headers
		}

		const response = await axios.get(`${trimmedBaseUrl}/models`, config)
		const modelsArray = response.data?.data?.map((model: any) => model.id) || []
		return [...new Set<string>(modelsArray)]
	} catch (error) {
		return []
	}
}
