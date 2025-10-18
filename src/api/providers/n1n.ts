import { n1nDefaultModelId, n1nDefaultModelInfo, N1N_BASE_URL } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { getModelParams } from "../transform/model-params"

import { OpenAiHandler } from "./openai"

export class N1nHandler extends OpenAiHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.n1nApiKey ?? "",
			openAiModelId: options.n1nModelId ?? n1nDefaultModelId,
			openAiBaseUrl: N1N_BASE_URL,
			openAiStreamingEnabled: true,
		})
	}

	override getModel() {
		const id = this.options.n1nModelId ?? n1nDefaultModelId
		// Since n1n.ai supports 400+ models dynamically, we use default model info
		// unless we implement dynamic model fetching
		const info = n1nDefaultModelInfo
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}
}
