import { type PerplexityModelId, perplexityDefaultModelId, perplexityModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { Package } from "../../shared/package"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

/**
 * Resolves the Perplexity API key in priority order:
 *   1. explicit settings value
 *   2. PERPLEXITY_API_KEY env var
 *   3. PPLX_API_KEY env var (fallback)
 */
export function resolvePerplexityApiKey(explicit?: string): string | undefined {
	if (explicit && explicit.length > 0) {
		return explicit
	}
	return process.env.PERPLEXITY_API_KEY || process.env.PPLX_API_KEY || undefined
}

const REASONING_MODELS = new Set<PerplexityModelId>(["sonar-reasoning", "sonar-reasoning-pro"])
const PERPLEXITY_DEFAULT_HEADERS = {
	"X-Pplx-Integration": `roo-code/${Package.version}`,
}

export class PerplexityHandler extends BaseOpenAiCompatibleProvider<PerplexityModelId> {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "Perplexity",
			baseURL: "https://api.perplexity.ai",
			apiKey: resolvePerplexityApiKey(options.perplexityApiKey),
			defaultProviderModelId: perplexityDefaultModelId,
			providerModels: perplexityModels,
			defaultTemperature: 0,
			defaultHeaders: PERPLEXITY_DEFAULT_HEADERS,
		})
	}

	protected override getTemperature(model: PerplexityModelId, info = this.providerModels[model]): number | undefined {
		return REASONING_MODELS.has(model) ? undefined : super.getTemperature(model, info)
	}
}
