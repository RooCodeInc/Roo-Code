import type { RooMessage } from "../../core/task-persistence/rooMessage"

export interface CacheBreakpointConfig {
	/** The providerOptions value to apply to targeted messages */
	cacheProviderOption: Record<string, Record<string, unknown>>
	/** Max number of message cache breakpoints (excluding system). Default: 2 */
	maxMessageBreakpoints?: number
	/** Add an anchor breakpoint in the middle for long conversations. Default: false */
	useAnchor?: boolean
	/** Min non-assistant batch count before anchor is added. Default: 5 */
	anchorThreshold?: number
}

/**
 * Apply cache breakpoints to RooMessage[].
 *
 * Targets the last message in each non-assistant batch (user/tool).
 * A "batch" is a consecutive run of non-assistant messages.
 * We only cache the last message per batch to avoid redundant breakpoints.
 *
 * Mutates messages in place by adding providerOptions.
 */
export function applyCacheBreakpoints(messages: RooMessage[], config: CacheBreakpointConfig): void {
	const { cacheProviderOption, maxMessageBreakpoints = 2, useAnchor = false, anchorThreshold = 5 } = config

	// Find the index of the last message in each non-assistant batch
	const batchLastIndices: number[] = []
	let inBatch = false

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i]
		const isNonAssistant = "role" in msg && msg.role !== "assistant"

		if (isNonAssistant) {
			inBatch = true
		} else if (inBatch) {
			batchLastIndices.push(i - 1)
			inBatch = false
		}
	}
	if (inBatch) {
		batchLastIndices.push(messages.length - 1)
	}

	// Select targets: last N batches + optional anchor
	const targets = new Set<number>()
	const numBatches = batchLastIndices.length

	for (let j = 0; j < Math.min(maxMessageBreakpoints, numBatches); j++) {
		targets.add(batchLastIndices[numBatches - 1 - j])
	}

	if (useAnchor && numBatches >= anchorThreshold) {
		const anchorBatchIdx = Math.floor(numBatches / 3)
		targets.add(batchLastIndices[anchorBatchIdx])
	}

	// Apply providerOptions to targeted messages
	for (const idx of targets) {
		const msg = messages[idx] as RooMessage & {
			providerOptions?: Record<string, Record<string, unknown>>
		}
		msg.providerOptions = { ...msg.providerOptions, ...cacheProviderOption }
	}
}
