import { experiments, EXPERIMENT_IDS } from "../../../shared/experiments"

export function getSharedToolUseSection(experimentFlags?: Record<string, boolean>): string {
	// Check if multiple native tool calls is enabled via experiment
	const isMultipleNativeToolCallsEnabled = experiments.isEnabled(
		experimentFlags ?? {},
		EXPERIMENT_IDS.MULTIPLE_NATIVE_TOOL_CALLS,
	)

	const toolUseGuidance = isMultipleNativeToolCallsEnabled
		? " You must call at least one tool per assistant response. Prefer calling as many tools as are reasonably needed in a single response to reduce back-and-forth and complete tasks faster."
		: " You must use exactly one tool call per assistant response. Do not call zero tools or more than one tool in the same response."

	return `====

TOOL USE

You have access to a set of tools that are executed upon the user's approval. Use the provider-native tool-calling mechanism. Do not include XML markup or examples.${toolUseGuidance}`
}
