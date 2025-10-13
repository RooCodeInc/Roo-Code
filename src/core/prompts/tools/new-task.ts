import { ToolArgs } from "./types"

/**
 * Prompt when todos are NOT required (default)
 */
const PROMPT_WITHOUT_TODOS = `## new_task
Description: This will let you create a new task instance in the chosen mode using your provided message.

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

**When to Use:**
- You need to **switch modes** for different phases of work (e.g., architect → code → test → debug)
- The task has clearly **separated stages** that benefit from isolated contexts
- You need **independent context** for a subtask (separate conversation history and state)
- The subtask is **complex enough** to warrant its own task management and tracking
- You want to **delegate** a well-defined piece of work with clear boundaries
- Different parts of the work require **different expertise or approaches** (design vs implementation vs testing)

**When NOT to Use:**
- The work can be completed in the **current mode** without switching
- All steps naturally **share the same context** and conversation flow
- The task is **simple** and can be tracked with update_todo_list
- You just need to **organize steps** within the current task
- Creating a subtask would add unnecessary overhead

**Comparison with update_todo_list:**
- Use \`update_todo_list\`: For step-by-step tracking within the same mode and context
- Use \`new_task\`: For creating separate task instances with different modes or isolated contexts

**Best Practice - Hybrid Approach:**
Combine both tools for maximum effectiveness:
1. Use \`new_task\` to break down complex work into phase-based subtasks (e.g., "Design API", "Implement API", "Test API")
2. Within each subtask, use \`update_todo_list\` to track detailed progress steps
3. This provides both high-level task separation and fine-grained progress tracking

`

/**
 * Prompt when todos ARE required
 */
const PROMPT_WITH_TODOS = `## new_task
Description: This will let you create a new task instance in the chosen mode using your provided message and initial todo list.

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

**When to Use:**
- You need to **switch modes** for different phases of work (e.g., architect → code → test → debug)
- The task has clearly **separated stages** that benefit from isolated contexts
- You need **independent context** for a subtask (separate conversation history and state)
- The subtask is **complex enough** to warrant its own task management and tracking
- You want to **delegate** a well-defined piece of work with clear boundaries
- Different parts of the work require **different expertise or approaches** (design vs implementation vs testing)

**When NOT to Use:**
- The work can be completed in the **current mode** without switching
- All steps naturally **share the same context** and conversation flow
- The task is **simple** and can be tracked with update_todo_list
- You just need to **organize steps** within the current task
- Creating a subtask would add unnecessary overhead

**Comparison with update_todo_list:**
- Use \`update_todo_list\`: For step-by-step tracking within the same mode and context
- Use \`new_task\`: For creating separate task instances with different modes or isolated contexts

**Best Practice - Hybrid Approach:**
Combine both tools for maximum effectiveness:
1. Use \`new_task\` to break down complex work into phase-based subtasks (e.g., "Design API", "Implement API", "Test API")
2. Within each subtask, use \`update_todo_list\` to track detailed progress steps
3. This provides both high-level task separation and fine-grained progress tracking

`

export function getNewTaskDescription(args: ToolArgs): string {
	const todosRequired = args.settings?.newTaskRequireTodos === true

	// Simply return the appropriate prompt based on the setting
	return todosRequired ? PROMPT_WITH_TODOS : PROMPT_WITHOUT_TODOS
}
