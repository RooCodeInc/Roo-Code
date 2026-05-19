// pnpm --filter @roo-code/vscode-webview test src/components/chat/__tests__/ChatView.show-subtask-button.spec.tsx

import React from "react"
import { render, waitFor, screen } from "@/utils/test-utils"
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
vi.mock("use-sound", () => ({
	default: vi.fn().mockImplementation(() => {
		return [vi.fn()]
	}),
}))

// Mock components that use ESM dependencies
vi.mock("../ChatRow", () => ({
	default: function MockChatRow({ message }: { message: ClineMessage }) {
		return <div data-testid="chat-row">{JSON.stringify(message)}</div>
	},
}))

vi.mock("../AutoApproveMenu", () => ({
	default: () => null,
}))

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

vi.mock("../../common/VersionIndicator", () => ({
	default: vi.fn(() => null),
}))

vi.mock("../Announcement", () => ({
	default: () => null,
}))

vi.mock("@/components/common/DismissibleUpsell", () => ({
	default: function MockDismissibleUpsell({ children }: { children: React.ReactNode }) {
		return <div>{children}</div>
	},
}))

vi.mock("../QueuedMessages", () => ({
	QueuedMessages: () => null,
}))

vi.mock("@src/components/welcome/RooTips", () => ({
	default: () => null,
}))

vi.mock("@src/components/welcome/RooHero", () => ({
	default: () => null,
}))

// Mock i18n - return the key itself so we can match on it
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const map: Record<string, string> = {
				"chat:subtasks.showActiveSubtask": "Show subtask",
				"chat:subtasks.showActiveSubtaskTooltip": "A subtask is currently running. Click to view it.",
				"chat:resumeTask.title": "Resume Task",
				"chat:terminate.title": "Terminate",
			}
			return map[key] ?? key
		},
	}),
	initReactI18next: { type: "3rdParty", init: () => {} },
	Trans: ({ i18nKey, children }: { i18nKey: string; children?: React.ReactNode }) => {
		return <>{children || i18nKey}</>
	},
}))

// Mock ChatTextArea
vi.mock("../ChatTextArea", () => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const mockReact = require("react")

	const ChatTextAreaComponent = mockReact.forwardRef(function MockChatTextArea(
		_props: any,
		ref: React.ForwardedRef<{ focus: () => void }>,
	) {
		mockReact.useImperativeHandle(ref, () => ({
			focus: vi.fn(),
		}))
		return <div data-testid="chat-textarea" />
	})

	return {
		default: ChatTextAreaComponent,
		ChatTextArea: ChatTextAreaComponent,
	}
})

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
	VSCodeTextField: () => <input type="text" />,
	VSCodeLink: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

// Mock window.postMessage to trigger state hydration
const sendStateMessage = (state: Partial<ExtensionState>) => {
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

describe("ChatView - Show subtask button", () => {
	beforeEach(() => vi.clearAllMocks())

	it("shows 'Show subtask' button when parent task has awaitingChildId and no other buttons", async () => {
		renderChatView()

		sendStateMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Parent task",
				},
			],
			currentTaskItem: {
				id: "parent-task-1",
				ts: Date.now() - 2000,
				task: "Parent task",
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
				awaitingChildId: "child-task-1",
			} as any,
		})

		await waitFor(() => {
			const showSubtaskButton = screen.getByTestId("show-subtask-button")
			expect(showSubtaskButton).toBeInTheDocument()
			expect(showSubtaskButton).toHaveTextContent("chat:subtasks.showActiveSubtask")
		})
	})

	it("navigates to child task when 'Show subtask' button is clicked", async () => {
		renderChatView()

		sendStateMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Parent task",
				},
			],
			currentTaskItem: {
				id: "parent-task-1",
				ts: Date.now() - 2000,
				task: "Parent task",
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
				awaitingChildId: "child-task-1",
			} as any,
		})

		await waitFor(() => {
			const showSubtaskButton = screen.getByTestId("show-subtask-button")
			showSubtaskButton.click()
		})

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "showTaskWithId",
			text: "child-task-1",
		})
	})

	it("does not show 'Show subtask' button when no awaitingChildId", async () => {
		renderChatView()

		sendStateMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Regular task",
				},
			],
			currentTaskItem: {
				id: "task-1",
				ts: Date.now() - 2000,
				task: "Regular task",
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
			} as any,
		})

		// Give time for any rendering to complete
		await waitFor(() => {
			const showSubtaskButton = screen.queryByTestId("show-subtask-button")
			expect(showSubtaskButton).not.toBeInTheDocument()
		})
	})

	it("shows 'Show subtask' button alongside primary button when both are present", async () => {
		renderChatView()

		sendStateMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Parent task",
				},
				{
					type: "ask",
					ask: "resume_task",
					ts: Date.now(),
					text: "Resume?",
				},
			],
			currentTaskItem: {
				id: "parent-task-1",
				ts: Date.now() - 2000,
				task: "Parent task",
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
				awaitingChildId: "child-task-1",
			} as any,
		})

		await waitFor(() => {
			const showSubtaskButton = screen.getByTestId("show-subtask-button")
			expect(showSubtaskButton).toBeInTheDocument()
		})
	})
})
