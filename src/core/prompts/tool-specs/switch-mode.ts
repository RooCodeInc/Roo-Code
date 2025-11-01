import type { ToolSpec } from "../../../api/transform/tool-converters"

/**
 * Tool specification for switch_mode
 * This defines the schema for switching between modes
 */
export const switchModeToolSpec: ToolSpec = {
	name: "switch_mode",
	description:
		"Request to switch to a different mode. This tool allows modes to request switching to another mode when needed, such as switching to Code mode to make code changes. The user must approve the mode switch.",
	parameters: [
		{
			name: "mode_slug",
			type: "string",
			required: true,
			description: 'The slug of the mode to switch to (e.g., "code", "ask", "architect")',
		},
		{
			name: "reason",
			type: "string",
			required: false,
			description: "The reason for switching modes",
		},
	],
}
