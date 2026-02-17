import React from "react"
import { fireEvent, render, screen } from "@/utils/test-utils"
import type { ClineMessage } from "@roo-code/types"
import { TranslationProvider } from "@/i18n/__mocks__/TranslationContext"
import FileChangesPanel from "../components/chat/FileChangesPanel"

const mockPostMessage = vi.fn()

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: (...args: unknown[]) => mockPostMessage(...args),
	},
}))

// Mock i18n to return readable header with count
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, opts?: { count?: number }) => {
			if (key === "chat:fileChangesInConversation.header" && opts?.count != null) {
				return `${opts.count} file(s) changed in this conversation`
			}
			return key
		},
	}),
}))

// Lightweight mock so we don't pull in CodeBlock/DiffView
vi.mock("@src/components/common/CodeAccordian", () => ({
	default: ({
		path,
		isExpanded,
		onToggleExpand,
	}: {
		path?: string
		isExpanded: boolean
		onToggleExpand: () => void
	}) => (
		<div data-testid="code-accordian">
			<span data-testid="accordian-path">{path}</span>
			<button type="button" onClick={onToggleExpand} data-testid="accordian-toggle">
				{isExpanded ? "expanded" : "collapsed"}
			</button>
		</div>
	),
}))

function createFileEditMessage(path: string, diff: string): ClineMessage {
	return {
		type: "ask",
		ask: "tool",
		ts: Date.now(),
		partial: false,
		isAnswered: true,
		text: JSON.stringify({
			tool: "appliedDiff",
			path,
			diff,
		}),
	}
}

function renderPanel(messages: ClineMessage[] | undefined) {
	return render(
		<TranslationProvider>
			<FileChangesPanel clineMessages={messages} />
		</TranslationProvider>,
	)
}

describe("FileChangesPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders nothing when clineMessages is undefined", () => {
		const { container } = renderPanel(undefined)
		expect(container.firstChild).toBeNull()
	})

	it("renders nothing when clineMessages is empty", () => {
		const { container } = renderPanel([])
		expect(container.firstChild).toBeNull()
	})

	it("renders nothing when there are no file-edit messages", () => {
		const messages: ClineMessage[] = [
			{
				type: "say",
				say: "text",
				ts: Date.now(),
				partial: false,
				text: "hello",
			},
			{
				type: "ask",
				ask: "tool",
				ts: Date.now(),
				partial: false,
				text: JSON.stringify({ tool: "read_file", path: "x.ts" }),
			},
		]
		const { container } = renderPanel(messages)
		expect(container.firstChild).toBeNull()
	})

	it("renders nothing when file-edit ask tool is not approved (isAnswered false or missing)", () => {
		const messages: ClineMessage[] = [
			{
				type: "ask",
				ask: "tool",
				ts: Date.now(),
				partial: false,
				text: JSON.stringify({
					tool: "appliedDiff",
					path: "src/foo.ts",
					diff: "+line",
				}),
			},
		]
		const { container } = renderPanel(messages)
		expect(container.firstChild).toBeNull()
	})

	it("renders panel with header when there is one file edit", () => {
		const messages = [createFileEditMessage("src/foo.ts", "@@ -1 +1 @@\n+line")]
		renderPanel(messages)

		expect(screen.getByText("1 file(s) changed in this conversation")).toBeInTheDocument()
		// Expand panel so file row is in DOM (CollapsibleContent may not render when closed in some setups)
		fireEvent.click(screen.getByText("1 file(s) changed in this conversation").closest("button")!)
		expect(screen.getByTestId("accordian-path")).toHaveTextContent("src/foo.ts")
	})

	it("renders one row per unique path when multiple files edited", () => {
		const messages = [createFileEditMessage("src/a.ts", "diff a"), createFileEditMessage("src/b.ts", "diff b")]
		renderPanel(messages)

		expect(screen.getByText("2 file(s) changed in this conversation")).toBeInTheDocument()
		// Expand panel so file rows are rendered
		fireEvent.click(screen.getByText("2 file(s) changed in this conversation").closest("button")!)
		const paths = screen.getAllByTestId("accordian-path")
		expect(paths).toHaveLength(2)
		expect(paths.map((el) => el.textContent)).toEqual(expect.arrayContaining(["src/a.ts", "src/b.ts"]))
	})

	it("collapsed by default: panel trigger shows chevron and expanding reveals file rows", () => {
		const messages = [createFileEditMessage("src/foo.ts", "diff")]
		renderPanel(messages)

		// Header visible
		const headerText = screen.getByText("1 file(s) changed in this conversation")
		expect(headerText).toBeInTheDocument()
		// Trigger is the button that contains the header text
		const trigger = headerText.closest("button")
		expect(trigger).toBeInTheDocument()

		// Expand panel
		fireEvent.click(trigger!)
		expect(screen.getByTestId("accordian-path")).toHaveTextContent("src/foo.ts")
	})

	it("toggling a file row expand calls onToggleExpand", () => {
		const messages = [createFileEditMessage("src/foo.ts", "diff")]
		renderPanel(messages)

		// Expand panel first so the file row is rendered
		const headerText = screen.getByText("1 file(s) changed in this conversation")
		fireEvent.click(headerText.closest("button")!)

		const accordianToggle = screen.getByTestId("accordian-toggle")
		expect(accordianToggle).toHaveTextContent("collapsed")
		fireEvent.click(accordianToggle)
		expect(accordianToggle).toHaveTextContent("expanded")
	})
})
