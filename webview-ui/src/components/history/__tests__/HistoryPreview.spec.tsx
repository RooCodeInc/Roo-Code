import { render, screen } from "@/utils/test-utils"

import type { HistoryItem } from "@roo-code/types"

import HistoryPreview from "../HistoryPreview"
import type { TaskGroup } from "../types"

vi.mock("../useTaskSearch")
vi.mock("../useGroupedTasks")

vi.mock("../TaskGroupItem", () => {
	return {
		default: vi.fn(({ group, variant }) => (
			<div data-testid={`task-group-${group.parent.id}`} data-variant={variant}>
				{group.parent.task}
			</div>
		)),
	}
})

import { useTaskSearch } from "../useTaskSearch"
import { useGroupedTasks } from "../useGroupedTasks"
import TaskGroupItem from "../TaskGroupItem"

const mockUseTaskSearch = useTaskSearch as any
const mockUseGroupedTasks = useGroupedTasks as any
const mockTaskGroupItem = TaskGroupItem as any

const mockTasks: HistoryItem[] = [
	{
		id: "task-1",
		number: 1,
		task: "First task",
		ts: 600,
		tokensIn: 100,
		tokensOut: 50,
		totalCost: 0.01,
	},
	{
		id: "task-2",
		number: 2,
		task: "Second task",
		ts: 500,
		tokensIn: 200,
		tokensOut: 100,
		totalCost: 0.02,
	},
	{
		id: "task-3",
		number: 3,
		task: "Third task",
		ts: 400,
		tokensIn: 150,
		tokensOut: 75,
		totalCost: 0.015,
	},
	{
		id: "task-4",
		number: 4,
		task: "Fourth task",
		ts: 300,
		tokensIn: 300,
		tokensOut: 150,
		totalCost: 0.03,
	},
	{
		id: "task-5",
		number: 5,
		task: "Fifth task",
		ts: 200,
		tokensIn: 250,
		tokensOut: 125,
		totalCost: 0.025,
	},
	{
		id: "task-6",
		number: 6,
		task: "Sixth task",
		ts: 100,
		tokensIn: 400,
		tokensOut: 200,
		totalCost: 0.04,
	},
]

// Helper to create mock groups from tasks
function createMockGroups(tasks: HistoryItem[]): TaskGroup[] {
	return tasks.map((task) => ({
		parent: { ...task, isSubtask: false },
		subtasks: [],
		isExpanded: false,
	}))
}

describe("HistoryPreview", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders nothing when no tasks are available", () => {
		mockUseTaskSearch.mockReturnValue({
			tasks: [],
			searchQuery: "",
			setSearchQuery: vi.fn(),
			sortOption: "newest",
			setSortOption: vi.fn(),
			lastNonRelevantSort: null,
			setLastNonRelevantSort: vi.fn(),
			showAllWorkspaces: false,
			setShowAllWorkspaces: vi.fn(),
		})

		mockUseGroupedTasks.mockReturnValue({
			groups: [],
			flatTasks: null,
			toggleExpand: vi.fn(),
			isSearchMode: false,
		})

		const { container } = render(<HistoryPreview />)

		// Should render the container but no task groups
		expect(container.firstChild).toHaveClass("flex", "flex-col", "gap-1")
		expect(screen.queryByTestId(/task-group-/)).not.toBeInTheDocument()
	})

	it("renders up to 4 groups when tasks are available", () => {
		mockUseTaskSearch.mockReturnValue({
			tasks: mockTasks,
			searchQuery: "",
			setSearchQuery: vi.fn(),
			sortOption: "newest",
			setSortOption: vi.fn(),
			lastNonRelevantSort: null,
			setLastNonRelevantSort: vi.fn(),
			showAllWorkspaces: false,
			setShowAllWorkspaces: vi.fn(),
		})

		const mockGroups = createMockGroups(mockTasks)
		mockUseGroupedTasks.mockReturnValue({
			groups: mockGroups,
			flatTasks: null,
			toggleExpand: vi.fn(),
			isSearchMode: false,
		})

		render(<HistoryPreview />)

		// Should render only the first 4 groups
		expect(screen.getByTestId("task-group-task-1")).toBeInTheDocument()
		expect(screen.getByTestId("task-group-task-2")).toBeInTheDocument()
		expect(screen.getByTestId("task-group-task-3")).toBeInTheDocument()
		expect(screen.getByTestId("task-group-task-4")).toBeInTheDocument()
		expect(screen.queryByTestId("task-group-task-5")).not.toBeInTheDocument()
		expect(screen.queryByTestId("task-group-task-6")).not.toBeInTheDocument()
	})

	it("renders all groups when there are 4 or fewer", () => {
		const threeTasks = mockTasks.slice(0, 3)
		mockUseTaskSearch.mockReturnValue({
			tasks: threeTasks,
			searchQuery: "",
			setSearchQuery: vi.fn(),
			sortOption: "newest",
			setSortOption: vi.fn(),
			lastNonRelevantSort: null,
			setLastNonRelevantSort: vi.fn(),
			showAllWorkspaces: false,
			setShowAllWorkspaces: vi.fn(),
		})

		const mockGroups = createMockGroups(threeTasks)
		mockUseGroupedTasks.mockReturnValue({
			groups: mockGroups,
			flatTasks: null,
			toggleExpand: vi.fn(),
			isSearchMode: false,
		})

		render(<HistoryPreview />)

		expect(screen.getByTestId("task-group-task-1")).toBeInTheDocument()
		expect(screen.getByTestId("task-group-task-2")).toBeInTheDocument()
		expect(screen.getByTestId("task-group-task-3")).toBeInTheDocument()
		expect(screen.queryByTestId("task-group-task-4")).not.toBeInTheDocument()
		expect(screen.queryByTestId("task-group-task-5")).not.toBeInTheDocument()
		expect(screen.queryByTestId("task-group-task-6")).not.toBeInTheDocument()
	})

	it("renders only 1 group when there is only 1 task", () => {
		const oneTask = mockTasks.slice(0, 1)
		mockUseTaskSearch.mockReturnValue({
			tasks: oneTask,
			searchQuery: "",
			setSearchQuery: vi.fn(),
			sortOption: "newest",
			setSortOption: vi.fn(),
			lastNonRelevantSort: null,
			setLastNonRelevantSort: vi.fn(),
			showAllWorkspaces: false,
			setShowAllWorkspaces: vi.fn(),
		})

		const mockGroups = createMockGroups(oneTask)
		mockUseGroupedTasks.mockReturnValue({
			groups: mockGroups,
			flatTasks: null,
			toggleExpand: vi.fn(),
			isSearchMode: false,
		})

		render(<HistoryPreview />)

		expect(screen.getByTestId("task-group-task-1")).toBeInTheDocument()
		expect(screen.queryByTestId("task-group-task-2")).not.toBeInTheDocument()
	})

	it("passes correct props to TaskGroupItem components", () => {
		const threeTasks = mockTasks.slice(0, 3)
		mockUseTaskSearch.mockReturnValue({
			tasks: threeTasks,
			searchQuery: "",
			setSearchQuery: vi.fn(),
			sortOption: "newest",
			setSortOption: vi.fn(),
			lastNonRelevantSort: null,
			setLastNonRelevantSort: vi.fn(),
			showAllWorkspaces: false,
			setShowAllWorkspaces: vi.fn(),
		})

		const mockGroups = createMockGroups(threeTasks)
		mockUseGroupedTasks.mockReturnValue({
			groups: mockGroups,
			flatTasks: null,
			toggleExpand: vi.fn(),
			isSearchMode: false,
		})

		render(<HistoryPreview />)

		// Verify TaskGroupItem was called with correct props for first 3 groups
		expect(mockTaskGroupItem).toHaveBeenCalledWith(
			expect.objectContaining({
				group: mockGroups[0],
				variant: "compact",
			}),
			expect.anything(),
		)
		expect(mockTaskGroupItem).toHaveBeenCalledWith(
			expect.objectContaining({
				group: mockGroups[1],
				variant: "compact",
			}),
			expect.anything(),
		)
		expect(mockTaskGroupItem).toHaveBeenCalledWith(
			expect.objectContaining({
				group: mockGroups[2],
				variant: "compact",
			}),
			expect.anything(),
		)
	})

	it("displays the header and view all button", () => {
		mockUseTaskSearch.mockReturnValue({
			tasks: mockTasks,
			searchQuery: "",
			setSearchQuery: vi.fn(),
			sortOption: "newest",
			setSortOption: vi.fn(),
			lastNonRelevantSort: null,
			setLastNonRelevantSort: vi.fn(),
			showAllWorkspaces: false,
			setShowAllWorkspaces: vi.fn(),
		})

		const mockGroups = createMockGroups(mockTasks)
		mockUseGroupedTasks.mockReturnValue({
			groups: mockGroups,
			flatTasks: null,
			toggleExpand: vi.fn(),
			isSearchMode: false,
		})

		render(<HistoryPreview />)

		// Should show header and view all button
		expect(screen.getByText("history:recentTasks")).toBeInTheDocument()
		expect(screen.getByText("history:viewAllHistory")).toBeInTheDocument()
	})

	it("calls toggleExpand when onToggleExpand is called", () => {
		const oneTask = mockTasks.slice(0, 1)
		mockUseTaskSearch.mockReturnValue({
			tasks: oneTask,
			searchQuery: "",
			setSearchQuery: vi.fn(),
			sortOption: "newest",
			setSortOption: vi.fn(),
			lastNonRelevantSort: null,
			setLastNonRelevantSort: vi.fn(),
			showAllWorkspaces: false,
			setShowAllWorkspaces: vi.fn(),
		})

		const mockToggleExpand = vi.fn()
		const mockGroups = createMockGroups(oneTask)
		mockUseGroupedTasks.mockReturnValue({
			groups: mockGroups,
			flatTasks: null,
			toggleExpand: mockToggleExpand,
			isSearchMode: false,
		})

		render(<HistoryPreview />)

		// Verify TaskGroupItem received onToggleExpand prop
		expect(mockTaskGroupItem).toHaveBeenCalledWith(
			expect.objectContaining({
				onToggleExpand: expect.any(Function),
			}),
			expect.anything(),
		)

		// Call the onToggleExpand function passed to TaskGroupItem
		const callArgs = mockTaskGroupItem.mock.calls[0][0]
		callArgs.onToggleExpand()

		// Verify toggleExpand was called with the parent id
		expect(mockToggleExpand).toHaveBeenCalledWith("task-1")
	})
})
