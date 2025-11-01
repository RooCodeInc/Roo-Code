import type { ToolSpec } from "../../../api/transform/tool-converters"

/**
 * Tool specification for run_slash_command
 * This defines the schema for executing slash commands
 */
export const runSlashCommandToolSpec: ToolSpec = {
	name: "run_slash_command",
	description:
		"Execute a slash command to get specific instructions or content. Slash commands are predefined templates that provide detailed guidance for common tasks.",
	parameters: [
		{
			name: "command",
			type: "string",
			required: true,
			description: 'The name of the slash command to execute (e.g., "init", "test", "deploy")',
		},
		{
			name: "args",
			type: "string",
			required: false,
			description: "Additional arguments or context to pass to the command",
		},
	],
}
