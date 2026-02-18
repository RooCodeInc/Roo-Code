// src/hooks/postWriteHook.ts
import { HookContext } from "./hookEngine"

export async function postWriteHook(ctx: HookContext) {
	// TODO: compute content hash and write to agent_trace.jsonl
	return ctx
}
