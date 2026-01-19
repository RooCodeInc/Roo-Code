import { render, screen } from "@testing-library/react"
import { SkillsSettings } from "../SkillsSettings"

// Mock the vscode API
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock the translation context
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"settings:sections.skills": "Skills",
				"settings:skills.global": "Global Skills",
				"settings:skills.workspace": "Workspace Skills",
				"settings:skills.empty": "No skills configured",
				"settings:skills.newGlobalPlaceholder": "Enter skill name",
				"settings:skills.newWorkspacePlaceholder": "Enter skill name",
			}
			return translations[key] || key
		},
	}),
}))

// Mock extension state
vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		skills: [],
		cwd: "/test/workspace",
	}),
}))

describe("SkillsSettings", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders the section header", () => {
		render(<SkillsSettings />)

		expect(screen.getByText("Skills")).toBeInTheDocument()
	})

	it("renders the skills tab content", () => {
		render(<SkillsSettings />)

		expect(screen.getByText("Global Skills")).toBeInTheDocument()
	})

	it("shows workspace skills when in workspace", () => {
		render(<SkillsSettings />)

		expect(screen.getByText("Workspace Skills")).toBeInTheDocument()
	})
})
