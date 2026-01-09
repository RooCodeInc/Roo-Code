import { render, screen, fireEvent } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui"
import { SkillItem, type SkillForUI } from "../SkillItem"

// Mock the vscode API
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock the translation context
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Wrapper component to provide necessary context
const TestWrapper = ({ children }: { children: React.ReactNode }) => <TooltipProvider>{children}</TooltipProvider>

const renderWithProviders = (ui: React.ReactElement) => {
	return render(ui, { wrapper: TestWrapper })
}

describe("SkillItem", () => {
	const mockSkill: SkillForUI = {
		name: "test-skill",
		description: "A test skill description",
		source: "global",
		filePath: "/path/to/skill",
	}

	const mockOnDelete = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders skill name and description", () => {
		renderWithProviders(<SkillItem skill={mockSkill} onDelete={mockOnDelete} />)

		expect(screen.getByText("test-skill")).toBeInTheDocument()
		expect(screen.getByText("A test skill description")).toBeInTheDocument()
	})

	it("renders mode badge when skill has mode", () => {
		const skillWithMode: SkillForUI = {
			...mockSkill,
			mode: "code",
		}

		renderWithProviders(<SkillItem skill={skillWithMode} onDelete={mockOnDelete} />)

		expect(screen.getByText("code")).toBeInTheDocument()
	})

	it("does not render mode badge when skill has no mode", () => {
		renderWithProviders(<SkillItem skill={mockSkill} onDelete={mockOnDelete} />)

		// There should be no badge element
		expect(screen.queryByText(/^(code|architect|ask|debug)$/)).not.toBeInTheDocument()
	})

	it("calls onDelete when delete button is clicked", () => {
		renderWithProviders(<SkillItem skill={mockSkill} onDelete={mockOnDelete} />)

		// Find and click the delete button (second button)
		const buttons = screen.getAllByRole("button")
		const deleteButton = buttons[1] // Second button is delete

		fireEvent.click(deleteButton)

		expect(mockOnDelete).toHaveBeenCalledWith(mockSkill)
	})

	it("posts message to open skill file when edit button is clicked", async () => {
		const { vscode } = await import("@/utils/vscode")

		renderWithProviders(<SkillItem skill={mockSkill} onDelete={mockOnDelete} />)

		// Find and click the edit button (first button)
		const buttons = screen.getAllByRole("button")
		const editButton = buttons[0] // First button is edit

		fireEvent.click(editButton)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "openSkillFile",
			text: "test-skill",
			values: { source: "global" },
		})
	})

	it("renders workspace skill correctly", () => {
		const workspaceSkill: SkillForUI = {
			...mockSkill,
			source: "project",
		}

		renderWithProviders(<SkillItem skill={workspaceSkill} onDelete={mockOnDelete} />)

		expect(screen.getByText("test-skill")).toBeInTheDocument()
	})
})
