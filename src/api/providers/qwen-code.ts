import { promises as fs } from "node:fs"
import * as os from "os"
import * as path from "path"

import { Anthropic } from "@anthropic-ai/sdk"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { streamText, generateText, ToolSet } from "ai"

import { type ModelInfo, type QwenCodeModelId, qwenCodeModels, qwenCodeDefaultModelId } from "@roo-code/types"

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

const QWEN_OAUTH_BASE_URL = "https://chat.qwen.ai"
const QWEN_OAUTH_TOKEN_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/token`
const QWEN_OAUTH_CLIENT_ID = "f0304373b74a44d2b584a3fb70ca9e56"
const QWEN_DIR = ".qwen"
const QWEN_CREDENTIAL_FILENAME = "oauth_creds.json"

interface QwenOAuthCredentials {
	access_token: string
	refresh_token: string
	token_type: string
	expiry_date: number
	resource_url?: string
}

interface QwenCodeHandlerOptions extends ApiHandlerOptions {
	qwenCodeOauthPath?: string
}

function getQwenCachedCredentialPath(customPath?: string): string {
	if (customPath) {
		// Support custom path that starts with ~/ or is absolute
		if (customPath.startsWith("~/")) {
			return path.join(os.homedir(), customPath.slice(2))
		}
		return path.resolve(customPath)
	}
	return path.join(os.homedir(), QWEN_DIR, QWEN_CREDENTIAL_FILENAME)
}

function objectToUrlEncoded(data: Record<string, string>): string {
	return Object.keys(data)
		.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
		.join("&")
}

/**
 * Qwen Code provider using @ai-sdk/openai-compatible.
 * Uses OAuth credentials for authentication with automatic token refresh.
 */
export class QwenCodeHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: QwenCodeHandlerOptions
	private credentials: QwenOAuthCredentials | null = null
	private provider: ReturnType<typeof createOpenAICompatible> | null = null
	private refreshPromise: Promise<QwenOAuthCredentials> | null = null

	constructor(options: QwenCodeHandlerOptions) {
		super()
		this.options = options
	}

	private async loadCachedQwenCredentials(): Promise<QwenOAuthCredentials> {
		try {
			const keyFile = getQwenCachedCredentialPath(this.options.qwenCodeOauthPath)
			const credsStr = await fs.readFile(keyFile, "utf-8")
			return JSON.parse(credsStr)
		} catch (error) {
			console.error(
				`Error reading or parsing credentials file at ${getQwenCachedCredentialPath(this.options.qwenCodeOauthPath)}`,
			)
			throw new Error(`Failed to load Qwen OAuth credentials: ${error}`)
		}
	}

	private async refreshAccessToken(credentials: QwenOAuthCredentials): Promise<QwenOAuthCredentials> {
		// If a refresh is already in progress, return the existing promise
		if (this.refreshPromise) {
			return this.refreshPromise
		}

		// Create a new refresh promise
		this.refreshPromise = this.doRefreshAccessToken(credentials)

		try {
			const result = await this.refreshPromise
			return result
		} finally {
			// Clear the promise after completion (success or failure)
			this.refreshPromise = null
		}
	}

	private async doRefreshAccessToken(credentials: QwenOAuthCredentials): Promise<QwenOAuthCredentials> {
		if (!credentials.refresh_token) {
			throw new Error("No refresh token available in credentials.")
		}

		const bodyData = {
			grant_type: "refresh_token",
			refresh_token: credentials.refresh_token,
			client_id: QWEN_OAUTH_CLIENT_ID,
		}

		const response = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Accept: "application/json",
			},
			body: objectToUrlEncoded(bodyData),
		})

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`Token refresh failed: ${response.status} ${response.statusText}. Response: ${errorText}`)
		}

		const tokenData = await response.json()

		if (tokenData.error) {
			throw new Error(`Token refresh failed: ${tokenData.error} - ${tokenData.error_description}`)
		}

		const newCredentials = {
			...credentials,
			access_token: tokenData.access_token,
			token_type: tokenData.token_type,
			refresh_token: tokenData.refresh_token || credentials.refresh_token,
			expiry_date: Date.now() + tokenData.expires_in * 1000,
		}

		const filePath = getQwenCachedCredentialPath(this.options.qwenCodeOauthPath)
		try {
			await fs.writeFile(filePath, JSON.stringify(newCredentials, null, 2))
		} catch (error) {
			console.error("Failed to save refreshed credentials:", error)
			// Continue with the refreshed token in memory even if file write fails
		}

		return newCredentials
	}

	private isTokenValid(credentials: QwenOAuthCredentials): boolean {
		const TOKEN_REFRESH_BUFFER_MS = 30 * 1000 // 30s buffer
		if (!credentials.expiry_date) {
			return false
		}
		return Date.now() < credentials.expiry_date - TOKEN_REFRESH_BUFFER_MS
	}

	private async ensureAuthenticated(): Promise<void> {
		if (!this.credentials) {
			this.credentials = await this.loadCachedQwenCredentials()
		}

		if (!this.isTokenValid(this.credentials)) {
			this.credentials = await this.refreshAccessToken(this.credentials)
			// Invalidate provider when credentials change
			this.provider = null
		}
	}

	private getBaseUrl(creds: QwenOAuthCredentials): string {
		let baseUrl = creds.resource_url || "https://dashscope.aliyuncs.com/compatible-mode/v1"
		if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
			baseUrl = `https://${baseUrl}`
		}
		return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`
	}

	/**
	 * Get or create the AI SDK provider. Creates a new provider if credentials have changed.
	 */
	private getProvider(): ReturnType<typeof createOpenAICompatible> {
		if (!this.credentials) {
			throw new Error("Not authenticated. Call ensureAuthenticated first.")
		}

		if (!this.provider) {
			this.provider = createOpenAICompatible({
				name: "qwen-code",
				baseURL: this.getBaseUrl(this.credentials),
				apiKey: this.credentials.access_token,
				headers: DEFAULT_HEADERS,
			})
		}

		return this.provider
	}

	/**
	 * Get the language model for the configured model ID.
	 */
	private getLanguageModel() {
		const { id } = this.getModel()
		const provider = this.getProvider()
		return provider(id)
	}

	override getModel(): { id: string; info: ModelInfo; maxTokens?: number; temperature?: number } {
		const id = this.options.apiModelId ?? qwenCodeDefaultModelId
		const info = qwenCodeModels[id as keyof typeof qwenCodeModels] || qwenCodeModels[qwenCodeDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}

	/**
	 * Process usage metrics from the AI SDK response.
	 */
	protected processUsageMetrics(usage: {
		inputTokens?: number
		outputTokens?: number
		details?: {
			cachedInputTokens?: number
			reasoningTokens?: number
		}
	}): ApiStreamUsageChunk {
		return {
			type: "usage",
			inputTokens: usage.inputTokens || 0,
			outputTokens: usage.outputTokens || 0,
			cacheReadTokens: usage.details?.cachedInputTokens,
			reasoningTokens: usage.details?.reasoningTokens,
		}
	}

	/**
	 * Get the max output tokens for requests.
	 */
	protected getMaxOutputTokens(): number | undefined {
		const { info } = this.getModel()
		return this.options.modelMaxTokens || info.maxTokens || undefined
	}

	/**
	 * Create a message stream using the AI SDK.
	 */
	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		await this.ensureAuthenticated()

		const model = this.getModel()
		const languageModel = this.getLanguageModel()

		// Convert messages to AI SDK format
		const aiSdkMessages = convertToAiSdkMessages(messages)

		// Convert tools to OpenAI format first, then to AI SDK format
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		// Build the request options
		const requestOptions: Parameters<typeof streamText>[0] = {
			model: languageModel,
			system: systemPrompt,
			messages: aiSdkMessages,
			temperature: model.temperature ?? 0,
			maxOutputTokens: this.getMaxOutputTokens(),
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
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

			// Yield usage metrics at the end
			const usage = await result.usage
			if (usage) {
				yield this.processUsageMetrics(usage)
			}
		} catch (error: any) {
			// Handle 401 errors by refreshing token and retrying once
			if (error?.statusCode === 401 || error?.response?.status === 401) {
				this.credentials = await this.refreshAccessToken(this.credentials!)
				this.provider = null // Force provider recreation

				// Retry with new credentials
				const retryResult = streamText({
					...requestOptions,
					model: this.getLanguageModel(),
				})

				for await (const part of retryResult.fullStream) {
					for (const chunk of processAiSdkStreamPart(part)) {
						yield chunk
					}
				}

				const retryUsage = await retryResult.usage
				if (retryUsage) {
					yield this.processUsageMetrics(retryUsage)
				}
				return
			}

			// Handle other AI SDK errors
			throw handleAiSdkError(error, "Qwen Code")
		}
	}

	/**
	 * Complete a prompt using the AI SDK generateText.
	 */
	async completePrompt(prompt: string): Promise<string> {
		await this.ensureAuthenticated()

		const { temperature } = this.getModel()
		const languageModel = this.getLanguageModel()

		try {
			const { text } = await generateText({
				model: languageModel,
				prompt,
				maxOutputTokens: this.getMaxOutputTokens(),
				temperature: temperature ?? 0,
			})

			return text
		} catch (error: any) {
			// Handle 401 errors by refreshing token and retrying once
			if (error?.statusCode === 401 || error?.response?.status === 401) {
				this.credentials = await this.refreshAccessToken(this.credentials!)
				this.provider = null

				const { text } = await generateText({
					model: this.getLanguageModel(),
					prompt,
					maxOutputTokens: this.getMaxOutputTokens(),
					temperature: temperature ?? 0,
				})

				return text
			}

			throw handleAiSdkError(error, "Qwen Code")
		}
	}
}
