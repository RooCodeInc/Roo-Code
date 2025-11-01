import type { ToolSpec } from "../../../api/transform/tool-converters"

/**
 * Tool specification for new_task
 * This defines the schema for creating new task instances
 */
export const newTaskToolSpec: ToolSpec = {
	name: "new_task",
	description: "This will let you create a new task instance in the chosen mode using your provided message.",
	parameters: [
		{
			name: "mode",
			type: "string",
			required: true,
			description: 'The slug of the mode to start the new task in (e.g., "code", "debug", "architect").',
		},
		{
			name: "message",
			type: "string",
			required: true,
			description: "The initial user message or instructions for this new task.",
		},
	],
}
