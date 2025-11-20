/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import OpenAI from "openai"
import { Logger } from "../base/common/log-util"
import { workspace } from "vscode"
import { AxiosError } from "axios"
import { v7 as uuidv7 } from "uuid"
import * as vscode from "vscode"
import { configCompletion, settings, OPENAI_CLIENT_NOT_INITIALIZED, NOT_PROVIDERED } from "../base/common/constant"
import { CompletionPoint } from "./completionPoint"
import { CompletionScores } from "./completionScore"
import { Completion } from "openai/resources/completions"
import type { ClineProvider } from "../../webview/ClineProvider"
import { CompletionAcception } from "./completionDataInterface"
import { getDependencyImports } from "./extractingImports"
import { getClientId } from "../../../utils/getClientId"
import { ProviderSettings } from "@roo-code/types"
import { ZgsmAuthConfig, ZgsmAuthService, ZgsmAuthStorage } from "../auth"
import { COSTRICT_DEFAULT_HEADERS } from "../../../shared/headers"
/**
 * Completion client, which handles the details of communicating with the large model API and shields the communication details from the caller.
 * The caller can handle network communication as conveniently as calling a local function.
 */

export class CompletionClient {
	private static client?: CompletionClient
	private static providerRef: WeakRef<ClineProvider>
	private openai?: OpenAI
	private stopWords: string[] = []
	private reqs: Map<string, any> = new Map<string, any>()
	private betaMode?: any

	private async getApiConfig(apiConfiguration: ProviderSettings) {
		const completionUrl = "/code-completion/api/v1"
		const tokens = await ZgsmAuthStorage.getInstance().getTokens()

		return {
			baseUrl: apiConfiguration.zgsmBaseUrl || ZgsmAuthConfig.getInstance().getDefaultApiBaseUrl(),
			completionUrl,
			apiKey: apiConfiguration.zgsmAccessToken || tokens?.access_token || NOT_PROVIDERED,
		}
	}

	public static async setProvider(provider: ClineProvider) {
		CompletionClient.providerRef = new WeakRef(provider)

		provider?.postMessageToWebview?.({ type: "state", state: await provider?.getStateToPostToWebview?.() })
	}

	public static getProvider() {
		return CompletionClient.providerRef.deref()
	}

	/**
	 * Send a request to the LLM to obtain the code completion result at the completion point cp.
	 */
	public static async callApi(
		cp: CompletionPoint,
		scores: CompletionScores,
		latestCompletion: CompletionPoint | undefined,
	): Promise<string> {
		const client = await this.getInstance()
		if (!client) {
			const provider = CompletionClient.providerRef.deref()
			ZgsmAuthService.openStatusBarLoginTip()
			provider?.postMessageToWebview?.({ type: "state", state: await provider?.getStateToPostToWebview?.() })

			throw new Error(OPENAI_CLIENT_NOT_INITIALIZED)
		}
		// console.time("Completion response timeout");

		try {
			const response = await client.doCallApi(cp, scores, latestCompletion)

			Logger.log(`Completion [${cp.id}]: Request succeeded`, response)
			cp.fetched(client.acquireCompletionText(response))
			cp.parentId = client.acquireCompletionId(response)
			return cp.getContent()
		} catch (err: unknown) {
			if (err instanceof Error && err.name === "AbortError") {
				Logger.log(`Completion [${cp.id}]: Request cancelled`, err)
				cp.cancel()
			} else {
				Logger.error(`Completion [${cp.id}]: Request failed`, err)
				this.client = undefined // reset client
				const statusCode = (err as AxiosError)?.response?.status || 500

				if ((err as AxiosError).status === 401) {
					const provider = CompletionClient.providerRef.deref()

					ZgsmAuthService.openStatusBarLoginTip()

					provider?.postMessageToWebview?.({
						type: "state",
						state: await provider?.getStateToPostToWebview?.(),
					})
				}
			}
			throw err
		} finally {
			if (client) {
				client.reqs.delete(cp.id)
			}
			// console.timeEnd("Completion response timeout");
		}
	}

	/**
	 * Cancel the incomplete request initiated by the completion point cp.
	 */
	public static async cancelApi(cp: CompletionPoint) {
		const client = await this.getInstance()
		if (!client) {
			return
		}
		const value = client.reqs.get(cp.id)
		if (value) {
			Logger.log(`Request [id=${cp.id}] cancelled`)
			value.cancel(`Request [id=${cp.id}] cancelled`)
			client.reqs.delete(cp.id)
		}
	}

	/**
	 * Create an OpenAI client for calling the LLM API.
	 */
	private async createClient(force: boolean): Promise<boolean> {
		if (this.openai && !force) {
			return true
		}
		const provider = CompletionClient.providerRef.deref()

		const { apiConfiguration } = await provider!.getState()

		if (!apiConfiguration?.zgsmAccessToken) {
			Logger.error("Failed to get login information. Please log in again to use the completion service")
			return false
		}

		const config = await this.getApiConfig(apiConfiguration)
		const fullUrl = `${config.baseUrl}${config.completionUrl}`

		if (config.apiKey === NOT_PROVIDERED) {
			return false
		}

		this.openai = new OpenAI({
			baseURL: fullUrl,
			apiKey: config.apiKey,
			defaultHeaders: {
				...COSTRICT_DEFAULT_HEADERS,
				"X-Request-ID": uuidv7(),
			},
			timeout: 5000,
			maxRetries: 0,
		})

		if (!this.openai) {
			// Logger.error("Completion: Configuration error: configuration:", configuration, "openai: ", this.openai);
			return false
		}

		this.stopWords = workspace.getConfiguration(configCompletion).get("inlineCompletion") ? ["\n", "\r"] : []
		this.betaMode = workspace.getConfiguration(configCompletion).get("betaMode")
		Logger.info(
			`Completion: Create OpenAIApi client, URL: ${fullUrl}, betaMode: ${this.betaMode}, stopWords: ${this.stopWords}`,
		)
		return true
	}

	/**
	 * The client uses a single instance.
	 */
	private static async getInstance(): Promise<CompletionClient | undefined> {
		if (!this.client) {
			this.client = new CompletionClient()
			if (!(await this.client.createClient(true))) {
				this.client = undefined
			}
		}
		return this.client
	}

	/**
	 * Obtain the completion content from the result returned by the LLM.
	 */
	private acquireCompletionText(resp: Completion): string {
		if (!resp || !resp.choices || resp.choices.length === 0) {
			return ""
		}

		let text = ""
		for (const choice of resp.choices) {
			if (choice.text) {
				text = choice.text.trim()
				if (text.length > 0) {
					break
				}
			}
		}
		if (!text) {
			return ""
		}
		// Since Chinese characters occupy 3 bytes, the plugin may be affected by Max Tokens. When the result is returned, only half of the last Chinese character is returned, resulting in garbled characters.
		// The garbled characters need to be replaced with ''.
		if (text.includes("�")) {
			text = text.replace(/�/g, "")
		}
		return text
	}

	private acquireCompletionId(resp: Completion): string {
		if (!resp || !resp.choices || resp.choices.length === 0 || !resp.id) {
			return ""
		}

		return resp.id
	}

	/**
	 * Initiate a request for code completion.
	 */
	private async doCallApi(
		cp: CompletionPoint,
		scores: CompletionScores,
		lastCompletion: CompletionPoint | undefined,
	): Promise<Completion> {
		if (!this.openai) {
			throw new Error(OPENAI_CLIENT_NOT_INITIALIZED)
		}
		const provider = CompletionClient.providerRef.deref()

		const { apiConfiguration } = await provider!.getState()

		// cleanup Old Requests
		const currentId = cp.id
		for (const [key, controller] of this.reqs) {
			if (key !== currentId) {
				Logger.log(`Completion: Request cancelled id: ${key}`)
				controller.abort()
				this.reqs.delete(key)
			}
		}

		const abortController = new AbortController()
		this.reqs.set(cp.id, abortController)
		// machineId
		const client_id = getClientId()
		const requestId = uuidv7()
		Logger.log(`[RequestID ${requestId}] Completion [${cp.id}]: Sending API request`)
		const { id } = (await ZgsmAuthService.getInstance()?.getUserInfo()) || {}
		const headers = {
			...COSTRICT_DEFAULT_HEADERS,
			"X-Request-ID": requestId,
			"x-user-id": id,
			"zgsm-client-id": client_id,
		}
		const repo = workspace?.name?.split(" ")[0] ?? ""

		const config = await this.getApiConfig(apiConfiguration)

		this.openai.baseURL = `${config.baseUrl}${config.completionUrl}`
		this.openai.apiKey = config.apiKey
		// project_dir
		let workspaceFolder = ""
		if (vscode.workspace.workspaceFolders) {
			workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath
		}

		const editor = vscode.window.activeTextEditor
		// file_path
		let relativePath = ""
		let documentContent = ""
		if (editor) {
			const filePath = editor.document.uri.fsPath
			relativePath = vscode.workspace.asRelativePath(filePath)
			documentContent = editor.document.getText()
		}
		let importContent = ""

		// Get import statements
		try {
			const imports = editor ? getDependencyImports(relativePath, documentContent) : []
			importContent = imports.join("\n")
		} catch {
			importContent = ""
		}

		return this.openai.completions.create(
			{
				// no use
				model: settings.openai_model,
				temperature: settings.temperature,
				stop: this.stopWords,
				prompt: null,
			},
			{
				// in use
				headers: headers,
				signal: abortController.signal,
				body: {
					model: settings.openai_model,
					temperature: settings.temperature,
					stop: this.stopWords,
					prompt_options: cp.getPrompt(),
					completion_id: cp.id,
					language_id: cp.doc.language,
					beta_mode: this.betaMode,
					calculate_hide_score: scores,
					client_id,
					file_project_path: relativePath,
					project_path: workspaceFolder,
					code_path: "",
					user_id: "",
					repo: repo,
					git_path: "",
					parent_id: lastCompletion?.parentId,
					trigger_mode: lastCompletion?.getAcception() === CompletionAcception.Accepted ? "continue" : "",
					import_content: importContent,
				},
			},
		)
	}
}
