export type UsageProtocol = "anthropic" | "openai"

export interface UsageMetricPaths {
	providerMetadata?: string[]
	usage?: string[]
	raw?: string[]
}

export interface UsageProfile {
	key: string
	apiProtocol: UsageProtocol
	emitZeroCacheTokens?: boolean
	deriveNonCachedInputFromTotalMinusCache?: boolean
	metrics: {
		inputTokensTotal?: UsageMetricPaths
		inputTokensNonCached?: UsageMetricPaths
		outputTokens?: UsageMetricPaths
		cacheWriteTokens?: UsageMetricPaths
		cacheReadTokens?: UsageMetricPaths
		reasoningTokens?: UsageMetricPaths
		totalCostCandidate?: UsageMetricPaths
	}
}

const OPENAI_BASE_PROFILE: UsageProfile = {
	key: "default-openai",
	apiProtocol: "openai",
	emitZeroCacheTokens: false,
	deriveNonCachedInputFromTotalMinusCache: true,
	metrics: {
		inputTokensTotal: {
			usage: ["inputTokens", "promptTokens", "prompt_tokens"],
			raw: ["input_tokens", "prompt_tokens"],
		},
		outputTokens: {
			usage: ["outputTokens", "completionTokens", "completion_tokens"],
			raw: ["output_tokens", "completion_tokens"],
		},
		cacheWriteTokens: {
			usage: ["inputTokenDetails.cacheWriteTokens", "cacheCreationInputTokens", "cache_creation_input_tokens"],
			raw: [
				"cache_creation_input_tokens",
				"cacheCreationInputTokens",
				"prompt_tokens_details.cache_write_tokens",
			],
		},
		cacheReadTokens: {
			usage: [
				"inputTokenDetails.cacheReadTokens",
				"cachedInputTokens",
				"details.cachedInputTokens",
				"cached_tokens",
			],
			raw: [
				"input_tokens_details.cached_tokens",
				"prompt_tokens_details.cached_tokens",
				"cache_read_input_tokens",
				"cacheReadInputTokens",
				"cached_tokens",
			],
		},
		reasoningTokens: {
			usage: ["outputTokenDetails.reasoningTokens", "reasoningTokens", "details.reasoningTokens"],
			raw: ["output_tokens_details.reasoning_tokens", "completion_tokens_details.reasoning_tokens"],
		},
		totalCostCandidate: {
			providerMetadata: ["gateway.cost"],
			usage: ["cost"],
			raw: ["cost"],
		},
	},
}

const ANTHROPIC_BASE_PROFILE: UsageProfile = {
	key: "default-anthropic",
	apiProtocol: "anthropic",
	emitZeroCacheTokens: false,
	deriveNonCachedInputFromTotalMinusCache: true,
	metrics: {
		inputTokensTotal: {
			usage: ["inputTokens", "promptTokens", "prompt_tokens"],
			raw: ["input_tokens", "prompt_tokens"],
		},
		inputTokensNonCached: {
			usage: ["inputTokenDetails.noCacheTokens"],
			providerMetadata: ["anthropic.usage.input_tokens"],
			raw: ["input_tokens"],
		},
		outputTokens: {
			usage: ["outputTokens", "completionTokens", "completion_tokens"],
			providerMetadata: ["anthropic.usage.output_tokens"],
			raw: ["output_tokens", "completion_tokens"],
		},
		cacheWriteTokens: {
			providerMetadata: ["anthropic.usage.cache_creation_input_tokens", "anthropic.cacheCreationInputTokens"],
			usage: ["inputTokenDetails.cacheWriteTokens", "cacheCreationInputTokens", "cache_creation_input_tokens"],
			raw: ["cache_creation_input_tokens", "cacheCreationInputTokens", "prompt_tokens_details.cache_write_tokens"],
		},
		cacheReadTokens: {
			providerMetadata: [
				"anthropic.usage.cache_read_input_tokens",
				"anthropic.cacheReadInputTokens",
				"anthropic.usage.cached_tokens",
			],
			usage: [
				"inputTokenDetails.cacheReadTokens",
				"cachedInputTokens",
				"details.cachedInputTokens",
				"cached_tokens",
			],
				raw: [
					"cache_read_input_tokens",
					"cacheReadInputTokens",
					"input_tokens_details.cached_tokens",
					"prompt_tokens_details.cached_tokens",
					"cached_tokens",
				],
		},
		reasoningTokens: {
			usage: ["outputTokenDetails.reasoningTokens", "reasoningTokens", "details.reasoningTokens"],
			raw: ["output_tokens_details.reasoning_tokens", "completion_tokens_details.reasoning_tokens"],
		},
		totalCostCandidate: {
			providerMetadata: ["gateway.cost"],
			usage: ["cost"],
			raw: ["cost"],
		},
	},
}

const PROFILES: Record<string, Partial<UsageProfile>> = {
	anthropic: {
		key: "anthropic",
		apiProtocol: "anthropic",
	},
	"anthropic-vertex": {
		key: "anthropic-vertex",
		apiProtocol: "anthropic",
	},
	bedrock: {
		key: "bedrock",
		apiProtocol: "anthropic",
		metrics: {
			cacheWriteTokens: {
				providerMetadata: ["bedrock.usage.cacheWriteInputTokens"],
				usage: [
					"inputTokenDetails.cacheWriteTokens",
					"cacheCreationInputTokens",
					"cache_creation_input_tokens",
				],
			},
			cacheReadTokens: {
				providerMetadata: ["bedrock.usage.cacheReadInputTokens"],
				usage: [
					"inputTokenDetails.cacheReadTokens",
					"cachedInputTokens",
					"details.cachedInputTokens",
					"cached_tokens",
				],
				raw: ["input_tokens_details.cached_tokens", "prompt_tokens_details.cached_tokens", "cache_read_input_tokens", "cached_tokens"],
			},
		},
	},
	baseten: {
		key: "baseten",
		apiProtocol: "openai",
	},
	mistral: {
		key: "mistral",
		apiProtocol: "openai",
	},
	"native-ollama": {
		key: "native-ollama",
		apiProtocol: "openai",
	},
	lmstudio: {
		key: "lmstudio",
		apiProtocol: "openai",
	},
	"lm-studio": {
		key: "lm-studio",
		apiProtocol: "openai",
	},
	litellm: {
		key: "litellm",
		apiProtocol: "openai",
	},
	"lite-llm": {
		key: "lite-llm",
		apiProtocol: "openai",
	},
	moonshot: {
		key: "moonshot",
		apiProtocol: "openai",
	},
	"qwen-code": {
		key: "qwen-code",
		apiProtocol: "openai",
	},
	minimax: {
		key: "minimax",
		apiProtocol: "anthropic",
	},
	openai: {
		key: "openai",
		apiProtocol: "openai",
		metrics: {
			cacheReadTokens: {
				providerMetadata: ["openai.cachedPromptTokens"],
				usage: [
					"inputTokenDetails.cacheReadTokens",
					"cachedInputTokens",
					"details.cachedInputTokens",
					"cached_tokens",
				],
				raw: ["input_tokens_details.cached_tokens", "prompt_tokens_details.cached_tokens", "cached_tokens"],
			},
			reasoningTokens: {
				providerMetadata: ["openai.reasoningTokens"],
				usage: ["outputTokenDetails.reasoningTokens", "reasoningTokens", "details.reasoningTokens"],
				raw: ["output_tokens_details.reasoning_tokens", "completion_tokens_details.reasoning_tokens"],
			},
		},
	},
	"openai-native": {
		key: "openai-native",
		apiProtocol: "openai",
		metrics: {
			cacheReadTokens: {
				providerMetadata: ["openai.cachedPromptTokens"],
				usage: ["inputTokenDetails.cacheReadTokens", "cachedInputTokens", "details.cachedInputTokens"],
				raw: ["input_tokens_details.cached_tokens", "prompt_tokens_details.cached_tokens", "cached_tokens"],
			},
			reasoningTokens: {
				providerMetadata: ["openai.reasoningTokens"],
				usage: ["outputTokenDetails.reasoningTokens", "reasoningTokens", "details.reasoningTokens"],
				raw: ["output_tokens_details.reasoning_tokens", "completion_tokens_details.reasoning_tokens"],
			},
		},
	},
	"openai-codex": {
		key: "openai-codex",
		apiProtocol: "openai",
		metrics: {
			cacheReadTokens: {
				providerMetadata: ["openai.cachedPromptTokens"],
				usage: ["inputTokenDetails.cacheReadTokens", "cachedInputTokens", "details.cachedInputTokens"],
				raw: ["input_tokens_details.cached_tokens", "prompt_tokens_details.cached_tokens", "cached_tokens"],
			},
			reasoningTokens: {
				providerMetadata: ["openai.reasoningTokens"],
				usage: ["outputTokenDetails.reasoningTokens", "reasoningTokens", "details.reasoningTokens"],
				raw: ["output_tokens_details.reasoning_tokens", "completion_tokens_details.reasoning_tokens"],
			},
		},
	},
	openrouter: {
		key: "openrouter",
		apiProtocol: "openai",
		metrics: {
			cacheWriteTokens: {
				providerMetadata: [
					"openrouter.cacheCreationInputTokens",
					"openrouter.cache_creation_input_tokens",
					"openrouter.cacheWriteTokens",
				],
				usage: [
					"inputTokenDetails.cacheWriteTokens",
					"cacheCreationInputTokens",
					"cache_creation_input_tokens",
				],
			},
			cacheReadTokens: {
				providerMetadata: [
					"openrouter.cachedInputTokens",
					"openrouter.cache_read_input_tokens",
					"openrouter.cacheReadTokens",
					"openrouter.cached_tokens",
				],
				usage: [
					"inputTokenDetails.cacheReadTokens",
					"cachedInputTokens",
					"details.cachedInputTokens",
					"cached_tokens",
				],
				raw: ["input_tokens_details.cached_tokens", "prompt_tokens_details.cached_tokens", "cached_tokens"],
			},
			reasoningTokens: {
				providerMetadata: [
					"openrouter.reasoningOutputTokens",
					"openrouter.reasoning_tokens",
					"openrouter.output_tokens_details.reasoning_tokens",
				],
				usage: ["outputTokenDetails.reasoningTokens", "reasoningTokens", "details.reasoningTokens"],
				raw: ["output_tokens_details.reasoning_tokens", "completion_tokens_details.reasoning_tokens"],
			},
		},
	},
	requesty: {
		key: "requesty",
		apiProtocol: "openai",
		metrics: {
			cacheWriteTokens: {
				providerMetadata: ["requesty.usage.cachingTokens"],
				usage: [
					"inputTokenDetails.cacheWriteTokens",
					"cacheCreationInputTokens",
					"cache_creation_input_tokens",
				],
			},
			cacheReadTokens: {
				providerMetadata: ["requesty.usage.cachedTokens"],
				usage: ["inputTokenDetails.cacheReadTokens", "cachedInputTokens", "details.cachedInputTokens"],
				raw: ["input_tokens_details.cached_tokens", "prompt_tokens_details.cached_tokens", "cached_tokens"],
			},
		},
	},
	fireworks: {
		key: "fireworks",
		apiProtocol: "openai",
		metrics: {
			cacheWriteTokens: {
				providerMetadata: ["fireworks.promptCacheMissTokens"],
				usage: [
					"inputTokenDetails.cacheWriteTokens",
					"cacheCreationInputTokens",
					"cache_creation_input_tokens",
				],
			},
			cacheReadTokens: {
				providerMetadata: ["fireworks.promptCacheHitTokens"],
				usage: ["inputTokenDetails.cacheReadTokens", "cachedInputTokens", "details.cachedInputTokens"],
				raw: ["input_tokens_details.cached_tokens", "prompt_tokens_details.cached_tokens", "cached_tokens"],
			},
		},
	},
	deepseek: {
		key: "deepseek",
		apiProtocol: "openai",
		metrics: {
			cacheWriteTokens: {
				providerMetadata: ["deepseek.promptCacheMissTokens"],
				usage: [
					"inputTokenDetails.cacheWriteTokens",
					"cacheCreationInputTokens",
					"cache_creation_input_tokens",
				],
			},
			cacheReadTokens: {
				providerMetadata: ["deepseek.promptCacheHitTokens"],
				usage: ["inputTokenDetails.cacheReadTokens", "cachedInputTokens", "details.cachedInputTokens"],
				raw: ["input_tokens_details.cached_tokens", "prompt_tokens_details.cached_tokens", "cached_tokens"],
			},
		},
	},
	xai: {
		key: "xai",
		apiProtocol: "openai",
		metrics: {
			cacheReadTokens: {
				providerMetadata: ["xai.cachedPromptTokens"],
				usage: ["inputTokenDetails.cacheReadTokens", "cachedInputTokens", "details.cachedInputTokens"],
				raw: ["input_tokens_details.cached_tokens", "prompt_tokens_details.cached_tokens", "cached_tokens"],
			},
		},
	},
	azure: {
		key: "azure",
		apiProtocol: "openai",
		metrics: {
			cacheReadTokens: {
				providerMetadata: ["azure.promptCacheHitTokens"],
				usage: ["inputTokenDetails.cacheReadTokens", "cachedInputTokens", "details.cachedInputTokens"],
				raw: ["input_tokens_details.cached_tokens", "prompt_tokens_details.cached_tokens", "cached_tokens"],
			},
			cacheWriteTokens: {
				usage: ["inputTokenDetails.cacheWriteTokens"],
			},
		},
	},
	sambanova: {
		key: "sambanova",
		apiProtocol: "openai",
		metrics: {
			cacheWriteTokens: {
				providerMetadata: ["sambanova.promptCacheMissTokens"],
				usage: [
					"inputTokenDetails.cacheWriteTokens",
					"cacheCreationInputTokens",
					"cache_creation_input_tokens",
				],
			},
			cacheReadTokens: {
				providerMetadata: ["sambanova.promptCacheHitTokens"],
				usage: ["inputTokenDetails.cacheReadTokens", "cachedInputTokens", "details.cachedInputTokens"],
				raw: ["input_tokens_details.cached_tokens", "prompt_tokens_details.cached_tokens", "cached_tokens"],
			},
		},
	},
	gemini: {
		key: "gemini",
		apiProtocol: "openai",
		metrics: {
			cacheReadTokens: {
				providerMetadata: [
					"google.usageMetadata.cachedContentTokenCount",
					"google.usageMetadata.cacheTokensDetails",
				],
				usage: ["inputTokenDetails.cacheReadTokens", "cachedInputTokens", "details.cachedInputTokens"],
			},
		},
	},
	vertex: {
		key: "vertex",
		apiProtocol: "openai",
		metrics: {
			cacheReadTokens: {
				providerMetadata: [
					"vertex.usageMetadata.cachedContentTokenCount",
					"vertex.usageMetadata.cacheTokensDetails",
					"google.usageMetadata.cachedContentTokenCount",
					"google.usageMetadata.cacheTokensDetails",
				],
				usage: ["inputTokenDetails.cacheReadTokens", "cachedInputTokens", "details.cachedInputTokens"],
			},
		},
	},
	roo: {
		key: "roo",
		emitZeroCacheTokens: true,
		metrics: {
			cacheWriteTokens: {
				providerMetadata: [
					"roo.cache_creation_input_tokens",
					"roo.cacheCreationInputTokens",
					"openai.cacheCreationInputTokens",
					"anthropic.usage.cache_creation_input_tokens",
					"anthropic.cacheCreationInputTokens",
					"gateway.cache_creation_input_tokens",
					"gateway.cacheCreationInputTokens",
				],
				usage: [
					"inputTokenDetails.cacheWriteTokens",
					"cacheCreationInputTokens",
					"cache_creation_input_tokens",
				],
			},
			cacheReadTokens: {
				providerMetadata: [
					"roo.cache_read_input_tokens",
					"roo.cacheReadInputTokens",
					"roo.cached_tokens",
					"openai.cachedPromptTokens",
					"anthropic.usage.cache_read_input_tokens",
					"anthropic.usage.cached_tokens",
					"anthropic.cacheReadInputTokens",
					"gateway.cache_read_input_tokens",
					"gateway.cacheReadInputTokens",
					"gateway.cached_tokens",
				],
				usage: [
					"inputTokenDetails.cacheReadTokens",
					"cachedInputTokens",
					"details.cachedInputTokens",
					"cached_tokens",
				],
				raw: [
					"input_tokens_details.cached_tokens",
					"prompt_tokens_details.cached_tokens",
					"cache_read_input_tokens",
					"cached_tokens",
				],
			},
			totalCostCandidate: {
				providerMetadata: ["roo.cost", "gateway.cost"],
			},
		},
	},
	"vercel-ai-gateway": {
		key: "vercel-ai-gateway",
		metrics: {
			cacheWriteTokens: {
				providerMetadata: [
					"anthropic.usage.cache_creation_input_tokens",
					"anthropic.cacheCreationInputTokens",
					"gateway.cache_creation_input_tokens",
					"gateway.cacheCreationInputTokens",
				],
				usage: [
					"inputTokenDetails.cacheWriteTokens",
					"cacheCreationInputTokens",
					"cache_creation_input_tokens",
				],
			},
			cacheReadTokens: {
				providerMetadata: [
					"openai.cachedPromptTokens",
					"anthropic.usage.cache_read_input_tokens",
					"anthropic.usage.cached_tokens",
					"anthropic.cacheReadInputTokens",
					"gateway.cache_read_input_tokens",
					"gateway.cacheReadInputTokens",
					"gateway.cached_tokens",
				],
				usage: [
					"inputTokenDetails.cacheReadTokens",
					"cachedInputTokens",
					"details.cachedInputTokens",
					"cached_tokens",
				],
				raw: [
					"input_tokens_details.cached_tokens",
					"prompt_tokens_details.cached_tokens",
					"cache_read_input_tokens",
					"cached_tokens",
				],
			},
			totalCostCandidate: {
				providerMetadata: ["gateway.cost"],
			},
		},
	},
}

function mergeMetricPaths(base?: UsageMetricPaths, override?: UsageMetricPaths): UsageMetricPaths | undefined {
	if (!base && !override) return undefined
	return {
		providerMetadata: override?.providerMetadata ?? base?.providerMetadata,
		usage: override?.usage ?? base?.usage,
		raw: override?.raw ?? base?.raw,
	}
}

function mergeProfiles(base: UsageProfile, override: Partial<UsageProfile>): UsageProfile {
	return {
		...base,
		...override,
		metrics: {
			inputTokensTotal: mergeMetricPaths(base.metrics.inputTokensTotal, override.metrics?.inputTokensTotal),
			inputTokensNonCached: mergeMetricPaths(
				base.metrics.inputTokensNonCached,
				override.metrics?.inputTokensNonCached,
			),
			outputTokens: mergeMetricPaths(base.metrics.outputTokens, override.metrics?.outputTokens),
			cacheWriteTokens: mergeMetricPaths(base.metrics.cacheWriteTokens, override.metrics?.cacheWriteTokens),
			cacheReadTokens: mergeMetricPaths(base.metrics.cacheReadTokens, override.metrics?.cacheReadTokens),
			reasoningTokens: mergeMetricPaths(base.metrics.reasoningTokens, override.metrics?.reasoningTokens),
			totalCostCandidate: mergeMetricPaths(base.metrics.totalCostCandidate, override.metrics?.totalCostCandidate),
		},
	}
}

export function getUsageProfile(providerKey: string, apiProtocol?: UsageProtocol): UsageProfile {
	const override = PROFILES[providerKey]
	const protocol = override?.apiProtocol ?? apiProtocol ?? "openai"
	const base = protocol === "anthropic" ? ANTHROPIC_BASE_PROFILE : OPENAI_BASE_PROFILE

	if (!override) {
		return {
			...base,
			key: providerKey || base.key,
		}
	}

	return mergeProfiles(base, {
		...override,
		key: override.key ?? providerKey,
		apiProtocol: protocol,
	})
}
