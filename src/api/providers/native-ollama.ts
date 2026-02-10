import { Anthropic } from "@anthropic-ai/sdk"
import { createOllama } from "ollama-ai-provider-v2"
import { streamText, generateText, ToolSet, ModelMessage } from "ai"

import { ModelInfo, openAiModelInfoSaneDefaults, DEEP_SEEK_DEFAULT_TEMPERATURE } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { ApiStream } from "../transform/stream"

import { BaseProvider } from "./base-provider"
import { getOllamaModels } from "./fetchers/ollama"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import type { RooMessage } from "../../core/task-persistence/rooMessage"

/**
 * NativeOllamaHandler using the ollama-ai-provider-v2 AI SDK community provider.
 * Communicates with Ollama via its HTTP API through the AI SDK abstraction.
 */
export class NativeOllamaHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected provider: ReturnType<typeof createOllama>
	protected models: Record<string, ModelInfo> = {}

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const baseUrl = options.ollamaBaseUrl || "http://localhost:11434"

		this.provider = createOllama({
			baseURL: `${baseUrl}/api`,
			headers: options.ollamaApiKey ? { Authorization: `Bearer ${options.ollamaApiKey}` } : undefined,
		})
	}

	override getModel(): { id: string; info: ModelInfo } {
		const modelId = this.options.ollamaModelId || ""
		return {
			id: modelId,
			info: this.models[modelId] || openAiModelInfoSaneDefaults,
		}
	}

	async fetchModel() {
		this.models = await getOllamaModels(this.options.ollamaBaseUrl, this.options.ollamaApiKey)
		return this.getModel()
	}

	protected getLanguageModel() {
		const { id } = this.getModel()
		return this.provider(id)
	}

	/**
	 * Build ollama-specific providerOptions based on model settings.
	 * The ollama-ai-provider-v2 schema expects:
	 *   { ollama: { think?: boolean, options?: { num_ctx?: number, ... } } }
	 */
	private buildProviderOptions(useR1Format: boolean): Record<string, any> | undefined {
		const ollamaOpts: Record<string, any> = {}

		if (useR1Format) {
			ollamaOpts.think = true
		}

		if (this.options.ollamaNumCtx !== undefined) {
			ollamaOpts.options = { num_ctx: this.options.ollamaNumCtx }
		}

		if (Object.keys(ollamaOpts).length === 0) {
			return undefined
		}

		return { ollama: ollamaOpts }
	}

	override async *createMessage(
		systemPrompt: string,
		messages: RooMessage[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		await this.fetchModel()
		const { id: modelId } = this.getModel()
		const useR1Format = modelId.toLowerCase().includes("deepseek-r1")
		const temperature = this.options.modelTemperature ?? (useR1Format ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0)

		const languageModel = this.getLanguageModel()

		const aiSdkMessages = messages as ModelMessage[]

		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		const providerOptions = this.buildProviderOptions(useR1Format)

		const requestOptions: Parameters<typeof streamText>[0] = {
			model: languageModel,
			system: systemPrompt,
			messages: aiSdkMessages,
			temperature,
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
			...(providerOptions && { providerOptions }),
		}

		const result = streamText(requestOptions)

		try {
			for await (const part of result.fullStream) {
				for (const chunk of processAiSdkStreamPart(part)) {
					yield chunk
				}
			}

			const usage = await result.usage
			if (usage) {
				yield {
					type: "usage",
					inputTokens: usage.inputTokens || 0,
					outputTokens: usage.outputTokens || 0,
				}
			}
		} catch (error) {
			this.handleOllamaError(error, modelId)
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			await this.fetchModel()
			const { id: modelId } = this.getModel()
			const useR1Format = modelId.toLowerCase().includes("deepseek-r1")
			const temperature = this.options.modelTemperature ?? (useR1Format ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0)

			const languageModel = this.getLanguageModel()

			const providerOptions = this.buildProviderOptions(useR1Format)

			const { text } = await generateText({
				model: languageModel,
				prompt,
				temperature,
				...(providerOptions && { providerOptions }),
			})

			return text
		} catch (error) {
			const { id: modelId } = this.getModel()
			this.handleOllamaError(error, modelId)
		}
	}

	/**
	 * Handle Ollama-specific errors (ECONNREFUSED, 404) with user-friendly messages,
	 * falling back to the standard AI SDK error handler.
	 */
	private handleOllamaError(error: unknown, modelId: string): never {
		const anyError = error as any
		const errorMessage = anyError?.message || ""
		const statusCode = anyError?.status || anyError?.statusCode || anyError?.lastError?.status

		if (anyError?.code === "ECONNREFUSED" || errorMessage.includes("ECONNREFUSED")) {
			throw new Error(
				`Ollama service is not running at ${this.options.ollamaBaseUrl || "http://localhost:11434"}. Please start Ollama first.`,
			)
		}

		if (statusCode === 404 || errorMessage.includes("404")) {
			throw new Error(
				`Model ${modelId} not found in Ollama. Please pull the model first with: ollama pull ${modelId}`,
			)
		}

		throw handleAiSdkError(error, "Ollama")
	}

	override isAiSdkProvider(): boolean {
		return true
	}
}
