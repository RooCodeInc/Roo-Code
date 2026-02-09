import { promises as fs } from "node:fs"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import * as os from "os"
import * as path from "path"

import { qwenCodeModels, qwenCodeDefaultModelId } from "@roo-code/types"

import type { NeutralMessageParam } from "../../core/task-persistence"
import type { ApiHandlerOptions } from "../../shared/api"

import { ApiStream } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { OpenAICompatibleHandler, type OpenAICompatibleConfig } from "./openai-compatible"
import { DEFAULT_HEADERS } from "./constants"
import type { ApiHandlerCreateMessageMetadata } from "../index"

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

export class QwenCodeHandler extends OpenAICompatibleHandler {
	protected override options: QwenCodeHandlerOptions
	private credentials: QwenOAuthCredentials | null = null
	private refreshPromise: Promise<QwenOAuthCredentials> | null = null

	constructor(options: QwenCodeHandlerOptions) {
		const modelId = options.apiModelId || ""
		const modelInfo =
			qwenCodeModels[modelId as keyof typeof qwenCodeModels] || qwenCodeModels[qwenCodeDefaultModelId]

		const config: OpenAICompatibleConfig = {
			providerName: "qwen-code",
			baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
			apiKey: "",
			modelId,
			modelInfo,
		}

		super(options, config)
		this.options = options
	}

	override getModel() {
		const id = this.options.apiModelId ?? qwenCodeDefaultModelId
		const info = qwenCodeModels[id as keyof typeof qwenCodeModels] || qwenCodeModels[qwenCodeDefaultModelId]
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})
		return { id, info, ...params }
	}

	/**
	 * Recreate the AI SDK provider with current OAuth credentials.
	 */
	private updateProvider(): void {
		this.provider = createOpenAICompatible({
			name: this.config.providerName,
			baseURL: this.config.baseURL,
			apiKey: this.config.apiKey,
			headers: DEFAULT_HEADERS,
		})
	}

	// --- OAuth lifecycle (preserved as-is) ---

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
		}

		this.config.apiKey = this.credentials.access_token
		this.config.baseURL = this.getBaseUrl(this.credentials)
		this.updateProvider()
	}

	private getBaseUrl(creds: QwenOAuthCredentials): string {
		let baseUrl = creds.resource_url || "https://dashscope.aliyuncs.com/compatible-mode/v1"
		if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
			baseUrl = `https://${baseUrl}`
		}
		return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`
	}

	// --- Overrides with 401 retry ---

	override async *createMessage(
		systemPrompt: string,
		messages: NeutralMessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		await this.ensureAuthenticated()

		try {
			yield* super.createMessage(systemPrompt, messages, metadata)
		} catch (error: unknown) {
			if ((error as any).status === 401) {
				// Token expired mid-request, refresh and retry
				this.credentials = await this.refreshAccessToken(this.credentials!)
				this.config.apiKey = this.credentials.access_token
				this.config.baseURL = this.getBaseUrl(this.credentials)
				this.updateProvider()
				yield* super.createMessage(systemPrompt, messages, metadata)
			} else {
				throw error
			}
		}
	}

	override async completePrompt(prompt: string): Promise<string> {
		await this.ensureAuthenticated()

		try {
			return await super.completePrompt(prompt)
		} catch (error: unknown) {
			if ((error as any).status === 401) {
				// Token expired mid-request, refresh and retry
				this.credentials = await this.refreshAccessToken(this.credentials!)
				this.config.apiKey = this.credentials.access_token
				this.config.baseURL = this.getBaseUrl(this.credentials)
				this.updateProvider()
				return await super.completePrompt(prompt)
			} else {
				throw error
			}
		}
	}
}
