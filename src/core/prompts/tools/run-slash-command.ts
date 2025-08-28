/**
 * Generates the run_slash_command tool description.
 */
export function getRunSlashCommandDescription(): string {
	return `## run_slash_command
Description: Execute a slash command to get specific instructions or content. Slash commands are predefined templates that provide detailed guidance for common tasks. Commands can be built-in, defined globally, or project-specific.

Parameters:
- command: (required) The name of the slash command to execute (e.g., "init", "test", "deploy")
- args: (optional) Additional arguments or context to pass to the command

Usage:
<run_slash_command>
<command>command_name</command>
<args>optional arguments</args>
</run_slash_command>

Examples:

1. Running the init command to analyze a codebase:
<run_slash_command>
<command>init</command>
</run_slash_command>

2. Running a command with additional context:
<run_slash_command>
<command>test</command>
<args>focus on integration tests</args>
</run_slash_command>

Note: Available commands depend on the project and global configuration. The tool will list available commands if an invalid command is specified. Commands can be:
- Built-in: Predefined commands like "init" for codebase analysis
- Global: Custom commands defined in ~/.roo/commands/
- Project: Project-specific commands defined in .roo/commands/

The command content will be returned for you to execute or follow as instructions.`
}
