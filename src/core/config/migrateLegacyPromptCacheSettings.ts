type PromptCacheMigrationInput = Record<string, unknown>

export interface PromptCacheMigrationResult<T extends PromptCacheMigrationInput> {
	config: T
	changed: boolean
}

/**
 * One-time migration helper for legacy provider-specific prompt cache toggles.
 * - Maps legacy `false` values to provider overrides
 * - Drops legacy keys from the config object
 */
export function migrateLegacyPromptCacheSettings<T extends PromptCacheMigrationInput>(
	config: T,
): PromptCacheMigrationResult<T> {
	let changed = false
	const next = { ...config } as Record<string, unknown>

	const currentOverrides = next.promptCachingProviderOverrides
	const overrides =
		typeof currentOverrides === "object" && currentOverrides !== null && !Array.isArray(currentOverrides)
			? { ...(currentOverrides as Record<string, unknown>) }
			: {}

	if (next.awsUsePromptCache === false && overrides.bedrock === undefined) {
		overrides.bedrock = false
		changed = true
	}

	if (next.litellmUsePromptCache === false && overrides.litellm === undefined) {
		overrides.litellm = false
		changed = true
	}

	if (Object.keys(overrides).length > 0) {
		next.promptCachingProviderOverrides = overrides
	}

	if ("awsUsePromptCache" in next) {
		delete next.awsUsePromptCache
		changed = true
	}

	if ("litellmUsePromptCache" in next) {
		delete next.litellmUsePromptCache
		changed = true
	}

	return { config: next as T, changed }
}
