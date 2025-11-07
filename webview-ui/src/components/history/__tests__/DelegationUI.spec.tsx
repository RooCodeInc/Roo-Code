import React from "react"
import { render, screen, fireEvent } from "@/utils/test-utils"

import TaskItem from "../TaskItem"
import HistoryPreview from "../HistoryPreview"
import { vscode } from "@src/utils/vscode"

vi.mock("@src/utils/vscode")
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, params?: any) => {
			// Return key for assertions; include interpolation for childId if provided
			if (params?.childId) return `${key} ${params.childId}`
			return key
		},
	}),
}))

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

describe("Delegation UI", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders Delegated badge and Open Child link when status=delegated and awaitingChildId present", () => {
		const item: any = {
			id: "task-1",
			number: 1,
			ts: Date.now(),
			task: "Delegated parent task",
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
			status: "delegated",
			awaitingChildId: "child-123",
		}

		render(
			<TaskItem
				item={item}
				variant="full"
				isSelectionMode={false}
				isSelected={false}
				onToggleSelection={vi.fn()}
			/>,
		)

		// Badge
		expect(screen.getByTestId("delegated-badge")).toBeInTheDocument()

		// Open child link label comes from i18n key
		const openChild = screen.getByTestId("open-child-link")
		expect(openChild).toBeInTheDocument()
		expect(openChild.textContent).toContain("common:tasks.awaiting_child")

		// Clicking should open referenced child task
		fireEvent.click(openChild)
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "showTaskWithId", text: "child-123" })
	})

	it("renders Delegation completed indicator with tooltip (summary) when completedByChildId + summary present", () => {
		const item: any = {
			id: "parent-1",
			number: 10,
			ts: Date.now(),
			task: "Parent task",
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
			completedByChildId: "child-9",
			completionResultSummary: "Child finished successfully",
		}

		render(
			<TaskItem
				item={item}
				variant="full"
				isSelectionMode={false}
				isSelected={false}
				onToggleSelection={vi.fn()}
			/>,
		)

		const indicator = screen.getByTestId("delegation-completed-indicator")
		expect(indicator).toBeInTheDocument()
		expect(indicator.textContent).toContain("common:tasks.delegation_completed")
	})

	it("syncs focused selection to currentTaskItem (focus on child/parent after delegation/resume)", async () => {
		// Mock hooks used by HistoryPreview
		vi.doMock("../useTaskSearch", () => ({
			useTaskSearch: () => ({
				tasks: [
					{
						id: "1",
						number: 1,
						ts: Date.now(),
						task: "Task 1",
						tokensIn: 0,
						tokensOut: 0,
						totalCost: 0,
					},
					{
						id: "focused-task",
						number: 2,
						ts: Date.now(),
						task: "Focused Task",
						tokensIn: 0,
						tokensOut: 0,
						totalCost: 0,
					},
				],
				searchQuery: "",
				setSearchQuery: vi.fn(),
				sortOption: "newest",
				setSortOption: vi.fn(),
				lastNonRelevantSort: null,
				setLastNonRelevantSort: vi.fn(),
				showAllWorkspaces: false,
				setShowAllWorkspaces: vi.fn(),
			}),
		}))

		vi.doMock("@/context/ExtensionStateContext", async () => {
			const React = await import("react")
			const ExtensionStateContext = React.createContext<any>({
				currentTaskItem: { id: "focused-task", number: 2 },
			})
			return {
				useExtensionState: () => ({
					currentTaskItem: { id: "focused-task", number: 2 },
				}),
				ExtensionStateContext,
				ExtensionStateContextProvider: ({ children }: { children: React.ReactNode }) => (
					<ExtensionStateContext.Provider value={{ currentTaskItem: { id: "focused-task", number: 2 } }}>
						{children}
					</ExtensionStateContext.Provider>
				),
			}
		})

		// Import after mocks
		const { default: MockedHistoryPreview } = await import("../HistoryPreview")

		render(<MockedHistoryPreview />)

		const focusedRow = await screen.findByTestId("task-item-focused-task")
		expect(focusedRow).toHaveAttribute("data-focused", "true")
	})

	it("keeps Delegated badge visible across focus changes", () => {
		const item: any = {
			id: "task-2",
			number: 2,
			ts: Date.now(),
			task: "Delegated parent",
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
			status: "delegated",
			awaitingChildId: "child-xyz",
		}

		const { rerender } = render(
			<TaskItem
				item={item}
				variant="full"
				isSelectionMode={false}
				isSelected={false}
				onToggleSelection={vi.fn()}
			/>,
		)

		// Badge present initially
		expect(screen.getByTestId("delegated-badge")).toBeInTheDocument()

		// Simulate focus change and ensure badge persists
		rerender(
			<TaskItem
				item={item}
				variant="full"
				isSelectionMode={false}
				isSelected={false}
				onToggleSelection={vi.fn()}
				isFocused
			/>,
		)
		expect(screen.getByTestId("delegated-badge")).toBeInTheDocument()
	})
})
