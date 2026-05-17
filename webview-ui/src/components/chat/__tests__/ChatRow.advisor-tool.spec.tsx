import React from "react"
import { render, screen } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ClineMessage } from "@roo-code/types"
import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import { ChatRowContent } from "../ChatRow"

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const map: Record<string, string> = {
				"chat:advisor.isConsulting": "Consulting advisor...",
				"chat:advisor.resultLabel": "Advisor response",
			}
			return map[key] || key
		},
	}),
	Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
	initReactI18next: { type: "3rdParty", init: () => {} },
}))

// Mock CodeBlock (avoid ESM/highlighter costs)
vi.mock("@src/components/common/CodeBlock", () => ({
	default: () => null,
}))

// Mock VSCodeBadge
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeBadge: ({ children, ...props }: { children: React.ReactNode }) => <span {...props}>{children}</span>,
}))

const queryClient = new QueryClient()

function renderChatRow(message: ClineMessage, isLast = false) {
	return render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<ChatRowContent
					message={message}
					isExpanded={false}
					isLast={isLast}
					isStreaming={false}
					onToggleExpand={() => {}}
					onSuggestionClick={() => {}}
					onBatchFileResponse={() => {}}
					onFollowUpUnmount={() => {}}
					isFollowUpAnswered={false}
				/>
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)
}

describe("ChatRow - advisor tool messages", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders use_advisor_tool as a single header line with no badge", () => {
		const message: ClineMessage = {
			type: "say",
			say: "use_advisor_tool",
			ts: Date.now(),
			partial: false,
			text: JSON.stringify({
				toolUseId: "tool-1",
				name: "advisor",
				input: "{}",
			}),
		}

		renderChatRow(message)

		expect(screen.getByText("Consulting advisor...")).toBeInTheDocument()
		// No badge rendered — the "advisor" text should NOT appear
		expect(screen.queryByText("advisor")).not.toBeInTheDocument()
	})

	it("renders use_advisor_tool with non-empty input as a single header line (no input shown)", () => {
		const message: ClineMessage = {
			type: "say",
			say: "use_advisor_tool",
			ts: Date.now(),
			partial: false,
			text: JSON.stringify({
				toolUseId: "tool-2",
				name: "advisor",
				input: '{"query":"review this function"}',
			}),
		}

		renderChatRow(message)

		expect(screen.getByText("Consulting advisor...")).toBeInTheDocument()
		// Input text is NOT rendered in the simplified header-only view
		expect(screen.queryByText('{"query":"review this function"}')).not.toBeInTheDocument()
	})

	it("renders advisor_tool_result with header and content box", () => {
		const message: ClineMessage = {
			type: "say",
			say: "advisor_tool_result",
			ts: Date.now(),
			partial: false,
			text: "The code looks good overall.",
		}

		renderChatRow(message)

		expect(screen.getByText("Advisor response")).toBeInTheDocument()
	})

	it("renders use_advisor_tool header even with invalid JSON (no early return)", () => {
		const message: ClineMessage = {
			type: "say",
			say: "use_advisor_tool",
			ts: Date.now(),
			partial: false,
			text: "not-valid-json",
		}

		renderChatRow(message)

		// Header still renders — no JSON parsing required in simplified view
		expect(screen.getByText("Consulting advisor...")).toBeInTheDocument()
	})
})
