import OpenAI from "openai"

import type { ModelInfo } from "@roo-code/types"

import { ApiHandlerOptions, RouterName, ModelRecord } from "../../shared/api"

import { BaseProvider } from "./base-provider"
import { getModels } from "./fetchers/modelCache"

import { DEFAULT_HEADERS } from "./constants"
import { getApiRequestTimeout } from "./utils/timeout-config"

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

		let timeout = getApiRequestTimeout()
		if (timeout === 0) {
			// Use 2147483647 (2^31) as the maximum timeout value for setTimeout
			// JavaScript's setTimeout has a maximum delay limit of 2147483647ms (32-bit signed integer max)
			// Values larger than this may be clamped to 1ms or cause unexpected behavior
			// 2147483647 is safe as it's just above the limit but won't cause issues
			timeout = 2147483647
		}

		this.client = new OpenAI({
			baseURL,
			apiKey,
			defaultHeaders: {
				...DEFAULT_HEADERS,
				...(options.openAiHeaders || {}),
			},
			timeout,
		})
	}

	public async fetchModel() {
		this.models = await getModels({ provider: this.name, apiKey: this.client.apiKey, baseUrl: this.client.baseURL })
		return this.getModel()
	}

	override getModel(): { id: string; info: ModelInfo } {
		const id = this.modelId ?? this.defaultModelId

		return this.models[id]
			? { id, info: this.models[id] }
			: { id: this.defaultModelId, info: this.defaultModelInfo }
	}

	protected supportsTemperature(modelId: string): boolean {
		return !modelId.startsWith("openai/o3-mini")
	}
}
