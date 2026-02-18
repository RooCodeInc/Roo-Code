// src/hooks/preLlmHook.ts
import type { HookContext } from "./hookEngine"

export async function preLlmHook(ctx: HookContext) {
	// TODO: implement two-stage handshake: enforce select_active_intent
	return ctx
}
