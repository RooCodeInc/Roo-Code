import { getNewTaskDescription } from "../new-task"
import { ToolArgs } from "../types"

describe("getNewTaskDescription", () => {
	it("should NOT show todos parameter at all when setting is disabled", () => {
		const args: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			settings: {
				newTaskRequireTodos: false,
			},
		}

		const description = getNewTaskDescription(args)

		// Check that todos parameter is NOT shown at all
		expect(description).not.toContain("todos:")
		expect(description).not.toContain("todos parameter")
		expect(description).not.toContain("The initial todo list in markdown checklist format")

		// Should have a simple example without todos
		expect(description).toContain("Implement a new feature for the application")

		// Should NOT have any todos tags in examples
		expect(description).not.toContain("<todos>")
		expect(description).not.toContain("</todos>")

		// Should still have mode and message as required
		expect(description).toContain("mode: (required)")
		expect(description).toContain("message: (required)")
	})

	it("should show todos as required when setting is enabled", () => {
		const args: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			settings: {
				newTaskRequireTodos: true,
			},
		}

		const description = getNewTaskDescription(args)

		// Check that todos is marked as required
		expect(description).toContain("todos: (required)")
		expect(description).toContain("and initial todo list")
		expect(description).toContain("The initial todo list in markdown checklist format")

		// Should not contain any mention of optional for todos
		expect(description).not.toContain("todos: (optional)")
		expect(description).not.toContain("optional initial todo list")

		// Should include todos in the example
		expect(description).toContain("<todos>")
		expect(description).toContain("</todos>")
		expect(description).toContain("Set up auth middleware")
	})

	it("should NOT show todos parameter when settings is undefined", () => {
		const args: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			settings: undefined,
		}

		const description = getNewTaskDescription(args)

		// Check that todos parameter is NOT shown by default
		expect(description).not.toContain("todos:")
		expect(description).not.toContain("The initial todo list in markdown checklist format")
		expect(description).not.toContain("<todos>")
		expect(description).not.toContain("</todos>")
	})

	it("should NOT show todos parameter when newTaskRequireTodos is undefined", () => {
		const args: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			settings: {},
		}

		const description = getNewTaskDescription(args)

		// Check that todos parameter is NOT shown by default
		expect(description).not.toContain("todos:")
		expect(description).not.toContain("The initial todo list in markdown checklist format")
		expect(description).not.toContain("<todos>")
		expect(description).not.toContain("</todos>")
	})

	it("should include todos in examples only when setting is enabled", () => {
		const argsWithSettingOff: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			settings: {
				newTaskRequireTodos: false,
			},
		}

		const argsWithSettingOn: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			settings: {
				newTaskRequireTodos: true,
			},
		}

		const descriptionOff = getNewTaskDescription(argsWithSettingOff)
		const descriptionOn = getNewTaskDescription(argsWithSettingOn)

		// When setting is on, should include todos in main example
		expect(descriptionOn).toContain("Implement user authentication")
		expect(descriptionOn).toContain("[ ] Set up auth middleware")
		expect(descriptionOn).toContain("<todos>")
		expect(descriptionOn).toContain("</todos>")

		// When setting is off, should NOT include any todos references
		expect(descriptionOff).not.toContain("<todos>")
		expect(descriptionOff).not.toContain("</todos>")
		expect(descriptionOff).not.toContain("[ ] Set up auth middleware")
		expect(descriptionOff).not.toContain("[ ] First task to complete")

		// When setting is off, main example should be simple
		const usagePattern = /<new_task>\s*<mode>.*<\/mode>\s*<message>.*<\/message>\s*<\/new_task>/s
		expect(descriptionOff).toMatch(usagePattern)
	})

	it("should include usage guidance section in both versions", () => {
		const argsWithoutTodos: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			settings: {
				newTaskRequireTodos: false,
			},
		}

		const argsWithTodos: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			settings: {
				newTaskRequireTodos: true,
			},
		}

		const descriptionWithoutTodos = getNewTaskDescription(argsWithoutTodos)
		const descriptionWithTodos = getNewTaskDescription(argsWithTodos)

		// Both versions should contain "When to Use" section
		expect(descriptionWithoutTodos).toContain("**When to Use:**")
		expect(descriptionWithTodos).toContain("**When to Use:**")

		// Both should explain mode switching scenario
		expect(descriptionWithoutTodos).toContain("switch modes")
		expect(descriptionWithTodos).toContain("switch modes")

		// Both versions should contain "When NOT to Use" section
		expect(descriptionWithoutTodos).toContain("**When NOT to Use:**")
		expect(descriptionWithTodos).toContain("**When NOT to Use:**")

		// Both should warn against simple tasks
		expect(descriptionWithoutTodos).toContain("task is **simple**")
		expect(descriptionWithTodos).toContain("task is **simple**")

		// Both versions should contain comparison with update_todo_list
		expect(descriptionWithoutTodos).toContain("**Comparison with update_todo_list:**")
		expect(descriptionWithTodos).toContain("**Comparison with update_todo_list:**")

		// Both should mention TODO list system
		expect(descriptionWithoutTodos).toContain("update_todo_list")
		expect(descriptionWithTodos).toContain("update_todo_list")

		// Both versions should contain best practice section
		expect(descriptionWithoutTodos).toContain("**Best Practice - Hybrid Approach:**")
		expect(descriptionWithTodos).toContain("**Best Practice - Hybrid Approach:**")

		// Both should mention combining both tools
		expect(descriptionWithoutTodos).toContain("Combine both tools")
		expect(descriptionWithTodos).toContain("Combine both tools")
	})

	it("should include specific usage scenarios in guidance", () => {
		const args: ToolArgs = {
			cwd: "/test",
			supportsComputerUse: false,
			settings: {
				newTaskRequireTodos: false,
			},
		}

		const description = getNewTaskDescription(args)

		// Check for specific "When to Use" scenarios
		expect(description).toContain("isolated context")
		expect(description).toContain("different expertise or approaches")
		expect(description).toContain("separated stages")

		// Check for specific "When NOT to Use" scenarios
		expect(description).toContain("completed in the **current mode**")
		expect(description).toContain("share the same context")
		expect(description).toContain("unnecessary overhead")

		// Check for comparison points
		expect(description).toContain("same mode and context")
		expect(description).toContain("different modes or isolated contexts")
		expect(description).toContain("step-by-step tracking")

		// Check for best practice guidance
		expect(description).toContain("phase-based subtasks")
		expect(description).toContain("track detailed progress steps")
		expect(description).toContain("high-level task separation")
	})
})
