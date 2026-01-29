import { render, screen, fireEvent } from "@/utils/test-utils"

import type { SkillMetadata } from "@roo-code/types"

import { SkillItem } from "../SkillItem"

// Mock vscode
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock the translation hook
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock UI components
vi.mock("@/components/ui", () => ({
	Button: ({ children, onClick, className, tabIndex }: any) => (
		<button onClick={onClick} className={className} tabIndex={tabIndex} data-testid="button">
			{children}
		</button>
	),
	StandardTooltip: ({ children, content }: any) => (
		<div title={content} data-testid="tooltip">
			{children}
		</div>
	),
}))

const mockSkill: SkillMetadata = {
	name: "test-skill",
	description: "A test skill description",
	path: "/path/to/skill/SKILL.md",
	source: "project",
}

const mockSkillWithMode: SkillMetadata = {
	name: "mode-specific-skill",
	description: "A mode-specific skill",
	path: "/path/to/skill/SKILL.md",
	source: "global",
	mode: "architect",
}

describe("SkillItem", () => {
	const mockOnEdit = vi.fn()
	const mockOnDelete = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders skill name", () => {
		render(<SkillItem skill={mockSkill} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

		expect(screen.getByText("test-skill")).toBeInTheDocument()
	})

	it("renders skill description", () => {
		render(<SkillItem skill={mockSkill} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

		expect(screen.getByText("A test skill description")).toBeInTheDocument()
	})

	it("renders mode badge when skill has mode", () => {
		render(<SkillItem skill={mockSkillWithMode} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

		expect(screen.getByText("architect")).toBeInTheDocument()
	})

	it("does not render mode badge when skill has no mode", () => {
		render(<SkillItem skill={mockSkill} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

		// Should not have any mode badge
		const container = screen.getByText("test-skill").parentElement
		expect(container?.querySelector(".bg-vscode-badge-background")).toBeNull()
	})

	it("calls onEdit when edit button is clicked", () => {
		render(<SkillItem skill={mockSkill} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

		const buttons = screen.getAllByTestId("button")
		// First button is edit
		fireEvent.click(buttons[0])

		expect(mockOnEdit).toHaveBeenCalledTimes(1)
	})

	it("calls onDelete when delete button is clicked", () => {
		render(<SkillItem skill={mockSkill} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

		const buttons = screen.getAllByTestId("button")
		// Second button is delete
		fireEvent.click(buttons[1])

		expect(mockOnDelete).toHaveBeenCalledTimes(1)
	})

	it("calls onEdit when clicking on skill name area", () => {
		render(<SkillItem skill={mockSkill} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

		const nameElement = screen.getByText("test-skill")
		fireEvent.click(nameElement)

		expect(mockOnEdit).toHaveBeenCalledTimes(1)
	})

	it("renders without description when not provided", () => {
		const skillWithoutDescription: SkillMetadata = {
			name: "no-desc-skill",
			description: "",
			path: "/path/to/skill/SKILL.md",
			source: "project",
		}

		render(<SkillItem skill={skillWithoutDescription} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

		expect(screen.getByText("no-desc-skill")).toBeInTheDocument()
		// Description div should not be rendered when empty
		expect(screen.queryByText("A test skill description")).not.toBeInTheDocument()
	})

	it("renders with proper styling classes", () => {
		const { container } = render(<SkillItem skill={mockSkill} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

		const itemDiv = container.firstChild
		expect(itemDiv).toHaveClass("hover:bg-vscode-list-hoverBackground")
	})

	it("renders both edit and delete buttons", () => {
		render(<SkillItem skill={mockSkill} onEdit={mockOnEdit} onDelete={mockOnDelete} />)

		const buttons = screen.getAllByTestId("button")
		expect(buttons).toHaveLength(2)
	})
})
