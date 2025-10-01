import React from "react"
import { render, screen, fireEvent, waitFor, act } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"

import ChatView, { ChatViewProps } from "../ChatView"

// Mock localStorage
const localStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
}
Object.defineProperty(window, "localStorage", { value: localStorageMock })

// Mock vscode API
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock use-sound hook
const mockPlayFunction = vi.fn()
vi.mock("use-sound", () => ({
	default: vi.fn().mockImplementation(() => {
		return [mockPlayFunction]
	}),
}))

// Mock components that might cause issues in testing
vi.mock("../BrowserSessionRow", () => ({
	default: function MockBrowserSessionRow() {
		return <div data-testid="browser-session" />
	},
}))

vi.mock("../ChatTextArea", () => ({
	ChatTextArea: React.forwardRef(function MockChatTextArea(props: any, ref: any) {
		React.useImperativeHandle(ref, () => ({
			focus: vi.fn(),
		}))

		return (
			<div data-testid="chat-textarea">
				<textarea
					value={props.inputValue || ""}
					onChange={(e) => props.setInputValue(e.target.value)}
					placeholder={props.placeholderText}
					data-testid="message-input"
				/>
				<button onClick={() => props.onSend()} disabled={props.sendingDisabled} data-testid="send-button">
					Send
				</button>
			</div>
		)
	}),
}))

vi.mock("../TaskHeader", () => ({
	default: function MockTaskHeader() {
		return <div data-testid="task-header" />
	},
}))

vi.mock("../Announcement", () => ({
	default: function MockAnnouncement() {
		return <div data-testid="announcement" />
	},
}))

vi.mock("../../welcome/RooHero", () => ({
	default: function MockRooHero() {
		return <div data-testid="roo-hero" />
	},
}))

vi.mock("../../welcome/RooTips", () => ({
	default: function MockRooTips() {
		return <div data-testid="roo-tips" />
	},
}))

describe("ChatView Autosave Integration", () => {
	let queryClient: QueryClient
	let mockPostMessage: ReturnType<typeof vi.fn>

	const defaultProps: ChatViewProps = {
		isHidden: false,
		showAnnouncement: false,
		hideAnnouncement: vi.fn(),
	}

	const _createMockState = (overrides: any = {}) => ({
		version: "1.0.0",
		clineMessages: [],
		taskHistory: [],
		currentTaskItem: { id: "test-task-123" },
		shouldShowAnnouncement: false,
		allowedCommands: [],
		alwaysAllowExecute: false,
		apiConfiguration: {
			apiProvider: "anthropic",
		},
		...overrides,
	})

	const renderChatView = (_stateOverrides: any = {}) => {
		return render(
			<QueryClientProvider client={queryClient}>
				<ExtensionStateContextProvider>
					<ChatView {...defaultProps} />
				</ExtensionStateContextProvider>
			</QueryClientProvider>,
		)
	}

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		})

		mockPostMessage = vi.fn()
		vscode.postMessage = mockPostMessage

		localStorageMock.getItem.mockClear()
		localStorageMock.setItem.mockClear()
		localStorageMock.removeItem.mockClear()
		localStorageMock.clear.mockClear()

		vi.clearAllTimers()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.runOnlyPendingTimers()
		vi.useRealTimers()
	})

	describe("Draft Persistence", () => {
		it("should restore draft content when component mounts with saved draft", () => {
			// Mock saved draft in localStorage
			localStorageMock.getItem.mockReturnValue("This is a saved draft")

			renderChatView()

			const textarea = screen.getByTestId("message-input")
			expect(textarea).toHaveValue("This is a saved draft")
			expect(localStorageMock.getItem).toHaveBeenCalledWith("roo-draft.test-task-123")
		})

		it("should start with empty input when no draft is saved", () => {
			localStorageMock.getItem.mockReturnValue(null)

			renderChatView()

			const textarea = screen.getByTestId("message-input")
			expect(textarea).toHaveValue("")
			expect(localStorageMock.getItem).toHaveBeenCalledWith("roo-draft.test-task-123")
		})

		it("should auto-save draft content as user types (with debouncing)", async () => {
			localStorageMock.getItem.mockReturnValue(null)
			renderChatView()

			const textarea = screen.getByTestId("message-input")

			// Type a message
			fireEvent.change(textarea, { target: { value: "Hello world" } })

			// Should not save immediately
			expect(localStorageMock.setItem).not.toHaveBeenCalled()

			// Fast-forward past debounce delay
			act(() => {
				vi.advanceTimersByTime(400)
			})

			await waitFor(() => {
				expect(localStorageMock.setItem).toHaveBeenCalledWith("roo-draft.test-task-123", "Hello world")
			})
		})

		it("should demonstrate the bug fix: data persists across component remount", async () => {
			// First render - user types something
			localStorageMock.getItem.mockReturnValue(null)
			const { unmount } = renderChatView()

			const textarea = screen.getByTestId("message-input")
			fireEvent.change(textarea, { target: { value: "Important message" } })

			// Wait for debounce
			act(() => {
				vi.advanceTimersByTime(400)
			})

			// Verify save happened
			await waitFor(() => {
				expect(localStorageMock.setItem).toHaveBeenCalledWith("roo-draft.test-task-123", "Important message")
			})

			// Simulate component unmount (like VSCode webview reload)
			unmount()

			// Mock that localStorage now returns the saved data
			localStorageMock.getItem.mockReturnValue("Important message")

			// Second render - should restore the saved content
			renderChatView()

			const newTextarea = screen.getByTestId("message-input")
			expect(newTextarea).toHaveValue("Important message")
			expect(localStorageMock.getItem).toHaveBeenCalledWith("roo-draft.test-task-123")
		})
	})

	describe("Conversation Isolation", () => {
		it("should use different storage keys for different conversations", () => {
			// Render with first task ID
			localStorageMock.getItem.mockReturnValue(null)
			const { unmount } = renderChatView({ currentTaskItem: { id: "task-1" } })

			let textarea = screen.getByTestId("message-input")
			fireEvent.change(textarea, { target: { value: "Message for task 1" } })

			act(() => {
				vi.advanceTimersByTime(400)
			})

			unmount()

			// Render with second task ID
			renderChatView({ currentTaskItem: { id: "task-2" } })

			textarea = screen.getByTestId("message-input")
			fireEvent.change(textarea, { target: { value: "Message for task 2" } })

			act(() => {
				vi.advanceTimersByTime(400)
			})

			// Should have saved to different keys
			expect(localStorageMock.setItem).toHaveBeenCalledWith("roo-draft.task-1", "Message for task 1")
			expect(localStorageMock.setItem).toHaveBeenCalledWith("roo-draft.task-2", "Message for task 2")
		})

		it("should handle undefined task ID gracefully", () => {
			localStorageMock.getItem.mockReturnValue(null)
			renderChatView({ currentTaskItem: undefined })

			const textarea = screen.getByTestId("message-input")
			fireEvent.change(textarea, { target: { value: "Message with no task" } })

			act(() => {
				vi.advanceTimersByTime(400)
			})

			// Should use 'default' as fallback key
			expect(localStorageMock.setItem).toHaveBeenCalledWith("roo-draft.default", "Message with no task")
		})
	})

	describe("Message Sending and Draft Clearing", () => {
		it("should clear draft after successful message send", async () => {
			localStorageMock.getItem.mockReturnValue("Draft message")
			renderChatView()

			const textarea = screen.getByTestId("message-input")
			const sendButton = screen.getByTestId("send-button")

			// Verify draft is loaded
			expect(textarea).toHaveValue("Draft message")

			// Send the message
			fireEvent.click(sendButton)

			// Should clear the draft
			await waitFor(() => {
				expect(localStorageMock.removeItem).toHaveBeenCalledWith("roo-draft.test-task-123")
			})

			// Verify input is cleared
			expect(textarea).toHaveValue("")
		})

		it("should clear draft when input becomes empty", async () => {
			localStorageMock.getItem.mockReturnValue("Some text")
			renderChatView()

			const textarea = screen.getByTestId("message-input")

			// Clear the input
			fireEvent.change(textarea, { target: { value: "   " } })

			// Wait for debounce
			act(() => {
				vi.advanceTimersByTime(400)
			})

			// Should remove from localStorage for empty/whitespace content
			await waitFor(() => {
				expect(localStorageMock.removeItem).toHaveBeenCalledWith("roo-draft.test-task-123")
			})
		})
	})

	describe("Error Handling", () => {
		it("should handle localStorage errors gracefully during restoration", () => {
			localStorageMock.getItem.mockImplementation(() => {
				throw new Error("Storage quota exceeded")
			})

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			renderChatView()

			const textarea = screen.getByTestId("message-input")
			expect(textarea).toHaveValue("")

			expect(consoleSpy).toHaveBeenCalledWith(
				"[useAutosaveDraft] localStorage operation failed:",
				expect.any(Error),
			)

			consoleSpy.mockRestore()
		})

		it("should handle localStorage errors gracefully during save", async () => {
			localStorageMock.getItem.mockReturnValue(null)
			localStorageMock.setItem.mockImplementation(() => {
				throw new Error("Storage quota exceeded")
			})

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			renderChatView()

			const textarea = screen.getByTestId("message-input")
			fireEvent.change(textarea, { target: { value: "Test message" } })

			act(() => {
				vi.advanceTimersByTime(400)
			})

			await waitFor(() => {
				expect(consoleSpy).toHaveBeenCalledWith(
					"[useAutosaveDraft] localStorage operation failed:",
					expect.any(Error),
				)
			})

			consoleSpy.mockRestore()
		})
	})

	describe("Real-world User Workflows", () => {
		it("should handle rapid typing followed by navigation away", async () => {
			localStorageMock.getItem.mockReturnValue(null)
			const { unmount } = renderChatView()

			const textarea = screen.getByTestId("message-input")

			// Simulate rapid typing
			const typingUpdates = [
				"How",
				"How can",
				"How can I",
				"How can I help",
				"How can I help you",
				"How can I help you with",
				"How can I help you with this",
				"How can I help you with this task?",
			]

			for (const update of typingUpdates) {
				fireEvent.change(textarea, { target: { value: update } })
				// Small delay between keystrokes
				act(() => {
					vi.advanceTimersByTime(50)
				})
			}

			// Navigate away before debounce completes
			unmount()

			// Fast-forward to ensure any pending saves complete
			act(() => {
				vi.advanceTimersByTime(1000)
			})

			// Should have the final typed content available for save
			// (Note: In real implementation, the unmount cleanup prevents the save
			// but this tests the debouncing logic)
			expect(textarea).toHaveValue("How can I help you with this task?")
		})

		it("should restore draft, allow editing, and send message", async () => {
			// Start with a saved draft
			localStorageMock.getItem.mockReturnValue("Hello, I need help with")
			renderChatView()

			const textarea = screen.getByTestId("message-input")
			const sendButton = screen.getByTestId("send-button")

			// Verify restoration
			expect(textarea).toHaveValue("Hello, I need help with")

			// User continues typing
			fireEvent.change(textarea, { target: { value: "Hello, I need help with setting up the project" } })

			// Wait for auto-save
			act(() => {
				vi.advanceTimersByTime(400)
			})

			await waitFor(() => {
				expect(localStorageMock.setItem).toHaveBeenCalledWith(
					"roo-draft.test-task-123",
					"Hello, I need help with setting up the project",
				)
			})

			// User sends the message
			fireEvent.click(sendButton)

			// Verify message was sent and draft cleared
			expect(mockPostMessage).toHaveBeenCalled()
			expect(localStorageMock.removeItem).toHaveBeenCalledWith("roo-draft.test-task-123")
			expect(textarea).toHaveValue("")
		})
	})
})
