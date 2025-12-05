import type OpenAI from "openai"

const buildDescription = (enableScriptMode: boolean) => `Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. For command chaining, use the appropriate chaining syntax for the user's shell. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Prefer relative commands and paths that avoid location sensitivity for terminal consistency.${
	enableScriptMode
		? " On Windows you can also provide a script body when the command would be too long or hard to escape (percent signs in cmd, nested quotes, here-strings): supply the script text via script_content and the interpreter/shell via script_runner; Roo will write it to a temporary file, run it, and remove it."
		: ""
}

Parameters:
- command: (required unless script_content is used) The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.
- cwd: (optional) The working directory to execute the command in${
	enableScriptMode
		? `
- script_content: (Windows-only, optional) The full text of the script to run when the command would be too long or requires heavy quoting. Do not pass arguments separately—put them in the script. Use multi-line text (here-strings) to avoid escaping percent signs and quotes.
- script_runner: (Windows-only, optional) The interpreter or shell to execute the temporary script file (e.g., powershell.exe, cmd.exe, python).`
		: ""
}

Example: Executing npm run dev
{ "command": "npm run dev", "cwd": null }

Example: Executing ls in a specific directory if directed
{ "command": "ls -la", "cwd": "/home/user/projects" }${
	enableScriptMode
		? `

Example: Long script executed via temporary file on Windows
{ "script_content": "@'
Write-Output \"Hello\"
Write-Output \"Handles %PATH% safely\"
'@", "script_runner": "powershell.exe" }`
		: ""
}`

const COMMAND_PARAMETER_DESCRIPTION = `Shell command to execute`
const CWD_PARAMETER_DESCRIPTION = `Optional working directory for the command, relative or absolute`
const SCRIPT_CONTENT_DESCRIPTION = `Windows-only: script body to write into a temporary file when the command is too long or hard to escape (percent signs, nested quotes)`
const SCRIPT_RUNNER_DESCRIPTION = `Windows-only: program/shell that should run the temporary script file (e.g., powershell.exe, cmd.exe, python)`

export function getExecuteCommandTool(options: { enableScriptMode: boolean }): OpenAI.Chat.ChatCompletionTool {
	const properties: Record<string, any> = {
		command: {
			type: "string",
			description: COMMAND_PARAMETER_DESCRIPTION,
		},
		cwd: {
			type: ["string", "null"],
			description: CWD_PARAMETER_DESCRIPTION,
		},
	}

	if (options.enableScriptMode) {
		properties["script_content"] = {
			type: "string",
			description: SCRIPT_CONTENT_DESCRIPTION,
		}
		properties["script_runner"] = {
			type: "string",
			description: SCRIPT_RUNNER_DESCRIPTION,
		}
	}

	return {
		type: "function",
		function: {
			name: "execute_command",
			description: buildDescription(options.enableScriptMode),
			strict: true,
			parameters: {
				type: "object",
				properties,
				required: options.enableScriptMode ? [] : ["command"],
				additionalProperties: false,
				...(options.enableScriptMode
					? {
							oneOf: [
								{ required: ["command"] },
								{ required: ["script_content", "script_runner"] },
							],
						}
					: {}),
			},
		},
	} satisfies OpenAI.Chat.ChatCompletionTool
}
