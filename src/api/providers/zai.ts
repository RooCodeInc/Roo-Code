import {
	internationalZAiModels,
	mainlandZAiModels,
	internationalZAiDefaultModelId,
	mainlandZAiDefaultModelId,
	ZAI_DEFAULT_TEMPERATURE,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import type { InternationalZAiModelId, MainlandZAiModelId, ModelInfo } from "@roo-code/types"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

type ZAiModelId = InternationalZAiModelId | MainlandZAiModelId

// Local mapping to avoid cross-package runtime dependency issues in CI
type ZaiApiLineLocal = "international_coding" | "international" | "china_coding" | "china"
const ZAI_LINE_CONFIGS: Record<ZaiApiLineLocal, { name: string; baseUrl: string; isChina: boolean }> = {
	international_coding: {
		name: "International Coding Plan",
		baseUrl: "https://api.z.ai/api/coding/paas/v4",
		isChina: false,
	},
	international: { name: "International Standard", baseUrl: "https://api.z.ai/api/paas/v4", isChina: false },
	china_coding: { name: "China Coding Plan", baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4", isChina: true },
	china: { name: "China Standard", baseUrl: "https://open.bigmodel.cn/api/paas/v4", isChina: true },
}

export class ZAiHandler extends BaseOpenAiCompatibleProvider<ZAiModelId> {
	constructor(options: ApiHandlerOptions) {
		const line = (options.zaiApiLine ?? "international_coding") as ZaiApiLineLocal
		const { isChina, baseUrl } = ZAI_LINE_CONFIGS[line]

		const defaultModelId = isChina ? mainlandZAiDefaultModelId : internationalZAiDefaultModelId
		const providerModels = (isChina ? mainlandZAiModels : internationalZAiModels) as unknown as Record<
			ZAiModelId,
			ModelInfo
		>

		super({
			...options,
			providerName: "Z AI",
			baseURL: baseUrl,
			apiKey: options.zaiApiKey ?? "not-provided",
			defaultProviderModelId: defaultModelId,
			providerModels,
			defaultTemperature: ZAI_DEFAULT_TEMPERATURE,
		})
	}
}
