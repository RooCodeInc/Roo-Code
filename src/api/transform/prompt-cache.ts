import type { ModelInfo, ProviderSettings } from "@roo-code/types"
import type { ModelMessage } from "ai"

export type PromptCacheAdapter = "anthropic" | "anthropic-vertex" | "minimax" | "bedrock" | "openai-native" | "ai-sdk"

export interface PromptCachePolicy {
	enabled: boolean
}

export interface ApplyPromptCacheArgs {
	adapter: PromptCacheAdapter
	overrideKey: string
	messages: ModelMessage[]
	modelInfo: Pick<ModelInfo, "supportsPromptCache" | "promptCacheRetention">
	settings?: Pick<ProviderSettings, "promptCachingEnabled" | "promptCachingProviderOverrides">
}

export interface AppliedPromptCache {
	enabled: boolean
	systemProviderOptions?: Record<string, unknown>
	providerOptionsPatch?: Record<string, Record<string, unknown>>
	toolProviderOptions?: Record<string, unknown>
}

export function resolvePromptCachePolicy({
	overrideKey,
	settings,
	supportsPromptCache,
}: {
	overrideKey: string
	settings?: Pick<ProviderSettings, "promptCachingEnabled" | "promptCachingProviderOverrides">
	supportsPromptCache: boolean
}): PromptCachePolicy {
	if (!supportsPromptCache) {
		return { enabled: false }
	}

	const globalEnabled = settings?.promptCachingEnabled ?? true
	const providerOverride = settings?.promptCachingProviderOverrides?.[overrideKey]
	const enabled = providerOverride ?? globalEnabled

	return { enabled }
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
		}
	}

	if (adapter === "openai-native") {
		const providerOptionsPatch =
			modelInfo.promptCacheRetention === "24h"
				? ({
						openai: {
							promptCacheRetention: "24h",
						},
					} as const)
				: undefined

		return {
			enabled: true,
			providerOptionsPatch,
		}
	}

	const adapterConfig = getMessageAdapterConfig(adapter)
	const targetIndices = getNonAssistantMessageIndices(messages).slice(-2)

	applyProviderOptionAtIndices(messages, targetIndices, adapterConfig.messageProviderOption)

	return {
		enabled: true,
		systemProviderOptions: adapterConfig.systemProviderOptions,
		toolProviderOptions: adapterConfig.toolProviderOptions,
	}
}

function getMessageAdapterConfig(adapter: Exclude<PromptCacheAdapter, "openai-native">): {
	systemProviderOptions: Record<string, unknown>
	messageProviderOption: Record<string, Record<string, unknown>>
	toolProviderOptions?: Record<string, unknown>
} {
	if (adapter === "bedrock") {
		return {
			systemProviderOptions: {
				bedrock: { cachePoint: { type: "default" } },
			},
			messageProviderOption: {
				bedrock: { cachePoint: { type: "default" } },
			},
		}
	}

	// Unified AI SDK marker payload:
	// - Anthropic markers for providers that honor `anthropic.cacheControl`
	// - Bedrock markers for providers that honor `bedrock.cachePoint`
	// Providers are expected to ignore unknown provider namespaces.
	const unifiedProviderMarkers = {
		anthropic: { cacheControl: { type: "ephemeral" } },
		bedrock: { cachePoint: { type: "default" } },
	}

	return {
		systemProviderOptions: unifiedProviderMarkers,
		messageProviderOption: unifiedProviderMarkers,
		toolProviderOptions: {
			anthropic: { cacheControl: { type: "ephemeral" } },
		},
	}
}

export function mergeProviderOptions(
	base: Record<string, unknown> | undefined,
	patch: Record<string, Record<string, unknown>> | undefined,
): Record<string, unknown> | undefined {
	if (!patch) {
		return base
	}

	const next: Record<string, unknown> = { ...(base ?? {}) }

	for (const [providerName, providerPatch] of Object.entries(patch)) {
		const existingProviderOptions = next[providerName]
		if (
			typeof existingProviderOptions === "object" &&
			existingProviderOptions !== null &&
			!Array.isArray(existingProviderOptions)
		) {
			next[providerName] = {
				...(existingProviderOptions as Record<string, unknown>),
				...providerPatch,
			}
		} else {
			next[providerName] = providerPatch
		}
	}

	return Object.keys(next).length > 0 ? next : undefined
}

function getNonAssistantMessageIndices(messages: ModelMessage[]): number[] {
	const indices: number[] = []
	for (let i = 0; i < messages.length; i++) {
		if (messages[i].role !== "assistant") {
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
