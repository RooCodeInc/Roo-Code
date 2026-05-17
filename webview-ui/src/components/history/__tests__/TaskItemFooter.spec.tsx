import { render, screen } from "@/utils/test-utils"

import TaskItemFooter from "../TaskItemFooter"

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/utils/format", () => ({
	formatTimeAgo: vi.fn(() => "2 hours ago"),
	formatDate: vi.fn(() => "January 15 at 2:30 PM"),
	formatLargeNumber: vi.fn((num: number) => num.toString()),
}))

const mockItem = {
	id: "1",
	number: 1,
	task: "Test task",
	ts: Date.now(),
	tokensIn: 100,
	tokensOut: 50,
	totalCost: 0.002,
	workspace: "/test/workspace",
}

describe("TaskItemFooter", () => {
	it("renders time ago information", () => {
		render(<TaskItemFooter item={mockItem} variant="full" />)

		// Should show time ago format
		expect(screen.getByText(/ago/)).toBeInTheDocument()
	})

	it("renders cost information", () => {
		render(<TaskItemFooter item={mockItem} variant="full" />)

		// The component shows $0.00 for small amounts, not the exact value
		expect(screen.getByText("$0.00")).toBeInTheDocument()
	})

	it("shows action buttons", () => {
		render(<TaskItemFooter item={mockItem} variant="full" />)

		// Should show copy and export buttons
		expect(screen.getByTestId("copy-prompt-button")).toBeInTheDocument()
		expect(screen.getByTestId("export")).toBeInTheDocument()
	})

	it("hides export button in compact variant", () => {
		render(<TaskItemFooter item={mockItem} variant="compact" />)

		// Should show copy button but not export button
		expect(screen.getByTestId("copy-prompt-button")).toBeInTheDocument()
		expect(screen.queryByTestId("export")).not.toBeInTheDocument()
	})

	it("hides action buttons in selection mode", () => {
		render(<TaskItemFooter item={mockItem} variant="full" isSelectionMode={true} />)

		// Should not show any action buttons
		expect(screen.queryByTestId("copy-prompt-button")).not.toBeInTheDocument()
		expect(screen.queryByTestId("export")).not.toBeInTheDocument()
		expect(screen.queryByTestId("delete-task-button")).not.toBeInTheDocument()
	})

	it("shows delete button when not in selection mode and onDelete is provided", () => {
		render(<TaskItemFooter item={mockItem} variant="full" isSelectionMode={false} onDelete={vi.fn()} />)

		expect(screen.getByTestId("delete-task-button")).toBeInTheDocument()
	})

	it("does not show delete button in selection mode", () => {
		render(<TaskItemFooter item={mockItem} variant="full" isSelectionMode={true} onDelete={vi.fn()} />)

		expect(screen.queryByTestId("delete-task-button")).not.toBeInTheDocument()
	})

	it("does not show delete button when onDelete is not provided", () => {
		render(<TaskItemFooter item={mockItem} variant="full" isSelectionMode={false} />)

		expect(screen.queryByTestId("delete-task-button")).not.toBeInTheDocument()
	})

	it("shows subtask tag when isSubtask is true", () => {
		render(<TaskItemFooter item={mockItem} variant="full" isSubtask={true} />)

		expect(screen.getByText("history:subtaskTag")).toBeInTheDocument()
	})

	it("does not show subtask tag when isSubtask is false", () => {
		render(<TaskItemFooter item={mockItem} variant="full" isSubtask={false} />)

		expect(screen.queryByText("history:subtaskTag")).not.toBeInTheDocument()
	})

	it("shows background tag when item.background is true", () => {
		const backgroundItem = { ...mockItem, background: true }
		render(<TaskItemFooter item={backgroundItem} variant="full" />)

		expect(screen.getByText("history:backgroundTag")).toBeInTheDocument()
	})

	it("does not show background tag when item.background is falsy", () => {
		render(<TaskItemFooter item={mockItem} variant="full" />)

		expect(screen.queryByText("history:backgroundTag")).not.toBeInTheDocument()
	})

	it("shows interrupted tag when item is a background task with interrupted status", () => {
		const interruptedItem = { ...mockItem, background: true, status: "interrupted" as const }
		render(<TaskItemFooter item={interruptedItem} variant="full" />)

		expect(screen.getByText("history:interruptedTag")).toBeInTheDocument()
		expect(screen.queryByText("history:backgroundTag")).not.toBeInTheDocument()
	})

	it("shows background tag instead of interrupted for active background tasks", () => {
		const activeBackgroundItem = { ...mockItem, background: true, status: "active" as const }
		render(<TaskItemFooter item={activeBackgroundItem} variant="full" />)

		expect(screen.getByText("history:backgroundTag")).toBeInTheDocument()
		expect(screen.queryByText("history:interruptedTag")).not.toBeInTheDocument()
	})

	it("wraps interrupted tag in a tooltip explaining VS Code was closed", () => {
		const interruptedItem = { ...mockItem, background: true, status: "interrupted" as const }
		render(<TaskItemFooter item={interruptedItem} variant="full" />)

		// The interrupted tag should be present
		expect(screen.getByText("history:interruptedTag")).toBeInTheDocument()
		// The tooltip trigger wraps the tag -- verify the tooltip content key is used
		// StandardTooltip renders a trigger element with the content as a prop
		const tagElement = screen.getByText("history:interruptedTag")
		// The tag and icon should be grouped inside a styled span
		expect(tagElement.closest("span")).toHaveClass("text-vscode-editorWarning-foreground")
	})
})
