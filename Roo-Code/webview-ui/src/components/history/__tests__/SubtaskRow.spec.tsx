import { render, screen, fireEvent } from "@/utils/test-utils"

import { vscode } from "@src/utils/vscode"

import SubtaskRow from "../SubtaskRow"
import type { SubtaskTreeNode, DisplayHistoryItem } from "../types"

vi.mock("@src/utils/vscode")
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			if (key === "history:subtasks" && options?.count !== undefined) {
				return `${options.count} Subtask${options.count === 1 ? "" : "s"}`
			}
			if (key === "history:collapseSubtasks") return "Collapse subtasks"
			if (key === "history:expandSubtasks") return "Expand subtasks"
			return key
		},
	}),
}))

const createMockDisplayItem = (overrides: Partial<DisplayHistoryItem> = {}): DisplayHistoryItem => ({
	id: "task-1",
	number: 1,
	task: "Test task",
	ts: Date.now(),
	tokensIn: 100,
	tokensOut: 50,
	totalCost: 0.01,
	workspace: "/workspace/project",
	...overrides,
})

const createMockNode = (
	itemOverrides: Partial<DisplayHistoryItem> = {},
	children: SubtaskTreeNode[] = [],
	isExpanded = false,
): SubtaskTreeNode => ({
	item: createMockDisplayItem(itemOverrides),
	children,
	isExpanded,
})

describe("SubtaskRow", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("leaf node rendering", () => {
		it("renders leaf node with correct text", () => {
			const node = createMockNode({ id: "leaf-1", task: "Leaf task content" })

			render(<SubtaskRow node={node} depth={1} onToggleExpand={vi.fn()} />)

			expect(screen.getByText("Leaf task content")).toBeInTheDocument()
		})

		it("renders with correct depth indentation", () => {
			const node = createMockNode({ id: "leaf-1", task: "Indented task" })

			render(<SubtaskRow node={node} depth={2} onToggleExpand={vi.fn()} />)

			const row = screen.getByTestId("subtask-row-leaf-1")
			// The clickable row inside should have paddingLeft = depth * 16 = 32px
			const clickableRow = row.querySelector("[role='button']")
			expect(clickableRow).toHaveStyle({ paddingLeft: "32px" })
		})

		it("does not render collapsible row for leaf node", () => {
			const node = createMockNode({ id: "leaf-1", task: "Leaf only" })

			render(<SubtaskRow node={node} depth={1} onToggleExpand={vi.fn()} />)

			expect(screen.queryByTestId("subtask-collapsible-row")).not.toBeInTheDocument()
		})
	})

	describe("node with children", () => {
		it("renders collapsible row with correct child count", () => {
			const node = createMockNode(
				{ id: "parent-1", task: "Parent task" },
				[
					createMockNode({ id: "child-1", task: "Child 1" }),
					createMockNode({ id: "child-2", task: "Child 2" }),
				],
				false,
			)

			render(<SubtaskRow node={node} depth={1} onToggleExpand={vi.fn()} />)

			expect(screen.getByText("2 Subtasks")).toBeInTheDocument()
			expect(screen.getByTestId("subtask-collapsible-row")).toBeInTheDocument()
		})

		it("renders nested children count including grandchildren", () => {
			const node = createMockNode(
				{ id: "parent-1", task: "Parent task" },
				[
					createMockNode({ id: "child-1", task: "Child 1" }, [
						createMockNode({ id: "grandchild-1", task: "Grandchild 1" }),
					]),
				],
				false,
			)

			render(<SubtaskRow node={node} depth={1} onToggleExpand={vi.fn()} />)

			// countAllSubtasks counts child-1 (1) + grandchild-1 (1) = 2
			expect(screen.getByText("2 Subtasks")).toBeInTheDocument()
		})
	})

	describe("click behavior", () => {
		it("sends showTaskWithId message when task row is clicked", () => {
			const node = createMockNode({ id: "task-42", task: "Clickable task" })

			render(<SubtaskRow node={node} depth={1} onToggleExpand={vi.fn()} />)

			const row = screen.getByRole("button")
			fireEvent.click(row)

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "showTaskWithId",
				text: "task-42",
			})
		})

		it("calls onToggleExpand with correct task ID when collapsible row is clicked", () => {
			const onToggleExpand = vi.fn()
			const node = createMockNode(
				{ id: "expandable-1", task: "Expandable task" },
				[createMockNode({ id: "child-1", task: "Child" })],
				false,
			)

			render(<SubtaskRow node={node} depth={1} onToggleExpand={onToggleExpand} />)

			const collapsibleRow = screen.getByTestId("subtask-collapsible-row")
			fireEvent.click(collapsibleRow)

			expect(onToggleExpand).toHaveBeenCalledWith("expandable-1")
		})
	})

	describe("expand/collapse behavior", () => {
		it("renders child SubtaskRow components when expanded", () => {
			const node = createMockNode(
				{ id: "parent-1", task: "Parent" },
				[
					createMockNode({ id: "child-1", task: "Child 1" }),
					createMockNode({ id: "child-2", task: "Child 2" }),
				],
				true, // expanded
			)

			render(<SubtaskRow node={node} depth={1} onToggleExpand={vi.fn()} />)

			expect(screen.getByTestId("subtask-row-child-1")).toBeInTheDocument()
			expect(screen.getByTestId("subtask-row-child-2")).toBeInTheDocument()
			expect(screen.getByText("Child 1")).toBeInTheDocument()
			expect(screen.getByText("Child 2")).toBeInTheDocument()
		})

		it("uses max-h-0 for collapsed node with children", () => {
			const node = createMockNode(
				{ id: "parent-1", task: "Parent" },
				[createMockNode({ id: "child-1", task: "Child 1" })],
				false, // collapsed
			)

			const { container } = render(<SubtaskRow node={node} depth={1} onToggleExpand={vi.fn()} />)

			// The children wrapper div should have max-h-0 when collapsed
			const childrenWrapper = container.querySelector(".max-h-0")
			expect(childrenWrapper).toBeInTheDocument()
		})

		it("does not use max-h-0 when node is expanded", () => {
			const node = createMockNode(
				{ id: "parent-1", task: "Parent" },
				[createMockNode({ id: "child-1", task: "Child 1" })],
				true, // expanded
			)

			const { container } = render(<SubtaskRow node={node} depth={1} onToggleExpand={vi.fn()} />)

			// The children wrapper should NOT have max-h-0 when expanded
			const collapsedWrapper = container.querySelector(".max-h-0")
			expect(collapsedWrapper).not.toBeInTheDocument()
		})

		it("renders deeply nested recursive structure when all levels expanded", () => {
			const node = createMockNode(
				{ id: "root", task: "Root" },
				[
					createMockNode(
						{ id: "child", task: "Child" },
						[createMockNode({ id: "grandchild", task: "Grandchild" })],
						true, // child expanded
					),
				],
				true, // root expanded
			)

			render(<SubtaskRow node={node} depth={1} onToggleExpand={vi.fn()} />)

			expect(screen.getByTestId("subtask-row-root")).toBeInTheDocument()
			expect(screen.getByTestId("subtask-row-child")).toBeInTheDocument()
			expect(screen.getByTestId("subtask-row-grandchild")).toBeInTheDocument()
			expect(screen.getByText("Grandchild")).toBeInTheDocument()
		})
	})
})
