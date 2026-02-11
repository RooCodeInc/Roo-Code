import { promises as fs } from "node:fs"
import { Anthropic } from "@anthropic-ai/sdk"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { wrapLanguageModel, extractReasoningMiddleware, type LanguageModel } from "ai"
import * as os from "os"
import * as path from "path"

import { type ModelInfo, type QwenCodeModelId, qwenCodeModels, qwenCodeDefaultModelId } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { safeWriteJson } from "../../utils/safeWriteJson"

import { getModelParams } from "../transform/model-params"
import { ApiStream } from "../transform/stream"

import { DEFAULT_HEADERS } from "./constants"
import { OpenAICompatibleHandler, OpenAICompatibleConfig } from "./openai-compatible"
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

interface QwenTokenRefreshResponse {
	access_token?: string
	refresh_token?: string
	token_type?: string
	expires_in?: number
	error?: string
	error_description?: string
}

export interface QwenCodeHandlerOptions extends ApiHandlerOptions {
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

export class QwenCodeHandler extends OpenAICompatibleHandler implements SingleCompletionHandler {
	private qwenOptions: QwenCodeHandlerOptions
	private credentials: QwenOAuthCredentials | null = null
	private refreshPromise: Promise<QwenOAuthCredentials> | null = null

	constructor(options: QwenCodeHandlerOptions) {
		const modelId = options.apiModelId ?? qwenCodeDefaultModelId
		const modelInfo =
			qwenCodeModels[modelId as QwenCodeModelId] || qwenCodeModels[qwenCodeDefaultModelId as QwenCodeModelId]

		const config: OpenAICompatibleConfig = {
			providerName: "qwen-code",
			baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
			apiKey: "pending-oauth",
			modelId,
			modelInfo,
			modelMaxTokens: options.modelMaxTokens ?? undefined,
			temperature: options.modelTemperature ?? undefined,
		}

		super(options, config)
		this.qwenOptions = options
	}

	protected override getLanguageModel(): LanguageModel {
		const apiKey = this.credentials?.access_token ?? "pending-oauth"
		const baseURL = this.credentials
			? this.getBaseUrl(this.credentials)
			: "https://dashscope.aliyuncs.com/compatible-mode/v1"
		const provider = createOpenAICompatible({
			name: "qwen-code",
			baseURL,
			apiKey,
			headers: { ...DEFAULT_HEADERS },
		})
		const model = this.getModel()
		const baseModel = provider(model.id)
		return wrapLanguageModel({
			model: baseModel,
			middleware: extractReasoningMiddleware({ tagName: "think" }),
		})
	}

	private async loadCachedQwenCredentials(): Promise<QwenOAuthCredentials> {
		try {
			const keyFile = getQwenCachedCredentialPath(this.qwenOptions.qwenCodeOauthPath)
			const credsStr = await fs.readFile(keyFile, "utf-8")
			return JSON.parse(credsStr)
		} catch (error) {
			console.error(
				`Error reading or parsing credentials file at ${getQwenCachedCredentialPath(this.qwenOptions.qwenCodeOauthPath)}`,
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

		const tokenData = (await response.json()) as QwenTokenRefreshResponse

		if (tokenData.error) {
			throw new Error(`Token refresh failed: ${tokenData.error} - ${tokenData.error_description}`)
		}

		if (!tokenData.access_token || !tokenData.token_type || typeof tokenData.expires_in !== "number") {
			throw new Error("Token refresh failed: invalid token response")
		}

		const newCredentials: QwenOAuthCredentials = {
			...credentials,
			access_token: tokenData.access_token,
			token_type: tokenData.token_type,
			refresh_token: tokenData.refresh_token || credentials.refresh_token,
			expiry_date: Date.now() + tokenData.expires_in * 1000,
		}

		const filePath = getQwenCachedCredentialPath(this.qwenOptions.qwenCodeOauthPath)
		try {
			await safeWriteJson(filePath, newCredentials)
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
		}
	}

	private getBaseUrl(creds: QwenOAuthCredentials): string {
		let baseUrl = creds.resource_url || "https://dashscope.aliyuncs.com/compatible-mode/v1"
		if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
			baseUrl = `https://${baseUrl}`
		}
		return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`
	}

	private async forceRefreshAndAuthenticate(): Promise<void> {
		if (!this.credentials) {
			this.credentials = await this.loadCachedQwenCredentials()
		}

		this.credentials = await this.refreshAccessToken(this.credentials)
	}

	private getStatusCode(error: unknown): number | undefined {
		if (!error || typeof error !== "object") {
			return undefined
		}

		const obj = error as Record<string, unknown>

		const parseStatusCode = (value: unknown): number | undefined => {
			if (typeof value === "number") {
				return value
			}
			if (typeof value === "string") {
				const parsed = Number.parseInt(value, 10)
				if (!Number.isNaN(parsed)) {
					return parsed
				}
			}
			return undefined
		}

		const directStatus = parseStatusCode(obj.status) ?? parseStatusCode(obj.statusCode)
		if (directStatus !== undefined) {
			return directStatus
		}

		const nestedError = obj.lastError ?? obj.cause
		if (nestedError) {
			return this.getStatusCode(nestedError)
		}

		return undefined
	}

	private isAuthError(error: unknown): boolean {
		const statusCode = this.getStatusCode(error)
		if (statusCode === 401) {
			return true
		}

		if (error instanceof Error) {
			const message = error.message || ""
			if (message.includes("401") || message.includes("Unauthorized")) {
				return true
			}
		}

		return false
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		await this.ensureAuthenticated()

		try {
			yield* super.createMessage(systemPrompt, messages, metadata)
		} catch (error) {
			if (this.isAuthError(error)) {
				await this.forceRefreshAndAuthenticate()
				yield* super.createMessage(systemPrompt, messages, metadata)
			} else {
				throw error
			}
		}
	}

	override getModel(): { id: string; info: ModelInfo; maxTokens?: number; temperature?: number } {
		const id = this.options.apiModelId ?? qwenCodeDefaultModelId
		const info = qwenCodeModels[id as QwenCodeModelId] || qwenCodeModels[qwenCodeDefaultModelId as QwenCodeModelId]
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})
		return { id, info, ...params }
	}

	override async completePrompt(prompt: string): Promise<string> {
		await this.ensureAuthenticated()

		try {
			return await super.completePrompt(prompt)
		} catch (error) {
			if (this.isAuthError(error)) {
				await this.forceRefreshAndAuthenticate()
				return await super.completePrompt(prompt)
			}
			throw error
		}
	}
}
