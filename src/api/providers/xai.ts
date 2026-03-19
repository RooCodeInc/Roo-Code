import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type XAIModelId, xaiDefaultModelId, xaiModels, ApiProviderError } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import type { ApiHandlerOptions } from "../../shared/api"

import { ApiStream } from "../transform/stream"
import { convertToResponsesApiInput } from "../transform/responses-api-input"
import { processResponsesApiStream, createUsageNormalizer } from "../transform/responses-api-stream"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { handleOpenAIError } from "./utils/openai-error-handler"

const XAI_DEFAULT_TEMPERATURE = 0

export class XAIHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	private readonly providerName = "xAI"

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const apiKey = this.options.xaiApiKey ?? "not-provided"

		this.client = new OpenAI({
			baseURL: "https://api.x.ai/v1",
			apiKey: apiKey,
			defaultHeaders: DEFAULT_HEADERS,
		})
	}

	override getModel() {
		const id =
			this.options.apiModelId && this.options.apiModelId in xaiModels
				? (this.options.apiModelId as XAIModelId)
				: xaiDefaultModelId

		return { id, info: xaiModels[id] }
	}

	/**
	 * Convert tools from OpenAI Chat Completions format to Responses API format.
	 * Chat Completions: { type: "function", function: { name, description, parameters } }
	 * Responses API: { type: "function", name, description, parameters }
	 */
	private mapResponseTools(tools?: any[]): any[] | undefined {
		if (!tools?.length) {
			return undefined
		}
		return tools
			.filter((tool) => tool?.type === "function")
			.map((tool) => ({
				type: "function",
				name: tool.function.name,
				description: tool.function.description,
				parameters: tool.function.parameters ?? null,
				strict: false,
			}))
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = this.getModel()

		// Convert directly from Anthropic format to Responses API input format
		const input = convertToResponsesApiInput(messages)
		const responseTools = this.mapResponseTools(metadata?.tools)

		let stream
		try {
			stream = await this.client.responses.create({
				model: model.id,
				instructions: systemPrompt,
				input: input,
				max_output_tokens: model.info.maxTokens,
				temperature: this.options.modelTemperature ?? XAI_DEFAULT_TEMPERATURE,
				stream: true,
				store: false, // Don't store responses server-side for privacy
				tools: responseTools,
				tool_choice: responseTools ? "auto" : undefined,
				include: ["reasoning.encrypted_content"],
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, model.id, "createMessage")
			TelemetryService.instance.captureException(apiError)
			throw handleOpenAIError(error, this.providerName)
		}

		const normalizeUsage = createUsageNormalizer(model.info)
		yield* processResponsesApiStream(stream, normalizeUsage)
	}

	async completePrompt(prompt: string): Promise<string> {
		const model = this.getModel()

		try {
			const response = await this.client.responses.create({
				model: model.id,
				input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
				store: false,
			})

			// Extract text from the response output
			const output = (response as any).output
			if (Array.isArray(output)) {
				for (const item of output) {
					if (item.type === "message" && Array.isArray(item.content)) {
						for (const content of item.content) {
							if (content.type === "output_text" && content.text) {
								return content.text
							}
						}
					}
				}
			}
			return (response as any).output_text || ""
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, model.id, "completePrompt")
			TelemetryService.instance.captureException(apiError)
			throw handleOpenAIError(error, this.providerName)
		}
	}
}
