import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@/utils/test-utils"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"

import { ChatRowContent } from "../ChatRow"

vi.mock("../HookExecution", () => ({
	HookExecution: ({ message }: any) => <div data-testid="hook-execution-mock">{message?.text}</div>,
}))

describe("ChatRowContent - hook_execution", () => {
	it("renders HookExecution for say: hook_execution", () => {
		const queryClient = new QueryClient()
		const message: any = {
			type: "say",
			say: "hook_execution",
			ts: Date.now(),
			text: JSON.stringify({
				executionId: "exec_1",
				hookId: "hook_1",
				event: "PreToolUse",
				toolName: "Write",
				command: "echo hi",
				messageTs: 123,
			}),
			partial: false,
		}

		render(
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

		expect(screen.getByTestId("hook-execution-mock")).toBeInTheDocument()
	})
})
