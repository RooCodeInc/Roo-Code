import { render, screen, fireEvent } from "@testing-library/react"
import type { HistoryItem } from "@roo-code/types"
import TaskDashboard from "../TaskDashboard"

// Mock the vscode API
const mockPostMessage = vi.fn()
vi.mock("@src/utils/vscode", () => ({
	vscode: { postMessage: (...args: any[]) => mockPostMessage(...args) },
}))

// Mock useTranslation
vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

// Mock extension state
let mockState: Record<string, any> = {}
vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => mockState,
}))

// Mock modes
vi.mock("@roo/modes", () => ({
	getAllModes: (customModes: any[]) => [
		{ slug: "orchestrator", name: "Orchestrator" },
		{ slug: "code", name: "Code" },
		{ slug: "architect", name: "Architect" },
		{ slug: "debug", name: "Debug" },
		...(customModes || []),
	],
}))

function makeItem(overrides: Partial<HistoryItem> & { id: string }): HistoryItem {
	return {
		ts: Date.now(),
		task: "Test task",
		tokensIn: 0,
		tokensOut: 0,
		totalCost: 0,
		number: 1,
		...overrides,
	}
}

describe("TaskDashboard", () => {
	beforeEach(() => {
		mockPostMessage.mockClear()
		mockState = {
			taskHistory: [],
			currentTaskItem: undefined,
			currentTaskId: undefined,
			customModes: [],
		}
	})

	it("does not render when there is no delegation hierarchy", () => {
		const standalone = makeItem({ id: "standalone", task: "Simple task" })
		mockState = {
			taskHistory: [standalone],
			currentTaskItem: standalone,
			currentTaskId: "standalone",
			customModes: [],
		}

		const { container } = render(<TaskDashboard />)
		expect(container.innerHTML).toBe("")
	})

	it("renders the dashboard when delegation hierarchy exists", () => {
		const parent = makeItem({
			id: "parent-1",
			task: "Orchestrator task",
			mode: "orchestrator",
			status: "delegated",
			childIds: ["child-1"],
		})
		const child = makeItem({
			id: "child-1",
			task: "Code task",
			mode: "code",
			status: "active",
			rootTaskId: "parent-1",
			parentTaskId: "parent-1",
		})
		mockState = {
			taskHistory: [parent, child],
			currentTaskItem: child,
			currentTaskId: "child-1",
			customModes: [],
		}

		render(<TaskDashboard />)

		expect(screen.getByTestId("task-dashboard")).toBeTruthy()
		expect(screen.getByText("Task Delegation")).toBeTruthy()
	})

	it("displays mode names for each task node", () => {
		const parent = makeItem({
			id: "parent-1",
			task: "Root task",
			mode: "orchestrator",
			status: "delegated",
			childIds: ["child-1"],
		})
		const child = makeItem({
			id: "child-1",
			task: "Child task",
			mode: "code",
			status: "active",
			rootTaskId: "parent-1",
			parentTaskId: "parent-1",
		})
		mockState = {
			taskHistory: [parent, child],
			currentTaskItem: child,
			currentTaskId: "child-1",
			customModes: [],
		}

		render(<TaskDashboard />)

		expect(screen.getByText("Orchestrator")).toBeTruthy()
		expect(screen.getByText("Code")).toBeTruthy()
	})

	it("displays status badges", () => {
		const parent = makeItem({
			id: "parent-1",
			task: "Root task",
			mode: "orchestrator",
			status: "delegated",
			childIds: ["child-1"],
		})
		const child = makeItem({
			id: "child-1",
			task: "Child task",
			mode: "code",
			status: "active",
			rootTaskId: "parent-1",
			parentTaskId: "parent-1",
		})
		mockState = {
			taskHistory: [parent, child],
			currentTaskItem: child,
			currentTaskId: "child-1",
			customModes: [],
		}

		render(<TaskDashboard />)

		expect(screen.getByText("Delegated")).toBeTruthy()
		expect(screen.getByText("Active")).toBeTruthy()
	})

	it("sends showTaskWithId message on task node click", () => {
		const parent = makeItem({
			id: "parent-1",
			task: "Root task",
			mode: "orchestrator",
			status: "delegated",
			childIds: ["child-1"],
		})
		const child = makeItem({
			id: "child-1",
			task: "Child task",
			mode: "code",
			status: "active",
			rootTaskId: "parent-1",
			parentTaskId: "parent-1",
		})
		mockState = {
			taskHistory: [parent, child],
			currentTaskItem: child,
			currentTaskId: "child-1",
			customModes: [],
		}

		render(<TaskDashboard />)

		const parentNode = screen.getByTestId("task-node-parent-1")
		fireEvent.click(parentNode.querySelector("[role='button']")!)

		expect(mockPostMessage).toHaveBeenCalledWith({
			type: "showTaskWithId",
			text: "parent-1",
		})
	})

	it("collapses and expands the dashboard", () => {
		const parent = makeItem({
			id: "parent-1",
			task: "Root task",
			mode: "orchestrator",
			status: "delegated",
			childIds: ["child-1"],
		})
		const child = makeItem({
			id: "child-1",
			task: "Child task",
			mode: "code",
			status: "active",
			rootTaskId: "parent-1",
			parentTaskId: "parent-1",
		})
		mockState = {
			taskHistory: [parent, child],
			currentTaskItem: child,
			currentTaskId: "child-1",
			customModes: [],
		}

		render(<TaskDashboard />)

		// Should start expanded
		expect(screen.getByTestId("task-dashboard-content")).toBeTruthy()

		// Click toggle to collapse
		fireEvent.click(screen.getByTestId("task-dashboard-toggle"))

		// Content should be hidden
		expect(screen.queryByTestId("task-dashboard-content")).toBeNull()

		// Click again to expand
		fireEvent.click(screen.getByTestId("task-dashboard-toggle"))

		expect(screen.getByTestId("task-dashboard-content")).toBeTruthy()
	})

	it("highlights the currently active task", () => {
		const parent = makeItem({
			id: "parent-1",
			task: "Root task",
			mode: "orchestrator",
			status: "delegated",
			childIds: ["child-1"],
		})
		const child = makeItem({
			id: "child-1",
			task: "Child task",
			mode: "code",
			status: "active",
			rootTaskId: "parent-1",
			parentTaskId: "parent-1",
		})
		mockState = {
			taskHistory: [parent, child],
			currentTaskItem: child,
			currentTaskId: "child-1",
			customModes: [],
		}

		render(<TaskDashboard />)

		// The active task node should have the active selection class
		const activeNode = screen.getByTestId("task-node-child-1")
		const button = activeNode.querySelector("[role='button']")
		expect(button?.className).toContain("activeSelection")
	})
})
