import type { RooMessage } from "../../core/task-persistence/rooMessage"
import type { ModelInfo } from "@roo-code/types"

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface PromptCacheConfig {
	providerName: string
	modelInfo: ModelInfo
	providerSettings?: Record<string, unknown>
	maxMessageBreakpoints?: number
}

/** Provider-specific options object attached to individual messages. */
type CacheProviderOptions = Record<string, Record<string, unknown>>

/**
 * Typed intersection so we can set `providerOptions` on a `RooMessage`
 * without widening to `any`. The base `RooMessage` union doesn't declare
 * this field, but the AI SDK runtime accepts it.
 */
type MessageWithProviderOptions = RooMessage & {
	providerOptions?: CacheProviderOptions
}

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_CACHE_OPTIONS: CacheProviderOptions = {
	anthropic: { cacheControl: { type: "ephemeral" } },
}

const BEDROCK_CACHE_OPTIONS: CacheProviderOptions = {
	bedrock: { cachePoint: { type: "default" } },
}

/** Providers that use the Anthropic-style cache control object. */
const ANTHROPIC_STYLE_PROVIDERS: readonly string[] = ["anthropic", "vertex", "minimax"]

// ────────────────────────────────────────────────────────────────────────────
// resolveCacheProviderOptions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Returns the provider-specific cache options object for the given
 * configuration, or `null` when prompt caching is not supported / enabled.
 *
 * Decision order:
 *  1. Model must declare `supportsPromptCache`.
 *  2. Bedrock requires `awsUsePromptCache` in provider settings.
 *  3. Anthropic / Vertex / Minimax → Anthropic-style ephemeral cache.
 *  4. Bedrock → Bedrock-style cache point.
 *  5. All other providers → `null`.
 */
export function resolveCacheProviderOptions(config: PromptCacheConfig): CacheProviderOptions | null {
	const { providerName, modelInfo, providerSettings } = config

	if (!modelInfo.supportsPromptCache) {
		return null
	}

	// Bedrock gate: must have awsUsePromptCache enabled.
	if (providerName === "bedrock" && !providerSettings?.awsUsePromptCache) {
		return null
	}

	if (ANTHROPIC_STYLE_PROVIDERS.includes(providerName)) {
		return ANTHROPIC_CACHE_OPTIONS
	}

	if (providerName === "bedrock") {
		return BEDROCK_CACHE_OPTIONS
	}

	return null
}

// ────────────────────────────────────────────────────────────────────────────
// applyCacheBreakpoints
// ────────────────────────────────────────────────────────────────────────────

/** A contiguous run of non-assistant messages identified by inclusive indices. */
interface Batch {
	start: number
	end: number
}

/**
 * Applies cache breakpoints to an array of {@link RooMessage} by setting
 * `providerOptions` on strategically chosen messages.
 *
 * **Strategy**
 * 1. Identify "non-assistant batches" — consecutive runs of messages whose
 *    role is *not* `"assistant"` (user, tool, reasoning, etc.).
 * 2. Target the **last** message in each batch (the natural boundary before
 *    an assistant turn).
 * 3. Pick the last `maxMessageBreakpoints` batches.
 * 4. Optionally place an "anchor" breakpoint at roughly 1/3 through the
 *    conversation when `messages.length >= anchorThreshold`, which helps the
 *    provider reuse cached prefixes across turns in long conversations.
 *
 * Mutates `messages` in place and returns the same array for chaining.
 *
 * @param messages              The conversation history.
 * @param cacheProviderOptions  Provider-specific options (from {@link resolveCacheProviderOptions}).
 * @param maxMessageBreakpoints Maximum trailing breakpoints to place (default `2`).
 * @param useAnchor             Whether to add an anchor breakpoint for long conversations.
 * @param anchorThreshold       Minimum message count before an anchor is considered (default `20`).
 */
export function applyCacheBreakpoints(
	messages: RooMessage[],
	cacheProviderOptions: CacheProviderOptions,
	maxMessageBreakpoints: number = 2,
	useAnchor: boolean = false,
	anchorThreshold: number = 20,
): RooMessage[] {
	if (messages.length === 0 || maxMessageBreakpoints <= 0) {
		return messages
	}

	// ── 1. Identify non-assistant batches ───────────────────────────────
	const batches: Batch[] = []
	let batchStart: number | null = null

	for (let i = 0; i < messages.length; i++) {
		const isAssistant = "role" in messages[i] && (messages[i] as { role: string }).role === "assistant"

		if (!isAssistant) {
			if (batchStart === null) {
				batchStart = i
			}
		} else {
			if (batchStart !== null) {
				batches.push({ start: batchStart, end: i - 1 })
				batchStart = null
			}
		}
	}

	// Close a trailing batch that runs to the end of the array.
	if (batchStart !== null) {
		batches.push({ start: batchStart, end: messages.length - 1 })
	}

	if (batches.length === 0) {
		return messages
	}

	// ── 2. Pick the last N batches ──────────────────────────────────────
	const targetBatches = batches.slice(-maxMessageBreakpoints)

	// ── 3. Apply breakpoints ────────────────────────────────────────────
	for (const batch of targetBatches) {
		const target = messages[batch.end] as MessageWithProviderOptions
		target.providerOptions = { ...target.providerOptions, ...cacheProviderOptions }
	}

	// ── 4. Optional anchor at ~1/3 of conversation ─────────────────────
	if (useAnchor && messages.length >= anchorThreshold && batches.length > maxMessageBreakpoints) {
		const anchorIndex = Math.floor(messages.length / 3)

		// Find the first batch whose end is at or past the anchor point.
		const anchorBatch = batches.find((b) => b.end >= anchorIndex)

		if (anchorBatch && !targetBatches.includes(anchorBatch)) {
			const anchor = messages[anchorBatch.end] as MessageWithProviderOptions
			anchor.providerOptions = { ...anchor.providerOptions, ...cacheProviderOptions }
		}
	}

	return messages
}
