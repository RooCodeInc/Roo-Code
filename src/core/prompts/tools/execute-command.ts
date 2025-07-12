import { ToolArgs } from "./types"

export function getExecuteCommandDescription(args: ToolArgs): string | undefined {
	return `## execute_command
Description: Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. For command chaining, use the appropriate chaining syntax for the user's shell. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Prefer relative commands and paths that avoid location sensitivity for terminal consistency, e.g: \`touch ./testdata/example.file\`, \`dir ./examples/model1/data/yaml\`, or \`go test ./cmd/front --config ./cmd/front/config.yml\`. If directed by the user, you may open a terminal in a different directory by using the \`cwd\` parameter.

**IMPORTANT: When executing commands that match common patterns (like npm, git, ls, etc.), you SHOULD provide suggestions for whitelisting. This allows users to auto-approve similar commands in the future.**

Parameters:
- command: (required) The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.
- cwd: (optional) The working directory to execute the command in (default: ${args.cwd})
- suggestions: (optional) An array of safe command patterns that the user can whitelist for automatic approval in the future. Each suggestion should be a pattern that can match similar commands. When the command matches common development patterns, you SHOULD include relevant suggestions. Format each suggestion using <suggest> tags.

**Whitelisting Guidelines:**
- Include suggestions when executing common development commands (npm, git, ls, cd, etc.)
- Suggestions use prefix matching: any command that starts with the suggestion will be auto-approved
- The special pattern "*" allows ALL commands (use with caution)
- Suggestions are case-insensitive (e.g., "npm " matches "NPM install", "npm test", etc.)
- Include a trailing space in suggestions to ensure proper prefix matching
- Common patterns to suggest:
  - "npm " for all npm commands
  - "git " for all git operations
  - "ls " for listing files
  - "cd " for changing directories
  - "echo " for echo commands
  - "mkdir " for creating directories
  - "rm -rf node_modules" for specific cleanup command
  - Language-specific patterns like "python ", "node ", "go test ", etc.
  - "*" to allow all commands (only suggest when explicitly requested by user)

Usage:
<execute_command>
<command>Your command here</command>
<cwd>Working directory path (optional)</cwd>
<suggestions>
<suggest>pattern 1</suggest>
<suggest>pattern 2</suggest>
</suggestions>
</execute_command>

Example: Requesting to execute npm run dev with suggestions
<execute_command>
<command>npm run dev</command>
<suggestions>
<suggest>npm run </suggest>
<suggest>npm </suggest>
</suggestions>
</execute_command>

Example: Requesting to execute git status with suggestions
<execute_command>
<command>git status</command>
<suggestions>
<suggest>git status</suggest>
<suggest>git *</suggest>
</suggestions>
</execute_command>

Example: Requesting to execute ls in a specific directory with suggestions
<execute_command>
<command>ls -la</command>
<cwd>/home/user/projects</cwd>
<suggestions>
<suggest>ls -la</suggest>
<suggest>ls </suggest>
</suggestions>
</execute_command>`
}
