import { render, screen, fireEvent } from "@/utils/test-utils"

import type { HookWithMetadata } from "@roo-code/types"

import { HookItem } from "../HookItem"

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

// Mock dnd-kit
vi.mock("@dnd-kit/sortable", () => ({
	useSortable: () => ({
		attributes: {},
		listeners: {},
		setNodeRef: vi.fn(),
		transform: null,
		transition: null,
		isDragging: false,
	}),
}))

vi.mock("@dnd-kit/utilities", () => ({
	CSS: {
		Transform: {
			toString: () => null,
		},
	},
}))

// Mock UI components - keep ToggleSwitch functional for testing
vi.mock("@/components/ui", () => ({
	Button: ({ children, onClick, className, title }: any) => (
		<button onClick={onClick} className={className} title={title} data-testid="button">
			{children}
		</button>
	),
	ToggleSwitch: ({ checked, onChange, disabled, "aria-label": ariaLabel }: any) => (
		<div
			role="switch"
			aria-checked={checked}
			aria-label={ariaLabel}
			data-testid="toggle-switch"
			tabIndex={disabled ? -1 : 0}
			onClick={disabled ? undefined : onChange}
			onKeyDown={(e: React.KeyboardEvent) => {
				if (!disabled && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault()
					onChange()
				}
			}}
			style={{ opacity: disabled ? 0.6 : 1 }}
		/>
	),
}))

// Mock tab components
vi.mock("../HookConfigTab", () => ({
	HookConfigTab: () => <div data-testid="hook-config-tab">Config Tab</div>,
}))

vi.mock("../HookCommandTab", () => ({
	HookCommandTab: () => <div data-testid="hook-command-tab">Command Tab</div>,
}))

vi.mock("../HookLogsTab", () => ({
	HookLogsTab: () => <div data-testid="hook-logs-tab">Logs Tab</div>,
}))

const mockEnabledHook: HookWithMetadata = {
	id: "test-hook",
	name: "Test Hook",
	enabled: true,
	action: {
		type: "command",
		command: "echo test",
		timeout: 30,
	},
	eventType: "PreToolUse",
	source: "project",
	matchers: {
		tools: ["read", "edit"],
	},
}

const mockDisabledHook: HookWithMetadata = {
	...mockEnabledHook,
	id: "disabled-hook",
	name: "Disabled Hook",
	enabled: false,
}

const mockHookWithSessionMatcher: HookWithMetadata = {
	id: "session-hook",
	name: "Session Hook",
	enabled: true,
	action: {
		type: "slashCommand",
		command: "/test",
	},
	eventType: "SessionStart",
	source: "global",
	matchers: {
		sessionType: ["startup", "resume"],
	},
}

describe("HookItem", () => {
	const mockOnChange = vi.fn()
	const mockOnToggleEnabled = vi.fn()
	const mockOnDelete = vi.fn()
	const mockOnCopy = vi.fn()
	const mockOnOpenFolder = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Toggle Switch and Status Indicator", () => {
		it("renders toggle switch for enabled hook", () => {
			render(
				<HookItem
					hook={mockEnabledHook}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
				/>,
			)

			const toggle = screen.getByRole("switch")
			expect(toggle).toBeInTheDocument()
			expect(toggle).toHaveAttribute("aria-checked", "true")
			expect(toggle).toHaveAttribute("aria-label", "Toggle test-hook hook")
		})

		it("renders green status indicator when hook is enabled", () => {
			render(
				<HookItem
					hook={mockEnabledHook}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
				/>,
			)

			const statusIndicator = screen.getByTitle("Enabled")
			expect(statusIndicator).toBeInTheDocument()
			expect(statusIndicator).toHaveStyle({
				background: "var(--vscode-testing-iconPassed)",
			})
		})

		it("renders grey status indicator when hook is disabled", () => {
			render(
				<HookItem
					hook={mockDisabledHook}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
				/>,
			)

			const statusIndicator = screen.getByTitle("Disabled")
			expect(statusIndicator).toBeInTheDocument()
			expect(statusIndicator).toHaveStyle({
				background: "var(--vscode-descriptionForeground)",
			})
		})

		it("renders toggle switch for disabled hook", () => {
			render(
				<HookItem
					hook={mockDisabledHook}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
				/>,
			)

			const toggle = screen.getByRole("switch")
			expect(toggle).toBeInTheDocument()
			expect(toggle).toHaveAttribute("aria-checked", "false")
		})

		it("calls onToggleEnabled when toggle is clicked", () => {
			render(
				<HookItem
					hook={mockEnabledHook}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
				/>,
			)

			const toggle = screen.getByRole("switch")
			fireEvent.click(toggle)

			expect(mockOnToggleEnabled).toHaveBeenCalledTimes(1)
		})

		it("calls onToggleEnabled when Enter key is pressed on toggle", () => {
			render(
				<HookItem
					hook={mockEnabledHook}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
				/>,
			)

			const toggle = screen.getByRole("switch")
			fireEvent.keyDown(toggle, { key: "Enter" })

			expect(mockOnToggleEnabled).toHaveBeenCalledTimes(1)
		})

		it("calls onToggleEnabled when Space key is pressed on toggle", () => {
			render(
				<HookItem
					hook={mockEnabledHook}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
				/>,
			)

			const toggle = screen.getByRole("switch")
			fireEvent.keyDown(toggle, { key: " " })

			expect(mockOnToggleEnabled).toHaveBeenCalledTimes(1)
		})

		it("does not call onToggleEnabled when disabled prop is true", () => {
			render(
				<HookItem
					hook={mockEnabledHook}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
					disabled={true}
				/>,
			)

			const toggle = screen.getByRole("switch")
			fireEvent.click(toggle)

			expect(mockOnToggleEnabled).not.toHaveBeenCalled()
		})

		it("has reduced opacity when disabled", () => {
			render(
				<HookItem
					hook={mockEnabledHook}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
					disabled={true}
				/>,
			)

			const toggle = screen.getByRole("switch")
			expect(toggle).toHaveStyle({ opacity: 0.6 })
		})

		it("clicking toggle does not expand/collapse the hook item", () => {
			render(
				<HookItem
					hook={mockEnabledHook}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
				/>,
			)

			// Toggle should not cause expansion
			const toggle = screen.getByRole("switch")
			fireEvent.click(toggle)

			// Config tab should not be visible (item not expanded)
			expect(screen.queryByTestId("hook-config-tab")).not.toBeInTheDocument()
		})
	})

	describe("Hook Item Display", () => {
		it("renders hook ID", () => {
			render(
				<HookItem
					hook={mockEnabledHook}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
				/>,
			)

			expect(screen.getByText("test-hook")).toBeInTheDocument()
		})

		it("renders source badge", () => {
			render(
				<HookItem
					hook={mockEnabledHook}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
				/>,
			)

			expect(screen.getByText("project")).toBeInTheDocument()
		})

		it("renders tool matcher badges", () => {
			render(
				<HookItem
					hook={mockEnabledHook}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
				/>,
			)

			expect(screen.getByText("read|edit")).toBeInTheDocument()
		})

		it("renders session matcher badges", () => {
			render(
				<HookItem
					hook={mockHookWithSessionMatcher}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
				/>,
			)

			expect(screen.getByText("startup|resume")).toBeInTheDocument()
		})

		it("applies reduced opacity when hook is disabled", () => {
			const { container } = render(
				<HookItem
					hook={mockDisabledHook}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
				/>,
			)

			const hookItem = container.firstChild
			expect(hookItem).toHaveClass("opacity-60")
		})
	})

	describe("Action Buttons", () => {
		it("calls onCopy when copy button is clicked", () => {
			render(
				<HookItem
					hook={mockEnabledHook}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
				/>,
			)

			const buttons = screen.getAllByTestId("button")
			// First button is copy
			fireEvent.click(buttons[0])

			expect(mockOnCopy).toHaveBeenCalledTimes(1)
		})

		it("calls onDelete when delete button is clicked", () => {
			render(
				<HookItem
					hook={mockEnabledHook}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
				/>,
			)

			const buttons = screen.getAllByTestId("button")
			// Second button is delete
			fireEvent.click(buttons[1])

			expect(mockOnDelete).toHaveBeenCalledTimes(1)
		})

		it("calls onOpenFolder when folder button is clicked", () => {
			render(
				<HookItem
					hook={mockEnabledHook}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
				/>,
			)

			const buttons = screen.getAllByTestId("button")
			// Third button is open folder
			fireEvent.click(buttons[2])

			expect(mockOnOpenFolder).toHaveBeenCalledTimes(1)
		})
	})

	describe("Expand/Collapse", () => {
		it("expands when header is clicked", () => {
			render(
				<HookItem
					hook={mockEnabledHook}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
				/>,
			)

			// Click on the hook ID to expand
			const hookId = screen.getByText("test-hook")
			fireEvent.click(hookId)

			// Config tab should now be visible
			expect(screen.getByTestId("hook-config-tab")).toBeInTheDocument()
		})

		it("shows all tabs when expanded", () => {
			render(
				<HookItem
					hook={mockEnabledHook}
					onChange={mockOnChange}
					onToggleEnabled={mockOnToggleEnabled}
					onDelete={mockOnDelete}
					onCopy={mockOnCopy}
					onOpenFolder={mockOnOpenFolder}
				/>,
			)

			// Click to expand
			const hookId = screen.getByText("test-hook")
			fireEvent.click(hookId)

			// Check all tabs are present
			expect(screen.getByText("config")).toBeInTheDocument()
			expect(screen.getByText("command")).toBeInTheDocument()
			expect(screen.getByText("logs")).toBeInTheDocument()
		})
	})
})
