/**
 * OrchestrationPaths - Defines file paths for orchestration artifacts
 */

import * as path from "path"

export const ORCHESTRATION_DIR = ".orchestration"

export const OrchestrationPaths = {
	// Main intent specification file
	activeIntents: () => path.join(ORCHESTRATION_DIR, "active_intents.yaml"),

	// Intent map for code ownership
	intentMap: () => path.join(ORCHESTRATION_DIR, "intent_map.md"),

	// Trace ledger
	traceLedger: () => path.join(ORCHESTRATION_DIR, "agent_trace.jsonl"),

	// Spatial map
	spatialMap: () => path.join(ORCHESTRATION_DIR, "spatial_map.json"),

	// Base directory
	baseDir: () => ORCHESTRATION_DIR,
} as const

export type OrchestrationPathKey = keyof typeof OrchestrationPaths
