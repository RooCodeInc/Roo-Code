import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type XAIModelId, xaiDefaultModelId, xaiModels, ApiProviderError } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import type { ApiHandlerOptions } from "../../shared/api"

import { ApiStream } from "../transform/stream"
import { convertToResponsesApiInput } from "../transform/responses-api-input"
import { processResponsesApiStream, createUsageNormalizer } from "../transform/responses-api-stream"
import { getModelParams } from "../transform/model-params"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { handleOpenAIError } from "./utils/openai-error-handler"
import { isMcpTool } from "../../utils/mcp-name"

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
		const id = this.options.apiModelId ?? xaiDefaultModelId

		const info = xaiModels[id as XAIModelId] ?? xaiModels[xaiDefaultModelId]
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: XAI_DEFAULT_TEMPERATURE,
		})
		return { id, info, ...params }
	}

	/**
	 * Convert tools from OpenAI Chat Completions format to Responses API format.
	 * Chat Completions: { type: "function", function: { name, description, parameters } }
	 * Responses API: { type: "function", name, description, parameters }
	 *
	 * Uses base provider's convertToolSchemaForOpenAI() for schema hardening
	 * (additionalProperties: false, ensureAllRequired) and handles MCP tools.
	 */
	private mapResponseTools(tools?: any[]): any[] | undefined {
		const converted = this.convertToolsForOpenAI(tools)
		if (!converted?.length) {
			return undefined
		}
		return converted
			.filter((tool) => tool?.type === "function")
			.map((tool) => {
				const isMcp = isMcpTool(tool.function.name)
				return {
					type: "function",
					name: tool.function.name,
					description: tool.function.description,
					parameters: isMcp
						? tool.function.parameters
						: this.convertToolSchemaForOpenAI(tool.function.parameters),
					strict: !isMcp,
				}
			})
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

		// Build request options
		const requestBody: Record<string, any> = {
			model: model.id,
			instructions: systemPrompt,
			input: input,
			stream: true,
			store: false, // Don't store responses server-side for privacy
			include: ["reasoning.encrypted_content"],
		}

		if (model.maxTokens) {
			requestBody.max_output_tokens = model.maxTokens
		}

		if (model.temperature !== undefined) {
			requestBody.temperature = model.temperature
		}

		if (responseTools) {
			requestBody.tools = responseTools
			// Cast tool_choice since metadata uses Chat Completions types but Responses API has its own type
			requestBody.tool_choice = (metadata?.tool_choice ?? "auto") as any
			requestBody.parallel_tool_calls = metadata?.parallelToolCalls ?? true
		}

		// Pass reasoning effort for models that support it (e.g., mini models)
		if (model.reasoning) {
			requestBody.reasoning = model.reasoning
		}

		let stream: AsyncIterable<any>
		try {
			stream = (await this.client.responses.create({
				...requestBody,
				stream: true,
			} as any)) as unknown as AsyncIterable<any>
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, model.id, "createMessage")
			TelemetryService.instance.captureException(apiError)
			throw handleOpenAIError(error, this.providerName)
		}

		const normalizeUsage = createUsageNormalizer()
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

			// output_text is a convenience field on the Responses API response
			return response.output_text || ""
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, model.id, "completePrompt")
			TelemetryService.instance.captureException(apiError)
			throw handleOpenAIError(error, this.providerName)
		}
	}
}
