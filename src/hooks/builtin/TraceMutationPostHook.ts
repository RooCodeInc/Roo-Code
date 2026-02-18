import { PostToolHook, PostToolHookContext } from "../types"

export class TraceMutationPostHook implements PostToolHook {
	name = "trace-mutation-post-hook"

	run(_context: PostToolHookContext): void {
		// Placeholder for Phase 2:
		// append normalized trace entry to .orchestration/agent_trace.jsonl
		// with content hashes and intent linkage.
	}
}
