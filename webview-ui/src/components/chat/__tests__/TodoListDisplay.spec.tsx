import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import { TodoListDisplay } from "../TodoListDisplay"
import type { SubtaskDetail } from "../SubtaskCostList"

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
		{ id: "1", content: "Task 1: Change background colour", status: "completed" },
		{ id: "2", content: "Task 2: Add timestamp to bottom", status: "completed" },
		{ id: "3", content: "Task 3: Pending task", status: "pending" },
	]

	const subtaskDetails: SubtaskDetail[] = [
		{
			id: "subtask-1",
			name: "Task 1: Change background colour",
			tokens: 95400,
			cost: 0.22,
			status: "completed",
			hasNestedChildren: false,
		},
		{
			id: "subtask-2",
			name: "Task 2: Add timestamp to bottom",
			tokens: 95000,
			cost: 0.24,
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
		it("should display tokens and cost when subtaskDetails are provided and match", () => {
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

		it("should not display tokens/cost for unmatched todos", () => {
			render(<TodoListDisplay todos={baseTodos} subtaskDetails={subtaskDetails} />)

			// Expand to see the items
			const header = screen.getByText("Task 3: Pending task")
			fireEvent.click(header)

			// The pending task has no matching subtask, should not show cost
			const listItems = screen.getAllByRole("listitem")
			const pendingItem = listItems.find((item) => item.textContent?.includes("Task 3: Pending task"))
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

	describe("fuzzy matching", () => {
		it("should match todos with slightly different names (partial match)", () => {
			const todosWithSlightlyDifferentNames = [
				{ id: "1", content: "Change background colour", status: "completed" }, // Missing "Task 1:" prefix
			]
			const subtaskWithFullName: SubtaskDetail[] = [
				{
					id: "subtask-1",
					name: "Change background colour", // Exact partial match
					tokens: 50000,
					cost: 0.15,
					status: "completed",
					hasNestedChildren: false,
				},
			]

			render(<TodoListDisplay todos={todosWithSlightlyDifferentNames} subtaskDetails={subtaskWithFullName} />)

			// Expand
			const header = screen.getByText("1 to-dos done")
			fireEvent.click(header)

			// Should find the match
			expect(screen.getByText("$0.15")).toBeInTheDocument()
		})

		it("should handle case-insensitive matching", () => {
			const todosLowercase = [{ id: "1", content: "change background colour", status: "completed" }]
			const subtaskUppercase: SubtaskDetail[] = [
				{
					id: "subtask-1",
					name: "Change Background Colour",
					tokens: 50000,
					cost: 0.15,
					status: "completed",
					hasNestedChildren: false,
				},
			]

			render(<TodoListDisplay todos={todosLowercase} subtaskDetails={subtaskUppercase} />)

			// Expand
			const header = screen.getByText("1 to-dos done")
			fireEvent.click(header)

			// Should find the match despite case difference
			expect(screen.getByText("$0.15")).toBeInTheDocument()
		})

		it("should match when todo has 'Subtask N:' prefix and subtask has '## Task:' prefix", () => {
			const todosWithSubtaskPrefix = [
				{ id: "1", content: "Subtask 1: Change background colour to light purple", status: "completed" },
			]
			const subtaskWithMarkdownPrefix: SubtaskDetail[] = [
				{
					id: "subtask-1",
					name: "## Task: Change Background Colour to Light Purp...",
					tokens: 95400,
					cost: 0.22,
					status: "completed",
					hasNestedChildren: false,
				},
			]

			render(<TodoListDisplay todos={todosWithSubtaskPrefix} subtaskDetails={subtaskWithMarkdownPrefix} />)

			// Expand
			const header = screen.getByText("1 to-dos done")
			fireEvent.click(header)

			// Should find the match despite different prefixes
			expect(screen.getByText("$0.22")).toBeInTheDocument()
		})

		it("should match when subtask name is truncated with ellipsis", () => {
			const todos = [{ id: "1", content: "Task 1: Add timestamp to the bottom of the page", status: "completed" }]
			const subtaskWithTruncation: SubtaskDetail[] = [
				{
					id: "subtask-1",
					name: "## Task: Add Timestamp to the Bottom of the Pag...",
					tokens: 95000,
					cost: 0.24,
					status: "completed",
					hasNestedChildren: false,
				},
			]

			render(<TodoListDisplay todos={todos} subtaskDetails={subtaskWithTruncation} />)

			// Expand
			const header = screen.getByText("1 to-dos done")
			fireEvent.click(header)

			// Should find the match despite truncation
			expect(screen.getByText("$0.24")).toBeInTheDocument()
		})

		it("should strip 'Subtask N:' prefix from todo content", () => {
			const todosWithNumberedPrefix = [
				{ id: "1", content: "Subtask 2: Do something important", status: "completed" },
			]
			const subtaskWithoutPrefix: SubtaskDetail[] = [
				{
					id: "subtask-1",
					name: "Do something important",
					tokens: 50000,
					cost: 0.15,
					status: "completed",
					hasNestedChildren: false,
				},
			]

			render(<TodoListDisplay todos={todosWithNumberedPrefix} subtaskDetails={subtaskWithoutPrefix} />)

			// Expand
			const header = screen.getByText("1 to-dos done")
			fireEvent.click(header)

			// Should find the match after stripping prefix
			expect(screen.getByText("$0.15")).toBeInTheDocument()
		})
	})

	describe("click handler", () => {
		it("should call onSubtaskClick when a matched todo is clicked", () => {
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

		it("should not call onSubtaskClick when an unmatched todo is clicked", () => {
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
