import type { Experiments } from "@roo-code/types"

import { EXPERIMENT_IDS, experiments } from "../../../shared/experiments"

export function getToolUseGuidelinesSection(experimentsConfig?: Experiments): string {
	const reAnchorEnabled = experimentsConfig
		? experiments.isEnabled(experimentsConfig, EXPERIMENT_IDS.RE_ANCHOR_BEFORE_EDIT)
		: false

	const reAnchorGuideline = reAnchorEnabled
		? `
4. **Re-anchor before every file edit:** Before modifying any existing file, you MUST re-read the file (or the relevant section) using the read_file tool to confirm its current contents. This re-anchoring step is critical to avoid edits based on stale or hallucinated content. The re-read must happen immediately before the edit tool call, even if you have read the file earlier in the conversation. This applies to all file editing tools (apply_diff, edit_file, edit, search_replace, write_to_file for existing files, apply_patch for modifications). When the file is large, use read_file with an appropriate offset/limit or indentation mode to read the specific section you plan to modify. Skipping this step is the most common cause of failed edits.`
		: ""

	return `# Tool Use Guidelines

1. Assess what information you already have and what information you need to proceed with the task.
2. Choose the most appropriate tool based on the task and the tool descriptions provided. Assess if you need additional information to proceed, and which of the available tools would be most effective for gathering this information. For example using the list_files tool is more effective than running a command like \`ls\` in the terminal. It's critical that you think about each available tool and use the one that best fits the current step in the task.
3. If multiple actions are needed, you may use multiple tools in a single message when appropriate, or use tools iteratively across messages. Each tool use should be informed by the results of previous tool uses. Do not assume the outcome of any tool use. Each step must be informed by the previous step's result.${reAnchorGuideline}

By carefully considering the user's response after tool executions, you can react accordingly and make informed decisions about how to proceed with the task. This iterative process helps ensure the overall success and accuracy of your work.`
}
