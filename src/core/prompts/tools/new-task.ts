import { ToolArgs } from "./types"

/**
 * Prompt when todos are NOT required (default)
 */
const PROMPT_WITHOUT_TODOS = `<tool name="new_task">
<description>This will let you create a new task instance in the chosen mode using your provided message.</description>

Parameters:
- mode: (required) The slug of the mode to start the new task in (e.g., "code", "debug", "architect").
- message: (required) The initial user message or instructions for this new task.

Usage:
<new_task>
<mode>your-mode-slug-here</mode>
<message>Your initial instructions here</message>
</new_task>

Example:
<new_task>
<mode>code</mode>
<message>Implement a new feature for the application</message>
</new_task>

</tool>`

/**
 * Prompt when todos ARE required
 */
const PROMPT_WITH_TODOS = `<tool name="new_task">
<description>This will let you create a new task instance in the chosen mode using your provided message and initial todo list.</description>

Parameters:
- mode: (required) The slug of the mode to start the new task in (e.g., "code", "debug", "architect").
- message: (required) The initial user message or instructions for this new task.
- todos: (required) The initial todo list in markdown checklist format for the new task.

Usage:
<new_task>
<mode>your-mode-slug-here</mode>
<message>Your initial instructions here</message>
<todos>
[ ] First task to complete
[ ] Second task to complete
[ ] Third task to complete
</todos>
</new_task>

Example:
<new_task>
<mode>code</mode>
<message>Implement user authentication</message>
<todos>
[ ] Set up auth middleware
[ ] Create login endpoint
[ ] Add session management
[ ] Write tests
</todos>
</new_task>

</tool>`

export function getNewTaskDescription(args: ToolArgs): string {
	const todosRequired = args.settings?.newTaskRequireTodos === true

	// Simply return the appropriate prompt based on the setting
	return todosRequired ? PROMPT_WITH_TODOS : PROMPT_WITHOUT_TODOS
}
