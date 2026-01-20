import { experiments, EXPERIMENT_IDS } from "../../../shared/experiments"

export function getToolUseGuidelinesSection(experimentFlags?: Record<string, boolean>): string {
	// Build guidelines array with automatic numbering
	let itemNumber = 1
	const guidelinesList: string[] = []

	// First guideline is always the same
	guidelinesList.push(
		`${itemNumber++}. Assess what information you already have and what information you need to proceed with the task.`,
	)

	guidelinesList.push(
		`${itemNumber++}. Choose the most appropriate tool based on the task and the tool descriptions provided. Assess if you need additional information to proceed, and which of the available tools would be most effective for gathering this information. For example using the list_files tool is more effective than running a command like \`ls\` in the terminal. It's critical that you think about each available tool and use the one that best fits the current step in the task.`,
	)

	// Native-only guidelines.
	// Check if multiple native tool calls is enabled via experiment.
	const isMultipleNativeToolCallsEnabled = experiments.isEnabled(
		experimentFlags ?? {},
		EXPERIMENT_IDS.MULTIPLE_NATIVE_TOOL_CALLS,
	)

	if (isMultipleNativeToolCallsEnabled) {
		guidelinesList.push(
			`${itemNumber++}. If multiple actions are needed, you may use multiple tools in a single message when appropriate, or use tools iteratively across messages. Each tool use should be informed by the results of previous tool uses. Do not assume the outcome of any tool use. Each step must be informed by the previous step's result.`,
		)
	} else {
		guidelinesList.push(
			`${itemNumber++}. If multiple actions are needed, use one tool at a time per message to accomplish the task iteratively, with each tool use being informed by the result of the previous tool use. Do not assume the outcome of any tool use. Each step must be informed by the previous step's result.`,
		)
	}
	// Only add the per-tool confirmation guideline when NOT using multiple tool calls.
	// When multiple tool calls are enabled, results may arrive batched (after all tools),
	// so "after each tool use" would contradict the batching behavior.
	if (!isMultipleNativeToolCallsEnabled) {
		guidelinesList.push(`${itemNumber++}. After each tool use, the user will respond with the result of that tool use. This result will provide you with the necessary information to continue your task or make further decisions. This response may include:
	 - Information about whether the tool succeeded or failed, along with any reasons for failure.
	 - Linter errors that may have arisen due to the changes you made, which you'll need to address.
	 - New terminal output in reaction to the changes, which you may need to consider or act upon.
	 - Any other relevant feedback or information related to the tool use.`)
	}

	// Only add the "wait for confirmation" guideline when NOT using multiple tool calls.
	// With multiple tool calls enabled, the model is expected to batch tools and get results together.
	if (!isMultipleNativeToolCallsEnabled) {
		guidelinesList.push(
			`${itemNumber++}. ALWAYS wait for user confirmation after each tool use before proceeding. Never assume the success of a tool use without explicit confirmation of the result from the user.`,
		)
	}

	// Join guidelines and add the footer
	const footer = isMultipleNativeToolCallsEnabled
		? `\n\nBy carefully considering the user's response after tool executions, you can react accordingly and make informed decisions about how to proceed with the task. This iterative process helps ensure the overall success and accuracy of your work.`
		: `\n\nIt is crucial to proceed step-by-step, waiting for the user's message after each tool use before moving forward with the task. This approach allows you to:
1. Confirm the success of each step before proceeding.
2. Address any issues or errors that arise immediately.
3. Adapt your approach based on new information or unexpected results.
4. Ensure that each action builds correctly on the previous ones.

By waiting for and carefully considering the user's response after each tool use, you can react accordingly and make informed decisions about how to proceed with the task. This iterative process helps ensure the overall success and accuracy of your work.`

	return `# Tool Use Guidelines

${guidelinesList.join("\n")}${footer}`
}
