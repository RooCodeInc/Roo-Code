// pnpm --filter @roo-code/vscode-webview test src/components/chat/__tests__/ChatView.spec.tsx

import React from "react"
import { render, waitFor, act, fireEvent } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"

import ChatView, { ChatViewProps } from "../ChatView"
import {
	setFollowUpInteractionInstrumentationSink,
	type FollowUpInteractionMarker,
} from "../followUpInteractionInstrumentation"

// Define minimal types needed for testing
interface ClineMessage {
	type: "say" | "ask"
	say?: string
	ask?: string
	ts: number
	text?: string
	partial?: boolean
}

interface SuggestionItem {
	answer: string
	mode?: string
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
	default: function MockChatRow({
		message,
		isFollowUpAnswered,
		onSuggestionClick,
	}: {
		message: ClineMessage
		isFollowUpAnswered?: boolean
		onSuggestionClick?: (suggestion: SuggestionItem, event?: React.MouseEvent) => void
	}) {
		return (
			<div
				data-testid={`chat-row-${message.ts}`}
				data-message-ask={message.ask ?? ""}
				data-followup-answered={String(Boolean(isFollowUpAnswered))}>
				{message.ask === "followup" && (
					<button
						type="button"
						data-testid={`mock-followup-suggestion-${message.ts}`}
						onClick={(event) => onSuggestionClick?.({ answer: "Mock suggestion", mode: "code" }, event)}>
						Pick follow-up suggestion
					</button>
				)}
				{JSON.stringify(message)}
			</div>
		)
	},
}))

vi.mock("../AutoApproveMenu", () => ({
	default: () => null,
}))

// Mock react-virtuoso to render items directly without virtualization
// This allows tests to verify items rendered in the chat list
vi.mock("react-virtuoso", () => ({
	Virtuoso: function MockVirtuoso({
		data,
		itemContent,
	}: {
		data: ClineMessage[]
		itemContent: (index: number, item: ClineMessage) => React.ReactNode
	}) {
		return (
			<div data-testid="virtuoso-item-list">
				{data.map((item, index) => (
					<div key={item.ts} data-testid={`virtuoso-item-${index}`}>
						{itemContent(index, item)}
					</div>
				))}
			</div>
		)
	},
}))

// Mock VersionIndicator - returns null by default to prevent rendering in tests
vi.mock("../../common/VersionIndicator", () => ({
	default: vi.fn(() => null),
}))

// Get the mock function after the module is mocked
const mockVersionIndicator = vi.mocked((await import("../../common/VersionIndicator")).default)

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

// Mock DismissibleUpsell component
vi.mock("@/components/common/DismissibleUpsell", () => ({
	default: function MockDismissibleUpsell({ children }: { children: React.ReactNode }) {
		return <div data-testid="dismissible-upsell">{children}</div>
	},
}))

// Mock QueuedMessages component
vi.mock("../QueuedMessages", () => ({
	QueuedMessages: function MockQueuedMessages({
		queue = [],
		onRemove,
	}: {
		queue?: Array<{ id: string; text: string; images?: string[] }>
		onRemove?: (index: number) => void
		onUpdate?: (index: number, newText: string) => void
	}) {
		if (!queue || queue.length === 0) {
			return null
		}
		return (
			<div data-testid="queued-messages">
				{queue.map((msg, index) => (
					<div key={msg.id}>
						<span>{msg.text}</span>
						<button aria-label="Remove message" onClick={() => onRemove?.(index)}>
							Remove
						</button>
					</div>
				))}
			</div>
		)
	},
}))

// Mock RooTips component
vi.mock("@src/components/welcome/RooTips", () => ({
	default: function MockRooTips() {
		return <div data-testid="roo-tips">Tips content</div>
	},
}))

// Mock RooHero component
vi.mock("@src/components/welcome/RooHero", () => ({
	default: function MockRooHero() {
		return <div data-testid="roo-hero">Hero content</div>
	},
}))

// Mock TelemetryBanner component
vi.mock("../common/TelemetryBanner", () => ({
	default: function MockTelemetryBanner() {
		return null // Don't render anything to avoid interference
	},
}))

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: any) => {
			if (key === "chat:versionIndicator.ariaLabel" && options?.version) {
				return `Version ${options.version}`
			}
			return key
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

interface ChatTextAreaProps {
	onSend: () => void
	inputValue?: string
	setInputValue?: (value: string) => void
	sendingDisabled?: boolean
	placeholderText?: string
	selectedImages?: string[]
	shouldDisableImages?: boolean
}

const mockInputRef = React.createRef<HTMLInputElement>()
const mockFocus = vi.fn()

vi.mock("../ChatTextArea", () => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const mockReact = require("react")

	const ChatTextAreaComponent = mockReact.forwardRef(function MockChatTextArea(
		props: ChatTextAreaProps,
		ref: React.ForwardedRef<{ focus: () => void }>,
	) {
		// Use useImperativeHandle to expose the mock focus method
		mockReact.useImperativeHandle(ref, () => ({
			focus: mockFocus,
		}))

		return (
			<div data-testid="chat-textarea">
				<input
					ref={mockInputRef}
					type="text"
					value={props.inputValue || ""}
					onChange={(e) => {
						// Use parent's setInputValue if available
						if (props.setInputValue) {
							props.setInputValue(e.target.value)
						}
					}}
					onKeyDown={(e) => {
						// Only call onSend when Enter is pressed (simulating real behavior)
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault()
							props.onSend()
						}
					}}
					data-sending-disabled={props.sendingDisabled}
				/>
			</div>
		)
	})

	return {
		default: ChatTextAreaComponent,
		ChatTextArea: ChatTextAreaComponent, // Export as named export too
	}
})

// Mock VSCode components
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: function MockVSCodeButton({
		children,
		onClick,
		appearance,
	}: {
		children: React.ReactNode
		onClick?: () => void
		appearance?: string
	}) {
		return (
			<button onClick={onClick} data-appearance={appearance}>
				{children}
			</button>
		)
	},
	VSCodeTextField: function MockVSCodeTextField({
		value,
		onInput,
		placeholder,
	}: {
		value?: string
		onInput?: (e: { target: { value: string } }) => void
		placeholder?: string
	}) {
		return (
			<input
				type="text"
				value={value}
				onChange={(e) => onInput?.({ target: { value: e.target.value } })}
				placeholder={placeholder}
			/>
		)
	},
	VSCodeLink: function MockVSCodeLink({ children, href }: { children: React.ReactNode; href?: string }) {
		return <a href={href}>{children}</a>
	},
}))

// Mock window.postMessage to trigger state hydration
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

const expectMonotonicMarkerTimes = (markers: FollowUpInteractionMarker[]): void => {
	const markerTimes = markers.map((marker) => marker.atMs)
	expect(
		markerTimes.every((time, index) => {
			if (index === 0) {
				return true
			}

			return time >= markerTimes[index - 1]
		}),
	).toBe(true)
}

describe("ChatView - Sound Playing Tests", () => {
	beforeEach(() => vi.clearAllMocks())

	it("plays celebration sound for completion results", async () => {
		renderChatView()

		// First hydrate state with initial task
		mockPostMessage({
			soundEnabled: true, // Enable sound
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
			],
		})

		// Clear any initial calls
		mockPlayFunction.mockClear()

		// Add completion result
		mockPostMessage({
			soundEnabled: true, // Enable sound
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "completion_result",
					ts: Date.now(),
					text: "Task completed successfully",
					partial: false, // Ensure it's not partial
				},
			],
		})

		// Wait for sound to be played
		await waitFor(() => {
			expect(mockPlayFunction).toHaveBeenCalled()
		})
	})

	it("plays progress_loop sound for api failures", async () => {
		renderChatView()

		// First hydrate state with initial task
		mockPostMessage({
			soundEnabled: true, // Enable sound
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
			],
		})

		// Clear any initial calls
		mockPlayFunction.mockClear()

		// Add API failure
		mockPostMessage({
			soundEnabled: true, // Enable sound
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "api_req_failed",
					ts: Date.now(),
					text: "API request failed",
					partial: false, // Ensure it's not partial
				},
			],
		})

		// Wait for sound to be played
		await waitFor(() => {
			expect(mockPlayFunction).toHaveBeenCalled()
		})
	})

	it("does not play sound when resuming a task from history", () => {
		renderChatView()

		// Clear any initial calls
		mockPlayFunction.mockClear()

		// Hydrate state with a task that has a resumeTaskId (indicating it's resumed from history)
		mockPostMessage({
			resumeTaskId: "task-123",
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Resumed task",
				},
				{
					type: "ask",
					ask: "tool",
					ts: Date.now(),
					text: JSON.stringify({ tool: "readFile", path: "test.txt" }),
				},
			],
		})

		// Should not play sound when resuming from history
		expect(mockPlayFunction).not.toHaveBeenCalled()
	})

	it("does not play sound when resuming a completed task from history", () => {
		renderChatView()

		// Clear any initial calls
		mockPlayFunction.mockClear()

		// Hydrate state with a completed task that has a resumeTaskId
		mockPostMessage({
			resumeTaskId: "task-123",
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Resumed task",
				},
				{
					type: "ask",
					ask: "completion_result",
					ts: Date.now(),
					text: "Task completed",
				},
			],
		})

		// Should not play sound for completion when resuming from history
		expect(mockPlayFunction).not.toHaveBeenCalled()
	})
})

describe("ChatView - Focus Grabbing Tests", () => {
	beforeEach(() => vi.clearAllMocks())

	it("does not grab focus when follow-up question presented", async () => {
		const { getByTestId } = renderChatView()

		// First hydrate state with initial task
		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
			],
		})

		// Wait for the component to fully render and settle before clearing mocks
		await waitFor(() => {
			expect(getByTestId("chat-textarea")).toBeInTheDocument()
		})

		// Wait for the debounced focus effect to fire (50ms debounce + buffer for CI variability)
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 100))
		})

		// Clear any initial calls after state has settled
		mockFocus.mockClear()

		// Add follow-up question
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
					ask: "followup",
					ts: Date.now(),
					text: "Should I continue?",
				},
			],
		})

		// Wait for state update to complete
		await waitFor(() => {
			expect(getByTestId("chat-textarea")).toBeInTheDocument()
		})

		// Should not grab focus for follow-up questions
		expect(mockFocus).not.toHaveBeenCalled()
	})
})

describe("ChatView - Version Indicator Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset the mock to return null by default
		mockVersionIndicator.mockReturnValue(null)
	})

	it("displays version indicator button", () => {
		// Mock VersionIndicator to return a button
		mockVersionIndicator.mockReturnValue(
			React.createElement("button", {
				"data-testid": "version-indicator",
				"aria-label": "Version 1.0.0",
				className: "version-indicator-button",
			}),
		)

		const { getByTestId } = renderChatView()

		// Hydrate state with no active task
		mockPostMessage({
			version: "1.0.0",
			clineMessages: [],
		})

		// Should display version indicator
		expect(getByTestId("version-indicator")).toBeInTheDocument()
	})

	it("opens announcement modal when version indicator is clicked", async () => {
		// Mock VersionIndicator to return a button with onClick
		mockVersionIndicator.mockImplementation(({ onClick }: { onClick?: () => void }) =>
			React.createElement("button", {
				"data-testid": "version-indicator",
				onClick,
			}),
		)

		const { getByTestId, queryByTestId } = renderChatView({ showAnnouncement: false })

		// Hydrate state
		mockPostMessage({
			version: "1.0.0",
			clineMessages: [],
		})

		// Wait for component to render
		await waitFor(() => {
			expect(getByTestId("version-indicator")).toBeInTheDocument()
		})

		// Click version indicator
		const versionIndicator = getByTestId("version-indicator")
		act(() => {
			versionIndicator.click()
		})

		// Wait for announcement modal to appear
		await waitFor(() => {
			expect(queryByTestId("announcement-modal")).toBeInTheDocument()
		})
	})

	it("version indicator has correct styling classes", () => {
		// Mock VersionIndicator to return a button with specific classes
		mockVersionIndicator.mockReturnValue(
			React.createElement("button", {
				"data-testid": "version-indicator",
				className: "version-indicator-button absolute top-2 right-2",
			}),
		)

		const { getByTestId } = renderChatView()

		// Hydrate state
		mockPostMessage({
			version: "1.0.0",
			clineMessages: [],
		})

		const versionIndicator = getByTestId("version-indicator")
		expect(versionIndicator.className).toContain("version-indicator-button")
		expect(versionIndicator.className).toContain("absolute")
		expect(versionIndicator.className).toContain("top-2")
		expect(versionIndicator.className).toContain("right-2")
	})

	it("version indicator has proper accessibility attributes", () => {
		// Mock VersionIndicator to return a button with aria-label
		mockVersionIndicator.mockReturnValue(
			React.createElement("button", {
				"data-testid": "version-indicator",
				"aria-label": "Version 1.0.0",
				role: "button",
			}),
		)

		const { getByTestId } = renderChatView()

		// Hydrate state
		mockPostMessage({
			version: "1.0.0",
			clineMessages: [],
		})

		const versionIndicator = getByTestId("version-indicator")
		expect(versionIndicator.getAttribute("aria-label")).toBe("Version 1.0.0")
		expect(versionIndicator.getAttribute("role")).toBe("button")
	})

	it("does not display version indicator when there is an active task", () => {
		// Mock VersionIndicator to return null (simulating hidden state)
		mockVersionIndicator.mockReturnValue(null)

		const { queryByTestId } = renderChatView()

		// Hydrate state with active task
		mockPostMessage({
			version: "1.0.0",
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now(),
					text: "Active task",
				},
			],
		})

		// Should not display version indicator during active task
		expect(queryByTestId("version-indicator")).not.toBeInTheDocument()
	})

	it("displays version indicator only on welcome screen (no task)", () => {
		// Mock VersionIndicator to return a button
		mockVersionIndicator.mockReturnValue(React.createElement("button", { "data-testid": "version-indicator" }))

		const { queryByTestId } = renderChatView()

		// Hydrate state with no active task
		mockPostMessage({
			version: "1.0.0",
			clineMessages: [],
		})

		// Should display version indicator on welcome screen
		expect(queryByTestId("version-indicator")).toBeInTheDocument()
	})
})

describe("ChatView - DismissibleUpsell Display Tests", () => {
	beforeEach(() => vi.clearAllMocks())

	it("does not show DismissibleUpsell when user is authenticated to Cloud", () => {
		const { queryByTestId } = renderChatView()

		// Hydrate state with user authenticated to cloud
		mockPostMessage({
			cloudIsAuthenticated: true,
			taskHistory: [
				{ id: "1", ts: Date.now() - 3000 },
				{ id: "2", ts: Date.now() - 2000 },
				{ id: "3", ts: Date.now() - 1000 },
				{ id: "4", ts: Date.now() },
			],
			clineMessages: [], // No active task
		})

		// Should not show DismissibleUpsell when authenticated
		expect(queryByTestId("dismissible-upsell")).not.toBeInTheDocument()
	})

	it("does not show DismissibleUpsell when user has only run 3 tasks in their history", () => {
		const { queryByTestId } = renderChatView()

		// Hydrate state with user not authenticated but only 3 tasks
		mockPostMessage({
			cloudIsAuthenticated: false,
			taskHistory: [
				{ id: "1", ts: Date.now() - 2000 },
				{ id: "2", ts: Date.now() - 1000 },
				{ id: "3", ts: Date.now() },
			],
			clineMessages: [], // No active task
		})

		// Should not show DismissibleUpsell with less than 4 tasks
		expect(queryByTestId("dismissible-upsell")).not.toBeInTheDocument()
	})

	it("shows DismissibleUpsell when user is not authenticated and has run 6 or more tasks", async () => {
		const { getByTestId } = renderChatView()

		// Hydrate state with user not authenticated and 4 tasks
		mockPostMessage({
			cloudIsAuthenticated: false,
			taskHistory: [
				{ id: "1", ts: Date.now() - 6000 },
				{ id: "2", ts: Date.now() - 5000 },
				{ id: "3", ts: Date.now() - 4000 },
				{ id: "4", ts: Date.now() - 3000 },
				{ id: "5", ts: Date.now() - 2000 },
				{ id: "6", ts: Date.now() - 1000 },
				{ id: "7", ts: Date.now() },
			],
			clineMessages: [], // No active task
		})

		// Wait for component to render and show DismissibleUpsell
		await waitFor(() => {
			expect(getByTestId("dismissible-upsell")).toBeInTheDocument()
		})
	})

	it("does not show DismissibleUpsell when there is an active task (regardless of auth status)", async () => {
		const { queryByTestId } = renderChatView()

		// Hydrate state with active task
		mockPostMessage({
			cloudIsAuthenticated: false,
			taskHistory: [
				{ id: "1", ts: Date.now() - 3000 },
				{ id: "2", ts: Date.now() - 2000 },
				{ id: "3", ts: Date.now() - 1000 },
				{ id: "4", ts: Date.now() },
			],
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now(),
					text: "Active task",
				},
			],
		})

		// Wait for component to render with active task
		await waitFor(() => {
			// Should not show DismissibleUpsell during active task
			expect(queryByTestId("dismissible-upsell")).not.toBeInTheDocument()
			// Should not show RooTips either since the entire welcome screen is hidden during active tasks
			expect(queryByTestId("roo-tips")).not.toBeInTheDocument()
			// Should not show RooHero either since the entire welcome screen is hidden during active tasks
			expect(queryByTestId("roo-hero")).not.toBeInTheDocument()
		})
	})

	it("shows RooTips when user is authenticated (instead of DismissibleUpsell)", () => {
		const { queryByTestId, getByTestId } = renderChatView()

		// Hydrate state with user authenticated to cloud
		mockPostMessage({
			cloudIsAuthenticated: true,
			taskHistory: [
				{ id: "1", ts: Date.now() - 3000 },
				{ id: "2", ts: Date.now() - 2000 },
				{ id: "3", ts: Date.now() - 1000 },
				{ id: "4", ts: Date.now() },
			],
			clineMessages: [], // No active task
		})

		// Should not show DismissibleUpsell but should show RooTips
		expect(queryByTestId("dismissible-upsell")).not.toBeInTheDocument()
		expect(getByTestId("roo-tips")).toBeInTheDocument()
	})

	it("shows RooTips when user has fewer than 6 tasks (instead of DismissibleUpsell)", () => {
		const { queryByTestId, getByTestId } = renderChatView()

		// Hydrate state with user not authenticated but fewer than 4 tasks
		mockPostMessage({
			cloudIsAuthenticated: false,
			taskHistory: [
				{ id: "1", ts: Date.now() - 2000 },
				{ id: "2", ts: Date.now() - 1000 },
				{ id: "3", ts: Date.now() },
			],
			clineMessages: [], // No active task
		})

		// Should not show DismissibleUpsell but should show RooTips
		expect(queryByTestId("dismissible-upsell")).not.toBeInTheDocument()
		expect(getByTestId("roo-tips")).toBeInTheDocument()
	})
})

describe("ChatView - Message Queueing Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset the mock to clear any initial calls
		vi.mocked(vscode.postMessage).mockClear()
	})

	it("shows sending is disabled when task is active", async () => {
		const { getByTestId } = renderChatView()

		// Hydrate state with active task that should disable sending
		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 1000,
					text: "Task in progress",
				},
				{
					type: "ask",
					ask: "tool",
					ts: Date.now(),
					text: JSON.stringify({ tool: "readFile", path: "test.txt" }),
					partial: true, // Partial messages disable sending
				},
			],
		})

		// Wait for state to be updated and check that sending is disabled
		await waitFor(() => {
			const chatTextArea = getByTestId("chat-textarea")
			const input = chatTextArea.querySelector("input")!
			expect(input.getAttribute("data-sending-disabled")).toBe("true")
		})
	})

	it("shows sending is enabled when no task is active", async () => {
		const { getByTestId } = renderChatView()

		// Hydrate state with completed task
		mockPostMessage({
			clineMessages: [
				{
					type: "ask",
					ask: "completion_result",
					ts: Date.now(),
					text: "Task completed",
					partial: false,
				},
			],
		})

		// Wait for state to be updated
		await waitFor(() => {
			expect(getByTestId("chat-textarea")).toBeInTheDocument()
		})

		// Check that sending is enabled
		const chatTextArea = getByTestId("chat-textarea")
		const input = chatTextArea.querySelector("input")!
		expect(input.getAttribute("data-sending-disabled")).toBe("false")
	})

	it("queues messages when API request is in progress (spinner visible)", async () => {
		const { getByTestId } = renderChatView()

		// First hydrate state with initial task
		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
			],
		})

		// Clear any initial calls
		vi.mocked(vscode.postMessage).mockClear()

		// Add api_req_started without cost (spinner state - API request in progress)
		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "say",
					say: "api_req_started",
					ts: Date.now(),
					text: JSON.stringify({ apiProtocol: "anthropic" }), // No cost = still streaming
				},
			],
		})

		// Wait for state to be updated
		await waitFor(() => {
			expect(getByTestId("chat-textarea")).toBeInTheDocument()
		})

		// Clear message calls before simulating user input
		vi.mocked(vscode.postMessage).mockClear()

		// Simulate user typing and sending a message during the spinner
		const chatTextArea = getByTestId("chat-textarea")
		const input = chatTextArea.querySelector("input")! as HTMLInputElement

		// Trigger message send by simulating typing and Enter key press
		await act(async () => {
			// Use fireEvent to properly trigger React's onChange handler
			fireEvent.change(input, { target: { value: "follow-up question during spinner" } })

			// Simulate pressing Enter to send
			fireEvent.keyDown(input, { key: "Enter", code: "Enter" })
		})

		// Verify that the message was queued, not sent as askResponse
		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "queueMessage",
				text: "follow-up question during spinner",
				images: [],
			})
		})

		// Verify it was NOT sent as a direct askResponse (which would get lost)
		expect(vscode.postMessage).not.toHaveBeenCalledWith(
			expect.objectContaining({
				type: "askResponse",
				askResponse: "messageResponse",
			}),
		)
	})

	it("sends messages normally when API request is complete (cost present)", async () => {
		const { getByTestId } = renderChatView()

		// Hydrate state with completed API request (cost present)
		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "say",
					say: "api_req_started",
					ts: Date.now(),
					text: JSON.stringify({
						apiProtocol: "anthropic",
						cost: 0.05, // Cost present = streaming complete
						tokensIn: 100,
						tokensOut: 50,
					}),
				},
				{
					type: "say",
					say: "text",
					ts: Date.now(),
					text: "Response from API",
				},
			],
		})

		// Wait for state to be updated
		await waitFor(() => {
			expect(getByTestId("chat-textarea")).toBeInTheDocument()
		})

		// Clear message calls before simulating user input
		vi.mocked(vscode.postMessage).mockClear()

		// Simulate user sending a message when API is done
		const chatTextArea = getByTestId("chat-textarea")
		const input = chatTextArea.querySelector("input")! as HTMLInputElement

		await act(async () => {
			// Use fireEvent to properly trigger React's onChange handler
			fireEvent.change(input, { target: { value: "follow-up after completion" } })

			// Simulate pressing Enter to send
			fireEvent.keyDown(input, { key: "Enter", code: "Enter" })
		})

		// Verify that the message was sent as askResponse, not queued
		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "askResponse",
				askResponse: "messageResponse",
				text: "follow-up after completion",
				images: [],
			})
		})

		// Verify it was NOT queued
		expect(vscode.postMessage).not.toHaveBeenCalledWith(
			expect.objectContaining({
				type: "queueMessage",
			}),
		)
	})

	it("preserves message order when messages sent during queue drain", async () => {
		const { getByTestId } = renderChatView()

		// Hydrate state with API request in progress and existing queue
		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "say",
					say: "api_req_started",
					ts: Date.now(),
					text: JSON.stringify({ apiProtocol: "anthropic" }), // No cost = still streaming
				},
			],
			messageQueue: [
				{ id: "msg1", text: "queued message 1", images: [] },
				{ id: "msg2", text: "queued message 2", images: [] },
			],
		})

		// Wait for state to be updated
		await waitFor(() => {
			expect(getByTestId("chat-textarea")).toBeInTheDocument()
		})

		// Clear message calls before simulating user input
		vi.mocked(vscode.postMessage).mockClear()

		// Simulate user sending a new message while queue has items
		const chatTextArea = getByTestId("chat-textarea")
		const input = chatTextArea.querySelector("input")! as HTMLInputElement

		await act(async () => {
			fireEvent.change(input, { target: { value: "message during queue drain" } })
			fireEvent.keyDown(input, { key: "Enter", code: "Enter" })
		})

		// Verify that the new message was queued (not sent directly) to preserve order
		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "queueMessage",
				text: "message during queue drain",
				images: [],
			})
		})

		// Verify it was NOT sent as askResponse (which would break ordering)
		expect(vscode.postMessage).not.toHaveBeenCalledWith(
			expect.objectContaining({
				type: "askResponse",
				askResponse: "messageResponse",
			}),
		)
	})

	it("queues the first interaction immediately during command_output without effect-sync delays", async () => {
		const { getByTestId } = renderChatView()

		// Hydrate state with command_output ask (Proceed While Running state)
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
					ask: "command_output",
					ts: Date.now(),
					text: "",
					partial: false, // Non-partial so buttons are enabled
				},
			],
		})

		// Wait for state to be updated
		await waitFor(() => {
			expect(getByTestId("chat-textarea")).toBeInTheDocument()
		})

		// Clear message calls before simulating user input
		vi.mocked(vscode.postMessage).mockClear()

		// Simulate user typing and sending a message during command execution
		const chatTextArea = getByTestId("chat-textarea")
		const input = chatTextArea.querySelector("input")! as HTMLInputElement

		await act(async () => {
			fireEvent.change(input, { target: { value: "message during command execution" } })
			fireEvent.keyDown(input, { key: "Enter", code: "Enter" })
		})

		// Verify that the message was queued (not lost via terminalOperation)
		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "queueMessage",
				text: "message during command execution",
				images: [],
			})
		})

		// Verify it was NOT sent as terminalOperation (which would lose the message)
		expect(vscode.postMessage).not.toHaveBeenCalledWith(
			expect.objectContaining({
				type: "terminalOperation",
			}),
		)
	})
})

describe("ChatView - Primary Action Responsiveness", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(vscode.postMessage).mockClear()
	})

	it.each([
		{
			name: "primary approval",
			buttonLabel: "chat:runCommand.title",
			invoke: "primaryButtonClick",
			expectedMessage: { type: "askResponse", askResponse: "yesButtonClicked" },
		},
		{
			name: "secondary rejection",
			buttonLabel: "chat:reject.title",
			invoke: "secondaryButtonClick",
			expectedMessage: { type: "askResponse", askResponse: "noButtonClicked" },
		},
	] as const)(
		"emits only one dispatch path for $name when duplicate activation is attempted while pending",
		async ({ buttonLabel, invoke, expectedMessage }) => {
			const { getByRole } = renderChatView()

			mockPostMessage({
				clineMessages: [
					{
						type: "say",
						say: "task",
						ts: Date.now() - 2_000,
						text: "Initial task",
					},
					{
						type: "ask",
						ask: "command",
						ts: Date.now(),
						text: "",
						partial: false,
					},
				],
			})

			await waitFor(() => {
				expect(getByRole("button", { name: buttonLabel })).toBeInTheDocument()
			})

			vi.mocked(vscode.postMessage).mockClear()

			act(() => {
				fireEvent.click(getByRole("button", { name: buttonLabel }))
			})

			await act(async () => {
				window.dispatchEvent(
					new MessageEvent("message", {
						data: {
							type: "invoke",
							invoke,
						},
					}),
				)
			})

			expect(vscode.postMessage).toHaveBeenCalledTimes(1)
			expect(vscode.postMessage).toHaveBeenCalledWith(expectedMessage)
		},
	)

	it("applies optimistic pending UI immediately when the primary action is clicked", async () => {
		const { getByRole, getByTestId, queryByRole } = renderChatView()

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2_000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "command",
					ts: Date.now(),
					text: "",
					partial: false,
				},
			],
		})

		await waitFor(() => {
			expect(getByRole("button", { name: "chat:runCommand.title" })).toBeInTheDocument()
		})

		const input = getByTestId("chat-textarea").querySelector("input") as HTMLInputElement
		const primaryButton = getByRole("button", { name: "chat:runCommand.title" })

		expect(input.getAttribute("data-sending-disabled")).toBe("false")

		act(() => {
			fireEvent.click(primaryButton)
		})

		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "askResponse", askResponse: "yesButtonClicked" })
		expect(input.getAttribute("data-sending-disabled")).toBe("true")
		expect(queryByRole("button", { name: "chat:runCommand.title" })).not.toBeInTheDocument()
	})

	it("keeps pending state stable through async ask-resolution updates", async () => {
		const { getByRole, getByTestId, queryByRole } = renderChatView()

		const taskTs = Date.now() - 2_000
		const askTs = Date.now() - 1_000

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: taskTs,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "command",
					ts: askTs,
					text: "",
					partial: false,
				},
			],
		})

		await waitFor(() => {
			expect(getByRole("button", { name: "chat:runCommand.title" })).toBeInTheDocument()
		})

		const input = getByTestId("chat-textarea").querySelector("input") as HTMLInputElement

		act(() => {
			fireEvent.click(getByRole("button", { name: "chat:runCommand.title" }))
		})

		expect(input.getAttribute("data-sending-disabled")).toBe("true")
		expect(queryByRole("button", { name: "chat:runCommand.title" })).not.toBeInTheDocument()

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: taskTs,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "command",
					ts: askTs,
					text: "",
					partial: false,
				},
				{
					type: "say",
					say: "api_req_started",
					ts: Date.now(),
					text: JSON.stringify({ apiProtocol: "anthropic" }),
				},
			],
		})

		await waitFor(() => {
			expect(input.getAttribute("data-sending-disabled")).toBe("true")
			expect(queryByRole("button", { name: "chat:runCommand.title" })).not.toBeInTheDocument()
		})
	})

	it("applies optimistic pending UI immediately when the secondary reject action is clicked", async () => {
		const { getByRole, getByTestId, queryByRole } = renderChatView()

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2_000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "command",
					ts: Date.now(),
					text: "",
					partial: false,
				},
			],
		})

		await waitFor(() => {
			expect(getByRole("button", { name: "chat:reject.title" })).toBeInTheDocument()
		})

		const input = getByTestId("chat-textarea").querySelector("input") as HTMLInputElement
		const secondaryButton = getByRole("button", { name: "chat:reject.title" })

		expect(input.getAttribute("data-sending-disabled")).toBe("false")

		act(() => {
			fireEvent.click(secondaryButton)
		})

		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "askResponse", askResponse: "noButtonClicked" })
		expect(input.getAttribute("data-sending-disabled")).toBe("true")
		expect(queryByRole("button", { name: "chat:runCommand.title" })).not.toBeInTheDocument()
		expect(queryByRole("button", { name: "chat:reject.title" })).not.toBeInTheDocument()
	})

	it("restores deterministic error controls after secondary rejection settle", async () => {
		const { getByRole, getByTestId, queryByRole } = renderChatView()

		const taskTs = Date.now() - 2_000
		const askTs = Date.now() - 1_000

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: taskTs,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "command",
					ts: askTs,
					text: "",
					partial: false,
				},
			],
		})

		await waitFor(() => {
			expect(getByRole("button", { name: "chat:reject.title" })).toBeInTheDocument()
		})

		const input = getByTestId("chat-textarea").querySelector("input") as HTMLInputElement

		act(() => {
			fireEvent.click(getByRole("button", { name: "chat:reject.title" }))
		})

		expect(input.getAttribute("data-sending-disabled")).toBe("true")
		expect(queryByRole("button", { name: "chat:runCommand.title" })).not.toBeInTheDocument()
		expect(queryByRole("button", { name: "chat:reject.title" })).not.toBeInTheDocument()

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: taskTs,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "command",
					ts: askTs,
					text: "",
					partial: false,
				},
				{
					type: "say",
					say: "error",
					ts: Date.now(),
					text: "Tool rejected by user",
				},
				{
					type: "ask",
					ask: "api_req_failed",
					ts: Date.now() + 1,
					text: "Tool rejected by user",
					partial: false,
				},
			],
		})

		await waitFor(() => {
			expect(input.getAttribute("data-sending-disabled")).toBe("true")
			expect(getByRole("button", { name: "chat:retry.title" })).toBeInTheDocument()
			expect(getByRole("button", { name: "chat:startNewTask.title" })).toBeInTheDocument()
		})
	})

	it("applies optimistic pending transition when primary action is invoked via extension message", async () => {
		const { getByRole, getByTestId, queryByRole } = renderChatView()

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2_000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "command",
					ts: Date.now(),
					text: "",
					partial: false,
				},
			],
		})

		await waitFor(() => {
			expect(getByRole("button", { name: "chat:runCommand.title" })).toBeInTheDocument()
		})

		vi.mocked(vscode.postMessage).mockClear()

		const input = getByTestId("chat-textarea").querySelector("input") as HTMLInputElement
		expect(input.getAttribute("data-sending-disabled")).toBe("false")

		await act(async () => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "invoke",
						invoke: "primaryButtonClick",
					},
				}),
			)
		})

		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "askResponse", askResponse: "yesButtonClicked" })
		expect(input.getAttribute("data-sending-disabled")).toBe("true")
		expect(queryByRole("button", { name: "chat:runCommand.title" })).not.toBeInTheDocument()
	})

	it("blocks duplicate primary invoke activations while approval action resolution is pending", async () => {
		const { getByRole } = renderChatView()

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2_000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "command",
					ts: Date.now(),
					text: "",
					partial: false,
				},
			],
		})

		await waitFor(() => {
			expect(getByRole("button", { name: "chat:runCommand.title" })).toBeInTheDocument()
		})

		vi.mocked(vscode.postMessage).mockClear()

		await act(async () => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "invoke",
						invoke: "primaryButtonClick",
					},
				}),
			)

			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "invoke",
						invoke: "primaryButtonClick",
					},
				}),
			)
		})

		expect(vscode.postMessage).toHaveBeenCalledTimes(1)
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "askResponse", askResponse: "yesButtonClicked" })
	})

	it("applies optimistic pending transition when secondary action is invoked via extension message", async () => {
		const { getByRole, getByTestId, queryByRole } = renderChatView()

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2_000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "command",
					ts: Date.now(),
					text: "",
					partial: false,
				},
			],
		})

		await waitFor(() => {
			expect(getByRole("button", { name: "chat:reject.title" })).toBeInTheDocument()
		})

		vi.mocked(vscode.postMessage).mockClear()

		const input = getByTestId("chat-textarea").querySelector("input") as HTMLInputElement
		expect(input.getAttribute("data-sending-disabled")).toBe("false")

		await act(async () => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "invoke",
						invoke: "secondaryButtonClick",
					},
				}),
			)
		})

		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "askResponse", askResponse: "noButtonClicked" })
		expect(input.getAttribute("data-sending-disabled")).toBe("true")
		expect(queryByRole("button", { name: "chat:runCommand.title" })).not.toBeInTheDocument()
		expect(queryByRole("button", { name: "chat:reject.title" })).not.toBeInTheDocument()
	})

	it("blocks duplicate secondary invoke activations while approval action resolution is pending", async () => {
		const { getByRole } = renderChatView()

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2_000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "command",
					ts: Date.now(),
					text: "",
					partial: false,
				},
			],
		})

		await waitFor(() => {
			expect(getByRole("button", { name: "chat:reject.title" })).toBeInTheDocument()
		})

		vi.mocked(vscode.postMessage).mockClear()

		await act(async () => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "invoke",
						invoke: "secondaryButtonClick",
					},
				}),
			)

			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "invoke",
						invoke: "secondaryButtonClick",
					},
				}),
			)
		})

		expect(vscode.postMessage).toHaveBeenCalledTimes(1)
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "askResponse", askResponse: "noButtonClicked" })
	})

	it("keeps approval lock stable across rerenders and deterministically re-enables terminal controls after completion", async () => {
		const { getByRole, queryByRole, rerender } = renderChatView()

		const taskTs = Date.now() - 2_000
		const commandAskTs = Date.now() - 1_000

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: taskTs,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "command",
					ts: commandAskTs,
					text: "",
					partial: false,
				},
			],
		})

		await waitFor(() => {
			expect(getByRole("button", { name: "chat:runCommand.title" })).toBeInTheDocument()
		})

		vi.mocked(vscode.postMessage).mockClear()

		act(() => {
			fireEvent.click(getByRole("button", { name: "chat:runCommand.title" }))
		})

		expect(vscode.postMessage).toHaveBeenCalledTimes(1)
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "askResponse", askResponse: "yesButtonClicked" })
		expect(queryByRole("button", { name: "chat:runCommand.title" })).not.toBeInTheDocument()

		rerender(
			<ExtensionStateContextProvider>
				<QueryClientProvider client={queryClient}>
					<ChatView {...defaultProps} />
				</QueryClientProvider>
			</ExtensionStateContextProvider>,
		)

		await act(async () => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "invoke",
						invoke: "primaryButtonClick",
					},
				}),
			)
		})

		expect(vscode.postMessage).toHaveBeenCalledTimes(1)
		expect(queryByRole("button", { name: "chat:runCommand.title" })).not.toBeInTheDocument()

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: taskTs,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "command",
					ts: commandAskTs,
					text: "",
					partial: false,
				},
				{
					type: "ask",
					ask: "completion_result",
					ts: Date.now(),
					text: "Completed",
					partial: false,
				},
			],
		})

		await waitFor(() => {
			const startNewTaskButton = getByRole("button", { name: "chat:startNewTask.title" })
			expect(startNewTaskButton).toBeInTheDocument()
			expect(startNewTaskButton).toBeEnabled()
		})

		vi.mocked(vscode.postMessage).mockClear()

		act(() => {
			fireEvent.click(getByRole("button", { name: "chat:startNewTask.title" }))
		})

		expect(vscode.postMessage).toHaveBeenCalledTimes(1)
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "clearTask" })
	})
})

describe("ChatView - Follow-up Responsiveness Guards", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(vscode.postMessage).mockClear()
	})

	afterEach(() => {
		setFollowUpInteractionInstrumentationSink(undefined)
	})

	it("marks historical follow-up rows as answered while keeping only the newest follow-up actionable", async () => {
		const { getByTestId } = renderChatView()

		const olderFollowUpTs = 2_000
		const newerFollowUpTs = 4_000

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: 1_000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "followup",
					ts: olderFollowUpTs,
					text: "Older follow-up",
				},
				{
					type: "say",
					say: "text",
					ts: 3_000,
					text: "Interleaved text",
				},
				{
					type: "ask",
					ask: "followup",
					ts: newerFollowUpTs,
					text: "Newest follow-up",
				},
			],
		})

		await waitFor(() => {
			const olderRow = getByTestId(`chat-row-${olderFollowUpTs}`)
			const newerRow = getByTestId(`chat-row-${newerFollowUpTs}`)

			expect(olderRow).toHaveAttribute("data-message-ask", "followup")
			expect(newerRow).toHaveAttribute("data-message-ask", "followup")

			expect(olderRow).toHaveAttribute("data-followup-answered", "true")
			expect(newerRow).toHaveAttribute("data-followup-answered", "false")
		})
	})

	it("clears active follow-up row controls on the next render cycle after user answers", async () => {
		const { getByTestId } = renderChatView()

		const followUpTs = 2_000

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: 1_000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "followup",
					ts: followUpTs,
					text: "Should I continue?",
				},
			],
		})

		await waitFor(() => {
			expect(getByTestId(`chat-row-${followUpTs}`)).toHaveAttribute("data-followup-answered", "false")
		})

		vi.mocked(vscode.postMessage).mockClear()

		const chatTextArea = getByTestId("chat-textarea")
		const input = chatTextArea.querySelector("input")! as HTMLInputElement

		await act(async () => {
			fireEvent.change(input, { target: { value: "Proceed with this" } })
			fireEvent.keyDown(input, { key: "Enter", code: "Enter" })
		})

		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "askResponse",
				askResponse: "messageResponse",
				text: "Proceed with this",
				images: [],
			})

			expect(getByTestId(`chat-row-${followUpTs}`)).toHaveAttribute("data-followup-answered", "true")
		})
	})

	it("blocks duplicate typed follow-up submit dispatches while pending and emits a single click marker", async () => {
		const markers: FollowUpInteractionMarker[] = []
		setFollowUpInteractionInstrumentationSink((marker) => {
			markers.push(marker)
		})

		const { getByTestId } = renderChatView()

		const followUpTs = 2_050

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: 1_000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "followup",
					ts: followUpTs,
					text: "Should I continue?",
				},
			],
		})

		await waitFor(() => {
			expect(getByTestId(`chat-row-${followUpTs}`)).toHaveAttribute("data-followup-answered", "false")
		})

		vi.mocked(vscode.postMessage).mockClear()

		const chatTextArea = getByTestId("chat-textarea")
		const input = chatTextArea.querySelector("input")! as HTMLInputElement

		await act(async () => {
			fireEvent.change(input, { target: { value: "Proceed with this" } })
			fireEvent.keyDown(input, { key: "Enter", code: "Enter" })
			fireEvent.keyDown(input, { key: "Enter", code: "Enter" })
		})

		const postMessages = vi.mocked(vscode.postMessage).mock.calls.map(([message]) => message)
		const askResponseCalls = postMessages.filter((message) => {
			if (typeof message !== "object" || message === null || !("type" in message)) {
				return false
			}

			return message.type === "askResponse"
		})

		expect(askResponseCalls).toHaveLength(1)
		expect(askResponseCalls[0]).toEqual({
			type: "askResponse",
			askResponse: "messageResponse",
			text: "Proceed with this",
			images: [],
		})

		await waitFor(() => {
			expect(getByTestId(`chat-row-${followUpTs}`)).toHaveAttribute("data-followup-answered", "true")
		})

		await waitFor(() => {
			expect(markers.map((marker) => marker.stage)).toEqual(["click", "pending_render", "settle"])
		})
		expect(markers.map((marker) => marker.source)).toEqual(["chat_view", "chat_view", "chat_view"])
		expect(markers.map((marker) => marker.followUpTs)).toEqual([followUpTs, followUpTs, followUpTs])
		expectMonotonicMarkerTimes(markers)
	})

	it("keeps typed follow-up submit single-dispatch and forward-only markers under rerender pressure", async () => {
		const markers: FollowUpInteractionMarker[] = []
		setFollowUpInteractionInstrumentationSink((marker) => {
			markers.push(marker)
		})

		const { getByTestId, rerender } = renderChatView()

		const followUpTs = 2_075

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: 1_000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "followup",
					ts: followUpTs,
					text: "Should I continue?",
				},
			],
		})

		await waitFor(() => {
			expect(getByTestId(`chat-row-${followUpTs}`)).toHaveAttribute("data-followup-answered", "false")
		})

		vi.mocked(vscode.postMessage).mockClear()

		const firstInput = getByTestId("chat-textarea").querySelector("input") as HTMLInputElement

		await act(async () => {
			fireEvent.change(firstInput, { target: { value: "Proceed with this" } })
			fireEvent.keyDown(firstInput, { key: "Enter", code: "Enter" })
		})

		rerender(
			<ExtensionStateContextProvider>
				<QueryClientProvider client={queryClient}>
					<ChatView {...defaultProps} />
				</QueryClientProvider>
			</ExtensionStateContextProvider>,
		)

		const secondInput = getByTestId("chat-textarea").querySelector("input") as HTMLInputElement

		await act(async () => {
			fireEvent.keyDown(secondInput, { key: "Enter", code: "Enter" })
		})

		const postMessages = vi.mocked(vscode.postMessage).mock.calls.map(([message]) => message)
		const askResponseCalls = postMessages.filter((message) => {
			if (typeof message !== "object" || message === null || !("type" in message)) {
				return false
			}

			return message.type === "askResponse"
		})

		expect(askResponseCalls).toHaveLength(1)
		expect(askResponseCalls[0]).toEqual({
			type: "askResponse",
			askResponse: "messageResponse",
			text: "Proceed with this",
			images: [],
		})

		await waitFor(() => {
			expect(markers.map((marker) => marker.stage)).toEqual(["click", "pending_render", "settle"])
		})
		expect(markers.map((marker) => marker.followUpTs)).toEqual([followUpTs, followUpTs, followUpTs])
		expectMonotonicMarkerTimes(markers)
	})

	it("marks the active follow-up as terminal in the first post-settle render cycle after auto-approval acceptance", async () => {
		const { getByTestId } = renderChatView()

		const followUpTs = 2_000

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: 1_000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "followup",
					ts: followUpTs,
					text: JSON.stringify({
						question: "Should I continue?",
						suggest: [{ answer: "Proceed" }, { answer: "Pause" }],
					}),
				},
			],
		})

		await waitFor(() => {
			expect(getByTestId(`chat-row-${followUpTs}`)).toHaveAttribute("data-followup-answered", "false")
		})

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: 1_000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "followup",
					ts: followUpTs,
					text: JSON.stringify({
						question: "Should I continue?",
						suggest: [{ answer: "Proceed" }, { answer: "Pause" }],
					}),
				},
				{
					type: "say",
					say: "user_feedback",
					ts: 3_000,
					text: "Proceed",
				},
			],
		})

		await waitFor(() => {
			expect(getByTestId(`chat-row-${followUpTs}`)).toHaveAttribute("data-followup-answered", "true")
		})
	})

	it("keeps the active follow-up actionable when a non-followup say is the latest message", async () => {
		const { getByTestId } = renderChatView()

		const followUpTs = 2_090

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: 1_000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "followup",
					ts: followUpTs,
					text: "Should I continue?",
				},
				{
					type: "say",
					say: "text",
					ts: 2_091,
					text: "Interleaved non-followup message",
				},
			],
		})

		await waitFor(() => {
			expect(getByTestId(`chat-row-${followUpTs}`)).toHaveAttribute("data-followup-answered", "false")
		})
	})

	it("emits deterministic pending/settle/clear markers for follow-up answer lifecycle", async () => {
		const markers: FollowUpInteractionMarker[] = []
		setFollowUpInteractionInstrumentationSink((marker) => {
			markers.push(marker)
		})

		const { getByTestId, queryByTestId } = renderChatView()

		const followUpTs = 2_000

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: 1_000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "followup",
					ts: followUpTs,
					text: "Should I continue?",
				},
			],
		})

		await waitFor(() => {
			expect(getByTestId(`chat-row-${followUpTs}`)).toHaveAttribute("data-followup-answered", "false")
		})

		const chatTextArea = getByTestId("chat-textarea")
		const input = chatTextArea.querySelector("input") as HTMLInputElement

		await act(async () => {
			fireEvent.change(input, { target: { value: "Proceed" } })
			fireEvent.keyDown(input, { key: "Enter", code: "Enter" })
		})

		await waitFor(() => {
			expect(getByTestId(`chat-row-${followUpTs}`)).toHaveAttribute("data-followup-answered", "true")
		})

		mockPostMessage({ clineMessages: [] })

		await waitFor(() => {
			expect(queryByTestId(`chat-row-${followUpTs}`)).toBeNull()
		})

		await waitFor(() => {
			expect(markers.map((marker) => marker.stage)).toEqual(["click", "pending_render", "settle", "clear"])
		})

		expect(markers.map((marker) => marker.followUpTs)).toEqual([followUpTs, followUpTs, followUpTs, followUpTs])
		expect(markers.map((marker) => marker.source)).toEqual(["chat_view", "chat_view", "chat_view", "chat_view"])
		expect(markers.every((marker) => typeof marker.atMs === "number")).toBe(true)
		expectMonotonicMarkerTimes(markers)
	})

	it("uses current ask interaction state for suggestion clicks and emits pending->settle->clear once", async () => {
		const markers: FollowUpInteractionMarker[] = []
		setFollowUpInteractionInstrumentationSink((marker) => {
			markers.push(marker)
		})

		const { getByTestId, queryByTestId } = renderChatView()

		const followUpTs = 2_100

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: 1_000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "followup",
					ts: followUpTs,
					text: JSON.stringify({
						question: "Choose a follow-up path",
						suggest: [{ answer: "Proceed", mode: "code" }],
					}),
				},
			],
		})

		await waitFor(() => {
			expect(getByTestId(`chat-row-${followUpTs}`)).toHaveAttribute("data-followup-answered", "false")
			expect(getByTestId(`mock-followup-suggestion-${followUpTs}`)).toBeInTheDocument()
		})

		vi.mocked(vscode.postMessage).mockClear()

		act(() => {
			fireEvent.click(getByTestId(`mock-followup-suggestion-${followUpTs}`))
		})

		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith({ type: "mode", text: "code" })
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "askResponse",
				askResponse: "messageResponse",
				text: "Mock suggestion",
				images: [],
			})
			expect(getByTestId(`chat-row-${followUpTs}`)).toHaveAttribute("data-followup-answered", "true")
		})

		await waitFor(() => {
			expect(markers.map((marker) => marker.stage)).toEqual(["pending_render", "settle"])
		})

		mockPostMessage({ clineMessages: [] })

		await waitFor(() => {
			expect(queryByTestId(`chat-row-${followUpTs}`)).toBeNull()
		})

		await waitFor(() => {
			expect(markers.map((marker) => marker.stage)).toEqual(["pending_render", "settle", "clear"])
		})
		expect(markers.map((marker) => marker.followUpTs)).toEqual([followUpTs, followUpTs, followUpTs])
		expectMonotonicMarkerTimes(markers)
	})

	it("blocks duplicate follow-up suggestion dispatch while the follow-up suggestion action is pending", async () => {
		const markers: FollowUpInteractionMarker[] = []
		setFollowUpInteractionInstrumentationSink((marker) => {
			markers.push(marker)
		})

		const { getByTestId, queryByTestId } = renderChatView()

		const followUpTs = 2_120

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: 1_000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "followup",
					ts: followUpTs,
					text: JSON.stringify({
						question: "Choose a follow-up path",
						suggest: [{ answer: "Proceed", mode: "code" }],
					}),
				},
			],
		})

		await waitFor(() => {
			expect(getByTestId(`chat-row-${followUpTs}`)).toHaveAttribute("data-followup-answered", "false")
			expect(getByTestId(`mock-followup-suggestion-${followUpTs}`)).toBeInTheDocument()
		})

		vi.mocked(vscode.postMessage).mockClear()

		const suggestionButton = getByTestId(`mock-followup-suggestion-${followUpTs}`)

		act(() => {
			fireEvent.click(suggestionButton)
			fireEvent.click(suggestionButton)
		})

		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith({ type: "mode", text: "code" })
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "askResponse",
				askResponse: "messageResponse",
				text: "Mock suggestion",
				images: [],
			})
			expect(getByTestId(`chat-row-${followUpTs}`)).toHaveAttribute("data-followup-answered", "true")
		})

		const postMessages = vi.mocked(vscode.postMessage).mock.calls.map(([message]) => message)
		const askResponseCalls = postMessages.filter((message) => {
			if (typeof message !== "object" || message === null || !("type" in message)) {
				return false
			}

			return message.type === "askResponse"
		})
		const modeCalls = postMessages.filter((message) => {
			if (typeof message !== "object" || message === null || !("type" in message)) {
				return false
			}

			return message.type === "mode"
		})

		expect(askResponseCalls).toHaveLength(1)
		expect(modeCalls).toHaveLength(1)

		await waitFor(() => {
			expect(markers.map((marker) => marker.stage)).toEqual(["pending_render", "settle"])
		})

		mockPostMessage({ clineMessages: [] })

		await waitFor(() => {
			expect(queryByTestId(`chat-row-${followUpTs}`)).toBeNull()
		})

		await waitFor(() => {
			expect(markers.map((marker) => marker.stage)).toEqual(["pending_render", "settle", "clear"])
		})
		expect(markers.map((marker) => marker.followUpTs)).toEqual([followUpTs, followUpTs, followUpTs])
		expectMonotonicMarkerTimes(markers)
	})

	it("keeps follow-up lifecycle forward-only when clear is re-attempted across rerenders", async () => {
		const markers: FollowUpInteractionMarker[] = []
		setFollowUpInteractionInstrumentationSink((marker) => {
			markers.push(marker)
		})

		const { getByTestId, queryByTestId, rerender } = renderChatView()

		const followUpTs = 2_130

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: 1_000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "followup",
					ts: followUpTs,
					text: "Should I continue?",
				},
			],
		})

		await waitFor(() => {
			expect(getByTestId(`chat-row-${followUpTs}`)).toHaveAttribute("data-followup-answered", "false")
		})

		const input = getByTestId("chat-textarea").querySelector("input") as HTMLInputElement

		await act(async () => {
			fireEvent.change(input, { target: { value: "Proceed" } })
			fireEvent.keyDown(input, { key: "Enter", code: "Enter" })
		})

		await waitFor(() => {
			expect(markers.map((marker) => marker.stage)).toEqual(["click", "pending_render", "settle"])
		})

		mockPostMessage({ clineMessages: [] })

		await waitFor(() => {
			expect(queryByTestId(`chat-row-${followUpTs}`)).toBeNull()
		})

		await waitFor(() => {
			expect(markers.map((marker) => marker.stage)).toEqual(["click", "pending_render", "settle", "clear"])
		})

		rerender(
			<ExtensionStateContextProvider>
				<QueryClientProvider client={queryClient}>
					<ChatView {...defaultProps} />
				</QueryClientProvider>
			</ExtensionStateContextProvider>,
		)

		mockPostMessage({ clineMessages: [] })

		await act(async () => {
			await Promise.resolve()
		})

		expect(markers.map((marker) => marker.stage)).toEqual(["click", "pending_render", "settle", "clear"])
		expect(markers.map((marker) => marker.followUpTs)).toEqual([followUpTs, followUpTs, followUpTs, followUpTs])
		expectMonotonicMarkerTimes(markers)
	})

	it("handles failed follow-up attempt then retry with deterministic per-attempt marker progression", async () => {
		const markers: FollowUpInteractionMarker[] = []
		setFollowUpInteractionInstrumentationSink((marker) => {
			markers.push(marker)
		})

		const { getByTestId } = renderChatView()

		const firstFollowUpTs = 2_140
		const retryFollowUpTs = 2_141

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: 1_000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "followup",
					ts: firstFollowUpTs,
					text: "First follow-up",
				},
			],
		})

		await waitFor(() => {
			expect(getByTestId(`chat-row-${firstFollowUpTs}`)).toHaveAttribute("data-followup-answered", "false")
		})

		const input = getByTestId("chat-textarea").querySelector("input") as HTMLInputElement

		await act(async () => {
			fireEvent.change(input, { target: { value: "Attempt one" } })
			fireEvent.keyDown(input, { key: "Enter", code: "Enter" })
		})

		await waitFor(() => {
			expect(getByTestId(`chat-row-${firstFollowUpTs}`)).toHaveAttribute("data-followup-answered", "true")
			expect(markers.map((marker) => marker.stage)).toEqual(["click", "pending_render", "settle"])
		})

		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: 1_000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "followup",
					ts: firstFollowUpTs,
					text: "First follow-up",
				},
				{
					type: "say",
					say: "error",
					ts: 3_000,
					text: "Attempt failed",
				},
				{
					type: "ask",
					ask: "followup",
					ts: retryFollowUpTs,
					text: "Retry follow-up",
				},
			],
		})

		await waitFor(() => {
			expect(getByTestId(`chat-row-${firstFollowUpTs}`)).toHaveAttribute("data-followup-answered", "true")
			expect(getByTestId(`chat-row-${retryFollowUpTs}`)).toHaveAttribute("data-followup-answered", "false")
		})

		await act(async () => {
			fireEvent.change(input, { target: { value: "Attempt two" } })
			fireEvent.keyDown(input, { key: "Enter", code: "Enter" })
		})

		await waitFor(() => {
			expect(getByTestId(`chat-row-${retryFollowUpTs}`)).toHaveAttribute("data-followup-answered", "true")
		})

		expect(markers.map((marker) => marker.stage)).toEqual([
			"click",
			"pending_render",
			"settle",
			"click",
			"pending_render",
			"settle",
		])
		expect(markers.map((marker) => marker.followUpTs)).toEqual([
			firstFollowUpTs,
			firstFollowUpTs,
			firstFollowUpTs,
			retryFollowUpTs,
			retryFollowUpTs,
			retryFollowUpTs,
		])
		expectMonotonicMarkerTimes(markers)
	})
})

describe("ChatView - Context Condensing Indicator Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should add a condensing message to groupedMessages when isCondensing is true", async () => {
		// This test verifies that when the condenseTaskContextStarted message is received,
		// the isCondensing state is set to true and a synthetic condensing message is added
		// to the grouped messages list
		const { getByTestId, container } = renderChatView()
		const taskTs = 11_000
		const apiReqStartedTs = 12_000
		const expectedSyntheticCondenseTs = -taskTs

		// First hydrate state with an active task
		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: taskTs,
					text: "Initial task",
				},
				{
					type: "say",
					say: "api_req_started",
					ts: apiReqStartedTs,
					text: JSON.stringify({ apiProtocol: "anthropic" }),
				},
			],
		})

		// Wait for component to render
		await waitFor(() => {
			expect(getByTestId("chat-view")).toBeInTheDocument()
		})

		// Allow time for useEvent hook to register message listener
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10))
		})

		// Dispatch a MessageEvent directly to trigger the message handler
		// This simulates the VSCode extension sending a message to the webview
		await act(async () => {
			const event = new MessageEvent("message", {
				data: {
					type: "condenseTaskContextStarted",
					text: "test-task-id",
				},
			})
			window.dispatchEvent(event)
			// Wait for React state updates
			await new Promise((resolve) => setTimeout(resolve, 0))
		})

		// Check that groupedMessages now includes a condensing message
		// With Virtuoso mocked, items render directly and we can find the ChatRow with partial condense_context message
		await waitFor(
			() => {
				const rows = container.querySelectorAll('[data-testid^="chat-row-"]')
				expect(getByTestId(`chat-row-${expectedSyntheticCondenseTs}`)).toBeInTheDocument()
				// Check for the actual message structure: partial condense_context message
				const condensingRow = Array.from(rows).find((row) => {
					const text = row.textContent || ""
					return text.includes('"say":"condense_context"') && text.includes('"partial":true')
				})
				expect(condensingRow).toBeTruthy()
			},
			{ timeout: 2000 },
		)
	})
})
