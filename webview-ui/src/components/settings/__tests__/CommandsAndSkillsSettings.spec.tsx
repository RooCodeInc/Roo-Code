import { render, screen, fireEvent } from "@testing-library/react"
import { CommandsAndSkillsSettings } from "../CommandsAndSkillsSettings"

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
				"settings:sections.commandsAndSkills": "Commands & Skills",
				"settings:commandsAndSkills.tabCommands": "Slash Commands",
				"settings:commandsAndSkills.tabSkills": "Skills",
				"settings:slashCommands.description": "Manage your slash commands",
				"settings:skills.global": "Global Skills",
				"settings:skills.workspace": "Workspace Skills",
				"settings:skills.empty": "No skills configured",
				"settings:skills.newGlobalPlaceholder": "Enter skill name",
				"settings:skills.newWorkspacePlaceholder": "Enter skill name",
				"chat:slashCommands.globalCommands": "Global Commands",
				"chat:slashCommands.workspaceCommands": "Workspace Commands",
				"chat:slashCommands.builtInCommands": "Built-in Commands",
				"chat:slashCommands.newGlobalCommandPlaceholder": "Enter command name",
				"chat:slashCommands.newWorkspaceCommandPlaceholder": "Enter command name",
			}
			return translations[key] || key
		},
	}),
}))

// Mock extension state
vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		commands: [],
		skills: [],
		cwd: "/test/workspace",
	}),
}))

// Mock the docLinks utility
vi.mock("@/utils/docLinks", () => ({
	buildDocLink: (path: string) => `https://docs.example.com/${path}`,
}))

describe("CommandsAndSkillsSettings", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders the section header", () => {
		render(<CommandsAndSkillsSettings />)

		expect(screen.getByText("Commands & Skills")).toBeInTheDocument()
	})

	it("renders both tab buttons", () => {
		render(<CommandsAndSkillsSettings />)

		expect(screen.getByText("Slash Commands")).toBeInTheDocument()
		expect(screen.getByText("Skills")).toBeInTheDocument()
	})

	it("shows commands tab content by default", () => {
		render(<CommandsAndSkillsSettings />)

		// Slash Commands tab should be active
		expect(screen.getByText("Global Commands")).toBeInTheDocument()
	})

	it("switches to skills tab when clicked", () => {
		render(<CommandsAndSkillsSettings />)

		// Click on Skills tab
		const skillsTab = screen.getByText("Skills")
		fireEvent.click(skillsTab)

		// Skills content should be visible
		expect(screen.getByText("Global Skills")).toBeInTheDocument()
	})

	it("switches back to commands tab", () => {
		render(<CommandsAndSkillsSettings />)

		// First switch to Skills
		const skillsTab = screen.getByText("Skills")
		fireEvent.click(skillsTab)

		// Then switch back to Commands
		const commandsTab = screen.getByText("Slash Commands")
		fireEvent.click(commandsTab)

		// Commands content should be visible
		expect(screen.getByText("Global Commands")).toBeInTheDocument()
	})

	it("shows active state indicator on selected tab", () => {
		render(<CommandsAndSkillsSettings />)

		// The commands tab should have the active styling
		const commandsTab = screen.getByText("Slash Commands").closest("button")
		expect(commandsTab?.className).toContain("text-vscode-foreground")
	})
})
