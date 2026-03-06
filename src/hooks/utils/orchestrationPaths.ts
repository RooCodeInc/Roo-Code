/**
 * Centralizes all .orchestration/ path resolution.
 * Every hook reads/writes through these helpers — no magic strings elsewhere.
 */

import path from "path"

export const ORCHESTRATION_DIR = ".orchestration"

export function getOrchestrationDir(cwd: string): string {
	return path.join(cwd, ORCHESTRATION_DIR)
}

export function getActiveIntentsPath(cwd: string): string {
	return path.join(cwd, ORCHESTRATION_DIR, "active_intents.yaml")
}

export function getTraceLedgerPath(cwd: string): string {
	return path.join(cwd, ORCHESTRATION_DIR, "agent_trace.jsonl")
}

export function getIntentMapPath(cwd: string): string {
	return path.join(cwd, ORCHESTRATION_DIR, "intent_map.md")
}
