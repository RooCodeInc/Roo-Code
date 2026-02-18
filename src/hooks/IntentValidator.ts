import fs from "fs/promises"
import path from "path"
import YAML from "yaml"

import type { ToolParamName } from "../shared/tools"

interface ActiveIntentSpec {
	active_intent_id?: string
	owned_scope?: string[]
}

export interface IntentValidationResult {
	allowed: boolean
	reason: string
	intentId?: string
}

function normalizeScope(scope: string): string {
	let normalized = scope.replace(/\\/g, "/").trim()
	if (normalized.endsWith("/**")) {
		normalized = normalized.slice(0, -3)
	}
	return normalized.replace(/\/+$/, "")
}

export class IntentValidator {
	private readonly intentsFileName = "active_intents.yaml"

	private async readIntentSpec(cwd: string): Promise<ActiveIntentSpec> {
		const intentPath = path.join(cwd, this.intentsFileName)
		const raw = await fs.readFile(intentPath, "utf8")
		const parsed = YAML.parse(raw) as ActiveIntentSpec | undefined
		return parsed ?? {}
	}

	private isPathInOwnedScope(cwd: string, targetPath: string, scopes: string[]): boolean {
		const normalizedTarget = path.resolve(targetPath).replace(/\\/g, "/").replace(/\/+$/, "")
		return scopes.some((scope) => {
			const normalizedScope = path.resolve(cwd, normalizeScope(scope)).replace(/\\/g, "/").replace(/\/+$/, "")
			return normalizedTarget === normalizedScope || normalizedTarget.startsWith(`${normalizedScope}/`)
		})
	}

	private getTargetPathFromToolParams(
		cwd: string,
		toolName: string,
		params: Partial<Record<ToolParamName, string>>,
	): string | undefined {
		const directPath = params.path || params.file_path || (toolName === "execute_command" ? params.cwd : undefined)

		if (!directPath) {
			return undefined
		}

		return path.resolve(cwd, directPath)
	}

	async validate(
		cwd: string,
		toolName: string,
		params: Partial<Record<ToolParamName, string>>,
	): Promise<IntentValidationResult> {
		try {
			const spec = await this.readIntentSpec(cwd)
			const intentId = spec.active_intent_id?.trim()
			const selectedIntentId = params.intent_id?.trim()

			if (!intentId) {
				return { allowed: false, reason: "No active intent ID found in active_intents.yaml" }
			}

			if (selectedIntentId && selectedIntentId !== intentId) {
				return {
					allowed: false,
					reason: `Selected intent '${selectedIntentId}' does not match active_intents.yaml active_intent_id '${intentId}'`,
					intentId,
				}
			}

			const scope = (spec.owned_scope ?? []).map((entry) => entry.trim()).filter(Boolean)
			if (scope.length === 0) {
				return {
					allowed: false,
					reason: "No owned_scope entries found in active_intents.yaml",
					intentId,
				}
			}

			const targetPath = this.getTargetPathFromToolParams(cwd, toolName, params)
			if (!targetPath) {
				// If a tool does not target an explicit path, we keep skeleton behavior permissive.
				return { allowed: true, reason: "No explicit target path to scope-check", intentId }
			}

			if (!this.isPathInOwnedScope(cwd, targetPath, scope)) {
				return {
					allowed: false,
					reason: `Target path '${targetPath}' is outside owned_scope`,
					intentId,
				}
			}

			return { allowed: true, reason: "Path is within owned_scope", intentId }
		} catch (error) {
			return {
				allowed: false,
				reason: `Intent validation failed: ${error instanceof Error ? error.message : String(error)}`,
			}
		}
	}
}
