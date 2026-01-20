import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import { TodoListDisplay } from "../TodoListDisplay"
import type { SubtaskDetail } from "@src/types/subtasks"

// Mock i18next
vi.mock("i18next", () => ({
	t: (key: string, options?: Record<string, unknown>) => {
		if (key === "chat:todo.complete") return `${options?.total} to-dos done`
		if (key === "chat:todo.partial") return `${options?.completed} of ${options?.total} to-dos done`
		return key
	},
}))

// Mock format utility
vi.mock("@src/utils/format", () => ({
	formatLargeNumber: (num: number) => {
		if (num >= 1e3) return `${(num / 1e3).toFixed(1)}k`
		return num.toString()
	},
}))

describe("TodoListDisplay", () => {
	const baseTodos = [
		{ id: "1", content: "Task 1: Change background colour", status: "completed", subtaskId: "subtask-1" },
		{ id: "2", content: "Task 2: Add timestamp to bottom", status: "completed", subtaskId: "subtask-2" },
		{ id: "3", content: "Task 3: Pending task", status: "pending" },
	]

	const subtaskDetails: SubtaskDetail[] = [
		{
			id: "subtask-1",
			name: "Task 1: Change background colour",
			tokens: 95400,
			cost: 0.22,
			added: 10,
			removed: 4,
			status: "completed",
			hasNestedChildren: false,
		},
		{
			id: "subtask-2",
			name: "Task 2: Add timestamp to bottom",
			tokens: 95000,
			cost: 0.24,
			added: 3,
			removed: 2,
			status: "completed",
			hasNestedChildren: false,
		},
	]

	describe("basic rendering", () => {
		it("should render nothing when todos is empty", () => {
			const { container } = render(<TodoListDisplay todos={[]} />)
			expect(container.firstChild).toBeNull()
		})

		it("should render collapsed view by default", () => {
			render(<TodoListDisplay todos={baseTodos} />)
			// Should show the first incomplete task in collapsed view
			expect(screen.getByText("Task 3: Pending task")).toBeInTheDocument()
		})

		it("should expand when header is clicked", () => {
			render(<TodoListDisplay todos={baseTodos} />)
			const header = screen.getByText("Task 3: Pending task")
			fireEvent.click(header)

			// After expanding, should show all tasks
			expect(screen.getByText("Task 1: Change background colour")).toBeInTheDocument()
			expect(screen.getByText("Task 2: Add timestamp to bottom")).toBeInTheDocument()
			expect(screen.getByText("Task 3: Pending task")).toBeInTheDocument()
		})

		it("should show completion count when all tasks are complete", () => {
			const completedTodos = [
				{ id: "1", content: "Task 1", status: "completed" },
				{ id: "2", content: "Task 2", status: "completed" },
			]
			render(<TodoListDisplay todos={completedTodos} />)
			expect(screen.getByText("2 to-dos done")).toBeInTheDocument()
		})
	})

	describe("subtask cost display", () => {
		it("should display tokens and cost when subtaskDetails are provided and todo.subtaskId matches", () => {
			render(<TodoListDisplay todos={baseTodos} subtaskDetails={subtaskDetails} />)

			// Expand to see the items
			const header = screen.getByText("Task 3: Pending task")
			fireEvent.click(header)

			// Check for formatted token counts
			expect(screen.getByText("95.4k")).toBeInTheDocument()
			expect(screen.getByText("95.0k")).toBeInTheDocument()

			// Check for costs
			expect(screen.getByText("$0.22")).toBeInTheDocument()
			expect(screen.getByText("$0.24")).toBeInTheDocument()
		})

		it("should not display tokens/cost for todos without subtaskId", () => {
			render(<TodoListDisplay todos={baseTodos} subtaskDetails={subtaskDetails} />)

			// Expand to see the items
			const header = screen.getByText("Task 3: Pending task")
			fireEvent.click(header)

			// The pending task has no subtaskId, should not show cost
			const listItems = screen.getAllByRole("listitem")
			const pendingItem = listItems.find((item: HTMLElement) =>
				item.textContent?.includes("Task 3: Pending task"),
			)
			expect(pendingItem).toBeDefined()
			expect(pendingItem?.textContent).not.toContain("$")
		})

		it("should not display tokens/cost when subtaskDetails is undefined", () => {
			render(<TodoListDisplay todos={baseTodos} />)

			// Expand to see the items
			const header = screen.getByText("Task 3: Pending task")
			fireEvent.click(header)

			// No cost should be displayed
			expect(screen.queryByText("$0.22")).not.toBeInTheDocument()
			expect(screen.queryByText("$0.24")).not.toBeInTheDocument()
		})

		it("should not display tokens/cost when subtaskDetails is empty array", () => {
			render(<TodoListDisplay todos={baseTodos} subtaskDetails={[]} />)

			// Expand to see the items
			const header = screen.getByText("Task 3: Pending task")
			fireEvent.click(header)

			// No cost should be displayed
			expect(screen.queryByText("$0.22")).not.toBeInTheDocument()
		})
	})

	describe("direct subtask linking", () => {
		it("should use todo.tokens and todo.cost when provided (no subtaskDetails required)", () => {
			const todosWithDirectCost = [
				{
					id: "1",
					content: "Task 1: Change background colour",
					status: "completed",
					subtaskId: "subtask-1",
					tokens: 95400,
					cost: 0.22,
				},
			]
			render(<TodoListDisplay todos={todosWithDirectCost} />)

			// Expand
			const header = screen.getByText("1 to-dos done")
			fireEvent.click(header)

			expect(screen.getByText("95.4k")).toBeInTheDocument()
			expect(screen.getByText("$0.22")).toBeInTheDocument()
		})

		it("should fall back to subtaskDetails by ID when todo.tokens/cost are missing", () => {
			const todosMissingCostFields = [
				{
					id: "1",
					content: "Task 1: Change background colour",
					status: "completed",
					subtaskId: "subtask-1",
				},
			]
			render(<TodoListDisplay todos={todosMissingCostFields} subtaskDetails={subtaskDetails} />)

			// Expand
			const header = screen.getByText("1 to-dos done")
			fireEvent.click(header)

			expect(screen.getByText("95.4k")).toBeInTheDocument()
			expect(screen.getByText("$0.22")).toBeInTheDocument()
		})
	})

	describe("line change display", () => {
		it("uses todo.added/todo.removed when present", () => {
			const todosWithDirectLineChanges = [
				{
					id: "1",
					content: "Task 1: Change background colour",
					status: "completed",
					subtaskId: "subtask-1",
					added: 7,
					removed: 9,
				},
			]
			render(<TodoListDisplay todos={todosWithDirectLineChanges} subtaskDetails={subtaskDetails} />)

			// Expand
			const header = screen.getByText("1 to-dos done")
			fireEvent.click(header)

			// Line changes are rendered as separate colored spans
			expect(screen.getByText("+7")).toBeInTheDocument()
			expect(screen.getByText("−9")).toBeInTheDocument()
		})

		it("shows +0/−0 for completed subtask when fallback metrics are explicitly zero", () => {
			const todosMissingDirectLineChanges = [
				{
					id: "1",
					content: "Task 1: Zero changes",
					status: "completed",
					subtaskId: "subtask-1",
				},
			]
			const subtaskDetailsWithZeroLineChanges: SubtaskDetail[] = [
				{
					id: "subtask-1",
					name: "Task 1: Zero changes",
					tokens: 1,
					cost: 0.01,
					added: 0,
					removed: 0,
					status: "completed",
					hasNestedChildren: false,
				},
			]

			render(
				<TodoListDisplay
					todos={todosMissingDirectLineChanges}
					subtaskDetails={subtaskDetailsWithZeroLineChanges}
				/>,
			)

			// Expand
			const header = screen.getByText("1 to-dos done")
			fireEvent.click(header)

			const addedEl = screen.getByText("+0")
			const removedEl = screen.getByText("−0")

			expect(addedEl).toBeInTheDocument()
			expect(removedEl).toBeInTheDocument()

			// Zero values should be visually muted (not green/red emphasized)
			expect(addedEl.className).toContain("opacity-50")
			expect(addedEl.className).not.toContain("text-vscode-charts-green")

			expect(removedEl.className).toContain("opacity-50")
			expect(removedEl.className).not.toContain("text-vscode-charts-red")
		})

		it("in-progress: does not show +0/−0 when zeros only come from fallback", () => {
			const todosMissingDirectLineChanges = [
				{
					id: "1",
					content: "Task 1: Zero changes (running)",
					status: "in_progress",
					subtaskId: "subtask-1",
				},
			]
			const subtaskDetailsWithZeroLineChanges: SubtaskDetail[] = [
				{
					id: "subtask-1",
					name: "Task 1: Zero changes (running)",
					tokens: 1,
					cost: 0.01,
					added: 0,
					removed: 0,
					status: "active",
					hasNestedChildren: false,
				},
			]

			render(
				<TodoListDisplay
					todos={todosMissingDirectLineChanges}
					subtaskDetails={subtaskDetailsWithZeroLineChanges}
				/>,
			)

			// Expand
			const header = screen.getByText("Task 1: Zero changes (running)")
			fireEvent.click(header)

			expect(screen.queryByText("+0")).not.toBeInTheDocument()
			expect(screen.queryByText("−0")).not.toBeInTheDocument()
		})

		it("in-progress: shows +0/−0 when explicitly present on todo", () => {
			const todosWithDirectLineChanges = [
				{
					id: "1",
					content: "Task 1: Zero changes (explicit)",
					status: "in_progress",
					subtaskId: "subtask-1",
					added: 0,
					removed: 0,
				},
			]

			render(<TodoListDisplay todos={todosWithDirectLineChanges} subtaskDetails={subtaskDetails} />)

			// Expand
			const header = screen.getByText("Task 1: Zero changes (explicit)")
			fireEvent.click(header)

			const addedEl = screen.getByText("+0")
			const removedEl = screen.getByText("−0")
			expect(addedEl).toBeInTheDocument()
			expect(removedEl).toBeInTheDocument()

			expect(addedEl.className).toContain("opacity-50")
			expect(removedEl.className).toContain("opacity-50")
		})

		it("falls back to subtaskDetails when todo added/removed are missing", () => {
			const todosMissingDirectLineChanges = [
				{
					id: "1",
					content: "Task 1: Change background colour",
					status: "completed",
					subtaskId: "subtask-1",
				},
			]
			render(<TodoListDisplay todos={todosMissingDirectLineChanges} subtaskDetails={subtaskDetails} />)

			// Expand
			const header = screen.getByText("1 to-dos done")
			fireEvent.click(header)

			// Line changes are rendered as separate colored spans
			expect(screen.getByText("+10")).toBeInTheDocument()
			expect(screen.getByText("−4")).toBeInTheDocument()
		})

		it("hides line deltas when no data available (no subtaskId)", () => {
			const todosNoSubtaskLink = [{ id: "1", content: "No link todo", status: "completed" }]
			render(<TodoListDisplay todos={todosNoSubtaskLink} subtaskDetails={subtaskDetails} />)

			// Expand
			const header = screen.getByText("1 to-dos done")
			fireEvent.click(header)

			expect(screen.queryByText(/\+\d+/)).not.toBeInTheDocument()
			expect(screen.queryByText(/−\d+/)).not.toBeInTheDocument()
		})

		it("hides line deltas when all values are undefined (subtaskId present)", () => {
			const todosWithLinkButNoLineChanges = [
				{
					id: "1",
					content: "Task 1: Change background colour",
					status: "completed",
					subtaskId: "subtask-1",
				},
			]
			const subtaskDetailsWithoutLineChanges: SubtaskDetail[] = [
				{
					id: "subtask-1",
					name: "Task 1: Change background colour",
					tokens: 95400,
					cost: 0.22,
					status: "completed",
					hasNestedChildren: false,
				} as unknown as SubtaskDetail,
			]
			render(
				<TodoListDisplay
					todos={todosWithLinkButNoLineChanges}
					subtaskDetails={subtaskDetailsWithoutLineChanges}
				/>,
			)

			// Expand
			const header = screen.getByText("1 to-dos done")
			fireEvent.click(header)

			expect(screen.queryByText(/\+\d+/)).not.toBeInTheDocument()
			expect(screen.queryByText(/−\d+/)).not.toBeInTheDocument()
		})
	})

	describe("click handler", () => {
		it("should call onSubtaskClick when a todo with subtaskId is clicked", () => {
			const onSubtaskClick = vi.fn()
			render(
				<TodoListDisplay todos={baseTodos} subtaskDetails={subtaskDetails} onSubtaskClick={onSubtaskClick} />,
			)

			// Expand
			const header = screen.getByText("Task 3: Pending task")
			fireEvent.click(header)

			// Click on first matched todo
			const task1 = screen.getByText("Task 1: Change background colour")
			fireEvent.click(task1)

			expect(onSubtaskClick).toHaveBeenCalledWith("subtask-1")
		})

		it("should not call onSubtaskClick when a todo does not have subtaskId", () => {
			const onSubtaskClick = vi.fn()
			render(
				<TodoListDisplay todos={baseTodos} subtaskDetails={subtaskDetails} onSubtaskClick={onSubtaskClick} />,
			)

			// Expand
			const header = screen.getByText("Task 3: Pending task")
			fireEvent.click(header)

			// Click on unmatched todo
			const task3 = screen.getByText("Task 3: Pending task")
			fireEvent.click(task3)

			expect(onSubtaskClick).not.toHaveBeenCalled()
		})

		it("should not be clickable when onSubtaskClick is not provided", () => {
			render(<TodoListDisplay todos={baseTodos} subtaskDetails={subtaskDetails} />)

			// Expand
			const header = screen.getByText("Task 3: Pending task")
			fireEvent.click(header)

			// Task should be present but not have hover:underline class behavior
			const task1 = screen.getByText("Task 1: Change background colour")
			expect(task1.className).not.toContain("cursor-pointer")
		})
	})
})
