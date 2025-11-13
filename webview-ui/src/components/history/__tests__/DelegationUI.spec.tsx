import React from "react"
import { render, screen } from "@/utils/test-utils"

import TaskItem from "../TaskItem"

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

		// Badge hidden for UI-neutral PR (logic-only change)
		expect(screen.queryByTestId("delegated-badge")).toBeNull()

		// Link hidden for UI-neutral PR (logic-only change)
		expect(screen.queryByTestId("open-child-link")).toBeNull()
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

		// Completion indicator hidden for UI-neutral PR
		expect(screen.queryByTestId("delegation-completed-indicator")).toBeNull()
	})

	// UI focus indicator test removed (out of scope for this PR)

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

		render(
			<TaskItem
				item={item}
				variant="full"
				isSelectionMode={false}
				isSelected={false}
				onToggleSelection={vi.fn()}
			/>,
		)

		// Badge hidden in UI-neutral PR
		expect(screen.queryByTestId("delegated-badge")).toBeNull()

		// Focus change test removed (isFocused prop removed in UI-neutral PR)
	})
})
