import React from "react"
import { render, screen } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ChatRowContent } from "../ChatRow"
import type { HistoryItem, ClineMessage } from "@roo-code/types"

// Mock vscode API
const mockPostMessage = vi.fn()
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: (msg: unknown) => mockPostMessage(msg),
	},
}))

// Mock i18n - return key-based strings so we can assert on the right keys
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, string>) => {
			const map: Record<string, string> = {
				"chat:subtasks.wantsToCreate": "Roo wants to create a new subtask",
				"chat:subtasks.permissionBoundaries": "Permission Boundaries",
				"chat:subtasks.goToSubtask": "Go to subtask",
			}
			if (key === "chat:subtasks.permissionFilePatterns" && params?.patterns) {
				return `Allowed files: ${params.patterns}`
			}
			if (key === "chat:subtasks.permissionCommandPatterns" && params?.patterns) {
				return `Allowed commands: ${params.patterns}`
			}
			if (key === "chat:subtasks.permissionAllowedTools" && params?.tools) {
				return `Allowed tools: ${params.tools}`
			}
			if (key === "chat:subtasks.permissionDeniedTools" && params?.tools) {
				return `Denied tools: ${params.tools}`
			}
			return map[key] ?? key
		},
		i18n: { exists: () => true },
	}),
	Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
	initReactI18next: { type: "3rdParty", init: () => {} },
}))

// Mock extension state context
let mockCurrentTaskItem: Partial<HistoryItem> | undefined = undefined
let mockClineMessages: ClineMessage[] = []

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		mcpServers: [],
		alwaysAllowMcp: false,
		currentCheckpoint: null,
		mode: "code",
		apiConfiguration: {},
		clineMessages: mockClineMessages,
		currentTaskItem: mockCurrentTaskItem,
	}),
}))

// Mock useSelectedModel hook
vi.mock("@src/components/ui/hooks/useSelectedModel", () => ({
	useSelectedModel: () => ({ info: { supportsImages: true } }),
}))

const queryClient = new QueryClient()

function renderChatRow(message: any, currentTaskItem?: Partial<HistoryItem>, clineMessages?: ClineMessage[]) {
	mockCurrentTaskItem = currentTaskItem
	mockClineMessages = clineMessages || [message]

	return render(
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
		</QueryClientProvider>,
	)
}

describe("ChatRow - permission boundaries display", () => {
	beforeEach(() => {
		mockPostMessage.mockClear()
	})

	it("should display permission boundaries when permissions are set on a newTask", () => {
		const message = {
			ts: Date.now(),
			type: "ask" as const,
			ask: "tool" as const,
			text: JSON.stringify({
				tool: "newTask",
				mode: "code",
				content: "Edit the Button component",
				permissions: {
					filePatterns: ["src/components/.*"],
					commandPatterns: ["npm test.*"],
					deniedTools: ["execute_command"],
				},
			}),
		}

		renderChatRow(message)

		expect(screen.getByText("Permission Boundaries")).toBeInTheDocument()
		expect(screen.getByText("Allowed files: src/components/.*")).toBeInTheDocument()
		expect(screen.getByText("Allowed commands: npm test.*")).toBeInTheDocument()
		expect(screen.getByText("Denied tools: execute_command")).toBeInTheDocument()
	})

	it("should display allowedTools when set", () => {
		const message = {
			ts: Date.now(),
			type: "ask" as const,
			ask: "tool" as const,
			text: JSON.stringify({
				tool: "newTask",
				mode: "ask",
				content: "Research the API",
				permissions: {
					allowedTools: ["read_file", "search_files", "codebase_search"],
				},
			}),
		}

		renderChatRow(message)

		expect(screen.getByText("Permission Boundaries")).toBeInTheDocument()
		expect(screen.getByText("Allowed tools: read_file, search_files, codebase_search")).toBeInTheDocument()
	})

	it("should not display permission boundaries when permissions are not set", () => {
		const message = {
			ts: Date.now(),
			type: "ask" as const,
			ask: "tool" as const,
			text: JSON.stringify({
				tool: "newTask",
				mode: "code",
				content: "Implement feature X",
			}),
		}

		renderChatRow(message)

		expect(screen.queryByText("Permission Boundaries")).not.toBeInTheDocument()
	})

	it("should display multiple permission types together", () => {
		const message = {
			ts: Date.now(),
			type: "ask" as const,
			ask: "tool" as const,
			text: JSON.stringify({
				tool: "newTask",
				mode: "code",
				content: "Edit and test components",
				permissions: {
					filePatterns: ["src/components/.*", "src/utils/.*"],
					commandPatterns: ["npm test.*", "npm run lint"],
					allowedTools: ["read_file", "write_to_file", "execute_command"],
					deniedTools: ["apply_patch"],
				},
			}),
		}

		renderChatRow(message)

		expect(screen.getByText("Permission Boundaries")).toBeInTheDocument()
		expect(screen.getByText("Allowed files: src/components/.*, src/utils/.*")).toBeInTheDocument()
		expect(screen.getByText("Allowed commands: npm test.*, npm run lint")).toBeInTheDocument()
		expect(screen.getByText("Allowed tools: read_file, write_to_file, execute_command")).toBeInTheDocument()
		expect(screen.getByText("Denied tools: apply_patch")).toBeInTheDocument()
	})
})
