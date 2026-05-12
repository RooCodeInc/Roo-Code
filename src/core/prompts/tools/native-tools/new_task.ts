import type OpenAI from "openai"

const NEW_TASK_DESCRIPTION = `Create a new task instance in the chosen mode using your provided message and initial todo list (if required).

CRITICAL: This tool MUST be called alone. Do NOT call this tool alongside other tools in the same message turn. If you need to gather information before delegating, use other tools in a separate turn first, then call new_task by itself in the next turn.

SEQUENTIAL FAN-OUT: You can optionally provide a task_queue parameter to define additional subtasks that will execute automatically in sequence after the first subtask completes. Each queued subtask runs one after another without returning to the parent in between, saving time and API calls. Use this when you have planned multiple independent subtasks upfront. The first subtask is defined by the mode and message parameters; subsequent subtasks are defined in the task_queue array.`

const MODE_PARAMETER_DESCRIPTION = `Slug of the mode to begin the new task in (e.g., code, debug, architect)`

const MESSAGE_PARAMETER_DESCRIPTION = `Initial user instructions or context for the new task`

const TODOS_PARAMETER_DESCRIPTION = `Optional initial todo list written as a markdown checklist; required when the workspace mandates todos`

const TASK_QUEUE_PARAMETER_DESCRIPTION = `Optional JSON array of additional subtasks to execute sequentially after the first subtask completes. Each element is an object with "mode" (string) and "message" (string). Example: [{"mode":"code","message":"Implement feature X"},{"mode":"debug","message":"Test feature X"}]. When provided, the system automatically transitions between subtasks without returning to the parent, collecting all results. The parent receives aggregated results when the entire queue completes.`
const PERMISSIONS_PARAMETER_DESCRIPTION = `Optional JSON object defining permission boundaries for the subtask. Allows the parent to restrict the subtask's access. Supports: filePatterns (array of regex patterns for allowed file paths), commandPatterns (array of regex patterns for allowed commands), allowedTools (array of tool names the subtask may use), deniedTools (array of tool names the subtask may NOT use). Example: {"filePatterns":["src/components/.*"],"commandPatterns":["npm test.*"],"deniedTools":["execute_command"]}`

export default {
	type: "function",
	function: {
		name: "new_task",
		description: NEW_TASK_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				mode: {
					type: "string",
					description: MODE_PARAMETER_DESCRIPTION,
				},
				message: {
					type: "string",
					description: MESSAGE_PARAMETER_DESCRIPTION,
				},
				todos: {
					type: ["string", "null"],
					description: TODOS_PARAMETER_DESCRIPTION,
				},
				task_queue: {
					type: ["string", "null"],
					description: TASK_QUEUE_PARAMETER_DESCRIPTION,
				},
				permissions: {
					type: ["string", "null"],
					description: PERMISSIONS_PARAMETER_DESCRIPTION,
				},
			},
			required: ["mode", "message", "todos"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
