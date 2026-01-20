import { render, screen, fireEvent, waitFor } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import type { SkillMetadata } from "@roo-code/types"

import { ExtensionStateContextProvider } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"

import { SkillsSettings } from "../SkillsSettings"

// Mock vscode
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock the translation hook
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, params?: any) => {
			if (params?.name) {
				return `${key} ${params.name}`
			}
			return key
		},
	}),
}))

// Mock the doc links utility
vi.mock("@/utils/docLinks", () => ({
	buildDocLink: (path: string, anchor?: string) => `https://docs.example.com/${path}${anchor ? `#${anchor}` : ""}`,
}))

// Mock UI components
vi.mock("@/components/ui", () => ({
	AlertDialog: ({ children, open }: any) => (
		<div data-testid="alert-dialog" data-open={open}>
			{open && children}
		</div>
	),
	AlertDialogContent: ({ children }: any) => <div data-testid="alert-dialog-content">{children}</div>,
	AlertDialogHeader: ({ children }: any) => <div data-testid="alert-dialog-header">{children}</div>,
	AlertDialogTitle: ({ children }: any) => <div data-testid="alert-dialog-title">{children}</div>,
	AlertDialogDescription: ({ children }: any) => <div data-testid="alert-dialog-description">{children}</div>,
	AlertDialogFooter: ({ children }: any) => <div data-testid="alert-dialog-footer">{children}</div>,
	AlertDialogAction: ({ children, onClick }: any) => (
		<button data-testid="alert-dialog-action" onClick={onClick}>
			{children}
		</button>
	),
	AlertDialogCancel: ({ children, onClick }: any) => (
		<button data-testid="alert-dialog-cancel" onClick={onClick}>
			{children}
		</button>
	),
	Button: ({ children, onClick, disabled, className, variant, size }: any) => (
		<button
			onClick={onClick}
			disabled={disabled}
			className={className}
			data-variant={variant}
			data-size={size}
			data-testid="button">
			{children}
		</button>
	),
}))

// Mock SkillItem component
vi.mock("../SkillItem", () => ({
	SkillItem: ({ skill, onEdit, onDelete }: any) => (
		<div data-testid={`skill-item-${skill.name}`}>
			<span>{skill.name}</span>
			{skill.description && <span>{skill.description}</span>}
			{skill.mode && <span data-testid={`skill-mode-${skill.name}`}>{skill.mode}</span>}
			<button onClick={onEdit} data-testid={`edit-${skill.name}`}>
				Edit
			</button>
			<button onClick={onDelete} data-testid={`delete-${skill.name}`}>
				Delete
			</button>
		</div>
	),
}))

// Mock CreateSkillDialog component
vi.mock("../CreateSkillDialog", () => ({
	CreateSkillDialog: ({ open, onOpenChange, onSkillCreated }: any) => (
		<div data-testid="create-skill-dialog" data-open={open}>
			{open && (
				<>
					<button onClick={() => onOpenChange(false)} data-testid="close-dialog">
						Close
					</button>
					<button onClick={onSkillCreated} data-testid="create-skill-button">
						Create
					</button>
				</>
			)}
		</div>
	),
}))

// Mock SectionHeader and Section components
vi.mock("../SectionHeader", () => ({
	SectionHeader: ({ children }: any) => <div data-testid="section-header">{children}</div>,
}))

vi.mock("../Section", () => ({
	Section: ({ children }: any) => <div data-testid="section">{children}</div>,
}))

// Mock SearchableSetting
vi.mock("../SearchableSetting", () => ({
	SearchableSetting: ({ children }: any) => <div data-testid="searchable-setting">{children}</div>,
}))

const mockSkills: SkillMetadata[] = [
	{
		name: "project-skill",
		description: "A project skill",
		path: "/workspace/.roo/skills/project-skill/SKILL.md",
		source: "project",
	},
	{
		name: "project-mode-skill",
		description: "A project mode-specific skill",
		path: "/workspace/.roo/skills-architect/project-mode-skill/SKILL.md",
		source: "project",
		mode: "architect",
	},
	{
		name: "global-skill",
		description: "A global skill",
		path: "/home/.roo/skills/global-skill/SKILL.md",
		source: "global",
	},
]

// Create a variable to hold the mock state
let mockExtensionState: any = {}

// Mock the useExtensionState hook
vi.mock("@/context/ExtensionStateContext", () => ({
	ExtensionStateContextProvider: ({ children }: any) => children,
	useExtensionState: () => mockExtensionState,
}))

const renderSkillsSettings = (skills: SkillMetadata[] = mockSkills, cwd?: string) => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	})

	// Update the mock state before rendering
	mockExtensionState = {
		skills,
		cwd: cwd !== undefined ? cwd : "/workspace",
		customModes: [],
	}

	return render(
		<QueryClientProvider client={queryClient}>
			<ExtensionStateContextProvider>
				<SkillsSettings />
			</ExtensionStateContextProvider>
		</QueryClientProvider>,
	)
}

describe("SkillsSettings", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders section header", () => {
		renderSkillsSettings()

		expect(screen.getByTestId("section-header")).toBeInTheDocument()
		expect(screen.getByText("settings:sections.skills")).toBeInTheDocument()
	})

	it("requests skills on mount", () => {
		renderSkillsSettings()

		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "requestSkills" })
	})

	it("displays project skills section when in a workspace", () => {
		renderSkillsSettings()

		expect(screen.getByText("settings:skills.projectSkills")).toBeInTheDocument()
		expect(screen.getByTestId("skill-item-project-skill")).toBeInTheDocument()
	})

	it("displays global skills section", () => {
		renderSkillsSettings()

		expect(screen.getByText("settings:skills.globalSkills")).toBeInTheDocument()
		expect(screen.getByTestId("skill-item-global-skill")).toBeInTheDocument()
	})

	it("does not display project skills section when not in a workspace", () => {
		const globalOnlySkills = mockSkills.filter((s) => s.source === "global")
		renderSkillsSettings(globalOnlySkills, "")

		expect(screen.queryByText("settings:skills.projectSkills")).not.toBeInTheDocument()
	})

	it("shows empty state for project skills when none exist", () => {
		const globalOnlySkills = mockSkills.filter((s) => s.source === "global")
		renderSkillsSettings(globalOnlySkills)

		expect(screen.getByText("settings:skills.noProjectSkills")).toBeInTheDocument()
	})

	it("shows empty state for global skills when none exist", () => {
		const projectOnlySkills = mockSkills.filter((s) => s.source === "project")
		renderSkillsSettings(projectOnlySkills)

		expect(screen.getByText("settings:skills.noGlobalSkills")).toBeInTheDocument()
	})

	it("groups skills by source correctly", () => {
		renderSkillsSettings()

		// Project skills
		expect(screen.getByTestId("skill-item-project-skill")).toBeInTheDocument()
		expect(screen.getByTestId("skill-item-project-mode-skill")).toBeInTheDocument()

		// Global skills
		expect(screen.getByTestId("skill-item-global-skill")).toBeInTheDocument()
	})

	it("displays mode badge for mode-specific skills", () => {
		renderSkillsSettings()

		expect(screen.getByTestId("skill-mode-project-mode-skill")).toBeInTheDocument()
		expect(screen.getByText("architect")).toBeInTheDocument()
	})

	it("opens create skill dialog when add button is clicked", () => {
		renderSkillsSettings()

		const addButtons = screen.getAllByTestId("button")
		fireEvent.click(addButtons[0])

		expect(screen.getByTestId("create-skill-dialog")).toHaveAttribute("data-open", "true")
	})

	it("opens delete confirmation dialog when delete button is clicked", () => {
		renderSkillsSettings()

		const deleteButton = screen.getByTestId("delete-project-skill")
		fireEvent.click(deleteButton)

		expect(screen.getByTestId("alert-dialog")).toHaveAttribute("data-open", "true")
		expect(screen.getByText("settings:skills.deleteDialog.title")).toBeInTheDocument()
	})

	it("deletes skill when confirmation is clicked", async () => {
		renderSkillsSettings()

		const deleteButton = screen.getByTestId("delete-project-skill")
		fireEvent.click(deleteButton)

		const confirmButton = screen.getByTestId("alert-dialog-action")
		fireEvent.click(confirmButton)

		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "deleteSkill",
				skillName: "project-skill",
				source: "project",
				skillMode: undefined,
			})
		})
	})

	it("cancels deletion when cancel is clicked", () => {
		renderSkillsSettings()

		const deleteButton = screen.getByTestId("delete-project-skill")
		fireEvent.click(deleteButton)

		const cancelButton = screen.getByTestId("alert-dialog-cancel")
		fireEvent.click(cancelButton)

		expect(screen.getByTestId("alert-dialog")).toHaveAttribute("data-open", "false")
	})

	it("opens skill file when edit button is clicked", () => {
		renderSkillsSettings()

		const editButton = screen.getByTestId("edit-project-skill")
		fireEvent.click(editButton)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "openSkillFile",
			skillName: "project-skill",
			source: "project",
			skillMode: undefined,
		})
	})

	it("sends mode when editing mode-specific skill", () => {
		renderSkillsSettings()

		const editButton = screen.getByTestId("edit-project-mode-skill")
		fireEvent.click(editButton)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "openSkillFile",
			skillName: "project-mode-skill",
			source: "project",
			skillMode: "architect",
		})
	})

	it("sends mode when deleting mode-specific skill", async () => {
		renderSkillsSettings()

		const deleteButton = screen.getByTestId("delete-project-mode-skill")
		fireEvent.click(deleteButton)

		const confirmButton = screen.getByTestId("alert-dialog-action")
		fireEvent.click(confirmButton)

		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "deleteSkill",
				skillName: "project-mode-skill",
				source: "project",
				skillMode: "architect",
			})
		})
	})

	it("refreshes skills after deletion", async () => {
		renderSkillsSettings()

		const deleteButton = screen.getByTestId("delete-project-skill")
		fireEvent.click(deleteButton)

		const confirmButton = screen.getByTestId("alert-dialog-action")
		fireEvent.click(confirmButton)

		// Wait for the setTimeout to execute
		await waitFor(
			() => {
				const calls = (vscode.postMessage as any).mock.calls
				const refreshCalls = calls.filter((call: any[]) => call[0].type === "requestSkills")
				// Should have been called at least twice - once on mount, once after deletion
				expect(refreshCalls.length).toBeGreaterThanOrEqual(2)
			},
			{ timeout: 200 },
		)
	})

	it("refreshes skills after creating new skill", async () => {
		renderSkillsSettings()

		// Open create dialog
		const addButtons = screen.getAllByTestId("button")
		fireEvent.click(addButtons[0])

		// Simulate skill creation
		const createButton = screen.getByTestId("create-skill-button")
		fireEvent.click(createButton)

		// Wait for the setTimeout to execute
		await waitFor(
			() => {
				const calls = (vscode.postMessage as any).mock.calls
				const refreshCalls = calls.filter((call: any[]) => call[0].type === "requestSkills")
				expect(refreshCalls.length).toBeGreaterThanOrEqual(2)
			},
			{ timeout: 600 },
		)
	})

	it("renders empty state when no skills exist", () => {
		renderSkillsSettings([])

		expect(screen.getByText("settings:skills.noProjectSkills")).toBeInTheDocument()
		expect(screen.getByText("settings:skills.noGlobalSkills")).toBeInTheDocument()
	})

	it("handles multiple skills of the same source", () => {
		const multipleSkills: SkillMetadata[] = [
			{
				name: "skill-1",
				description: "First skill",
				path: "/path/1",
				source: "global",
			},
			{
				name: "skill-2",
				description: "Second skill",
				path: "/path/2",
				source: "global",
			},
			{
				name: "skill-3",
				description: "Third skill",
				path: "/path/3",
				source: "global",
			},
		]

		renderSkillsSettings(multipleSkills)

		expect(screen.getByTestId("skill-item-skill-1")).toBeInTheDocument()
		expect(screen.getByTestId("skill-item-skill-2")).toBeInTheDocument()
		expect(screen.getByTestId("skill-item-skill-3")).toBeInTheDocument()
	})

	it("renders add skill button in each section", () => {
		renderSkillsSettings()

		// Should have two "Add Skill" buttons - one for project, one for global
		const buttons = screen.getAllByTestId("button")
		const addButtons = buttons.filter((btn) => btn.textContent?.includes("settings:skills.addSkill"))
		expect(addButtons.length).toBe(2)
	})
})
