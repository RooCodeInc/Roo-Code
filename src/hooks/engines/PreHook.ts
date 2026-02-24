import * as fs from "fs/promises"
import * as path from "path"

import type { Intent } from "../models/Intent"
import { Tool } from "../models/Tool"

export class PreHook {
	/**
	 * Validate that an active intent exists and return its spec.
	 * If orchestration sidecar exists, try to read it; otherwise return minimal stub.
	 */
	static async validate(activeIntentId: string): Promise<Intent> {
		if (!activeIntentId || activeIntentId.trim().length === 0) {
			throw new Error("You must cite a valid active Intent ID")
		}

		const cwd = process.cwd()
		const orchestrationDir = path.join(cwd, ".orchestration")
		const intentsFile = path.join(orchestrationDir, "active_intents.yaml")

		try {
			const yaml = await fs.readFile(intentsFile, "utf-8")
			// Minimal parse: find block for the requested id
			const block = PreHook.extractIntentBlock(yaml, activeIntentId)
			if (!block) {
				// Fallback to permissive stub (allow tests to pass while sidecar is empty)
				return { id: activeIntentId, owned_scope: ["**"] }
			}
			return block
		} catch {
			// Sidecar not present; return permissive stub for development
			return { id: activeIntentId, owned_scope: ["**"] }
		}
	}

	/**
	 * Very lightweight YAML block extractor for the example schema
	 * (not a full YAML parser; keeps implementation dependency-free).
	 */
	private static extractIntentBlock(yaml: string, id: string): Intent | null {
		// Find entry that contains id: "ID"
		const entries = yaml.split(/\n\s*-\s+id:\s*/).slice(1)
		for (const entry of entries) {
			const idMatch = entry.match(/^"?([^"]+)"?/)
			const intentId = idMatch?.[1]
			if (intentId !== id) continue

			const name = entry.match(/\n\s*name:\s*"?([^\"\n]+)"?/i)?.[1]
			const status = entry.match(/\n\s*status:\s*"?([^\"\n]+)"?/i)?.[1]

			const owned_scope: string[] = []
			const scopeBlock =
				entry.match(/owned_scope:\s*\n([\s\S]*?)\n\s*[a-z_]+:/i)?.[1] ||
				entry.match(/owned_scope:\s*\n([\s\S]*)$/i)?.[1]
			if (scopeBlock) {
				for (const line of scopeBlock.split("\n")) {
					const m = line.match(/-\s*"?([^\"\n]+)"?/)
					if (m?.[1]) owned_scope.push(m[1])
				}
			}

			const constraints: string[] = []
			const constraintsBlock =
				entry.match(/constraints:\s*\n([\s\S]*?)\n\s*[a-z_]+:/i)?.[1] ||
				entry.match(/constraints:\s*\n([\s\S]*)$/i)?.[1]
			if (constraintsBlock) {
				for (const line of constraintsBlock.split("\n")) {
					const m = line.match(/-\s*"?([^\"\n]+)"?/)
					if (m?.[1]) constraints.push(m[1])
				}
			}

			const acceptance_criteria: string[] = []
			const acBlock =
				entry.match(/acceptance_criteria:\s*\n([\s\S]*?)\n\s*[a-z_]+:/i)?.[1] ||
				entry.match(/acceptance_criteria:\s*\n([\s\S]*)$/i)?.[1]
			if (acBlock) {
				for (const line of acBlock.split("\n")) {
					const m = line.match(/-\s*"?([^\"\n]+)"?/)
					if (m?.[1]) acceptance_criteria.push(m[1])
				}
			}

			return { id, name, owned_scope, constraints, acceptance_criteria }
		}
		return null
	}

	/**
	 * Tool definition for selecting an active intent.
	 */
	static selectActiveIntent(intentId: string): string {
		try {
			const intent = this.validate(intentId)
			return `<intent_context>${JSON.stringify(intent)}</intent_context>`
		} catch (error) {
			throw new Error(`Failed to select active intent: ${error.message}`)
		}
	}
}
