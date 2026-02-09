/**
 * Unified cache control utility for AI SDK providers.
 *
 * Adds cache control hints via providerOptions on messages.
 * Works for any provider that uses the `providerOptions.{key}.cacheControl`
 * pattern (e.g., anthropic, openrouter).
 *
 * Providers with fundamentally different caching mechanisms (bedrock's
 * cachePoint, lite-llm's raw cache_control on wire format) are NOT covered
 * here and keep their own inline logic.
 */
import type { SystemModelMessage, ModelMessage } from "ai"

// ── Types ───────────────────────────────────────────────────────

type CacheOpts = Record<string, Record<string, unknown>>

export interface CacheBreakpointOptions {
	/**
	 * Strategy for selecting which user messages to mark.
	 *
	 * - `"last-n"` (default): mark the last `count` user messages.
	 * - `"every-nth"`: mark every `frequency`-th user message.
	 */
	style?: "last-n" | "every-nth"

	/**
	 * For `"last-n"` style: how many trailing user messages to mark.
	 * @default 2
	 */
	count?: number

	/**
	 * For `"every-nth"` style: mark every N-th user message (0-indexed,
	 * so `frequency: 10` marks indices 9, 19, 29, …).
	 * @default 10
	 */
	frequency?: number
}

// ── Helpers ─────────────────────────────────────────────────────

function buildCacheOpts(providerKey: string): CacheOpts {
	return {
		[providerKey]: { cacheControl: { type: "ephemeral" } },
	} as CacheOpts
}

/**
 * Add cache control providerOptions to the last text part of a user message.
 *
 * If the message content is a plain string it is converted to a single-element
 * `[{ type: "text", text, providerOptions }]` array so the AI SDK provider can
 * pick up the cache hint on the content part.
 */
function addCacheToLastTextPart(message: ModelMessage, cacheOpts: CacheOpts): void {
	if (message.role !== "user") {
		return
	}

	// Handle string content by wrapping in array with providerOptions
	if (typeof message.content === "string") {
		;(message as Record<string, unknown>).content = [
			{ type: "text", text: message.content, providerOptions: cacheOpts },
		]
		return
	}

	if (Array.isArray(message.content)) {
		// Find last text part and add providerOptions.
		// The AI SDK provider reads cacheControl from providerOptions on content
		// parts at runtime, but the static types don't expose the property.
		// The same `as any` cast was used by every provider before extraction.
		for (let i = message.content.length - 1; i >= 0; i--) {
			if (message.content[i].type === "text") {
				;(message.content[i] as any).providerOptions = cacheOpts
				return
			}
		}
	}
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Wrap a system prompt string with cache control providerOptions for the
 * given provider key.
 *
 * @example
 * ```ts
 * const system = buildCachedSystemMessage(systemPrompt, "anthropic")
 * // → { role: "system", content: systemPrompt, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } }
 * ```
 */
export function buildCachedSystemMessage(systemPrompt: string, providerKey: string): SystemModelMessage {
	return {
		role: "system" as const,
		content: systemPrompt,
		providerOptions: buildCacheOpts(providerKey) as any,
	}
}

/**
 * Apply cache control breakpoints to user messages in an AI SDK message
 * array (mutates in place).
 *
 * Two strategies are supported:
 *
 * 1. **`"last-n"`** (default) – marks the last `count` (default 2) user
 *    messages.  This matches the Anthropic prompt-caching strategy where
 *    the latest user message is a write-to-cache and the second-to-last
 *    is a read-from-cache.
 *
 * 2. **`"every-nth"`** – marks every `frequency`-th user message.  Used
 *    by OpenRouter for Gemini-style caching.
 *
 * @param messages  The AI SDK messages array (mutated in place).
 * @param providerKey  The provider options key (e.g. `"anthropic"`, `"openrouter"`).
 * @param options  Optional strategy configuration.
 */
export function applyCacheBreakpoints(
	messages: ModelMessage[],
	providerKey: string,
	options?: CacheBreakpointOptions,
): void {
	const cacheOpts = buildCacheOpts(providerKey)
	const style = options?.style ?? "last-n"

	if (style === "last-n") {
		const count = options?.count ?? 2
		const userIndices = messages.map((m, i) => (m.role === "user" ? i : -1)).filter((i) => i >= 0)
		const targets = userIndices.slice(-count)

		for (const idx of targets) {
			addCacheToLastTextPart(messages[idx], cacheOpts)
		}
	} else {
		// "every-nth"
		const frequency = options?.frequency ?? 10
		let userCount = 0

		for (const msg of messages) {
			if (msg.role === "user") {
				if (userCount % frequency === frequency - 1) {
					addCacheToLastTextPart(msg, cacheOpts)
				}
				userCount++
			}
		}
	}
}
