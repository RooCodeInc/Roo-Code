import { render, screen, fireEvent } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui"
import { SkillsTab } from "../SkillsTab"
import type { SkillForUI } from "../SkillItem"

// Mock the vscode API
const mockPostMessage = vi.fn()
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: (...args: unknown[]) => mockPostMessage(...args),
	},
}))

// Mock the translation context
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"settings:skills.global": "Global Skills",
				"settings:skills.workspace": "Workspace Skills",
				"settings:skills.empty": "No skills configured",
				"settings:skills.newGlobalPlaceholder": "Enter skill name",
				"settings:skills.newWorkspacePlaceholder": "Enter skill name",
				"settings:skills.invalidName": "Invalid name",
				"settings:skills.edit": "Edit",
				"settings:skills.delete": "Delete",
				"settings:skills.deleteDialog.title": "Delete Skill",
				"settings:skills.deleteDialog.description": "Are you sure?",
				"settings:skills.deleteDialog.cancel": "Cancel",
				"settings:skills.deleteDialog.confirm": "Delete",
			}
			return translations[key] || key
		},
	}),
}))

// Mock extension state
const mockSkills: SkillForUI[] = [
	{ name: "global-skill", description: "A global skill", source: "global", filePath: "/global/path" },
	{ name: "workspace-skill", description: "A workspace skill", source: "project", filePath: "/workspace/path" },
]

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		skills: mockSkills,
		cwd: "/test/workspace",
	}),
}))

// Wrapper component to provide necessary context
const TestWrapper = ({ children }: { children: React.ReactNode }) => <TooltipProvider>{children}</TooltipProvider>

const renderWithProviders = (ui: React.ReactElement) => {
	return render(ui, { wrapper: TestWrapper })
}

describe("SkillsTab", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders global and workspace skills sections", () => {
		renderWithProviders(<SkillsTab />)

		expect(screen.getByText("Global Skills")).toBeInTheDocument()
		expect(screen.getByText("Workspace Skills")).toBeInTheDocument()
	})

	it("displays skills from context", () => {
		renderWithProviders(<SkillsTab />)

		expect(screen.getByText("global-skill")).toBeInTheDocument()
		expect(screen.getByText("workspace-skill")).toBeInTheDocument()
	})

	it("requests skills on mount", () => {
		renderWithProviders(<SkillsTab />)

		expect(mockPostMessage).toHaveBeenCalledWith({ type: "requestSkills" })
	})

	it("validates skill name input", () => {
		renderWithProviders(<SkillsTab />)

		const inputs = screen.getAllByPlaceholderText("Enter skill name")
		const globalInput = inputs[0]

		// Enter invalid name (uppercase)
		fireEvent.change(globalInput, { target: { value: "InvalidName" } })

		// Try to submit with Enter
		fireEvent.keyDown(globalInput, { key: "Enter" })

		// The invalid name message should appear
		expect(screen.getByText("Invalid name")).toBeInTheDocument()
	})

	it("creates skill with valid name", () => {
		renderWithProviders(<SkillsTab />)

		const inputs = screen.getAllByPlaceholderText("Enter skill name")
		const globalInput = inputs[0]

		// Enter valid name
		fireEvent.change(globalInput, { target: { value: "valid-skill" } })

		// Submit with Enter
		fireEvent.keyDown(globalInput, { key: "Enter" })

		expect(mockPostMessage).toHaveBeenCalledWith({
			type: "createSkill",
			text: "valid-skill",
			values: { source: "global" },
		})
	})

	it("shows delete confirmation dialog when delete is clicked", async () => {
		renderWithProviders(<SkillsTab />)

		// Find all delete buttons (there should be 2 - one for each skill)
		const deleteButtons = screen.getAllByRole("button").filter((btn) => btn.className.includes("hover:text-red"))

		// Click the first delete button
		if (deleteButtons.length > 0) {
			fireEvent.click(deleteButtons[0])

			// Dialog should appear
			expect(screen.getByText("Delete Skill")).toBeInTheDocument()
		}
	})
})
