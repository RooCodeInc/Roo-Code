import * as fs from "fs"
import * as path from "path"
import yaml from "js-yaml"
import { minimatch } from "minimatch"
import { PreHook } from "../interfaces"

export function scopeEnforcementPreHook(root: string): PreHook {
	return {
		async onPreWrite({ path: target, intentId }) {
			const data = yaml.load(
				fs.readFileSync(path.join(root, ".orchestration/active_intents.yaml"), "utf8"),
			) as any
			const intent = (data?.active_intents || []).find((i: any) => i.id === intentId)
			if (!intent) throw new Error(`Scope Enforcement: unknown intent ${intentId}`)
			const allowed = (intent.owned_scope || []).some((pattern: string) => minimatch(target, pattern))
			if (!allowed) {
				throw new Error(
					`Scope Violation: ${intentId} is not authorized to edit ${target}. Request scope expansion.`,
				)
			}
		},
	}
}
