import OpenAI from "openai"

import type { ModelInfo } from "@roo-code/types"

import { ApiHandlerOptions, RouterName, ModelRecord } from "../../shared/api"

import { BaseProvider } from "./base-provider"
import { getModels, getModelsFromCache } from "./fetchers/modelCache"

import { DEFAULT_HEADERS } from "./constants"

type RouterProviderOptions = {
	name: RouterName
	baseURL: string
	apiKey?: string
	modelId?: string
	defaultModelId: string
	defaultModelInfo: ModelInfo
	options: ApiHandlerOptions
}

export abstract class RouterProvider extends BaseProvider {
	protected readonly options: ApiHandlerOptions
	protected readonly name: RouterName
	protected models: ModelRecord = {}
	protected readonly modelId?: string
	protected readonly defaultModelId: string
	protected readonly defaultModelInfo: ModelInfo
	protected readonly client: OpenAI

	constructor({
		options,
		name,
		baseURL,
		apiKey = "not-provided",
		modelId,
		defaultModelId,
		defaultModelInfo,
	}: RouterProviderOptions) {
		super()

		this.options = options
		this.name = name
		this.modelId = modelId
		this.defaultModelId = defaultModelId
		this.defaultModelInfo = defaultModelInfo

		this.client = new OpenAI({
			baseURL,
			apiKey,
			defaultHeaders: {
				...DEFAULT_HEADERS,
				...(options.openAiHeaders || {}),
			},
		})
	}

	public async fetchModel() {
		this.models = await getModels({ provider: this.name, apiKey: this.client.apiKey, baseUrl: this.client.baseURL })
		return this.getModel()
	}

	override getModel(): { id: string; info: ModelInfo } {
		const id = this.modelId ?? this.defaultModelId

		// First check instance models (populated by fetchModel)
		if (this.models[id]) {
			// Apply model family defaults for consistent behavior across providers
			const info = this.applyModelDefaults(id, this.models[id])
			return { id, info }
		}

		// Fall back to global cache (synchronous disk/memory cache)
		// This ensures models are available before fetchModel() is called
		const cachedModels = getModelsFromCache(this.name)
		if (cachedModels?.[id]) {
			// Also populate instance models for future calls
			this.models = cachedModels
			// Apply model family defaults for consistent behavior across providers
			const info = this.applyModelDefaults(id, cachedModels[id])
			return { id, info }
		}

		// Last resort: return default model
		// Apply model family defaults for consistent behavior across providers
		const info = this.applyModelDefaults(this.defaultModelId, this.defaultModelInfo)
		return { id: this.defaultModelId, info }
	}

	protected supportsTemperature(modelId: string): boolean {
		return !modelId.startsWith("openai/o3-mini")
	}
}
