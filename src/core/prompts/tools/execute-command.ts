import { ToolArgs } from "./types"

export function getExecuteCommandDescription(args: ToolArgs): string | undefined {
	const isWindows = args.settings?.isWindows ?? args.isWindows ?? process.platform === "win32"
	const scriptModeEnabled = isWindows && (args.settings?.windowsScriptExecutionEnabled ?? true)

	const base = `## execute_command
Description: Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. For command chaining, use the appropriate chaining syntax for the user's shell. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Prefer relative commands and paths that avoid location sensitivity for terminal consistency, e.g: \`touch ./testdata/example.file\`, \`dir ./examples/model1/data/yaml\`, or \`go test ./cmd/front --config ./cmd/front/config.yml\`. If directed by the user, you may open a terminal in a different directory by using the \`cwd\` parameter.
Parameters:
- command: (required) The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.
- cwd: (optional) The working directory to execute the command in (default: ${args.cwd})
Usage:
<execute_command>
<command>Your command here</command>
<cwd>Working directory path (optional)</cwd>
</execute_command>

Example: Requesting to execute npm run dev
<execute_command>
<command>npm run dev</command>
</execute_command>

Example: Requesting to execute ls in a specific directory if directed
<execute_command>
<command>ls -la</command>
<cwd>/home/user/projects</cwd>
</execute_command>`

	if (!scriptModeEnabled) {
		return base
	}

	return `${base}

Windows-only script mode for long inputs:
- If the command would exceed Windows command-length limits or is heavy on quotes/percent signs (cmd expands %VAR% and requires %% inside FOR), send the script body in \`script_content\` and the interpreter/shell in \`script_runner\` (for example \`powershell.exe\`, \`cmd.exe\`, \`python\`).
- Roo will write the script to a temporary file, run it with the provided runner, and delete the file automatically. Do not provide filenames, args, or env separately—put everything needed inside the script body.
- Use multi-line bodies (here-strings) instead of one giant inline command to avoid escaping issues, especially with cmd percent signs and PowerShell quotes.

Example: Running a long PowerShell snippet
<execute_command>
<script_content>@'
Write-Output "Hello from script"
Write-Output "Another line without needing to escape % or quotes"
'@</script_content>
<script_runner>powershell.exe</script_runner>
</execute_command>`
}
