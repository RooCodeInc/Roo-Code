---
description: Learn how update_todo_list creates dynamic TODO lists with status tracking, enabling step-by-step task management for complex workflows in Roo Code.
keywords:
    - update_todo_list
    - Roo Code tools
    - task management
    - TODO lists
    - workflow tracking
    - checklist management
    - task status
    - interactive UI
    - VS Code AI
image: /img/social-share.jpg
---

# update_todo_list

The `update_todo_list` tool enables dynamic, interactive task management within the chat interface. It replaces the entire TODO list with an updated checklist, ensuring that task status is always current and providing step-by-step tracking for complex, multi-step workflows.

---

## Parameters

The tool accepts these parameters:

- `todos` (required): A markdown-formatted string representing the complete checklist with status indicators

---

## What It Does

This tool creates and manages an interactive todo list that appears as a UI component in the chat interface. It allows for real-time task tracking, status updates, and dynamic addition of new items as they are discovered during complex workflows. The list provides a structured way to manage multi-step tasks with clear visual progress indicators.

---

## When is it used?

- When managing complex, multi-step tasks that benefit from structured tracking
- When Roo needs to show progress through a series of related activities
- When tasks require step-by-step completion verification before proceeding
- When new actionable items are discovered during long or complex workflows
- When providing clear checkpoints and progress visibility to users

---

## Key Features

- **Full Checklist Replacement**: Overwrites the existing todo list with the updated version provided
- **Interactive UI Component**: Displays as an editable interface element in the chat
- **Multiple Status Types**: Supports pending, in-progress, and completed task states
- **Dynamic Task Management**: Add new tasks as they arise during workflow execution
- **User-Friendly Editing**: Provides direct editing capabilities within the chat interface
- **Step-by-Step Tracking**: Enables confirmation of each step before updating and proceeding
- **Progress Visualization**: Clear visual indicators for task completion status
- **Workflow Integration**: Seamlessly integrates with task execution and completion flows

---

## Limitations

- **Complete Replacement**: Replaces the entire list rather than making incremental updates
- **Single-Level Structure**: Uses single-level markdown checklists without nesting support
- **Format Requirements**: Requires specific markdown checkbox syntax for proper parsing
- **Manual Updates**: Requires explicit tool calls to update the list status
- **State Management**: Todo list state is tied to the current task and conversation context

---

## How It Works

When the `update_todo_list` tool is invoked, it follows this process:

1. **Input Validation**:

    - Validates the required `todos` parameter is provided
    - Parses the markdown checklist format for syntax correctness
    - Checks for valid status indicators: `[ ]`, `[-]`, and `[x]`

2. **List Processing**:

    - Processes the markdown-formatted checklist
    - Extracts individual todo items with their status indicators
    - Validates the structure and format of each item

3. **UI Integration**:

    - Presents the updated todo list to the user for approval
    - Replaces any existing todo list with the new version
    - Renders the list as an interactive component in the chat interface

4. **User Interaction**:

    - Allows users to edit todos directly in the UI when in editing mode
    - Provides "Add Todo" functionality for real-time list expansion
    - Synchronizes changes back to the extension to maintain state consistency

5. **State Management**:
    - Updates the task's internal todo list representation
    - Maintains synchronization between UI state and backend data
    - Preserves todo list state across conversation interactions

---

## Checklist Format Requirements

The tool uses a specific markdown format for todo items:

### Status Options

- `[ ]` - Pending task (not started)
- `[-]` - In progress task (currently being worked on)
- `[x]` - Completed task (fully finished)

### Format Rules

- Use single-level markdown checklist (no nesting or subtasks)
- List todos in intended execution order
- Each todo item should be clear and actionable
- Status should accurately reflect current task state

---

## Task Management Guidelines

### Status Updates

- Mark tasks as completed immediately after all work is finished
- Start the next task by marking it as in progress
- Use pending status for tasks not yet started
- Only mark tasks as completed when fully accomplished with no unresolved dependencies

### Dynamic List Management

- Add new todos as soon as they are identified during task execution
- Remove tasks only if they are no longer relevant or explicitly requested
- Retain all unfinished tasks and update their status as needed
- If a task is blocked, keep it as in progress and add new todos for resolution steps

---

## Examples When Used

- When developing a web application, Roo creates a todo list tracking design, implementation, testing, and deployment phases.
- When setting up a development environment, Roo tracks installation of dependencies, configuration steps, and verification tasks.
- When debugging complex issues, Roo maintains a list of investigation steps, potential causes, and testing procedures.
- When refactoring code, Roo tracks which files need updates, what tests need modification, and documentation changes required.
- When implementing new features, Roo manages tasks for planning, coding, testing, and integration steps.

---

## Usage Examples

Creating an initial todo list for a development task:

```xml
<update_todo_list>
<todos>
[ ] Analyze requirements
[ ] Design architecture
[ ] Implement core logic
[ ] Write tests
[ ] Update documentation
</todos>
</update_todo_list>
```

Updating progress after completing the first task:

```xml
<update_todo_list>
<todos>
[x] Analyze requirements
[-] Design architecture
[ ] Implement core logic
[ ] Write tests
[ ] Update documentation
</todos>
</update_todo_list>
```

Adding new tasks discovered during implementation:

```xml
<update_todo_list>
<todos>
[x] Analyze requirements
[x] Design architecture
[x] Implement core logic
[-] Write tests
[ ] Update documentation
[ ] Add performance benchmarks
[ ] Create deployment script
</todos>
</update_todo_list>
```

Managing a complex debugging workflow:

```xml
<update_todo_list>
<todos>
[x] Reproduce the issue
[x] Check recent code changes
[-] Analyze error logs
[ ] Test with different configurations
[ ] Check database queries
[ ] Verify network connectivity
[ ] Create fix and test
</todos>
</update_todo_list>
```
