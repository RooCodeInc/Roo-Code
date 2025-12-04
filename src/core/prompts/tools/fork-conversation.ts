import { ToolArgs } from "./types"

export function getForkConversationDescription(args: ToolArgs): string | undefined {
	// Fork conversation is available in all modes
	return `## fork_conversation

Description: Fork the current conversation at a specific point, creating a new independent task with its own workspace copy. This allows exploring "what if" scenarios without affecting the original conversation and files.

Parameters:
- message_index: (optional) The index of the message to fork from (0-based). If not provided, forks from the current point.
- target_directory: (optional) The path where the forked workspace should be created. If not provided, creates a timestamped directory next to the current workspace.

Usage:
<fork_conversation>
<message_index>5</message_index>
<target_directory>/path/to/forked-workspace</target_directory>
</fork_conversation>

Notes:
- Creates a complete copy of the workspace files (excluding common ignore patterns like node_modules, .git, etc.)
- The forked task is completely independent - changes don't affect the original
- Both the original and forked tasks can continue independently
- Useful for exploring alternative approaches or troubleshooting without contaminating the main context`
}
