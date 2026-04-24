import type OpenAI from "openai"

const MUTATION_CLASS_ENUM = ["AST_REFACTOR", "INTENT_EVOLUTION", "NEW_FILE"] as const

const WRITE_TO_FILE_DESCRIPTION = `Request to write content to a file. This tool is primarily used for creating new files or for scenarios where a complete rewrite of an existing file is intentionally required. If the file exists, it will be overwritten. If it doesn't exist, it will be created. This tool will automatically create any directories needed to write the file.

**Important:** You should prefer using other editing tools over write_to_file when making changes to existing files, since write_to_file is slower and cannot handle large files. Use write_to_file primarily for new file creation.

When using this tool, use it directly with the desired content. You do not need to display the content before using the tool. ALWAYS provide the COMPLETE file content in your response. This is NON-NEGOTIABLE. Partial updates or placeholders like '// rest of code unchanged' are STRICTLY FORBIDDEN. Failure to do so will result in incomplete or broken code.

When creating a new project, organize all new files within a dedicated project directory unless the user specifies otherwise. Structure the project logically, adhering to best practices for the specific type of project being created.

**Traceability:** You MUST provide intent_id (the active intent from select_active_intent) and mutation_class:
- AST_REFACTOR: Syntax/structural change, same intent (e.g. rename, format, extract function).
- INTENT_EVOLUTION: New feature or behavior change tied to the intent.
- NEW_FILE: Creating a file that did not exist before.

Example: Writing a configuration file
{ "path": "frontend-config.json", "content": "{\\n  \\"apiEndpoint\\": \\"https://api.example.com\\",\\n  \\"theme\\": {\\n    \\"primaryColor\\": \\"#007bff\\"\\n  }\\n}", "intent_id": "INT-001", "mutation_class": "INTENT_EVOLUTION" }`

const PATH_PARAMETER_DESCRIPTION = `The path of the file to write to (relative to the current workspace directory)`

const CONTENT_PARAMETER_DESCRIPTION = `The content to write to the file. ALWAYS provide the COMPLETE intended content of the file, without any truncation or omissions. You MUST include ALL parts of the file, even if they haven't been modified. Do NOT include line numbers in the content.`

const INTENT_ID_DESCRIPTION = `The ID of the active intent (from select_active_intent) that this write serves. Required for traceability.`

const MUTATION_CLASS_DESCRIPTION = `Semantic classification: AST_REFACTOR (syntax change, same intent), INTENT_EVOLUTION (new feature/behavior), or NEW_FILE (creating a new file).`

export default {
	type: "function",
	function: {
		name: "write_to_file",
		description: WRITE_TO_FILE_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: PATH_PARAMETER_DESCRIPTION,
				},
				content: {
					type: "string",
					description: CONTENT_PARAMETER_DESCRIPTION,
				},
				intent_id: {
					type: "string",
					description: INTENT_ID_DESCRIPTION,
				},
				mutation_class: {
					type: "string",
					enum: MUTATION_CLASS_ENUM,
					description: MUTATION_CLASS_DESCRIPTION,
				},
			},
			required: ["path", "content", "intent_id", "mutation_class"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
