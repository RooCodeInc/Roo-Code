/**
 * Orchestration hooks for Intent–Code traceability (TRP1 Challenge).
 * Clean middleware: Pre-Hook (context + scope + gatekeeper), Post-Hook (agent_trace.jsonl).
 */

export * from "./types"
export * from "./content-hash"
export * from "./context-loader"
export * from "./scope"
export * from "./pre-hook"
export * from "./post-hook"
export * from "./middleware"
export * from "./select-active-intent-tool"
