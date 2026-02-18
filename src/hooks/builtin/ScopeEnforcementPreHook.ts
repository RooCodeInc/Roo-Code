import * as fs from "fs"
import * as path from "path"

import { parse as parseYaml } from "yaml"

import { HookContext, HookDecision, PreToolHook } from "../types"

interface ActiveIntent {
	id: string
	name: string
	status: string
	owned_scope: string[]
	constraints?: string[]
	acceptance_criteria?: string[]
}

interface IntentsFile {
	active_intents: ActiveIntent[]
}

const WRITE_TOOLS = new Set(["write_to_file", "apply_diff", "edit_file", "apply_patch", "search_replace"])

/**
 * Matches a relative file path against a glob-like scope pattern.
 * Supports the `**` wildcard for directory segments and `*` for filename segments.
 */
function matchesScope(filePath: string, pattern: string): boolean {
	// Normalize separators.
	const normalizedPath = filePath.replace(/\\/g, "/")
	const normalizedPattern = pattern.replace(/\\/g, "/")

	// Convert glob pattern to a regex.
	const regexStr = normalizedPattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&") // escape regex special chars
		.replace(/\*\*/g, "§DOUBLESTAR§") // placeholder for **
		.replace(/\*/g, "[^/]*") // * matches within a segment
		.replace(/§DOUBLESTAR§/g, ".*") // ** matches across segments

	const regex = new RegExp(`^${regexStr}$`)
	return regex.test(normalizedPath)
}

export class ScopeEnforcementPreHook implements PreToolHook {
	name = "scope-enforcement-pre-hook"

	async run(context: HookContext): Promise<HookDecision> {
		if (!WRITE_TOOLS.has(context.toolName)) {
			return { allow: true }
		}

		const intentId = context.toolArgs["intent_id"] as string | undefined
		if (!intentId) {
			// RequireIntentPreHook handles the missing-intent case — skip here.
			return { allow: true }
		}

		const cwd = context.cwd ?? process.cwd()
		const intentsPath = path.join(cwd, ".orchestration", "active_intents.yaml")

		let intentsFile: IntentsFile
		try {
			const raw = await fs.promises.readFile(intentsPath, "utf-8")
			intentsFile = parseYaml(raw) as IntentsFile
		} catch {
			// No sidecar file — allow without scope check.
			return { allow: true }
		}

		const intent = intentsFile.active_intents?.find((i) => i.id === intentId)
		if (!intent) {
			return {
				allow: false,
				code: "SCOPE_VIOLATION",
				reason: `Intent '${intentId}' not found in active_intents.yaml. Use a valid active intent ID.`,
			}
		}

		const targetPath = context.toolArgs["path"] as string | undefined
		if (!targetPath) {
			return { allow: true }
		}

		const relPath = path.relative(cwd, path.resolve(cwd, targetPath)).replace(/\\/g, "/")
		const scope = intent.owned_scope ?? []

		const inScope = scope.length === 0 || scope.some((pattern) => matchesScope(relPath, pattern))

		if (!inScope) {
			return {
				allow: false,
				code: "SCOPE_VIOLATION",
				reason:
					`Scope Violation: Intent '${intentId}' (${intent.name}) is not authorized to edit '${relPath}'. ` +
					`Authorized scope: [${scope.join(", ")}]. ` +
					`Request a scope expansion or select the correct intent.`,
			}
		}

		return { allow: true, contextPatch: { scope_validated: true, intent_name: intent.name } }
	}
}
