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
				"chat:fileOperations.wantsToEdit": "Roo wants to edit this file",
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

const queryClient = new QueryClient()

function renderChatRow(message: any, isExpanded = false) {
	return render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<ChatRowContent
					message={message}
					isExpanded={isExpanded}
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

describe("ChatRow - inline diff stats and actions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("shows + and - counts for editedExistingFile ask", () => {
		const diff = "@@ -1,1 +1,1 @@\n-old\n+new\n"
		const message: any = {
			type: "ask",
			ask: "tool",
			ts: Date.now(),
			partial: false,
			text: JSON.stringify({
				tool: "editedExistingFile",
				path: "src/file.ts",
				diff,
			}),
		}

		renderChatRow(message, false)

		// Plus/minus counts
		expect(screen.getByText("+1")).toBeInTheDocument()
		expect(screen.getByText("-1")).toBeInTheDocument()
	})

	it("derives counts from searchAndReplace diff", () => {
		const diff = "-a\n-b\n+c\n"
		const message: any = {
			type: "ask",
			ask: "tool",
			ts: Date.now(),
			partial: false,
			text: JSON.stringify({
				tool: "searchAndReplace",
				path: "src/file.ts",
				diff,
			}),
		}

		renderChatRow(message)

		expect(screen.getByText("+1")).toBeInTheDocument()
		expect(screen.getByText("-2")).toBeInTheDocument()
	})
})
