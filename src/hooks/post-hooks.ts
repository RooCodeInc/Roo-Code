export * from "./types"
export * from "./tracePostWriteHook"

import { hashContent as hashContentInternal } from "../core/trace/ContentHasher"
import { classifySemanticChange } from "../core/trace/SemanticClassifier"
import { appendAgentTrace, type AgentTraceAppendInput } from "../core/trace/AgentTraceSerializer"
import { getCurrentHash, validateLock } from "../core/concurrency/OptimisticLock"

// Post-execution hooks that run after tools
export const postHooks = {
	// Phase 3: Content hashing
	hashContent: (content: string) => hashContentInternal(content),

	// Phase 3: Semantic classification
	classifyMutation: (intentId: string, filePath: string) =>
		classifySemanticChange({
			intentTitle: intentId,
			filePath,
		}),

	// Phase 3: Trace recording
	recordTrace: async (entry: AgentTraceAppendInput) => appendAgentTrace(entry),

	// Phase 4: Optimistic locking
	validateLock: async (expectedHash: string, filePath: string) => validateLock(expectedHash, filePath),

	// Phase 4: Capture initial hash
	captureInitialHash: async (filePath: string) => getCurrentHash(filePath),
}
