import type { ToolSpec } from "../../../api/transform/tool-converters"

/**
 * Tool specification for update_todo_list
 * This defines the schema for updating the todo list
 */
export const updateTodoListToolSpec: ToolSpec = {
	name: "update_todo_list",
	description:
		"Replace the entire TODO list with an updated checklist reflecting the current state. Always provide the full list; the system will overwrite the previous one. This tool is designed for step-by-step task tracking, allowing you to confirm completion of each step before updating, update multiple task statuses at once (e.g., mark one as completed and start the next), and dynamically add new todos discovered during long or complex tasks.\n\nChecklist Format:\n- Use a single-level markdown checklist (no nesting or subtasks).\n- List todos in the intended execution order.\n- Status options:\n  - [ ] Task description (pending)\n  - [x] Task description (completed)\n  - [-] Task description (in progress)\n\nStatus Rules:\n- [ ] = pending (not started)\n- [x] = completed (fully finished, no unresolved issues)\n- [-] = in_progress (currently being worked on)",
	parameters: [
		{
			name: "todos",
			type: "string",
			required: true,
			description:
				"The complete markdown checklist with status indicators. Include all todos, both completed and pending.",
		},
	],
}
