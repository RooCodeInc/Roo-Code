import { Anthropic } from "@anthropic-ai/sdk"
import { createOpenAI } from "@ai-sdk/openai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { createAzure } from "@ai-sdk/azure"
import { streamText, generateText, ToolSet, LanguageModel } from "ai"
import axios from "axios"

import {
	type ModelInfo,
	azureOpenAiDefaultApiVersion,
	openAiModelInfoSaneDefaults,
	DEEP_SEEK_DEFAULT_TEMPERATURE,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { TagMatcher } from "../../utils/tag-matcher"

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

// TODO: Rename this to OpenAICompatibleHandler. Also, I think the
// `OpenAINativeHandler` can subclass from this, since it's obviously
// compatible with the OpenAI API. We can also rename it to `OpenAIHandler`.
export class OpenAiHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private readonly providerName = "OpenAI"
	private readonly isAzureAiInference: boolean
	private readonly isAzureOpenAi: boolean
	private readonly languageModelFactory: (modelId: string) => LanguageModel

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const baseURL = this.options.openAiBaseUrl || "https://api.openai.com/v1"
		const apiKey = this.options.openAiApiKey ?? "not-provided"
		this.isAzureAiInference = this._isAzureAiInference(baseURL)
		const urlHost = this._getUrlHost(baseURL)
		this.isAzureOpenAi =
			!this.isAzureAiInference &&
			(urlHost === "azure.com" || urlHost.endsWith(".azure.com") || !!options.openAiUseAzure)

		const headers = {
			...DEFAULT_HEADERS,
			...(this.options.openAiHeaders || {}),
		}

		if (this.isAzureAiInference) {
			const provider = createOpenAICompatible({
				name: "OpenAI",
				baseURL: `${baseURL}/models`,
				apiKey,
				headers,
				queryParams: { "api-version": this.options.azureApiVersion || "2024-05-01-preview" },
			})
			this.languageModelFactory = (modelId: string) => provider(modelId)
		} else if (this.isAzureOpenAi) {
			const azureBaseURL = baseURL.endsWith("/openai") ? baseURL : `${baseURL}/openai`
			const provider = createAzure({
				baseURL: azureBaseURL,
				apiKey,
				apiVersion: this.options.azureApiVersion || azureOpenAiDefaultApiVersion,
				headers,
				useDeploymentBasedUrls: true,
			})
			this.languageModelFactory = (modelId: string) => provider.chat(modelId)
		} else {
			const provider = createOpenAI({
				baseURL,
				apiKey,
				headers,
			})
			this.languageModelFactory = (modelId: string) => provider.chat(modelId)
		}
	}

	protected getLanguageModel(): LanguageModel {
		const { id } = this.getModel()
		return this.languageModelFactory(id)
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { info: modelInfo, temperature, reasoning } = this.getModel()
		const modelId = this.options.openAiModelId ?? ""
		const enabledR1Format = this.options.openAiR1FormatEnabled ?? false
		const deepseekReasoner = modelId.includes("deepseek-reasoner") || enabledR1Format
		const isO3Family = modelId.includes("o1") || modelId.includes("o3") || modelId.includes("o4")

		const languageModel = this.getLanguageModel()

		const aiSdkMessages = convertToAiSdkMessages(messages)

		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		let effectiveSystemPrompt: string | undefined = systemPrompt
		let effectiveTemperature: number | undefined =
			this.options.modelTemperature ?? (deepseekReasoner ? DEEP_SEEK_DEFAULT_TEMPERATURE : (temperature ?? 0))

		const providerOptions: Record<string, any> = {}

		if (isO3Family) {
			effectiveSystemPrompt = `Formatting re-enabled\n${systemPrompt}`
			effectiveTemperature = undefined

			const openaiOpts: Record<string, unknown> = {
				systemMessageMode: "developer",
				parallelToolCalls: metadata?.parallelToolCalls ?? true,
			}

			const effort = modelInfo.reasoningEffort as string | undefined
			if (effort) {
				openaiOpts.reasoningEffort = effort
			}

			providerOptions.openai = openaiOpts
		} else if (reasoning?.reasoning_effort) {
			providerOptions.openai = {
				reasoningEffort: reasoning.reasoning_effort,
				parallelToolCalls: metadata?.parallelToolCalls ?? true,
			}
		}

		if (deepseekReasoner) {
			effectiveSystemPrompt = undefined
			aiSdkMessages.unshift({ role: "user", content: systemPrompt })
		}

		if (this.options.openAiStreamingEnabled ?? true) {
			yield* this.handleStreaming(
				languageModel,
				effectiveSystemPrompt,
				aiSdkMessages,
				effectiveTemperature,
				aiSdkTools,
				metadata,
				providerOptions,
				modelInfo,
			)
		} else {
			yield* this.handleNonStreaming(
				languageModel,
				effectiveSystemPrompt,
				aiSdkMessages,
				effectiveTemperature,
				aiSdkTools,
				metadata,
				providerOptions,
				modelInfo,
			)
		}
	}

	private async *handleStreaming(
		languageModel: LanguageModel,
		systemPrompt: string | undefined,
		messages: ReturnType<typeof convertToAiSdkMessages>,
		temperature: number | undefined,
		tools: ToolSet | undefined,
		metadata: ApiHandlerCreateMessageMetadata | undefined,
		providerOptions: Record<string, any>,
		modelInfo: ModelInfo,
	): ApiStream {
		const result = streamText({
			model: languageModel,
			system: systemPrompt,
			messages,
			temperature,
			maxOutputTokens: this.getMaxOutputTokens(),
			tools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
			providerOptions: Object.keys(providerOptions).length > 0 ? providerOptions : undefined,
		})

		const matcher = new TagMatcher(
			"think",
			(chunk) =>
				({
					type: chunk.matched ? "reasoning" : "text",
					text: chunk.data,
				}) as const,
		)

		try {
			for await (const part of result.fullStream) {
				for (const chunk of processAiSdkStreamPart(part)) {
					if (chunk.type === "text") {
						for (const matchedChunk of matcher.update(chunk.text)) {
							yield matchedChunk
						}
					} else {
						yield chunk
					}
				}
			}

			for (const chunk of matcher.final()) {
				yield chunk
			}

			const usage = await result.usage
			const providerMetadata = await result.providerMetadata
			if (usage) {
				yield this.processUsageMetrics(usage, modelInfo, providerMetadata as any)
			}
		} catch (error) {
			throw handleAiSdkError(error, this.providerName)
		}
	}

	private async *handleNonStreaming(
		languageModel: LanguageModel,
		systemPrompt: string | undefined,
		messages: ReturnType<typeof convertToAiSdkMessages>,
		temperature: number | undefined,
		tools: ToolSet | undefined,
		metadata: ApiHandlerCreateMessageMetadata | undefined,
		providerOptions: Record<string, any>,
		modelInfo: ModelInfo,
	): ApiStream {
		try {
			const { text, toolCalls, usage, providerMetadata } = await generateText({
				model: languageModel,
				system: systemPrompt,
				messages,
				temperature,
				maxOutputTokens: this.getMaxOutputTokens(),
				tools,
				toolChoice: mapToolChoice(metadata?.tool_choice),
				providerOptions: Object.keys(providerOptions).length > 0 ? providerOptions : undefined,
			})

			if (toolCalls && toolCalls.length > 0) {
				for (const toolCall of toolCalls) {
					yield {
						type: "tool_call",
						id: toolCall.toolCallId,
						name: toolCall.toolName,
						arguments: JSON.stringify((toolCall as any).args),
					}
				}
			}

			yield {
				type: "text",
				text: text || "",
			}

			if (usage) {
				yield this.processUsageMetrics(usage, modelInfo, providerMetadata as any)
			}
		} catch (error) {
			throw handleAiSdkError(error, this.providerName)
		}
	}

	protected processUsageMetrics(
		usage: {
			inputTokens?: number
			outputTokens?: number
			details?: {
				cachedInputTokens?: number
				reasoningTokens?: number
			}
		},
		_modelInfo?: ModelInfo,
		providerMetadata?: {
			openai?: {
				cachedPromptTokens?: number
				reasoningTokens?: number
			}
		},
	): ApiStreamUsageChunk {
		// Extract cache and reasoning metrics from OpenAI's providerMetadata when available,
		// falling back to usage.details for standard AI SDK fields.
		const cacheReadTokens = providerMetadata?.openai?.cachedPromptTokens ?? usage.details?.cachedInputTokens
		const reasoningTokens = providerMetadata?.openai?.reasoningTokens ?? usage.details?.reasoningTokens

		return {
			type: "usage",
			inputTokens: usage.inputTokens || 0,
			outputTokens: usage.outputTokens || 0,
			cacheReadTokens,
			reasoningTokens,
		}
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

	protected getMaxOutputTokens(): number | undefined {
		if (this.options.includeMaxTokens !== true) {
			return undefined
		}
		const { info } = this.getModel()
		return this.options.modelMaxTokens || info.maxTokens || undefined
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const { temperature } = this.getModel()
			const languageModel = this.getLanguageModel()

			const { text } = await generateText({
				model: languageModel,
				prompt,
				maxOutputTokens: this.getMaxOutputTokens(),
				temperature: this.options.modelTemperature ?? temperature ?? 0,
			})

			return text
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`${this.providerName} completion error: ${error.message}`)
			}
			throw error
		}
	}

	override isAiSdkProvider(): boolean {
		return true
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
