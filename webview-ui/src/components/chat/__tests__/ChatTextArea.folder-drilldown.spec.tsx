import React from "react"
import { render, fireEvent, screen } from "@src/utils/test-utils"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"
import { ContextMenuOptionType } from "@src/utils/context-mentions"
import { ChatTextArea } from "../ChatTextArea"

// Mock VS Code messaging
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Capture the last props passed to ContextMenu so we can invoke onSelect directly
let lastContextMenuProps: any = null
vi.mock("../ContextMenu", () => {
	return {
		__esModule: true,
		default: (props: any) => {
			lastContextMenuProps = props
			return <div data-testid="context-menu" />
		},
		__getLastProps: () => lastContextMenuProps,
	}
})

// Mock ExtensionStateContext
vi.mock("@src/context/ExtensionStateContext")

describe("ChatTextArea - folder drilldown behavior", () => {
	const defaultProps = {
		inputValue: "",
		setInputValue: vi.fn(),
		onSend: vi.fn(),
		sendingDisabled: false,
		selectApiConfigDisabled: false,
		onSelectImages: vi.fn(),
		shouldDisableImages: false,
		placeholderText: "Type a message...",
		selectedImages: [],
		setSelectedImages: vi.fn(),
		onHeightChange: vi.fn(),
		mode: "architect",
		setMode: vi.fn(),
		modeShortcutText: "(⌘. for next mode)",
	}

	beforeEach(() => {
		vi.clearAllMocks()
		;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
			filePaths: ["src/", "src/index.ts"],
			openedTabs: [],
			taskHistory: [],
			cwd: "/test/workspace",
		})
	})

	it("keeps picker open and triggers folder children search when selecting a folder", () => {
		const setInputValue = vi.fn()

		const { container } = render(<ChatTextArea {...defaultProps} setInputValue={setInputValue} />)

		// Type to open the @-context menu and set a query
		const textarea = container.querySelector("textarea")!
		fireEvent.change(textarea, {
			target: { value: "@s", selectionStart: 2 },
		})

		// Ensure our mocked ContextMenu rendered and captured props
		expect(screen.getByTestId("context-menu")).toBeInTheDocument()
		const props = lastContextMenuProps
		expect(props).toBeTruthy()
		expect(typeof props.onSelect).toBe("function")

		// Simulate selecting a concrete folder suggestion (e.g. "/src")
		props.onSelect(ContextMenuOptionType.Folder, "/src")

		// The input should contain "@/src/" with NO trailing space and the picker should remain open
		expect(setInputValue).toHaveBeenCalled()
		const finalValue = setInputValue.mock.calls.at(-1)?.[0]
		expect(finalValue).toBe("@/src/")

		// Context menu should still be present (picker remains open)
		expect(screen.getByTestId("context-menu")).toBeInTheDocument()

		// It should have kicked off a searchFiles request for the folder children
		const pm = vscode.postMessage as ReturnType<typeof vi.fn>
		expect(pm).toHaveBeenCalled()
		const lastMsg = pm.mock.calls.at(-1)?.[0]
		expect(lastMsg).toMatchObject({ type: "searchFiles" })
		// Query mirrors substring after '@' including leading slash per existing logic
		expect(lastMsg.query).toBe("/src/")
		expect(typeof lastMsg.requestId).toBe("string")
	})
})
