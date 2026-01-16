import { render, screen, fireEvent } from "@/utils/test-utils"
import { vscode } from "@/utils/vscode"

import { WarningRow } from "../WarningRow"

// Mock vscode webview messaging
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock i18n TranslationContext
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			const map: Record<string, string> = {
				"chat:apiRequest.errorMessage.docs": "Docs",
			}
			return map[key] ?? key
		},
	}),
}))

describe("WarningRow", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders title and message", () => {
		render(<WarningRow title="Test Warning" message="This is a test warning message" />)

		expect(screen.getByText("Test Warning")).toBeInTheDocument()
		expect(screen.getByText("This is a test warning message")).toBeInTheDocument()
	})

	it("does not render docs link when docsURL is not provided", () => {
		render(<WarningRow title="Test Warning" message="This is a test message" />)

		expect(screen.queryByText("Docs")).not.toBeInTheDocument()
	})

	it("renders docs link when docsURL is provided", () => {
		render(<WarningRow title="Test Warning" message="This is a test message" docsURL="https://docs.example.com" />)

		const docsLink = screen.getByText("Docs")
		expect(docsLink).toBeInTheDocument()
	})

	it("opens external URL when docs link is clicked", () => {
		const mockPostMessage = vi.mocked(vscode.postMessage)

		render(<WarningRow title="Test Warning" message="This is a test message" docsURL="https://docs.example.com" />)

		const docsLink = screen.getByText("Docs")
		fireEvent.click(docsLink)

		expect(mockPostMessage).toHaveBeenCalledWith({
			type: "openExternal",
			url: "https://docs.example.com",
		})
	})

	it("renders warning icon", () => {
		const { container } = render(<WarningRow title="Test Warning" message="This is a test message" />)

		// TriangleAlert icon should be present (as an SVG element)
		const warningIcon = container.querySelector("svg")
		expect(warningIcon).toBeInTheDocument()
	})
})
