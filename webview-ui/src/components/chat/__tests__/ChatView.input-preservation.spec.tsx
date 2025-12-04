// pnpm --filter @roo-code/vscode-webview test src/components/chat/__tests__/ChatView.input-preservation.spec.tsx

import React from "react"
import { render, waitFor, act, fireEvent, screen } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"

import ChatView, { ChatViewProps } from "../ChatView"

// Define minimal types needed for testing
interface ClineMessage {
	type: "say" | "ask"
	say?: string
	ask?: string
	ts: number
	text?: string
	partial?: boolean
}

interface ExtensionState {
	version: string
	clineMessages: ClineMessage[]
	taskHistory: any[]
	shouldShowAnnouncement: boolean
	allowedCommands: string[]
	alwaysAllowExecute: boolean
	[key: string]: any
}

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

// Mock components that use ESM dependencies
vi.mock("../BrowserSessionRow", () => ({
	default: function MockBrowserSessionRow({ messages }: { messages: ClineMessage[] }) {
		return <div data-testid="browser-session">{JSON.stringify(messages)}</div>
	},
}))

vi.mock("../ChatRow", () => ({
	default: function MockChatRow({ message }: { message: ClineMessage }) {
		return <div data-testid="chat-row">{JSON.stringify(message)}</div>
	},
}))

vi.mock("../AutoApproveMenu", () => ({
	default: () => null,
}))

vi.mock("../../common/VersionIndicator", () => ({
	default: vi.fn(() => null),
}))

vi.mock("../Announcement", () => ({
	default: function MockAnnouncement({ hideAnnouncement }: { hideAnnouncement: () => void }) {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const React = require("react")
		return React.createElement(
			"div",
			{ "data-testid": "announcement-modal" },
			React.createElement("div", null, "What's New"),
			React.createElement("button", { onClick: hideAnnouncement }, "Close"),
		)
	},
}))

vi.mock("@/components/common/DismissibleUpsell", () => ({
	default: function MockDismissibleUpsell({ children }: { children: React.ReactNode }) {
		return <div data-testid="dismissible-upsell">{children}</div>
	},
}))

vi.mock("../QueuedMessages", () => ({
	QueuedMessages: function MockQueuedMessages() {
		return null
	},
}))

vi.mock("@src/components/welcome/RooTips", () => ({
	default: function MockRooTips() {
		return <div data-testid="roo-tips">Tips content</div>
	},
}))

vi.mock("@src/components/welcome/RooHero", () => ({
	default: function MockRooHero() {
		return <div data-testid="roo-hero">Hero content</div>
	},
}))

vi.mock("../common/TelemetryBanner", () => ({
	default: function MockTelemetryBanner() {
		return null
	},
}))

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"chat:save.title": "Save",
				"chat:reject.title": "Reject",
				"chat:approve.title": "Approve",
				"chat:retry.title": "Retry",
				"chat:startNewTask.title": "Start New Task",
			}
			return translations[key] || key
		},
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => {},
	},
	Trans: ({ i18nKey, children }: { i18nKey: string; children?: React.ReactNode }) => {
		return <>{children || i18nKey}</>
	},
}))

// Mock ChatTextArea with controlled input
vi.mock("../ChatTextArea", () => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const React = require("react")

	const ChatTextAreaComponent = React.forwardRef(function MockChatTextArea(
		props: {
			onSend: () => void
			inputValue?: string
			setInputValue?: (value: string) => void
			sendingDisabled?: boolean
			placeholderText?: string
			selectedImages?: string[]
			setSelectedImages?: (images: string[]) => void
			shouldDisableImages?: boolean
		},
		ref: React.ForwardedRef<{ focus: () => void }>,
	) {
		React.useImperativeHandle(ref, () => ({
			focus: vi.fn(),
		}))

		return React.createElement(
			"div",
			{ "data-testid": "chat-textarea" },
			React.createElement("input", {
				type: "text",
				value: props.inputValue || "",
				onChange: (e: any) => props.setInputValue?.(e.target.value),
				onKeyDown: (e: any) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault()
						props.onSend()
					}
				},
				"data-sending-disabled": props.sendingDisabled,
				placeholder: props.placeholderText,
			}),
		)
	})

	return {
		default: ChatTextAreaComponent,
		ChatTextArea: ChatTextAreaComponent,
	}
})

// Mock VSCode components
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: function MockVSCodeButton({
		children,
		onClick,
	}: {
		children: React.ReactNode
		onClick?: () => void
	}) {
		return <button onClick={onClick}>{children}</button>
	},
	VSCodeLink: function MockVSCodeLink({ children, href }: { children: React.ReactNode; href?: string }) {
		return <a href={href}>{children}</a>
	},
}))

// Mock UI components
vi.mock("@src/components/ui", () => ({
	StandardTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	Button: function MockButton({
		children,
		onClick,
		disabled,
		variant,
		className,
	}: {
		children: React.ReactNode
		onClick?: () => void
		disabled?: boolean
		variant?: string
		className?: string
	}) {
		return (
			<button
				onClick={onClick}
				disabled={disabled}
				data-variant={variant}
				className={className}
				data-testid={
					variant === "primary" ? "primary-button" : variant === "secondary" ? "secondary-button" : "button"
				}>
				{children}
			</button>
		)
	},
	Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
	DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

// Mock CloudUpsellDialog
vi.mock("@src/components/cloud/CloudUpsellDialog", () => ({
	CloudUpsellDialog: () => null,
}))

// Mock useCloudUpsell hook
vi.mock("@src/hooks/useCloudUpsell", () => ({
	useCloudUpsell: () => ({
		isOpen: false,
		openUpsell: vi.fn(),
		closeUpsell: vi.fn(),
		handleConnect: vi.fn(),
	}),
}))

const mockPostMessage = (state: Partial<ExtensionState>) => {
	window.postMessage(
		{
			type: "state",
			state: {
				version: "1.0.0",
				clineMessages: [],
				taskHistory: [],
				shouldShowAnnouncement: false,
				allowedCommands: [],
				alwaysAllowExecute: false,
				cloudIsAuthenticated: false,
				telemetrySetting: "enabled",
				...state,
			},
		},
		"*",
	)
}

const defaultProps: ChatViewProps = {
	isHidden: false,
	showAnnouncement: false,
	hideAnnouncement: () => {},
}

const queryClient = new QueryClient()

const renderChatView = (props: Partial<ChatViewProps> = {}) => {
	return render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<ChatView {...defaultProps} {...props} />
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)
}

describe("ChatView - Input Preservation on Tool Errors", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("preserves user input when tool execution fails after approval", async () => {
		renderChatView()

		// Set up initial state with a tool ask
		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "tool",
					ts: Date.now(),
					text: JSON.stringify({
						tool: "editedExistingFile",
						path: "test.txt",
						content: "new content",
					}),
					partial: false,
				},
			],
		})

		// Wait for buttons to appear
		await waitFor(() => {
			expect(screen.getByTestId("primary-button")).toBeInTheDocument()
			expect(screen.getByTestId("primary-button")).toHaveTextContent("Save")
		})

		// Type a message in the input
		const input = screen.getByTestId("chat-textarea").querySelector("input")!
		await act(async () => {
			fireEvent.change(input, { target: { value: "Please fix the indentation" } })
		})

		// Verify input has the value
		expect(input.value).toBe("Please fix the indentation")

		// Clear mock to track only the approval message
		vi.mocked(vscode.postMessage).mockClear()

		// Click Save button
		const saveButton = screen.getByTestId("primary-button")
		await act(async () => {
			fireEvent.click(saveButton)
		})

		// Verify the message was sent with the user's text
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "askResponse",
			askResponse: "yesButtonClicked",
			text: "Please fix the indentation",
			images: [],
		})

		// Simulate an error occurring during tool execution
		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 3000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "tool",
					ts: Date.now() - 2000,
					text: JSON.stringify({
						tool: "editedExistingFile",
						path: "test.txt",
						content: "new content",
					}),
					partial: false,
				},
				{
					type: "say",
					say: "error",
					ts: Date.now() - 1000,
					text: "Failed to apply diff: merge conflict",
				},
				{
					type: "ask",
					ask: "api_req_failed",
					ts: Date.now(),
					text: "The operation failed. Would you like to retry?",
					partial: false,
				},
			],
		})

		// Wait for error state
		await waitFor(() => {
			expect(screen.getByTestId("primary-button")).toHaveTextContent("Retry")
		})

		// IMPORTANT: Verify that the user's input is still preserved
		expect(input.value).toBe("Please fix the indentation")
	})

	it("clears input when user explicitly rejects the tool", async () => {
		renderChatView()

		// Set up initial state with a tool ask
		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "tool",
					ts: Date.now(),
					text: JSON.stringify({
						tool: "editedExistingFile",
						path: "test.txt",
						content: "new content",
					}),
					partial: false,
				},
			],
		})

		// Wait for buttons to appear
		await waitFor(() => {
			expect(screen.getByTestId("secondary-button")).toBeInTheDocument()
			expect(screen.getByTestId("secondary-button")).toHaveTextContent("Reject")
		})

		// Type a message in the input
		const input = screen.getByTestId("chat-textarea").querySelector("input")!
		await act(async () => {
			fireEvent.change(input, { target: { value: "Don't make this change" } })
		})

		// Verify input has the value
		expect(input.value).toBe("Don't make this change")

		// Clear mock to track only the rejection message
		vi.mocked(vscode.postMessage).mockClear()

		// Click Reject button
		const rejectButton = screen.getByTestId("secondary-button")
		await act(async () => {
			fireEvent.click(rejectButton)
		})

		// Verify the message was sent with the user's text
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "askResponse",
			askResponse: "noButtonClicked",
			text: "Don't make this change",
			images: [],
		})

		// For rejection, input should be cleared since user explicitly rejected
		expect(input.value).toBe("")
	})

	it("clears input only after successful tool execution", async () => {
		renderChatView()

		// Set up initial state with a tool ask
		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "tool",
					ts: Date.now(),
					text: JSON.stringify({
						tool: "editedExistingFile",
						path: "test.txt",
						content: "new content",
					}),
					partial: false,
				},
			],
		})

		// Wait for buttons to appear
		await waitFor(() => {
			expect(screen.getByTestId("primary-button")).toBeInTheDocument()
		})

		// Type a message in the input
		const input = screen.getByTestId("chat-textarea").querySelector("input")!
		await act(async () => {
			fireEvent.change(input, { target: { value: "Looks good, please proceed" } })
		})

		// Click Save button
		const saveButton = screen.getByTestId("primary-button")
		await act(async () => {
			fireEvent.click(saveButton)
		})

		// Input should still be there initially
		expect(input.value).toBe("Looks good, please proceed")

		// Simulate successful tool execution (api_req_started after tool approval)
		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 3000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "tool",
					ts: Date.now() - 2000,
					text: JSON.stringify({
						tool: "editedExistingFile",
						path: "test.txt",
						content: "new content",
					}),
					partial: false,
				},
				{
					type: "say",
					say: "api_req_started",
					ts: Date.now(),
					text: JSON.stringify({ apiProtocol: "anthropic" }),
					partial: false,
				},
			],
		})

		// Wait for state update
		await waitFor(() => {
			// After successful tool execution start, input should be cleared
			expect(input.value).toBe("")
		})
	})

	it("preserves input when multiple errors occur in sequence", async () => {
		renderChatView()

		// Set up initial state with a tool ask
		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "tool",
					ts: Date.now(),
					text: JSON.stringify({
						tool: "editedExistingFile",
						path: "test.txt",
						content: "new content",
					}),
					partial: false,
				},
			],
		})

		// Type a message
		const input = screen.getByTestId("chat-textarea").querySelector("input")!
		await act(async () => {
			fireEvent.change(input, { target: { value: "Important context for the fix" } })
		})

		// Click Save
		const saveButton = screen.getByTestId("primary-button")
		await act(async () => {
			fireEvent.click(saveButton)
		})

		// First error
		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 4000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "tool",
					ts: Date.now() - 3000,
					text: JSON.stringify({
						tool: "editedExistingFile",
						path: "test.txt",
						content: "new content",
					}),
					partial: false,
				},
				{
					type: "say",
					say: "error",
					ts: Date.now() - 2000,
					text: "First error: File not found",
				},
				{
					type: "ask",
					ask: "api_req_failed",
					ts: Date.now() - 1000,
					text: "The operation failed. Would you like to retry?",
					partial: false,
				},
			],
		})

		// Input should still be preserved after first error
		await waitFor(() => {
			expect(input.value).toBe("Important context for the fix")
		})

		// Click Retry
		await act(async () => {
			const retryButton = screen.getByTestId("primary-button")
			fireEvent.click(retryButton)
		})

		// Second error
		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 5000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "tool",
					ts: Date.now() - 4000,
					text: JSON.stringify({
						tool: "editedExistingFile",
						path: "test.txt",
						content: "new content",
					}),
					partial: false,
				},
				{
					type: "say",
					say: "error",
					ts: Date.now() - 3000,
					text: "First error: File not found",
				},
				{
					type: "say",
					say: "error",
					ts: Date.now() - 2000,
					text: "Second error: Permission denied",
				},
				{
					type: "ask",
					ask: "api_req_failed",
					ts: Date.now(),
					text: "The operation failed again. Would you like to retry?",
					partial: false,
				},
			],
		})

		// Input should STILL be preserved after second error
		await waitFor(() => {
			expect(input.value).toBe("Important context for the fix")
		})
	})
})
