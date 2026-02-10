// npx vitest run src/components/chat/__tests__/ChatView.preserve-images.spec.tsx

import React from "react"
import { render, waitFor, act } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"

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

// Mock VersionIndicator
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
		return null
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
	setSelectedImages?: React.Dispatch<React.SetStateAction<string[]>>
	shouldDisableImages?: boolean
}

const mockInputRef = React.createRef<HTMLInputElement>()
const mockFocus = vi.fn()

// Mock ChatTextArea to expose selectedImages via a data attribute
vi.mock("../ChatTextArea", () => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const mockReact = require("react")

	const ChatTextAreaComponent = mockReact.forwardRef(function MockChatTextArea(
		props: ChatTextAreaProps,
		ref: React.ForwardedRef<{ focus: () => void }>,
	) {
		mockReact.useImperativeHandle(ref, () => ({
			focus: mockFocus,
		}))

		return (
			<div data-testid="chat-textarea" data-selected-images={JSON.stringify(props.selectedImages || [])}>
				<input
					ref={mockInputRef}
					type="text"
					value={props.inputValue || ""}
					onChange={(e) => {
						if (props.setInputValue) {
							props.setInputValue(e.target.value)
						}
					}}
					onKeyDown={(e) => {
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
		ChatTextArea: ChatTextAreaComponent,
	}
})

// Mock react-virtuoso
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

describe("ChatView - Preserve Images During Chat Activity", () => {
	beforeEach(() => vi.clearAllMocks())

	it("should not clear selectedImages when api_req_started message arrives", async () => {
		const { getByTestId } = renderChatView()

		// Hydrate state with an active task
		await act(async () => {
			mockPostMessage({
				clineMessages: [
					{
						type: "say",
						say: "task",
						ts: Date.now() - 5000,
						text: "Initial task",
					},
				],
			})
		})

		// Wait for the component to render
		await waitFor(() => {
			expect(getByTestId("chat-textarea")).toBeInTheDocument()
		})

		// Simulate user pasting an image via the selectedImages message
		await act(async () => {
			window.postMessage(
				{
					type: "selectedImages",
					images: [
						"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
					],
				},
				"*",
			)
		})

		// Verify images are set
		await waitFor(() => {
			const textArea = getByTestId("chat-textarea")
			const images = JSON.parse(textArea.getAttribute("data-selected-images") || "[]")
			expect(images).toHaveLength(1)
		})

		// Now simulate an api_req_started message (which happens during chat activity)
		await act(async () => {
			mockPostMessage({
				clineMessages: [
					{
						type: "say",
						say: "task",
						ts: Date.now() - 5000,
						text: "Initial task",
					},
					{
						type: "say",
						say: "api_req_started",
						ts: Date.now(),
						text: JSON.stringify({ request: "test" }),
					},
				],
			})
		})

		// Images should still be present after api_req_started
		await waitFor(() => {
			const textArea = getByTestId("chat-textarea")
			const images = JSON.parse(textArea.getAttribute("data-selected-images") || "[]")
			expect(images).toHaveLength(1)
			expect(images[0]).toContain("data:image/png;base64,")
		})
	})

	it("should preserve images through multiple api_req_started messages", async () => {
		const { getByTestId } = renderChatView()

		// Hydrate state with an active task
		await act(async () => {
			mockPostMessage({
				clineMessages: [
					{
						type: "say",
						say: "task",
						ts: Date.now() - 5000,
						text: "Initial task",
					},
				],
			})
		})

		await waitFor(() => {
			expect(getByTestId("chat-textarea")).toBeInTheDocument()
		})

		// Simulate user pasting two images
		await act(async () => {
			window.postMessage(
				{
					type: "selectedImages",
					images: ["data:image/png;base64,image1", "data:image/png;base64,image2"],
				},
				"*",
			)
		})

		// Verify both images are set
		await waitFor(() => {
			const textArea = getByTestId("chat-textarea")
			const images = JSON.parse(textArea.getAttribute("data-selected-images") || "[]")
			expect(images).toHaveLength(2)
		})

		// Simulate multiple api_req_started messages (multiple API calls during task processing)
		const baseTs = Date.now()
		for (let i = 0; i < 3; i++) {
			await act(async () => {
				mockPostMessage({
					clineMessages: [
						{
							type: "say",
							say: "task",
							ts: baseTs - 5000,
							text: "Initial task",
						},
						{
							type: "say",
							say: "api_req_started",
							ts: baseTs + i * 1000,
							text: JSON.stringify({ request: `test-${i}` }),
						},
					],
				})
			})
		}

		// Images should still be preserved after multiple api_req_started messages
		await waitFor(() => {
			const textArea = getByTestId("chat-textarea")
			const images = JSON.parse(textArea.getAttribute("data-selected-images") || "[]")
			expect(images).toHaveLength(2)
			expect(images[0]).toBe("data:image/png;base64,image1")
			expect(images[1]).toBe("data:image/png;base64,image2")
		})
	})

	it("should still clear images when user sends a message", async () => {
		const { getByTestId } = renderChatView()

		// Hydrate with an active task that has a followup ask (so sending is enabled)
		await act(async () => {
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
						ask: "followup",
						ts: Date.now(),
						text: "What do you want to do?",
					},
				],
			})
		})

		await waitFor(() => {
			expect(getByTestId("chat-textarea")).toBeInTheDocument()
		})

		// Add an image
		await act(async () => {
			window.postMessage(
				{
					type: "selectedImages",
					images: ["data:image/png;base64,testimage"],
				},
				"*",
			)
		})

		// Verify image is set
		await waitFor(() => {
			const textArea = getByTestId("chat-textarea")
			const images = JSON.parse(textArea.getAttribute("data-selected-images") || "[]")
			expect(images).toHaveLength(1)
		})

		// Type something and send (Enter key triggers onSend -> handleSendMessage)
		const input = mockInputRef.current!
		await act(async () => {
			// Set input value first
			input.focus()
			// Fire change event to set the input value
			input.value = "Here is my image"
			input.dispatchEvent(new Event("change", { bubbles: true }))
		})

		await act(async () => {
			// Press Enter to send
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
		})

		// After sending, images should be cleared
		await waitFor(() => {
			const textArea = getByTestId("chat-textarea")
			const images = JSON.parse(textArea.getAttribute("data-selected-images") || "[]")
			expect(images).toHaveLength(0)
		})
	})
})
