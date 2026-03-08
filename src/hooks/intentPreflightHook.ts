import { INVALID_ACTIVE_INTENT_ERROR, loadIntentContext } from "../core/intent/IntentContextLoader"

import type { IntentHookContext, HookResult } from "./types"

export async function runIntentPreflightHook(context: IntentHookContext): Promise<HookResult> {
	const activeIntentId = String(context.activeIntentId ?? "").trim()
	if (!activeIntentId) {
		return {
			ok: false,
			error: INVALID_ACTIVE_INTENT_ERROR,
		}
	}

	try {
		const intentContext = await loadIntentContext(context.workspaceRoot, activeIntentId)
		if (!intentContext) {
			return {
				ok: false,
				error: INVALID_ACTIVE_INTENT_ERROR,
			}
		}

		return { ok: true }
	} catch {
		return {
			ok: false,
			error: INVALID_ACTIVE_INTENT_ERROR,
		}
	}
}
