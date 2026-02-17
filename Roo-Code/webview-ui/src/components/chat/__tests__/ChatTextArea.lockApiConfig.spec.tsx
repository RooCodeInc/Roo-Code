import { defaultModeSlug } from "@roo/modes"

import { render, fireEvent, screen } from "@src/utils/test-utils"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"

import { ChatTextArea } from "../ChatTextArea"

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@src/components/common/CodeBlock")
vi.mock("@src/components/common/MarkdownBlock")
vi.mock("@src/utils/path-mentions", () => ({
	convertToMentionPath: vi.fn((path: string) => path),
}))

// Mock ExtensionStateContext
vi.mock("@src/context/ExtensionStateContext")

const mockPostMessage = vscode.postMessage as ReturnType<typeof vi.fn>

describe("ChatTextArea - lockApiConfigAcrossModes toggle", () => {
	const defaultProps = {
		inputValue: "",
		setInputValue: vi.fn(),
		onSend: vi.fn(),
		sendingDisabled: false,
		selectApiConfigDisabled: false,
		onSelectImages: vi.fn(),
		shouldDisableImages: false,
		placeholderText: "Type a message...",
		selectedImages: [] as string[],
		setSelectedImages: vi.fn(),
		onHeightChange: vi.fn(),
		mode: defaultModeSlug,
		setMode: vi.fn(),
		modeShortcutText: "(⌘. for next mode)",
	}

	const defaultState = {
		filePaths: [],
		openedTabs: [],
		apiConfiguration: { apiProvider: "anthropic" },
		taskHistory: [],
		cwd: "/test/workspace",
		listApiConfigMeta: [{ id: "default", name: "Default", modelId: "claude-3" }],
		currentApiConfigName: "Default",
		pinnedApiConfigs: {},
		togglePinnedApiConfig: vi.fn(),
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	/**
	 * Helper: Opens the ApiConfigSelector popover by clicking the trigger,
	 * then returns the lock toggle button by its aria-label.
	 */
	const openPopoverAndGetLockToggle = (ariaLabel: string) => {
		const trigger = screen.getByTestId("dropdown-trigger")
		fireEvent.click(trigger)
		return screen.getByRole("button", { name: ariaLabel })
	}

	describe("rendering", () => {
		it("renders with muted opacity when lockApiConfigAcrossModes is false", () => {
			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultState,
				lockApiConfigAcrossModes: false,
			})

			render(<ChatTextArea {...defaultProps} />)

			const button = openPopoverAndGetLockToggle("chat:lockApiConfigAcrossModes")
			expect(button).toBeInTheDocument()
			// Unlocked state has muted opacity
			expect(button.className).toContain("opacity-60")
			expect(button.className).not.toContain("text-vscode-focusBorder")
		})

		it("renders with highlight color when lockApiConfigAcrossModes is true", () => {
			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultState,
				lockApiConfigAcrossModes: true,
			})

			render(<ChatTextArea {...defaultProps} />)

			const button = openPopoverAndGetLockToggle("chat:unlockApiConfigAcrossModes")
			expect(button).toBeInTheDocument()
			// Locked state has the focus border highlight color
			expect(button.className).toContain("text-vscode-focusBorder")
			expect(button.className).not.toContain("opacity-60")
		})

		it("renders in unlocked state when lockApiConfigAcrossModes is undefined (default)", () => {
			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultState,
			})

			render(<ChatTextArea {...defaultProps} />)

			const button = openPopoverAndGetLockToggle("chat:lockApiConfigAcrossModes")
			expect(button).toBeInTheDocument()
			// Default (undefined/falsy) renders in unlocked style
			expect(button.className).toContain("opacity-60")
		})
	})

	describe("interaction", () => {
		it("posts lockApiConfigAcrossModes=true message when locking", () => {
			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultState,
				lockApiConfigAcrossModes: false,
			})

			render(<ChatTextArea {...defaultProps} />)

			// Clear any initialization messages
			mockPostMessage.mockClear()

			const button = openPopoverAndGetLockToggle("chat:lockApiConfigAcrossModes")
			fireEvent.click(button)

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "lockApiConfigAcrossModes",
				bool: true,
			})
		})

		it("posts lockApiConfigAcrossModes=false message when unlocking", () => {
			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultState,
				lockApiConfigAcrossModes: true,
			})

			render(<ChatTextArea {...defaultProps} />)

			// Clear any initialization messages
			mockPostMessage.mockClear()

			const button = openPopoverAndGetLockToggle("chat:unlockApiConfigAcrossModes")
			fireEvent.click(button)

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "lockApiConfigAcrossModes",
				bool: false,
			})
		})
	})
})
