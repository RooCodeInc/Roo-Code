import React from "react"

import { render, screen } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import { ChatRowContent } from "../ChatRow"

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const map: Record<string, string> = {
				"chat:apiRequest.rateLimitWait": "Rate limiting",
			}
			return map[key] ?? key
		},
	}),
	Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
	initReactI18next: { type: "3rdParty", init: () => {} },
}))

const queryClient = new QueryClient()

function renderChatRow(message: any) {
	return render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<ChatRowContent
					message={message}
					isExpanded={false}
					isLast={false}
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

describe("ChatRow - rate limit wait", () => {
	it("renders a non-error progress row for api_req_rate_limit_wait", () => {
		const message: any = {
			type: "say",
			say: "api_req_rate_limit_wait",
			ts: Date.now(),
			partial: true,
			text: "Rate limiting for 1 seconds...",
		}

		renderChatRow(message)

		expect(screen.getByText("Rate limiting")).toBeInTheDocument()
		// Should show countdown, but should NOT show the error-details affordance.
		expect(screen.getByText("1s")).toBeInTheDocument()
		expect(screen.queryByText("Details")).toBeNull()
	})

	it("renders a greyed-out completed row with a clock icon when wait is complete", () => {
		const message: any = {
			type: "say",
			say: "api_req_rate_limit_wait",
			ts: Date.now(),
			partial: false,
			text: undefined,
		}

		renderChatRow(message)

		expect(screen.getByText("Rate limiting")).toBeInTheDocument()
		// Completed row should not show countdown
		expect(screen.queryByText(/\ds/)).toBeNull()
		// And should render a clock icon (codicon-clock) in the DOM.
		expect(document.querySelector(".codicon-clock")).not.toBeNull()
	})
})
