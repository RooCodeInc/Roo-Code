import type { ToolSpec } from "../../../api/transform/tool-converters"

/**
 * Tool specification for fetch_instructions
 * This defines the schema for fetching task-specific instructions
 */
export const fetchInstructionsToolSpec: ToolSpec = {
	name: "fetch_instructions",
	description: "Request to fetch instructions to perform a task",
	parameters: [
		{
			name: "task",
			type: "string",
			required: true,
			description: "The task to get instructions for. This can take the following values:\n  create_mode",
		},
	],
}
