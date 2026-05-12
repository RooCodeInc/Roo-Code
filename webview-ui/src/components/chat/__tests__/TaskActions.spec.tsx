import type { HistoryItem } from "@roo-code/types"

import { render, screen, fireEvent } from "@/utils/test-utils"
import { vscode } from "@/utils/vscode"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useCopyToClipboard } from "@/utils/clipboard"

import { TaskActions } from "../TaskActions"

Object.defineProperty(Element.prototype, "scrollIntoView", {
	value: vi.fn(),
	writable: true,
})

vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(),
}))

vi.mock("@/utils/clipboard", () => ({
	useCopyToClipboard: vi.fn(),
}))

const mockPostMessage = vi.mocked(vscode.postMessage)
const mockUseExtensionState = vi.mocked(useExtensionState)
const mockUseCopyToClipboard = vi.mocked(useCopyToClipboard)

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"chat:task.export": "Export task history",
				"chat:task.delete": "Delete Task (Shift + Click to skip confirmation)",
				"chat:task.openApiHistory": "Open API History",
				"chat:task.openUiHistory": "Open UI History",
				"history:copyPrompt": "Copy",
			}
			return translations[key] || key
		},
	}),
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
}))

vi.mock("pretty-bytes", () => ({
	default: (bytes: number) => `${bytes} B`,
}))

describe("TaskActions", () => {
	const mockItem: HistoryItem = {
		id: "test-task-id",
		number: 1,
		ts: Date.now(),
		task: "Test task",
		tokensIn: 100,
		tokensOut: 200,
		totalCost: 0.01,
		size: 1024,
	}

	beforeEach(() => {
		vi.clearAllMocks()
		mockUseExtensionState.mockReturnValue({ debug: false } as any)
		mockUseCopyToClipboard.mockReturnValue({
			copyWithFeedback: vi.fn(),
			showCopyFeedback: false,
		})
	})

	it("does not render a share button", () => {
		render(<TaskActions item={mockItem} buttonsDisabled={false} />)

		expect(screen.queryByTestId("share-button")).not.toBeInTheDocument()
	})

	it("renders export button", () => {
		render(<TaskActions item={mockItem} buttonsDisabled={false} />)

		expect(screen.getByLabelText("Export task history")).toBeInTheDocument()
	})

	it("sends exportCurrentTask message when export button is clicked", () => {
		render(<TaskActions item={mockItem} buttonsDisabled={false} />)

		fireEvent.click(screen.getByLabelText("Export task history"))

		expect(mockPostMessage).toHaveBeenCalledWith({
			type: "exportCurrentTask",
		})
	})

	it("renders delete button when item has size", () => {
		render(<TaskActions item={mockItem} buttonsDisabled={false} />)

		expect(screen.getByLabelText("Delete Task (Shift + Click to skip confirmation)")).toBeInTheDocument()
	})

	it("does not render delete button when item has no size", () => {
		const itemWithoutSize = { ...mockItem, size: 0 }
		render(<TaskActions item={itemWithoutSize} buttonsDisabled={false} />)

		expect(screen.queryByLabelText("Delete Task (Shift + Click to skip confirmation)")).not.toBeInTheDocument()
	})

	it("copies the task prompt", () => {
		const copyWithFeedback = vi.fn()
		mockUseCopyToClipboard.mockReturnValue({
			copyWithFeedback,
			showCopyFeedback: false,
		})

		render(<TaskActions item={mockItem} buttonsDisabled={false} />)

		fireEvent.click(screen.getByLabelText("Copy"))

		expect(copyWithFeedback).toHaveBeenCalledWith("Test task", expect.anything())
	})

	it("renders debug history buttons when debug is enabled", () => {
		mockUseExtensionState.mockReturnValue({ debug: true } as any)

		render(<TaskActions item={mockItem} buttonsDisabled={false} />)

		expect(screen.getByLabelText("Open API History")).toBeInTheDocument()
		expect(screen.getByLabelText("Open UI History")).toBeInTheDocument()
	})
})
