import { render, screen, fireEvent, waitFor } from "@/utils/test-utils"
import { vscode } from "@/utils/vscode"

import { ApiConfigSelector } from "../ApiConfigSelector"

// Mock the dependencies
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/ui/hooks/useRooPortal", () => ({
	useRooPortal: () => document.body,
}))

// Mock the ExtensionStateContext
vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		apiConfiguration: {
			apiProvider: "anthropic",
			apiModelId: "claude-3-opus-20240229",
		},
	}),
}))

// Mock the getModelId function from @roo-code/types
vi.mock("@roo-code/types", () => ({
	getModelId: (config: any) => config?.apiModelId || undefined,
}))

// Mock Popover components to be testable
vi.mock("@/components/ui", () => ({
	Popover: ({ children, open }: any) => (
		<div data-testid="popover-root" data-open={open}>
			{children}
		</div>
	),
	PopoverTrigger: ({ children, disabled, ...props }: any) => (
		<button data-testid="dropdown-trigger" disabled={disabled} onClick={() => props.onClick?.()} {...props}>
			{children}
		</button>
	),
	PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
	StandardTooltip: ({ children }: any) => <>{children}</>,
	Button: ({ children, onClick, ...props }: any) => (
		<button onClick={onClick} {...props}>
			{children}
		</button>
	),
}))

describe("ApiConfigSelector", () => {
	const mockOnChange = vi.fn()
	const mockTogglePinnedApiConfig = vi.fn()

	const defaultProps = {
		value: "config1",
		displayName: "Config 1",
		title: "API Config",
		onChange: mockOnChange,
		listApiConfigMeta: [
			{ id: "config1", name: "Config 1", modelId: "claude-3-opus-20240229" },
			{ id: "config2", name: "Config 2", modelId: "gpt-4" },
			{ id: "config3", name: "Config 3", modelId: "claude-3-sonnet-20240229" },
		],
		pinnedApiConfigs: { config1: true },
		togglePinnedApiConfig: mockTogglePinnedApiConfig,
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("renders correctly with default props", () => {
		render(<ApiConfigSelector {...defaultProps} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		expect(trigger).toBeInTheDocument()
		expect(trigger).toHaveTextContent("Config 1")
	})

	test("handles disabled state correctly", () => {
		render(<ApiConfigSelector {...defaultProps} disabled={true} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		expect(trigger).toBeDisabled()
	})

	test("renders with custom title tooltip", () => {
		const customTitle = "Custom tooltip text"
		render(<ApiConfigSelector {...defaultProps} title={customTitle} />)

		// The component should render with the tooltip wrapper
		const trigger = screen.getByTestId("dropdown-trigger")
		expect(trigger).toBeInTheDocument()
	})

	test("applies custom trigger className", () => {
		const customClass = "custom-trigger-class"
		render(<ApiConfigSelector {...defaultProps} triggerClassName={customClass} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		expect(trigger.className).toContain(customClass)
	})

	test("opens popover when trigger is clicked", () => {
		render(<ApiConfigSelector {...defaultProps} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		fireEvent.click(trigger)

		// Check if popover content is rendered
		const popoverContent = screen.getByTestId("popover-content")
		expect(popoverContent).toBeInTheDocument()
	})

	test("renders search input when popover is open and more than 6 configs", () => {
		const props = {
			...defaultProps,
			listApiConfigMeta: [
				{ id: "config1", name: "Config 1", modelId: "claude-3-opus-20240229" },
				{ id: "config2", name: "Config 2", modelId: "gpt-4" },
				{ id: "config3", name: "Config 3", modelId: "claude-3-sonnet-20240229" },
				{ id: "config4", name: "Config 4", modelId: "gpt-3.5-turbo" },
				{ id: "config5", name: "Config 5", modelId: "claude-3-haiku-20240307" },
				{ id: "config6", name: "Config 6", modelId: "gpt-4-turbo" },
				{ id: "config7", name: "Config 7", modelId: "claude-2.1" },
			],
		}
		render(<ApiConfigSelector {...props} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		fireEvent.click(trigger)

		const searchInput = screen.getByPlaceholderText("common:ui.search_placeholder")
		expect(searchInput).toBeInTheDocument()
	})

	test("renders info blurb instead of search when 6 or fewer configs", () => {
		render(<ApiConfigSelector {...defaultProps} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		fireEvent.click(trigger)

		// Should not have search input
		expect(screen.queryByPlaceholderText("common:ui.search_placeholder")).not.toBeInTheDocument()
		// Should have info blurb
		expect(screen.getByText("prompts:apiConfiguration.select")).toBeInTheDocument()
	})

	test("filters configs based on search input", async () => {
		const props = {
			...defaultProps,
			listApiConfigMeta: [
				{ id: "config1", name: "Config 1", modelId: "claude-3-opus-20240229" },
				{ id: "config2", name: "Config 2", modelId: "gpt-4" },
				{ id: "config3", name: "Config 3", modelId: "claude-3-sonnet-20240229" },
				{ id: "config4", name: "Config 4", modelId: "gpt-3.5-turbo" },
				{ id: "config5", name: "Config 5", modelId: "claude-3-haiku-20240307" },
				{ id: "config6", name: "Config 6", modelId: "gpt-4-turbo" },
				{ id: "config7", name: "Config 7", modelId: "claude-2.1" },
			],
		}
		render(<ApiConfigSelector {...props} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		fireEvent.click(trigger)

		const searchInput = screen.getByPlaceholderText("common:ui.search_placeholder")
		fireEvent.change(searchInput, { target: { value: "Config 2" } })

		// Wait for the filtering to take effect
		await waitFor(() => {
			// Config 2 should be visible
			expect(screen.getByText("Config 2")).toBeInTheDocument()
			// Config 3 should not be visible (assuming exact match filtering)
			expect(screen.queryByText("Config 3")).not.toBeInTheDocument()
		})
	})

	test("shows no results message when search has no matches", async () => {
		const props = {
			...defaultProps,
			listApiConfigMeta: [
				{ id: "config1", name: "Config 1", modelId: "claude-3-opus-20240229" },
				{ id: "config2", name: "Config 2", modelId: "gpt-4" },
				{ id: "config3", name: "Config 3", modelId: "claude-3-sonnet-20240229" },
				{ id: "config4", name: "Config 4", modelId: "gpt-3.5-turbo" },
				{ id: "config5", name: "Config 5", modelId: "claude-3-haiku-20240307" },
				{ id: "config6", name: "Config 6", modelId: "gpt-4-turbo" },
				{ id: "config7", name: "Config 7", modelId: "claude-2.1" },
			],
		}
		render(<ApiConfigSelector {...props} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		fireEvent.click(trigger)

		const searchInput = screen.getByPlaceholderText("common:ui.search_placeholder")
		fireEvent.change(searchInput, { target: { value: "NonExistentConfig" } })

		await waitFor(() => {
			expect(screen.getByText("common:ui.no_results")).toBeInTheDocument()
		})
	})

	test("clears search when X button is clicked", async () => {
		const props = {
			...defaultProps,
			listApiConfigMeta: [
				{ id: "config1", name: "Config 1", modelId: "claude-3-opus-20240229" },
				{ id: "config2", name: "Config 2", modelId: "gpt-4" },
				{ id: "config3", name: "Config 3", modelId: "claude-3-sonnet-20240229" },
				{ id: "config4", name: "Config 4", modelId: "gpt-3.5-turbo" },
				{ id: "config5", name: "Config 5", modelId: "claude-3-haiku-20240307" },
				{ id: "config6", name: "Config 6", modelId: "gpt-4-turbo" },
				{ id: "config7", name: "Config 7", modelId: "claude-2.1" },
			],
		}
		render(<ApiConfigSelector {...props} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		fireEvent.click(trigger)

		const searchInput = screen.getByPlaceholderText("common:ui.search_placeholder") as HTMLInputElement
		fireEvent.change(searchInput, { target: { value: "test" } })

		expect(searchInput.value).toBe("test")

		// Find and click the X button
		const clearButton = screen.getByTestId("popover-content").querySelector(".cursor-pointer")
		if (clearButton) {
			fireEvent.click(clearButton)
		}

		await waitFor(() => {
			expect(searchInput.value).toBe("")
		})
	})

	test("calls onChange when a config is selected", () => {
		render(<ApiConfigSelector {...defaultProps} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		fireEvent.click(trigger)

		const config2 = screen.getByText("Config 2")
		fireEvent.click(config2)

		expect(mockOnChange).toHaveBeenCalledWith("config2")
	})

	test("shows check mark for selected config", () => {
		render(<ApiConfigSelector {...defaultProps} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		fireEvent.click(trigger)

		// The selected config (config1) should have a check mark
		// Use getAllByText since there might be multiple elements with "Config 1"
		const config1Elements = screen.getAllByText("Config 1")
		// Find the one that's in the dropdown content (not the trigger)
		const configInDropdown = config1Elements.find((el) => el.closest('[data-testid="popover-content"]'))
		// Navigate up to find the parent row that contains both the text and the check icon
		const selectedConfigRow = configInDropdown?.closest(".group")
		const checkIcon = selectedConfigRow?.querySelector(".codicon-check")
		expect(checkIcon).toBeInTheDocument()
	})

	test("separates pinned and unpinned configs", () => {
		const props = {
			...defaultProps,
			pinnedApiConfigs: { config1: true, config3: true },
		}

		render(<ApiConfigSelector {...props} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		fireEvent.click(trigger)

		const content = screen.getByTestId("popover-content")
		// Get all config items by looking for the group class
		const configRows = content.querySelectorAll(".group")

		// Extract the config names from each row
		const configNames: string[] = []
		configRows.forEach((row) => {
			// Find the first span that's flex-shrink-0 (the profile name)
			const nameElement = row.querySelector(".flex-1 span.flex-shrink-0")
			if (nameElement?.textContent) {
				configNames.push(nameElement.textContent)
			}
		})

		// Pinned configs should appear first
		expect(configNames[0]).toBe("Config 1")
		expect(configNames[1]).toBe("Config 3")
		// Unpinned config should appear after separator
		expect(configNames[2]).toBe("Config 2")
	})

	test("toggles pin status when pin button is clicked", () => {
		render(<ApiConfigSelector {...defaultProps} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		fireEvent.click(trigger)

		// Find the pin button for Config 2 (unpinned)
		const config2Row = screen.getByText("Config 2").closest(".group")
		// Find the button with the pin icon (it's the second button, first is the row itself)
		const buttons = config2Row?.querySelectorAll("button")
		const pinButton = Array.from(buttons || []).find((btn) => btn.querySelector(".codicon-pin"))

		if (pinButton) {
			fireEvent.click(pinButton)
		}

		expect(mockTogglePinnedApiConfig).toHaveBeenCalledWith("config2")
		expect(vi.mocked(vscode.postMessage)).toHaveBeenCalledWith({
			type: "toggleApiConfigPin",
			text: "config2",
		})
	})

	test("opens settings when edit button is clicked", () => {
		render(<ApiConfigSelector {...defaultProps} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		fireEvent.click(trigger)

		// Find the settings button by its icon class within the popover content
		const popoverContent = screen.getByTestId("popover-content")
		const settingsButton = popoverContent.querySelector('[aria-label="chat:edit"]') as HTMLElement
		expect(settingsButton).toBeInTheDocument()
		fireEvent.click(settingsButton)

		expect(vi.mocked(vscode.postMessage)).toHaveBeenCalledWith({
			type: "switchTab",
			tab: "settings",
		})
	})

	test("renders bottom bar with title and info icon when more than 6 configs", () => {
		const props = {
			...defaultProps,
			listApiConfigMeta: [
				{ id: "config1", name: "Config 1", modelId: "claude-3-opus-20240229" },
				{ id: "config2", name: "Config 2", modelId: "gpt-4" },
				{ id: "config3", name: "Config 3", modelId: "claude-3-sonnet-20240229" },
				{ id: "config4", name: "Config 4", modelId: "gpt-3.5-turbo" },
				{ id: "config5", name: "Config 5", modelId: "claude-3-haiku-20240307" },
				{ id: "config6", name: "Config 6", modelId: "gpt-4-turbo" },
				{ id: "config7", name: "Config 7", modelId: "claude-2.1" },
			],
		}
		render(<ApiConfigSelector {...props} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		fireEvent.click(trigger)

		// Check for the title
		expect(screen.getByText("prompts:apiConfiguration.title")).toBeInTheDocument()

		// Check for the info icon
		const infoIcon = screen.getByTestId("popover-content").querySelector(".codicon-info")
		expect(infoIcon).toBeInTheDocument()
	})

	test("renders bottom bar with title but no info icon when 6 or fewer configs", () => {
		render(<ApiConfigSelector {...defaultProps} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		fireEvent.click(trigger)

		// Check for the title
		expect(screen.getByText("prompts:apiConfiguration.title")).toBeInTheDocument()

		// Check that info icon is not present
		const infoIcon = screen.getByTestId("popover-content").querySelector(".codicon-info")
		expect(infoIcon).not.toBeInTheDocument()
	})

	test("handles empty config list gracefully", () => {
		const props = {
			...defaultProps,
			listApiConfigMeta: [],
		}

		render(<ApiConfigSelector {...props} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		fireEvent.click(trigger)

		// Should render info blurb instead of search for empty list
		expect(screen.queryByPlaceholderText("common:ui.search_placeholder")).not.toBeInTheDocument()
		expect(screen.getByText("prompts:apiConfiguration.select")).toBeInTheDocument()
		expect(screen.getByText("prompts:apiConfiguration.title")).toBeInTheDocument()
	})

	test("maintains search value when pinning/unpinning", async () => {
		const props = {
			...defaultProps,
			listApiConfigMeta: [
				{ id: "config1", name: "Config 1", modelId: "claude-3-opus-20240229" },
				{ id: "config2", name: "Config 2", modelId: "gpt-4" },
				{ id: "config3", name: "Config 3", modelId: "claude-3-sonnet-20240229" },
				{ id: "config4", name: "Config 4", modelId: "gpt-3.5-turbo" },
				{ id: "config5", name: "Config 5", modelId: "claude-3-haiku-20240307" },
				{ id: "config6", name: "Config 6", modelId: "gpt-4-turbo" },
				{ id: "config7", name: "Config 7", modelId: "claude-2.1" },
			],
		}
		render(<ApiConfigSelector {...props} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		fireEvent.click(trigger)

		const searchInput = screen.getByPlaceholderText("common:ui.search_placeholder") as HTMLInputElement
		fireEvent.change(searchInput, { target: { value: "Config" } })

		// Pin a config
		const config2Row = screen.getByText("Config 2").closest("div")
		const pinButton = config2Row?.querySelector("button")
		if (pinButton) {
			fireEvent.click(pinButton)
		}

		// Search value should be maintained
		expect(searchInput.value).toBe("Config")
	})

	test("pinned configs remain fixed at top while unpinned configs scroll", () => {
		// Create a list with many configs to test scrolling
		const manyConfigs = Array.from({ length: 15 }, (_, i) => ({
			id: `config${i + 1}`,
			name: `Config ${i + 1}`,
			modelId: `model-${i + 1}`,
		}))

		const props = {
			...defaultProps,
			listApiConfigMeta: manyConfigs,
			pinnedApiConfigs: {
				config1: true,
				config2: true,
				config3: true,
			},
		}

		render(<ApiConfigSelector {...props} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		fireEvent.click(trigger)

		const popoverContent = screen.getByTestId("popover-content")

		// Check for Config 1, 2, 3 being visible (pinned) - use getAllByText since there might be multiple
		expect(screen.getAllByText("Config 1").length).toBeGreaterThan(0)
		expect(screen.getAllByText("Config 2").length).toBeGreaterThan(0)
		expect(screen.getAllByText("Config 3").length).toBeGreaterThan(0)

		// Find all containers with py-1 class
		const configContainers = popoverContent.querySelectorAll(".py-1")

		// Should have 2 containers: one for pinned (non-scrollable) and one for unpinned (scrollable)
		expect(configContainers.length).toBeGreaterThanOrEqual(1)

		// Find the non-scrollable container (pinned configs)
		let pinnedContainer: Element | null = null
		let unpinnedContainer: Element | null = null

		configContainers.forEach((container) => {
			if (container.classList.contains("overflow-y-auto")) {
				unpinnedContainer = container
			} else {
				pinnedContainer = container
			}
		})

		// Verify pinned container exists and contains the pinned configs
		if (pinnedContainer) {
			const elements = (pinnedContainer as Element).querySelectorAll(".flex-shrink-0")
			const pinnedConfigTexts = Array.from(elements)
				.map((el) => (el as Element).textContent)
				.filter((text) => text?.startsWith("Config"))

			expect(pinnedConfigTexts).toContain("Config 1")
			expect(pinnedConfigTexts).toContain("Config 2")
			expect(pinnedConfigTexts).toContain("Config 3")
		}

		// Verify unpinned container exists and is scrollable
		expect(unpinnedContainer).toBeInTheDocument()
		if (unpinnedContainer) {
			expect((unpinnedContainer as Element).classList.contains("overflow-y-auto")).toBe(true)
			// Check that the unpinned container has the correct max-height
			expect((unpinnedContainer as Element).getAttribute("style")).toContain("max-height")
		}

		// Verify separator exists between pinned and unpinned
		const separator = popoverContent.querySelector(".h-px")
		expect(separator).toBeInTheDocument()
	})

	test("displays all configs in scrollable container when no configs are pinned", () => {
		const manyConfigs = Array.from({ length: 10 }, (_, i) => ({
			id: `config${i + 1}`,
			name: `Config ${i + 1}`,
			modelId: `model-${i + 1}`,
		}))

		const props = {
			...defaultProps,
			listApiConfigMeta: manyConfigs,
			pinnedApiConfigs: {}, // No pinned configs
		}

		render(<ApiConfigSelector {...props} />)

		const trigger = screen.getByTestId("dropdown-trigger")
		fireEvent.click(trigger)

		const popoverContent = screen.getByTestId("popover-content")

		// Should have only one scrollable container with all configs
		const scrollableContainer = popoverContent.querySelector(".overflow-y-auto.py-1")
		expect(scrollableContainer).toBeInTheDocument()

		// Check max-height is 300px when no pinned configs
		expect(scrollableContainer?.getAttribute("style")).toContain("max-height")
		expect(scrollableContainer?.getAttribute("style")).toContain("300px")

		// All configs should be in the scrollable container
		const allConfigRows = scrollableContainer?.querySelectorAll(".group")
		expect(allConfigRows?.length).toBe(10)

		// No separator should exist
		const separator = popoverContent.querySelector(".h-px.bg-vscode-dropdown-foreground\\/10")
		expect(separator).not.toBeInTheDocument()
	})
})
