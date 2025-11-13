import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI, { AzureOpenAI } from "openai"
import type { ModelInfo } from "@roo-code/types"
import { ApiStream } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { getModelParams } from "../transform/model-params"
import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import { handleOpenAIError } from "./utils/openai-error-handler"
import type { ApiHandlerOptions, ApiHandlerCreateMessageMetadata } from "../index"
import { ClientSecretCredential } from "@azure/identity"

type AzureProviderOptions = ApiHandlerOptions & {
	azureEndpoint: string
	azureApiKey?: string
	azureApiVersion?: string
	azureDeployment?: string
	azureUseAAD?: boolean
	azureTenantId?: string
	azureClientId?: string
	azureClientSecret?: string
	azureFoundry?: boolean
	azureFoundryModelId?: string
	azureFoundryApiVersion?: string
	azureFoundryDeployment?: string
	providerModels: Record<string, ModelInfo>
	defaultProviderModelId: string
}

export class AzureHandler extends BaseProvider {
	protected options: AzureProviderOptions
	private client: OpenAI | AzureOpenAI
	private readonly providerName = "Azure"
	private readonly isFoundry: boolean
	private readonly modelRegistry: Record<string, ModelInfo>
	private readonly defaultModelId: string

	constructor(options: AzureProviderOptions) {
		super()
		this.options = options
		this.isFoundry = !!options.azureFoundry
		this.modelRegistry = options.providerModels
		this.defaultModelId = options.defaultProviderModelId

		const endpoint = options.azureEndpoint
		const apiKey = options.azureApiKey
		const apiVersion = options.azureApiVersion || "2025-04-01-preview"

		let headers = {
			...DEFAULT_HEADERS,
			...(apiKey ? { "api-key": apiKey } : {}),
		}

		// Azure AD (AAD) authentication
		if (options.azureUseAAD && options.azureTenantId && options.azureClientId && options.azureClientSecret) {
			const credential = new ClientSecretCredential(
				options.azureTenantId,
				options.azureClientId,
				options.azureClientSecret
			)
			// Azure OpenAI/Foundry resource scope
			const scope = options.azureScope || "https://cognitiveservices.azure.com/.default"
			// Synchronously block on token acquisition for provider construction
			// (in production, this should be cached/refreshed, but for provider init this is fine)
			// Note: getToken returns a Promise, so we must use async constructor pattern or workaround
			// Here, we use a sync workaround for simplicity (not ideal for high concurrency)
			const getTokenSync = () => {
				let token: string | undefined
				let error: any
				credential.getToken(scope)
					.then(res => { token = res?.token })
					.catch(e => { error = e })
				const start = Date.now()
				while (!token && !error && Date.now() - start < 10000) {
					require("deasync").runLoopOnce()
				}
				if (error) throw error
				if (!token) throw new Error("Timeout acquiring Azure AD token")
				return token
			}
			try {
				const bearer = getTokenSync()
				headers = {
					...headers,
					Authorization: `Bearer ${bearer}`,
				}
				// Remove api-key if present, as Bearer is preferred
				delete headers["api-key"]
			} catch (e) {
				throw new Error("Failed to acquire Azure AD token: " + (e instanceof Error ? e.message : String(e)))
			}
		}

		if (this.isFoundry) {
			// Azure AI Foundry endpoint pattern: {endpoint}/api/v1/...
			this.client = new OpenAI({
				baseURL: endpoint,
				apiKey,
				defaultHeaders: headers,
				defaultQuery: options.azureFoundryApiVersion
					? { "api-version": options.azureFoundryApiVersion }
					: undefined,
			})
		} else {
			// Azure OpenAI endpoint pattern: {endpoint}/openai/deployments/{deployment}/chat/completions?api-version=...
			this.client = new AzureOpenAI({
				baseURL: endpoint,
				apiKey,
				apiVersion,
				defaultHeaders: headers,
			})
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: modelId, info: modelInfo } = this.getModel()
		const deployment = this.isFoundry
			? this.options.azureFoundryDeployment || modelId
			: this.options.azureDeployment || modelId

		const apiVersion = this.isFoundry
			? this.options.azureFoundryApiVersion
			: this.options.azureApiVersion || "2025-04-01-preview"

		const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			max_tokens: modelInfo.maxTokens,
			temperature: this.options.modelTemperature ?? 0,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
		}

		let requestOptions: OpenAI.RequestOptions | undefined = undefined

		if (this.isFoundry) {
			// Foundry: {endpoint}/api/v1/{deployment}/chat/completions?api-version=...
			requestOptions = {
				path: `/api/v1/${deployment}/chat/completions?api-version=${apiVersion}`,
			}
		} else {
			// Azure OpenAI: {endpoint}/openai/deployments/{deployment}/chat/completions?api-version=...
			requestOptions = {
				path: `/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
			}
		}

		let stream
		try {
			stream = await (this.client as any).chat.completions.create(params, requestOptions)
		} catch (error) {
			throw this.normalizeAzureError(error)
		}

		for await (const chunk of stream) {
			const delta = chunk.choices?.[0]?.delta
			if (delta?.content) {
				yield { type: "text", text: delta.content }
			}
			if (chunk.usage) {
				yield {
					type: "usage",
					inputTokens: chunk.usage.prompt_tokens || 0,
					outputTokens: chunk.usage.completion_tokens || 0,
				}
			}
		}
	}

	override getModel() {
		// Forward-compatible: allow any model ID, even if not in registry
		const id = this.options.apiModelId || this.defaultModelId
		const info =
			this.modelRegistry[id] ||
			({
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsImages: false,
				description: "Azure (forward-compatible model)",
			} as ModelInfo)
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
		})
		return { id, info, ...params }
	}

	/**
	 * Normalize Azure-specific errors to user-friendly messages.
	 */
	private normalizeAzureError(error: unknown): Error {
		if (error instanceof Error) {
			const msg = error.message || ""
			// Azure error codes and patterns
			if (msg.includes("429") || msg.match(/rate.?limit|too many requests/i)) {
				return new Error("Azure API rate limit exceeded. Please reduce request frequency or check your quota.")
			}
			if (msg.includes("401") || msg.match(/unauthorized|invalid api key|invalid authentication/i)) {
				return new Error("Azure API authentication failed. Please check your API key or AAD credentials.")
			}
			if (msg.includes("403") || msg.match(/forbidden|permission/i)) {
				return new Error("Azure API permission denied. Please check your access rights and resource permissions.")
			}
			if (msg.includes("404") || msg.match(/not found|deployment does not exist|model not found/i)) {
				return new Error("Azure deployment or model not found. Please check your deployment name and model ID.")
			}
			if (msg.match(/quota|exceeded|limit/i)) {
				return new Error("Azure API quota exceeded. Please check your subscription limits or request a quota increase.")
			}
			// Fallback to OpenAI error handler for other cases
			return handleOpenAIError(error, this.providerName)
		}
		return handleOpenAIError(error, this.providerName)
	}
}