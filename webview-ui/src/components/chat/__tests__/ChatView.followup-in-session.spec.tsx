// npx vitest run src/components/chat/__tests__/ChatView.followup-in-session.spec.tsx

import { render, waitFor } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import ChatView, { ChatViewProps } from "../ChatView"

vi.mock("@src/utils/vscode", () => ({
	vscode: { postMessage: vi.fn() },
}))

vi.mock("rehype-highlight", () => ({ default: () => () => {} }))
vi.mock("hast-util-to-text", () => ({ default: () => "" }))

vi.mock("../BrowserSessionRow", () => ({
	default: function MockBrowserSessionRow({ messages }: { messages: any[] }) {
		return <div data-testid="browser-session">{JSON.stringify(messages)}</div>
	},
}))

vi.mock("../ChatRow", () => ({
	default: function MockChatRow({ message }: { message: any }) {
		return <div data-testid="chat-row">{JSON.stringify(message)}</div>
	},
}))

vi.mock("../TaskHeader", () => ({
	default: function MockTaskHeader() {
		return <div data-testid="task-header" />
	},
}))

vi.mock("@src/components/common/CodeBlock", () => ({
	default: () => null,
	CODE_BLOCK_BG_COLOR: "rgb(30, 30, 30)",
}))

const queryClient = new QueryClient()

const defaultProps: ChatViewProps = {
	isHidden: false,
	showAnnouncement: false,
	hideAnnouncement: () => {},
}

const renderChatView = (props: Partial<ChatViewProps> = {}) => {
	return render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<ChatView {...defaultProps} {...props} />
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)
}

const mockPostMessage = (state: any) => {
	window.postMessage(
		{
			type: "state",
			state: {
				version: "1.0.0",
				clineMessages: [],
				taskHistory: [],
				shouldShowAnnouncement: false,
				allowedCommands: [],
				autoApprovalEnabled: true,
				...state,
			},
		},
		"*",
	)
}

describe("ChatView followup inside browser session", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it.skip("renders followup ask as a regular ChatRow while session banner is visible", async () => {
		renderChatView()

		const ts = Date.now()

		// Send initial message with browser session and followup
		mockPostMessage({
			alwaysAllowBrowser: true,
			clineMessages: [
				{ type: "say", say: "task", ts: ts - 4000, text: "Initial task" },
				{
					type: "ask",
					ask: "browser_action_launch",
					ts: ts - 3000,
					text: "http://example.com",
					partial: false,
				},
				{ type: "say", say: "browser_action_result", ts: ts - 2000, text: "" },
				{
					type: "ask",
					ask: "followup",
					ts: ts,
					text: JSON.stringify({ question: "Continue?", suggest: [{ answer: "Yes" }, { answer: "No" }] }),
					partial: false,
				},
			],
		})

		// Banner should be present (only contains browser_action_launch and browser_action_result)
		await waitFor(() => {
			const banner = document.querySelector('[data-testid="browser-session"]')
			expect(banner).not.toBeNull()
		})

		// At least one ChatRow should render (the followup question)
		await waitFor(() => {
			const chatRows = document.querySelectorAll('[data-testid="chat-row"]')
			expect(chatRows.length).toBeGreaterThan(0)
		})
	})
})
