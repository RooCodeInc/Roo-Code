import { render, fireEvent, waitFor } from "@/utils/test-utils"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"
import { AutoApproveKeyboardShortcuts } from "../AutoApproveKeyboardShortcuts"
import { DEFAULT_KEYBOARD_CONFIG } from "@src/constants/autoApproveConstants"

// Mock vscode API
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock ExtensionStateContext
vi.mock("@src/context/ExtensionStateContext")

// Mock the constants to control keyboard config
vi.mock("@src/constants/autoApproveConstants", () => ({
	KEYBOARD_SHORTCUTS: {
		"1": "alwaysAllowReadOnly",
		"2": "alwaysAllowWrite",
		"3": "alwaysAllowBrowser",
		"4": "alwaysAllowExecute",
		"5": "alwaysAllowMcp",
		"6": "alwaysAllowModeSwitch",
		"7": "alwaysAllowSubtasks",
		"8": "alwaysAllowFollowupQuestions",
		"9": "alwaysAllowUpdateTodoList",
		"0": "alwaysApproveResubmit",
	},
	KEYBOARD_SHORTCUTS_DISPLAY: {
		alwaysAllowReadOnly: "Alt+1",
		alwaysAllowWrite: "Alt+2",
		alwaysAllowBrowser: "Alt+3",
		alwaysAllowExecute: "Alt+4",
		alwaysAllowMcp: "Alt+5",
		alwaysAllowModeSwitch: "Alt+6",
		alwaysAllowSubtasks: "Alt+7",
		alwaysAllowFollowupQuestions: "Alt+8",
		alwaysAllowUpdateTodoList: "Alt+9",
		alwaysApproveResubmit: "Alt+0",
	},
	DEFAULT_KEYBOARD_CONFIG: {
		enabled: true,
		useAltKey: true,
		useCtrlShiftKey: false,
	},
}))

// Get the mocked postMessage function
const mockPostMessage = vscode.postMessage as ReturnType<typeof vi.fn>

describe("AutoApproveKeyboardShortcuts", () => {
	const defaultExtensionState = {
		autoApprovalEnabled: true,
		alwaysAllowReadOnly: false,
		alwaysAllowReadOnlyOutsideWorkspace: false,
		alwaysAllowWrite: false,
		alwaysAllowWriteOutsideWorkspace: false,
		alwaysAllowExecute: false,
		alwaysAllowBrowser: false,
		alwaysAllowMcp: false,
		alwaysAllowModeSwitch: false,
		alwaysAllowSubtasks: false,
		alwaysApproveResubmit: false,
		alwaysAllowFollowupQuestions: false,
		alwaysAllowUpdateTodoList: false,
		writeDelayMs: 3000,
		allowedMaxRequests: undefined,
		setAutoApprovalEnabled: vi.fn(),
		setAlwaysAllowReadOnly: vi.fn(),
		setAlwaysAllowWrite: vi.fn(),
		setAlwaysAllowExecute: vi.fn(),
		setAlwaysAllowBrowser: vi.fn(),
		setAlwaysAllowMcp: vi.fn(),
		setAlwaysAllowModeSwitch: vi.fn(),
		setAlwaysAllowSubtasks: vi.fn(),
		setAlwaysApproveResubmit: vi.fn(),
		setAlwaysAllowFollowupQuestions: vi.fn(),
		setAlwaysAllowUpdateTodoList: vi.fn(),
		setAllowedMaxRequests: vi.fn(),
	}

	beforeEach(() => {
		vi.clearAllMocks()
		;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue(defaultExtensionState)
	})

	describe("Keyboard shortcut handling", () => {
		it("should toggle read-only with Alt+1", async () => {
			const mockSetAlwaysAllowReadOnly = vi.fn()
			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultExtensionState,
				setAlwaysAllowReadOnly: mockSetAlwaysAllowReadOnly,
			})

			render(<AutoApproveKeyboardShortcuts />)

			// Simulate Alt+1 keypress
			fireEvent.keyDown(window, { key: "1", altKey: true })

			await waitFor(() => {
				expect(mockPostMessage).toHaveBeenCalledWith({
					type: "alwaysAllowReadOnly",
					bool: true,
				})
				expect(mockSetAlwaysAllowReadOnly).toHaveBeenCalledWith(true)
			})
		})

		it("should toggle write with Alt+2", async () => {
			const mockSetAlwaysAllowWrite = vi.fn()
			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultExtensionState,
				setAlwaysAllowWrite: mockSetAlwaysAllowWrite,
			})

			render(<AutoApproveKeyboardShortcuts />)

			// Simulate Alt+2 keypress
			fireEvent.keyDown(window, { key: "2", altKey: true })

			await waitFor(() => {
				expect(mockPostMessage).toHaveBeenCalledWith({
					type: "alwaysAllowWrite",
					bool: true,
				})
				expect(mockSetAlwaysAllowWrite).toHaveBeenCalledWith(true)
			})
		})

		it("should toggle resubmit with Alt+0", async () => {
			const mockSetAlwaysApproveResubmit = vi.fn()
			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultExtensionState,
				setAlwaysApproveResubmit: mockSetAlwaysApproveResubmit,
			})

			render(<AutoApproveKeyboardShortcuts />)

			// Simulate Alt+0 keypress
			fireEvent.keyDown(window, { key: "0", altKey: true })

			await waitFor(() => {
				expect(mockPostMessage).toHaveBeenCalledWith({
					type: "alwaysApproveResubmit",
					bool: true,
				})
				expect(mockSetAlwaysApproveResubmit).toHaveBeenCalledWith(true)
			})
		})

		it("should not trigger with Ctrl+1", async () => {
			render(<AutoApproveKeyboardShortcuts />)

			// Simulate Ctrl+1 keypress (should not trigger)
			fireEvent.keyDown(window, { key: "1", ctrlKey: true })

			await waitFor(() => {
				expect(mockPostMessage).not.toHaveBeenCalled()
			})
		})

		it("should not trigger with Shift+1", async () => {
			render(<AutoApproveKeyboardShortcuts />)

			// Simulate Shift+1 keypress (should not trigger)
			fireEvent.keyDown(window, { key: "1", shiftKey: true })

			await waitFor(() => {
				expect(mockPostMessage).not.toHaveBeenCalled()
			})
		})

		it("should not trigger with Meta+1", async () => {
			render(<AutoApproveKeyboardShortcuts />)

			// Simulate Meta+1 keypress (should not trigger)
			fireEvent.keyDown(window, { key: "1", metaKey: true })

			await waitFor(() => {
				expect(mockPostMessage).not.toHaveBeenCalled()
			})
		})

		it("should not trigger with Alt+Ctrl+1", async () => {
			render(<AutoApproveKeyboardShortcuts />)

			// Simulate Alt+Ctrl+1 keypress (should not trigger)
			fireEvent.keyDown(window, { key: "1", altKey: true, ctrlKey: true })

			await waitFor(() => {
				expect(mockPostMessage).not.toHaveBeenCalled()
			})
		})

		it("should toggle off when already enabled", async () => {
			const mockSetAlwaysAllowReadOnly = vi.fn()
			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultExtensionState,
				alwaysAllowReadOnly: true, // Already enabled
				setAlwaysAllowReadOnly: mockSetAlwaysAllowReadOnly,
			})

			render(<AutoApproveKeyboardShortcuts />)

			// Simulate Alt+1 keypress
			fireEvent.keyDown(window, { key: "1", altKey: true })

			await waitFor(() => {
				expect(mockPostMessage).toHaveBeenCalledWith({
					type: "alwaysAllowReadOnly",
					bool: false, // Should toggle off
				})
				expect(mockSetAlwaysAllowReadOnly).toHaveBeenCalledWith(false)
			})
		})
	})

	describe("Configuration support", () => {
		it("should not trigger when keyboard shortcuts are disabled", async () => {
			// Mock the config to disable shortcuts
			DEFAULT_KEYBOARD_CONFIG.enabled = false

			render(<AutoApproveKeyboardShortcuts />)

			// Simulate Alt+1 keypress
			fireEvent.keyDown(window, { key: "1", altKey: true })

			await waitFor(() => {
				expect(mockPostMessage).not.toHaveBeenCalled()
			})

			// Reset config
			DEFAULT_KEYBOARD_CONFIG.enabled = true
		})

		it("should use Ctrl+Shift when configured", async () => {
			// Mock the config to use Ctrl+Shift
			DEFAULT_KEYBOARD_CONFIG.useAltKey = false
			DEFAULT_KEYBOARD_CONFIG.useCtrlShiftKey = true

			const mockSetAlwaysAllowReadOnly = vi.fn()
			;(useExtensionState as ReturnType<typeof vi.fn>).mockReturnValue({
				...defaultExtensionState,
				setAlwaysAllowReadOnly: mockSetAlwaysAllowReadOnly,
			})

			render(<AutoApproveKeyboardShortcuts />)

			// Alt+1 should not work
			fireEvent.keyDown(window, { key: "1", altKey: true })
			await waitFor(() => {
				expect(mockPostMessage).not.toHaveBeenCalled()
			})

			// Ctrl+Shift+1 should work
			fireEvent.keyDown(window, { key: "1", ctrlKey: true, shiftKey: true })
			await waitFor(() => {
				expect(mockPostMessage).toHaveBeenCalledWith({
					type: "alwaysAllowReadOnly",
					bool: true,
				})
			})

			// Reset config
			DEFAULT_KEYBOARD_CONFIG.useAltKey = true
			DEFAULT_KEYBOARD_CONFIG.useCtrlShiftKey = false
		})
	})

	describe("Event listener cleanup", () => {
		it("should clean up event listeners on unmount", () => {
			const addEventListenerSpy = vi.spyOn(window, "addEventListener")
			const removeEventListenerSpy = vi.spyOn(window, "removeEventListener")

			const { unmount } = render(<AutoApproveKeyboardShortcuts />)

			// Check that event listener was added
			expect(addEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function))

			// Unmount the component
			unmount()

			// Check that event listener was removed
			expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function))

			addEventListenerSpy.mockRestore()
			removeEventListenerSpy.mockRestore()
		})
	})
})
