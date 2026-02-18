import type { HookContext } from "./types"

const destructiveTools = new Set<string>([
	"apply_patch",
	"apply_diff",
	"edit",
	"edit_file",
	"search_and_replace",
	"search_replace",
	"write_to_file",
	"generate_image", // writes output to disk when path provided
	"execute_command", // may mutate filesystem indirectly
	"new_task", // spawns tasks; treat as governed
])

export function classifyTool(ctx: Pick<HookContext, "toolName">): HookContext["category"] {
	if (destructiveTools.has(ctx.toolName)) return "destructive"
	return "safe"
}
