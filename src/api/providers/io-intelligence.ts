import { ioIntelligenceDefaultModelId, ioIntelligenceModels, type IOIntelligenceModelId } from "@roo-code/types"
import { Anthropic } from "@anthropic-ai/sdk"

import type { ApiHandlerOptions, ModelRecord } from "../../shared/api"
import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"
import { getModels } from "./fetchers/modelCache"
import type { ApiHandlerCreateMessageMetadata } from "../index"
import { ApiStream } from "../transform/stream"

export class IOIntelligenceHandler extends BaseOpenAiCompatibleProvider<IOIntelligenceModelId> {
	protected models: ModelRecord = {}

	constructor(options: ApiHandlerOptions) {
		if (!options.ioIntelligenceApiKey) {
			throw new Error("IO Intelligence API key is required")
		}

		super({
			...options,
			providerName: "IO Intelligence",
			baseURL: "https://api.intelligence.io.solutions/api/v1",
			defaultProviderModelId: ioIntelligenceDefaultModelId,
			providerModels: ioIntelligenceModels,
			defaultTemperature: 0.7,
			apiKey: options.ioIntelligenceApiKey,
		})
	}

	public async fetchModel() {
		try {
			this.models = await getModels({
				provider: "io-intelligence",
				apiKey: this.options.ioIntelligenceApiKey || undefined,
			})
		} catch (error) {
			console.error("Failed to fetch IO Intelligence models, falling back to default models:", error)
			this.models = ioIntelligenceModels
		}
		return this.getModel()
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		await this.fetchModel()

		yield* super.createMessage(systemPrompt, messages, metadata)
	}

	override getModel() {
		const modelId = this.options.ioIntelligenceModelId || ioIntelligenceDefaultModelId
		let modelInfo = this.models[modelId]

		if (!modelInfo) {
			modelInfo =
				this.providerModels[modelId as IOIntelligenceModelId] ??
				this.providerModels[ioIntelligenceDefaultModelId]
		}

		if (modelInfo) {
			return { id: modelId as IOIntelligenceModelId, info: modelInfo }
		}

		// Return the requested model ID even if not found, with fallback info.
		return {
			id: modelId as IOIntelligenceModelId,
			info: {
				maxTokens: 8192,
				contextWindow: 128000,
				supportsImages: false,
				supportsPromptCache: false,
			},
		}
	}
}
