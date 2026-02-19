// src/tools/intentTools.ts
import { HookEngine } from "../hooks/hookEngine"

export const selectActiveIntent = (args: { intent_id: string }) => {
	const hook = new HookEngine("")
	return hook.preHook("select_active_intent", args)
}
