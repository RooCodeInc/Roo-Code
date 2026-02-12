/**
 * Universal cache breakpoint options — contains ALL provider namespaces.
 * AI SDK's `providerOptions` are namespaced: each provider ignores keys
 * that don't match its namespace, so it's safe to include all of them.
 */
export const UNIVERSAL_CACHE_OPTIONS: Record<string, Record<string, unknown>> = {
	anthropic: { cacheControl: { type: "ephemeral" } },
	bedrock: { cachePoint: { type: "default" } },
}

/**
 * Optional targeting configuration for cache breakpoint placement.
 */
export interface CacheBreakpointTargeting {
	/** Maximum number of message breakpoints to place. Default: 2 */
	maxBreakpoints?: number
	/** Whether to add an anchor breakpoint at ~1/3 through the conversation. Default: false */
	useAnchor?: boolean
	/** Minimum number of non-assistant messages before placing an anchor. Default: 5 */
	anchorThreshold?: number
}

/**
 * Apply cache breakpoints to AI SDK messages with ALL provider namespaces.
 *
 * 4-breakpoint strategy:
 *   1. System prompt — passed as first message in messages[] with providerOptions
 *   2. Tool definitions — handled externally via `toolProviderOptions` in `streamText()`
 *   3-4. Last 2 non-assistant messages — this function handles these
 *
 * @param messages - The AI SDK message array (mutated in place)
 * @param targeting - Optional targeting options (defaults: 2 breakpoints, no anchor)
 */
export function applyCacheBreakpoints(
	messages: { role: string; providerOptions?: Record<string, Record<string, unknown>> }[],
	targeting: CacheBreakpointTargeting = {},
): void {
	const { maxBreakpoints = 2, useAnchor = false, anchorThreshold = 5 } = targeting

	// 1. Collect non-assistant message indices (user | tool roles)
	const nonAssistantIndices: number[] = []
	for (let i = 0; i < messages.length; i++) {
		if (messages[i].role !== "assistant" && messages[i].role !== "system") {
			nonAssistantIndices.push(i)
		}
	}

	if (nonAssistantIndices.length === 0) return

	// 2. Target last N non-assistant messages
	const targetIndices = new Set<number>()
	for (let j = 0; j < maxBreakpoints && j < nonAssistantIndices.length; j++) {
		targetIndices.add(nonAssistantIndices[nonAssistantIndices.length - 1 - j])
	}

	// 3. Optional anchor at ~1/3 point
	if (useAnchor && nonAssistantIndices.length >= anchorThreshold) {
		const anchorIdx = Math.floor(nonAssistantIndices.length / 3)
		targetIndices.add(nonAssistantIndices[anchorIdx])
	}

	// 4. Apply UNIVERSAL cache options to targeted messages
	for (const idx of targetIndices) {
		if (idx >= 0 && idx < messages.length) {
			messages[idx].providerOptions = {
				...messages[idx].providerOptions,
				...UNIVERSAL_CACHE_OPTIONS,
			}
		}
	}
}

/**
 * Apply system prompt caching by injecting the system prompt as a cached
 * system message at the front of the messages array.
 *
 * AI SDK v6 does not support `providerOptions` on the `system` string
 * parameter. Cache-aware providers call this helper to convert the system
 * prompt into a system message with `providerOptions` for cache control.
 *
 * Returns the effective system prompt to pass to `streamText()`:
 *   - `undefined` when caching was applied (prompt is now in messages[0])
 *   - the original `systemPrompt` when no caching options were provided
 *
 * @param systemPrompt - The system prompt string
 * @param messages - The AI SDK message array (mutated in place)
 * @param cacheOptions - Provider-specific cache options (e.g. UNIVERSAL_CACHE_OPTIONS)
 */
export function applySystemPromptCaching(
	systemPrompt: string | undefined,
	messages: { role: string; content?: unknown; providerOptions?: Record<string, Record<string, unknown>> }[],
	cacheOptions: Record<string, Record<string, unknown>> | undefined,
): string | undefined {
	if (!systemPrompt || !cacheOptions) {
		return systemPrompt || undefined
	}

	messages.unshift({
		role: "system",
		content: systemPrompt,
		providerOptions: cacheOptions,
	})

	// Tell the caller not to also pass the system prompt via the `system:` parameter
	return undefined
}

/**
 * Apply provider-specific cache options to AI SDK tool definitions.
 * Breakpoint 2 of 4: tool definitions.
 */
export function applyToolCacheOptions(
	tools:
		| Record<string, { providerOptions?: Record<string, Record<string, unknown>>; [key: string]: unknown }>
		| undefined,
	cacheOptions: Record<string, Record<string, unknown>> | undefined,
): void {
	if (!tools || !cacheOptions) return
	const keys = Object.keys(tools)
	if (keys.length === 0) return
	// Only stamp the LAST tool to conserve cache breakpoints (max 4 shared across
	// messages and tools). Stamping every tool wastes breakpoints — the provider
	// silently drops all but the first few.
	const lastKey = keys[keys.length - 1]
	tools[lastKey].providerOptions = { ...tools[lastKey].providerOptions, ...cacheOptions }
}
