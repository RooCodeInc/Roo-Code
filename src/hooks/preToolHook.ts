// src/hooks/preToolHook.ts
import { HookContext } from "./hookEngine"

export async function preToolHook(ctx: HookContext) {
	// TODO: classify safe vs destructive; enforce owned_scope
	return ctx
}
