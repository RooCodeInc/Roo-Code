import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type NvidiaModelId, nvidiaDefaultModelId, nvidiaModels } from "@roo-code/types"

import { type ApiHandlerOptions, getModelMaxOutputTokens } from "../../shared/api"
import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"
import type { ApiHandlerCreateMessageMetadata } from "../index"
import { ApiStream } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { handleOpenAIError } from "./utils/openai-error-handler"

export class NvidiaHandler extends BaseOpenAiCompatibleProvider<NvidiaModelId> {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "NVIDIA",
			// Default to NVIDIA NIM API endpoint
			baseURL: options.nvidiaBaseUrl || "https://integrate.api.nvidia.com/v1",
			apiKey: options.nvidiaApiKey,
			defaultProviderModelId: nvidiaDefaultModelId,
			providerModels: nvidiaModels,
			defaultTemperature: 0.7,
		})
	}

	/**
	 * Override createStream to inject NVIDIA-specific parameters.
	 *
	 * Key difference from base implementation:
	 * - Uses `chat_template_kwargs: { enable_thinking: true }` for reasoning
	 * - Unlike OpenAI's `thinking: { type: "enabled" }` or DeepSeek's approach
	 */
	protected override async createStream(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
		requestOptions?: OpenAI.RequestOptions,
	): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
		const { id: model, info } = this.getModel()

		// Get max tokens using centralized logic
		const max_tokens =
			getModelMaxOutputTokens({
				modelId: model,
				model: info,
				settings: this.options,
				format: "openai",
			}) ?? undefined

		const temperature = this.options.modelTemperature ?? info.defaultTemperature ?? this.defaultTemperature

		// Build base params (same as parent class)
		const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model,
			max_tokens,
			temperature,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
			stream_options: { include_usage: true },
			tools: this.convertToolsForOpenAI(metadata?.tools),
			tool_choice: metadata?.tool_choice,
			parallel_tool_calls: metadata?.parallelToolCalls ?? true,
		}

		// NVIDIA-specific: Inject chat_template_kwargs for reasoning
		// This is the KEY difference - NVIDIA uses chat_template_kwargs.enable_thinking
		// instead of the `thinking` parameter used by OpenAI/DeepSeek
		if (this.options.enableReasoningEffort && info.supportsReasoningBinary) {
			;(params as any).chat_template_kwargs = {
				enable_thinking: true,
				clear_thinking: false,
			}
		}

		try {
			return this.client.chat.completions.create(params, requestOptions)
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}
	}

	/**
	 * Override completePrompt to inject chat_template_kwargs for non-streaming.
	 */
	override async completePrompt(prompt: string): Promise<string> {
		const { id: modelId, info: modelInfo } = this.getModel()

		const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
			model: modelId,
			messages: [{ role: "user", content: prompt }],
		}

		// Inject reasoning parameter for supported models
		if (this.options.enableReasoningEffort && modelInfo.supportsReasoningBinary) {
			;(params as any).chat_template_kwargs = {
				enable_thinking: true,
				clear_thinking: false,
			}
		}

		try {
			const response = await this.client.chat.completions.create(params)
			return response.choices?.[0]?.message.content || ""
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}
	}
}
