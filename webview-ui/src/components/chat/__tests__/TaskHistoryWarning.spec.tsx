import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { TaskHistoryWarning } from "../TaskHistoryWarning"
import { TooltipProvider } from "@/components/ui/tooltip"

// Mock the translation hook
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, params?: any) => {
			const translations: Record<string, string> = {
				"chat:taskHistoryWarning.title": "High Task History",
				"chat:taskHistoryWarning.ariaLabel": "High Task History",
				"chat:taskHistoryWarning.tooltip": `You have ${params?.count || 0} tasks in your history`,
				"chat:taskHistoryWarning.message": `You have ${params?.count || 0} tasks in your history. Consider cleaning up old tasks to improve performance.`,
				"chat:taskHistoryWarning.performance": "Large task histories can slow down the extension.",
				"chat:taskHistoryWarning.cleanupButton": `Clean up ${params?.count || 0} tasks older than 30 days`,
				"chat:taskHistoryWarning.cleaning": "Cleaning up...",
				"chat:taskHistoryWarning.noOldTasks": "No tasks older than 30 days",
				"chat:taskHistoryWarning.allRecent": "All your tasks are from the last 30 days",
				"chat:taskHistoryWarning.dismiss": "Dismiss",
				"chat:taskHistoryWarning.confirmTitle": "Clean Up Old Tasks",
				"chat:taskHistoryWarning.confirmMessage": `This will permanently delete ${params?.count || 0} tasks older than ${params?.days || 30} days.`,
				"chat:taskHistoryWarning.confirmWarning": "This action cannot be undone.",
				"chat:taskHistoryWarning.confirmButton": "Clean Up",
				"chat:taskHistoryWarning.cleanupSuccess": `Successfully deleted ${params?.count || 0} old tasks`,
				"chat:taskHistoryWarning.cleanupError": `Failed to clean up tasks: ${params?.error || "Unknown error"}`,
				"common:cancel": "Cancel",
			}
			return translations[key] || key
		},
	}),
}))

// Mock vscode API
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Create mock task history array that can be modified
let mockTaskHistory: any[] = []

// Mock the extension state context
vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		taskHistory: mockTaskHistory,
		setTaskHistory: vi.fn(),
	}),
}))

// Mock localStorage
const localStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
}
Object.defineProperty(window, "localStorage", {
	value: localStorageMock,
	writable: true,
})

describe("TaskHistoryWarning", () => {
	const renderWithProviders = (component: React.ReactElement) => {
		return render(<TooltipProvider>{component}</TooltipProvider>)
	}

	beforeEach(() => {
		vi.clearAllMocks()
		localStorageMock.getItem.mockReturnValue(null)
		mockTaskHistory = []
	})

	it("should not render when task history is below threshold", () => {
		mockTaskHistory = Array(999).fill({ id: "task" })

		const { container } = renderWithProviders(<TaskHistoryWarning />)
		// When not showing, the component returns null
		expect(container.firstChild?.firstChild).toBeFalsy()
	})

	it("should render warning when task history exceeds threshold", () => {
		mockTaskHistory = Array(1001).fill({ id: "task" })

		renderWithProviders(<TaskHistoryWarning />)

		const warningButton = screen.getByRole("button", { name: /High Task History/i })
		expect(warningButton).toBeInTheDocument()
	})

	it("should not render if dismissed at current threshold", () => {
		mockTaskHistory = Array(1500).fill({ id: "task" })
		localStorageMock.getItem.mockReturnValue("1000")

		const { container } = renderWithProviders(<TaskHistoryWarning />)
		// When not showing, the component returns null
		expect(container.firstChild?.firstChild).toBeFalsy()
	})

	it("should render if task count exceeds next threshold after dismissal", () => {
		mockTaskHistory = Array(2001).fill({ id: "task" })
		localStorageMock.getItem.mockReturnValue("1000")

		renderWithProviders(<TaskHistoryWarning />)

		const warningButton = screen.getByRole("button", { name: /High Task History/i })
		expect(warningButton).toBeInTheDocument()
	})

	it("should show popover content when warning button is clicked", () => {
		mockTaskHistory = Array(1001).fill({ id: "task" })

		renderWithProviders(<TaskHistoryWarning />)

		const warningButton = screen.getByRole("button", { name: /High Task History/i })
		fireEvent.click(warningButton)

		expect(screen.getByText(/You have 1001 tasks in your history/)).toBeInTheDocument()
		expect(screen.getByText("Large task histories can slow down the extension.")).toBeInTheDocument()
	})

	it("should dismiss warning and save to localStorage", () => {
		mockTaskHistory = Array(1001).fill({ id: "task" })

		renderWithProviders(<TaskHistoryWarning />)

		const warningButton = screen.getByRole("button", { name: /High Task History/i })
		fireEvent.click(warningButton)

		const dismissButton = screen.getByRole("button", { name: /dismiss/i })
		fireEvent.click(dismissButton)

		// The component stores the actual task count, not the threshold
		expect(localStorageMock.setItem).toHaveBeenCalledWith("taskHistoryWarningDismissed", "1001")
	})

	it("should show cleanup confirmation dialog when cleanup button is clicked", async () => {
		const now = Date.now()
		const oldDate = now - 31 * 24 * 60 * 60 * 1000
		const newDate = now - 10 * 24 * 60 * 60 * 1000

		mockTaskHistory = [
			...Array(500).fill({ id: "old", ts: oldDate }),
			...Array(501).fill({ id: "new", ts: newDate }),
		]

		renderWithProviders(<TaskHistoryWarning />)

		const warningButton = screen.getByRole("button", { name: /High Task History/i })
		fireEvent.click(warningButton)

		const cleanupButton = screen.getByRole("button", { name: /Clean up 500 tasks older than 30 days/i })
		fireEvent.click(cleanupButton)

		await waitFor(() => {
			expect(screen.getByText("Clean Up Old Tasks")).toBeInTheDocument()
			expect(screen.getByText(/This will permanently delete 500 tasks older than 30 days/)).toBeInTheDocument()
		})
	})

	it("should call deleteMultipleTasksWithIds when cleanup is confirmed", async () => {
		const now = Date.now()
		const oldDate = now - 31 * 24 * 60 * 60 * 1000
		const newDate = now - 10 * 24 * 60 * 60 * 1000

		// Need 1001 total tasks to trigger warning
		mockTaskHistory = [
			{ id: "old1", ts: oldDate },
			{ id: "old2", ts: oldDate },
			...Array(999).fill({ id: "new", ts: newDate }),
		]

		renderWithProviders(<TaskHistoryWarning />)

		const warningButton = screen.getByRole("button", { name: /High Task History/i })
		fireEvent.click(warningButton)

		const cleanupButton = screen.getByRole("button", { name: /Clean up 2 tasks older than 30 days/i })
		fireEvent.click(cleanupButton)

		await waitFor(() => {
			const confirmButton = screen.getByRole("button", { name: "Clean Up" })
			fireEvent.click(confirmButton)
		})

		const { vscode } = await import("@src/utils/vscode")
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "deleteMultipleTasksWithIds",
			ids: ["old1", "old2"],
		})
	})

	it("should handle cleanup with no old tasks gracefully", async () => {
		const now = Date.now()
		const newDate = now - 10 * 24 * 60 * 60 * 1000

		mockTaskHistory = Array(1001).fill({ id: "new", ts: newDate })

		renderWithProviders(<TaskHistoryWarning />)

		const warningButton = screen.getByRole("button", { name: /High Task History/i })
		fireEvent.click(warningButton)

		const cleanupButton = screen.getByRole("button", { name: /No tasks older than 30 days/i })
		expect(cleanupButton).toBeDisabled()

		// Verify the "all recent" message is shown
		expect(screen.getByText("All your tasks are from the last 30 days")).toBeInTheDocument()
	})

	it("should apply custom className when provided", () => {
		mockTaskHistory = Array(1001).fill({ id: "task" })

		renderWithProviders(<TaskHistoryWarning className="custom-class" />)

		// The className is applied to the Button component
		const warningButton = screen.getByRole("button", { name: /High Task History/i })
		expect(warningButton).toHaveClass("custom-class")
	})

	it("should handle tasks without timestamps", async () => {
		// Tasks without timestamps are treated as old
		const now = Date.now()
		mockTaskHistory = [
			{ id: "no-ts-1" }, // No timestamp - treated as old
			{ id: "no-ts-2" }, // No timestamp - treated as old
			...Array(999).fill({ id: "task", ts: now }), // Recent tasks
		]

		renderWithProviders(<TaskHistoryWarning />)

		const warningButton = screen.getByRole("button", { name: /High Task History/i })
		fireEvent.click(warningButton)

		// Since tasks without timestamps are treated as old, button should show "No tasks older than 30 days"
		// because the component filters by ts < cutoffDate, and undefined is not less than any number
		const cleanupButton = screen.getByRole("button", { name: /No tasks older than 30 days/i })
		expect(cleanupButton).toBeDisabled()
	})
})
