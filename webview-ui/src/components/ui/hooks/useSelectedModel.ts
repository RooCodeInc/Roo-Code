import {
	type ProviderName,
	type ProviderSettings,
	type ModelInfo,
	anthropicDefaultModelId,
	anthropicModels,
	bedrockDefaultModelId,
	bedrockModels,
	cerebrasDefaultModelId,
	cerebrasModels,
	deepSeekDefaultModelId,
	deepSeekModels,
	moonshotDefaultModelId,
	moonshotModels,
	geminiDefaultModelId,
	geminiModels,
	mistralDefaultModelId,
	mistralModels,
	openAiModelInfoSaneDefaults,
	openAiNativeDefaultModelId,
	openAiNativeModels,
	vertexDefaultModelId,
	vertexModels,
	xaiDefaultModelId,
	xaiModels,
	groqModels,
	groqDefaultModelId,
	chutesModels,
	chutesDefaultModelId,
	vscodeLlmModels,
	vscodeLlmDefaultModelId,
	openRouterDefaultModelId,
	requestyDefaultModelId,
	glamaDefaultModelId,
	unboundDefaultModelId,
	litellmDefaultModelId,
	claudeCodeDefaultModelId,
	claudeCodeModels,
	sambaNovaModels,
	sambaNovaDefaultModelId,
	doubaoModels,
	doubaoDefaultModelId,
	internationalZAiDefaultModelId,
	mainlandZAiDefaultModelId,
	internationalZAiModels,
	mainlandZAiModels,
	fireworksModels,
	fireworksDefaultModelId,
	featherlessModels,
	featherlessDefaultModelId,
	ioIntelligenceDefaultModelId,
	ioIntelligenceModels,
	rooDefaultModelId,
	rooModels,
	qwenCodeDefaultModelId,
	qwenCodeModels,
	vercelAiGatewayDefaultModelId,
	BEDROCK_1M_CONTEXT_MODEL_IDS,
	deepInfraDefaultModelId,
} from "@roo-code/types"

import type { ModelRecord, RouterModels } from "@roo/api"

import { useRouterModels } from "./useRouterModels"
import { useOpenRouterModelProviders } from "./useOpenRouterModelProviders"
import { useLmStudioModels } from "./useLmStudioModels"
import { useOllamaModels } from "./useOllamaModels"

export const useSelectedModel = (apiConfiguration?: ProviderSettings) => {
	const provider = apiConfiguration?.apiProvider || "anthropic"
	const openRouterModelId = provider === "openrouter" ? apiConfiguration?.openRouterModelId : undefined
	const lmStudioModelId = provider === "lmstudio" ? apiConfiguration?.lmStudioModelId : undefined
	const ollamaModelId = provider === "ollama" ? apiConfiguration?.ollamaModelId : undefined

	const routerModels = useRouterModels()
	const openRouterModelProviders = useOpenRouterModelProviders(openRouterModelId)
	const lmStudioModels = useLmStudioModels(lmStudioModelId)
	const ollamaModels = useOllamaModels(ollamaModelId)

	const { id, info } =
		apiConfiguration &&
		(typeof lmStudioModelId === "undefined" || typeof lmStudioModels.data !== "undefined") &&
		(typeof ollamaModelId === "undefined" || typeof ollamaModels.data !== "undefined") &&
		typeof routerModels.data !== "undefined" &&
		typeof openRouterModelProviders.data !== "undefined"
			? getSelectedModel({
					provider,
					apiConfiguration,
					routerModels: routerModels.data,
					openRouterModelProviders: openRouterModelProviders.data,
					lmStudioModels: lmStudioModels.data,
					ollamaModels: ollamaModels.data,
				})
			: { id: anthropicDefaultModelId, info: undefined }

	return {
		provider,
		id,
		info,
		isLoading:
			routerModels.isLoading ||
			openRouterModelProviders.isLoading ||
			(apiConfiguration?.lmStudioModelId && lmStudioModels!.isLoading),
		isError:
			routerModels.isError ||
			openRouterModelProviders.isError ||
			(apiConfiguration?.lmStudioModelId && lmStudioModels!.isError),
	}
}

function getSelectedModel({
	provider,
	apiConfiguration,
	routerModels,
	openRouterModelProviders,
	lmStudioModels,
	ollamaModels,
}: {
	provider: ProviderName
	apiConfiguration: ProviderSettings
	routerModels: RouterModels
	openRouterModelProviders: Record<string, ModelInfo>
	lmStudioModels: ModelRecord | undefined
	ollamaModels: ModelRecord | undefined
}): { id: string; info: ModelInfo | undefined } {
	// the `undefined` case are used to show the invalid selection to prevent
	// users from seeing the default model if their selection is invalid
	// this gives a better UX than showing the default model
	switch (provider) {
		case "openrouter": {
			const id = apiConfiguration.openRouterModelId ?? openRouterDefaultModelId
			let info = routerModels.openrouter[id]
			const specificProvider = apiConfiguration.openRouterSpecificProvider

			if (specificProvider && openRouterModelProviders[specificProvider]) {
				// Overwrite the info with the specific provider info. Some
				// fields are missing the model info for `openRouterModelProviders`
				// so we need to merge the two.
				info = info
					? { ...info, ...openRouterModelProviders[specificProvider] }
					: openRouterModelProviders[specificProvider]
			}

			return { id, info }
		}
		case "requesty": {
			const id = apiConfiguration.requestyModelId ?? requestyDefaultModelId
			const info = routerModels.requesty[id]
			return { id, info }
		}
		case "glama": {
			const id = apiConfiguration.glamaModelId ?? glamaDefaultModelId
			const info = routerModels.glama[id]
			return { id, info }
		}
		case "unbound": {
			const id = apiConfiguration.unboundModelId ?? unboundDefaultModelId
			const info = routerModels.unbound[id]
			return { id, info }
		}
		case "litellm": {
			const id = apiConfiguration.litellmModelId ?? litellmDefaultModelId
			const info = routerModels.litellm[id]
			return { id, info }
		}
		case "xai": {
			const id = apiConfiguration.apiModelId ?? xaiDefaultModelId
			const info = xaiModels[id as keyof typeof xaiModels]
			return info ? { id, info } : { id, info: undefined }
		}
		case "groq": {
			const id = apiConfiguration.apiModelId ?? groqDefaultModelId
			const info = groqModels[id as keyof typeof groqModels]
			return { id, info }
		}
		case "huggingface": {
			const id = apiConfiguration.huggingFaceModelId ?? "meta-llama/Llama-3.3-70B-Instruct"
			const info = {
				maxTokens: 8192,
				contextWindow: 131072,
				supportsImages: false,
				supportsPromptCache: false,
			}
			return { id, info }
		}
		case "chutes": {
			const id = apiConfiguration.apiModelId ?? chutesDefaultModelId
			const info = chutesModels[id as keyof typeof chutesModels]
			return { id, info }
		}
		case "bedrock": {
			const id = apiConfiguration.apiModelId ?? bedrockDefaultModelId
			const baseInfo = bedrockModels[id as keyof typeof bedrockModels]

			// Special case for custom ARN.
			if (id === "custom-arn") {
				return {
					id,
					info: { maxTokens: 5000, contextWindow: 128_000, supportsPromptCache: false, supportsImages: true },
				}
			}

			// Apply 1M context for Claude Sonnet 4 / 4.5 when enabled
			if (
				BEDROCK_1M_CONTEXT_MODEL_IDS.includes(id as any) &&
				baseInfo &&
				(apiConfiguration.awsBedrock1MContext || apiConfiguration.largeInputTierEnabled)
			) {
				// Create a new ModelInfo object with updated context window
				const info: ModelInfo = {
					...baseInfo,
					contextWindow: 1_000_000,
				}
				return { id, info }
			}

			return { id, info: baseInfo }
		}
		case "vertex": {
			const id = apiConfiguration.apiModelId ?? vertexDefaultModelId
			const baseInfo = vertexModels[id as keyof typeof vertexModels] as ModelInfo

			// If the model is not known, surface the selected id with undefined info
			if (!baseInfo) {
				return { id, info: undefined }
			}

			// Region-aware, tiered pricing for Vertex Claude Sonnet models
			// Source: https://cloud.google.com/vertex-ai/generative-ai/pricing
			//
			// Rules implemented:
			// - Sonnet 4 pricing is the same globally in all regions
			//   • Under 200k Input Tokens:
			//     Input: $3, Output: $15, Cache Write: $3.75, Cache Hit: $0.30
			//   • Over 200k Input Tokens ([1m] variants or largeInputTierEnabled):
			//     Input: $6, Output: $22.50, Cache Write: $7.50, Cache Hit: $0.60
			//
			// - Sonnet 4.5 has different pricing per region and per input context size
			//   • Global region (all regions except us-east5, europe-west1, asia-southeast1)
			//     - Under 200k Input Tokens:
			//       Input: $3.00, Output: $15.00, Cache Write: $3.75, Cache Hit: $0.30
			//     - Over 200k Input Tokens ([1m] variants or largeInputTierEnabled):
			//       Input: $6.00, Output: $22.50, Cache Write: $7.50, Cache Hit: $0.60
			//   • Regional (us-east5, europe-west1, asia-southeast1)
			//     - Under 200k Input Tokens:
			//       Input: $3.30, Output: $16.50, Cache Write: $4.13, Cache Hit: $0.33
			//     - Over 200k Input Tokens ([1m] variants or largeInputTierEnabled):
			//       Input: $6.60, Output: $24.75, Cache Write: $8.25, Cache Hit: $0.66
			//
			// We derive "over 200k" from Roo's explicit [1m] model variants, the selected Vertex region,
			// or the generic largeInputTierEnabled setting.
			const region = apiConfiguration.vertexRegion ?? "global"
			const is1m = id.endsWith("[1m]") || apiConfiguration.largeInputTierEnabled === true
			const isSonnet45 = id.startsWith("claude-sonnet-4-5@20250929")
			const isSonnet4 = id.startsWith("claude-sonnet-4@20250514")
			const regionalPricingRegions = new Set(["us-east5", "europe-west1", "asia-southeast1"])
			const useRegionalPricing = regionalPricingRegions.has(region)

			let adjustedInfo: ModelInfo = baseInfo as ModelInfo

			if (isSonnet45) {
				if (is1m) {
					// Over 200k (1M beta)
					adjustedInfo = {
						...baseInfo,
						contextWindow: 1_000_000,
						inputPrice: useRegionalPricing ? (6.6 as number) : (6.0 as number),
						outputPrice: useRegionalPricing ? (24.75 as number) : (22.5 as number),
						cacheWritesPrice: useRegionalPricing ? (8.25 as number) : (7.5 as number),
						cacheReadsPrice: useRegionalPricing ? (0.66 as number) : (0.6 as number),
					} as ModelInfo
				} else {
					// Under 200k
					adjustedInfo = {
						...baseInfo,
						contextWindow: 200_000,
						inputPrice: useRegionalPricing ? (3.3 as number) : (3.0 as number),
						outputPrice: useRegionalPricing ? (16.5 as number) : (15.0 as number),
						cacheWritesPrice: useRegionalPricing ? (4.13 as number) : (3.75 as number),
						cacheReadsPrice: useRegionalPricing ? (0.33 as number) : (0.3 as number),
					} as ModelInfo
				}
			} else if (isSonnet4) {
				if (is1m) {
					// Over 200k (1M beta) - global pricing
					adjustedInfo = {
						...baseInfo,
						contextWindow: 1_000_000,
						inputPrice: 6.0 as number,
						outputPrice: 22.5 as number,
						cacheWritesPrice: 7.5 as number,
						cacheReadsPrice: 0.6 as number,
					} as ModelInfo
				} else {
					// Under 200k - global pricing
					adjustedInfo = {
						...baseInfo,
						contextWindow: 200_000,
						inputPrice: 3.0 as number,
						outputPrice: 15.0 as number,
						cacheWritesPrice: 3.75 as number,
						cacheReadsPrice: 0.3 as number,
					} as ModelInfo
				}
			}

			return { id, info: adjustedInfo }
		}
		case "gemini": {
			const id = apiConfiguration.apiModelId ?? geminiDefaultModelId
			const baseInfo = geminiModels[id as keyof typeof geminiModels]
			if (baseInfo && apiConfiguration.largeInputTierEnabled && baseInfo.tiers && baseInfo.tiers.length > 0) {
				// Select the highest contextWindow tier and apply its pricing overrides
				const highTier = baseInfo.tiers.reduce((acc, t) => (t.contextWindow > acc.contextWindow ? t : acc))
				const info: ModelInfo = {
					...baseInfo,
					contextWindow: highTier.contextWindow,
					inputPrice: highTier.inputPrice ?? baseInfo.inputPrice,
					outputPrice: highTier.outputPrice ?? baseInfo.outputPrice,
					cacheWritesPrice: highTier.cacheWritesPrice ?? baseInfo.cacheWritesPrice,
					cacheReadsPrice: highTier.cacheReadsPrice ?? baseInfo.cacheReadsPrice,
				}
				return { id, info }
			}
			return { id, info: baseInfo }
		}
		case "deepseek": {
			const id = apiConfiguration.apiModelId ?? deepSeekDefaultModelId
			const info = deepSeekModels[id as keyof typeof deepSeekModels]
			return { id, info }
		}
		case "doubao": {
			const id = apiConfiguration.apiModelId ?? doubaoDefaultModelId
			const info = doubaoModels[id as keyof typeof doubaoModels]
			return { id, info }
		}
		case "moonshot": {
			const id = apiConfiguration.apiModelId ?? moonshotDefaultModelId
			const info = moonshotModels[id as keyof typeof moonshotModels]
			return { id, info }
		}
		case "zai": {
			const isChina = apiConfiguration.zaiApiLine === "china"
			const models = isChina ? mainlandZAiModels : internationalZAiModels
			const defaultModelId = isChina ? mainlandZAiDefaultModelId : internationalZAiDefaultModelId
			const id = apiConfiguration.apiModelId ?? defaultModelId
			const info = models[id as keyof typeof models]
			return { id, info }
		}
		case "openai-native": {
			const id = apiConfiguration.apiModelId ?? openAiNativeDefaultModelId
			const info = openAiNativeModels[id as keyof typeof openAiNativeModels]
			return { id, info }
		}
		case "mistral": {
			const id = apiConfiguration.apiModelId ?? mistralDefaultModelId
			const info = mistralModels[id as keyof typeof mistralModels]
			return { id, info }
		}
		case "openai": {
			const id = apiConfiguration.openAiModelId ?? ""
			const info = apiConfiguration?.openAiCustomModelInfo ?? openAiModelInfoSaneDefaults
			return { id, info }
		}
		case "ollama": {
			const id = apiConfiguration.ollamaModelId ?? ""
			const info = ollamaModels && ollamaModels[apiConfiguration.ollamaModelId!]

			const adjustedInfo =
				info?.contextWindow &&
				apiConfiguration?.ollamaNumCtx &&
				apiConfiguration.ollamaNumCtx < info.contextWindow
					? { ...info, contextWindow: apiConfiguration.ollamaNumCtx }
					: info

			return {
				id,
				info: adjustedInfo || undefined,
			}
		}
		case "lmstudio": {
			const id = apiConfiguration.lmStudioModelId ?? ""
			const info = lmStudioModels && lmStudioModels[apiConfiguration.lmStudioModelId!]
			return {
				id,
				info: info || undefined,
			}
		}
		case "deepinfra": {
			const id = apiConfiguration.deepInfraModelId ?? deepInfraDefaultModelId
			const info = routerModels.deepinfra?.[id]
			return { id, info }
		}
		case "vscode-lm": {
			const id = apiConfiguration?.vsCodeLmModelSelector
				? `${apiConfiguration.vsCodeLmModelSelector.vendor}/${apiConfiguration.vsCodeLmModelSelector.family}`
				: vscodeLlmDefaultModelId
			const modelFamily = apiConfiguration?.vsCodeLmModelSelector?.family ?? vscodeLlmDefaultModelId
			const info = vscodeLlmModels[modelFamily as keyof typeof vscodeLlmModels]
			return { id, info: { ...openAiModelInfoSaneDefaults, ...info, supportsImages: false } } // VSCode LM API currently doesn't support images.
		}
		case "claude-code": {
			// Claude Code models extend anthropic models but with images and prompt caching disabled
			const id = apiConfiguration.apiModelId ?? claudeCodeDefaultModelId
			const info = claudeCodeModels[id as keyof typeof claudeCodeModels]
			return { id, info: { ...openAiModelInfoSaneDefaults, ...info } }
		}
		case "cerebras": {
			const id = apiConfiguration.apiModelId ?? cerebrasDefaultModelId
			const info = cerebrasModels[id as keyof typeof cerebrasModels]
			return { id, info }
		}
		case "sambanova": {
			const id = apiConfiguration.apiModelId ?? sambaNovaDefaultModelId
			const info = sambaNovaModels[id as keyof typeof sambaNovaModels]
			return { id, info }
		}
		case "fireworks": {
			const id = apiConfiguration.apiModelId ?? fireworksDefaultModelId
			const info = fireworksModels[id as keyof typeof fireworksModels]
			return { id, info }
		}
		case "featherless": {
			const id = apiConfiguration.apiModelId ?? featherlessDefaultModelId
			const info = featherlessModels[id as keyof typeof featherlessModels]
			return { id, info }
		}
		case "io-intelligence": {
			const id = apiConfiguration.ioIntelligenceModelId ?? ioIntelligenceDefaultModelId
			const info =
				routerModels["io-intelligence"]?.[id] ?? ioIntelligenceModels[id as keyof typeof ioIntelligenceModels]
			return { id, info }
		}
		case "roo": {
			const requestedId = apiConfiguration.apiModelId

			// Check if the requested model exists in rooModels
			if (requestedId && rooModels[requestedId as keyof typeof rooModels]) {
				return {
					id: requestedId,
					info: rooModels[requestedId as keyof typeof rooModels],
				}
			}

			// Fallback to default model if requested model doesn't exist or is not specified
			return {
				id: rooDefaultModelId,
				info: rooModels[rooDefaultModelId as keyof typeof rooModels],
			}
		}
		case "qwen-code": {
			const id = apiConfiguration.apiModelId ?? qwenCodeDefaultModelId
			const info = qwenCodeModels[id as keyof typeof qwenCodeModels]
			return { id, info }
		}
		case "vercel-ai-gateway": {
			const id = apiConfiguration.vercelAiGatewayModelId ?? vercelAiGatewayDefaultModelId
			const info = routerModels["vercel-ai-gateway"]?.[id]
			return { id, info }
		}
		// case "anthropic":
		// case "human-relay":
		// case "fake-ai":
		default: {
			provider satisfies "anthropic" | "gemini-cli" | "qwen-code" | "human-relay" | "fake-ai"
			const id = apiConfiguration.apiModelId ?? anthropicDefaultModelId
			const baseInfo = anthropicModels[id as keyof typeof anthropicModels]

			// Apply 1M context beta tier pricing for Claude Sonnet 4
			if (
				provider === "anthropic" &&
				(id === "claude-sonnet-4-20250514" || id === "claude-sonnet-4-5") &&
				(apiConfiguration.anthropicBeta1MContext || apiConfiguration.largeInputTierEnabled) &&
				baseInfo
			) {
				// Type assertion since we know claude-sonnet-4-20250514 and claude-sonnet-4-5 have tiers
				const modelWithTiers = baseInfo as typeof baseInfo & {
					tiers?: Array<{
						contextWindow: number
						inputPrice?: number
						outputPrice?: number
						cacheWritesPrice?: number
						cacheReadsPrice?: number
					}>
				}
				const tier = modelWithTiers.tiers?.[0]
				if (tier) {
					// Create a new ModelInfo object with updated values
					const info: ModelInfo = {
						...baseInfo,
						contextWindow: tier.contextWindow,
						inputPrice: tier.inputPrice ?? baseInfo.inputPrice,
						outputPrice: tier.outputPrice ?? baseInfo.outputPrice,
						cacheWritesPrice: tier.cacheWritesPrice ?? baseInfo.cacheWritesPrice,
						cacheReadsPrice: tier.cacheReadsPrice ?? baseInfo.cacheReadsPrice,
					}
					return { id, info }
				}
			}

			return { id, info: baseInfo }
		}
	}
}
