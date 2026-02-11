import type { ModelInfo, ProviderSettings } from "@roo-code/types"
import type { ModelMessage } from "ai"

export type PromptCachingStrategy = NonNullable<ProviderSettings["promptCachingStrategy"]>
export type PromptCacheAdapter = "anthropic" | "bedrock" | "openai-native"

export interface PromptCachePolicy {
	enabled: boolean
	strategy: PromptCachingStrategy
}

export interface ApplyPromptCacheArgs {
	adapter: PromptCacheAdapter
	overrideKey: string
	messages: ModelMessage[]
	modelInfo: Pick<ModelInfo, "supportsPromptCache" | "promptCacheRetention">
	settings?: Pick<
		ProviderSettings,
		"promptCachingEnabled" | "promptCachingStrategy" | "promptCachingProviderOverrides"
	>
}

export interface AppliedPromptCache {
	enabled: boolean
	strategy: PromptCachingStrategy
	systemProviderOptions?: Record<string, unknown>
	providerOptionsPatch?: Record<string, Record<string, unknown>>
}

const DEFAULT_PROMPT_CACHING_STRATEGY: PromptCachingStrategy = "aggressive"

export function resolvePromptCachePolicy({
	overrideKey,
	settings,
	supportsPromptCache,
}: {
	overrideKey: string
	settings?: Pick<
		ProviderSettings,
		"promptCachingEnabled" | "promptCachingStrategy" | "promptCachingProviderOverrides"
	>
	supportsPromptCache: boolean
}): PromptCachePolicy {
	const strategy = settings?.promptCachingStrategy ?? DEFAULT_PROMPT_CACHING_STRATEGY
	if (!supportsPromptCache) {
		return { enabled: false, strategy }
	}

	const globalEnabled = settings?.promptCachingEnabled ?? true
	const providerOverride = settings?.promptCachingProviderOverrides?.[overrideKey]
	const enabled = providerOverride ?? globalEnabled

	return { enabled, strategy }
}

export function applyPromptCacheToMessages({
	adapter,
	overrideKey,
	messages,
	modelInfo,
	settings,
}: ApplyPromptCacheArgs): AppliedPromptCache {
	const policy = resolvePromptCachePolicy({
		overrideKey,
		settings,
		supportsPromptCache: modelInfo.supportsPromptCache,
	})

	if (!policy.enabled) {
		return {
			enabled: false,
			strategy: policy.strategy,
		}
	}

	if (adapter === "openai-native") {
		if (modelInfo.promptCacheRetention === "24h") {
			return {
				enabled: true,
				strategy: policy.strategy,
				providerOptionsPatch: {
					openai: {
						promptCacheRetention: "24h",
					},
				},
			}
		}

		return {
			enabled: true,
			strategy: policy.strategy,
		}
	}

	const adapterConfig = getMessageAdapterConfig(adapter)
	const checkpointCount = resolveCheckpointCount(policy.strategy, adapterConfig.maxUserCheckpoints)
	const userIndices = getUserMessageIndices(messages)
	const targetIndices = userIndices.slice(-checkpointCount)

	applyProviderOptionAtIndices(messages, targetIndices, adapterConfig.messageProviderOption)

	return {
		enabled: true,
		strategy: policy.strategy,
		systemProviderOptions: adapterConfig.systemProviderOptions,
	}
}

function getMessageAdapterConfig(adapter: Exclude<PromptCacheAdapter, "openai-native">): {
	maxUserCheckpoints: number
	systemProviderOptions: Record<string, unknown>
	messageProviderOption: Record<string, Record<string, unknown>>
} {
	if (adapter === "bedrock") {
		return {
			maxUserCheckpoints: 3,
			systemProviderOptions: {
				bedrock: { cachePoint: { type: "default" } },
			},
			messageProviderOption: {
				bedrock: { cachePoint: { type: "default" } },
			},
		}
	}

	return {
		maxUserCheckpoints: 2,
		systemProviderOptions: {
			anthropic: { cacheControl: { type: "ephemeral" } },
		},
		messageProviderOption: {
			anthropic: { cacheControl: { type: "ephemeral" } },
		},
	}
}

function resolveCheckpointCount(strategy: PromptCachingStrategy, maxUserCheckpoints: number): number {
	if (maxUserCheckpoints <= 0) {
		return 0
	}

	if (strategy === "conservative") {
		return 1
	}

	if (strategy === "balanced") {
		return Math.max(1, Math.ceil(maxUserCheckpoints / 2))
	}

	return maxUserCheckpoints
}

function getUserMessageIndices(messages: ModelMessage[]): number[] {
	const indices: number[] = []
	for (let i = 0; i < messages.length; i++) {
		if (messages[i].role === "user") {
			indices.push(i)
		}
	}
	return indices
}

function applyProviderOptionAtIndices(
	messages: ModelMessage[],
	indices: number[],
	providerOption: Record<string, Record<string, unknown>>,
): void {
	for (const index of indices) {
		const message = messages[index] as ModelMessage & { providerOptions?: unknown }
		message.providerOptions = {
			...((message.providerOptions as Record<string, unknown> | undefined) ?? {}),
			...providerOption,
		} as any
	}
}
