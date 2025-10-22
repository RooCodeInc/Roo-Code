// npx vitest src/components/settings/__tests__/ApiConfigManager.spec.tsx

import { render, screen, fireEvent, within } from "@/utils/test-utils"

import ApiConfigManager from "../ApiConfigManager"

// Mock the ExtensionStateContext
vitest.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		apiConfigsCustomOrder: [
			{ id: "config1", index: 0 },
			{ id: "config2", index: 1 },
			{ id: "config3", index: 2 },
		],
	}),
}))

// Mock the translation hook
vitest.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock VSCode components
vitest.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeTextField: ({ value, onInput, placeholder, onKeyDown, "data-testid": dataTestId }: any) => (
		<input
			value={value}
			onChange={(e) => onInput(e)}
			placeholder={placeholder}
			onKeyDown={onKeyDown}
			data-testid={dataTestId}
			ref={undefined} // Explicitly set ref to undefined to avoid warning
		/>
	),
}))

vitest.mock("@/components/ui", () => ({
	...vitest.importActual("@/components/ui"),
	Dialog: ({ children, open }: any) => (
		<div role="dialog" aria-modal="true" style={{ display: open ? "block" : "none" }} data-testid="dialog">
			{children}
		</div>
	),
	DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
	DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
	Button: ({ children, onClick, disabled, "data-testid": dataTestId, className }: any) => (
		<button onClick={onClick} disabled={disabled} data-testid={dataTestId} className={className}>
			{children}
		</button>
	),
	Input: ({ value, onInput, placeholder, onKeyDown, "data-testid": dataTestId }: any) => (
		<input
			value={value}
			onChange={(e) => onInput(e)}
			placeholder={placeholder}
			onKeyDown={onKeyDown}
			data-testid={dataTestId}
		/>
	),
	StandardTooltip: ({ children, content }: any) => <div title={content}>{children}</div>,
	// New components for searchable dropdown
	Popover: ({ children, open }: any) => (
		<div className="popover" style={{ position: "relative" }}>
			{children}
			{open && <div className="popover-content" style={{ position: "absolute", top: "100%", left: 0 }}></div>}
		</div>
	),
	PopoverTrigger: ({ children }: any) => <div className="popover-trigger">{children}</div>,
	PopoverContent: ({ children }: any) => <div className="popover-content">{children}</div>,
	Command: ({ children }: any) => <div className="command">{children}</div>,
	CommandInput: ({ value, onValueChange, placeholder, className, "data-testid": dataTestId }: any) => (
		<input
			value={value}
			onChange={(e) => onValueChange(e.target.value)}
			placeholder={placeholder}
			className={className}
			data-testid={dataTestId}
		/>
	),
	CommandList: ({ children }: any) => <div className="command-list">{children}</div>,
	CommandEmpty: ({ children }: any) => (children ? <div className="command-empty">{children}</div> : null),
	CommandGroup: ({ children }: any) => <div className="command-group">{children}</div>,
	CommandItem: ({ children, value, onSelect }: any) => (
		<div className="command-item" onClick={() => onSelect(value)} data-value={value}>
			{children}
		</div>
	),
	// Keep old components for backward compatibility
	Select: ({ value, onValueChange }: any) => (
		<select
			value={value}
			onChange={(e) => {
				if (onValueChange) onValueChange(e.target.value)
			}}
			data-testid="select-component">
			<option value="Default Config">Default Config</option>
			<option value="Another Config">Another Config</option>
		</select>
	),
	SelectTrigger: ({ children }: any) => <div className="select-trigger-mock">{children}</div>,
	SelectValue: ({ children }: any) => <div className="select-value-mock">{children}</div>,
	SelectContent: ({ children }: any) => <div className="select-content-mock">{children}</div>,
	SelectItem: ({ children, value }: any) => (
		<option value={value} className="select-item-mock">
			{children}
		</option>
	),
	SearchableSelect: ({ value, onValueChange, options, placeholder, "data-testid": dataTestId }: any) => (
		<select
			value={value}
			onChange={(e) => {
				if (onValueChange) onValueChange(e.target.value)
			}}
			data-testid={dataTestId || "select-component"}>
			<option value="">{placeholder || "settings:common.select"}</option>
			{options?.map((option: any) => (
				<option key={option.value} value={option.value}>
					{option.label}
				</option>
			))}
		</select>
	),
}))

describe("ApiConfigManager", () => {
	const mockOnSelectConfig = vitest.fn()
	const mockOnDeleteConfig = vitest.fn()
	const mockOnRenameConfig = vitest.fn()
	const mockOnUpsertConfig = vitest.fn()

	const defaultProps = {
		currentApiConfigName: "Default Config",
		listApiConfigMeta: [
			{ id: "default", name: "Default Config" },
			{ id: "another", name: "Another Config" },
		],
		onSelectConfig: mockOnSelectConfig,
		onDeleteConfig: mockOnDeleteConfig,
		onRenameConfig: mockOnRenameConfig,
		onUpsertConfig: mockOnUpsertConfig,
	}

	beforeEach(() => {
		vitest.clearAllMocks()
	})

	const getRenameForm = () => screen.getByTestId("rename-form")
	const getDialogContent = () => screen.getByTestId("dialog-content")

	it("opens new profile dialog when clicking add button", () => {
		render(<ApiConfigManager {...defaultProps} />)

		const addButton = screen.getByTestId("add-profile-button")
		fireEvent.click(addButton)

		expect(screen.getByTestId("dialog")).toBeVisible()
		expect(screen.getByTestId("dialog-title")).toHaveTextContent("settings:providers.newProfile")
	})

	it("creates new profile with entered name", () => {
		render(<ApiConfigManager {...defaultProps} />)

		// Open dialog
		const addButton = screen.getByTestId("add-profile-button")
		fireEvent.click(addButton)

		// Enter new profile name
		const input = screen.getByTestId("new-profile-input")
		fireEvent.input(input, { target: { value: "New Profile" } })

		// Click create button
		const createButton = screen.getByText("settings:providers.createProfile")
		fireEvent.click(createButton)

		expect(mockOnUpsertConfig).toHaveBeenCalledWith("New Profile")
	})

	it("shows error when creating profile with existing name", () => {
		render(<ApiConfigManager {...defaultProps} />)

		// Open dialog
		const addButton = screen.getByTestId("add-profile-button")
		fireEvent.click(addButton)

		// Enter existing profile name
		const input = screen.getByTestId("new-profile-input")
		fireEvent.input(input, { target: { value: "Default Config" } })

		// Click create button to trigger validation
		const createButton = screen.getByText("settings:providers.createProfile")
		fireEvent.click(createButton)

		// Verify error message
		const dialogContent = getDialogContent()
		const errorMessage = within(dialogContent).getByTestId("error-message")
		expect(errorMessage).toHaveTextContent("settings:providers.nameExists")
		expect(mockOnUpsertConfig).not.toHaveBeenCalled()
	})

	it("prevents creating profile with empty name", () => {
		render(<ApiConfigManager {...defaultProps} />)

		// Open dialog
		const addButton = screen.getByTestId("add-profile-button")
		fireEvent.click(addButton)

		// Enter empty name
		const input = screen.getByTestId("new-profile-input")
		fireEvent.input(input, { target: { value: "   " } })

		// Verify create button is disabled
		const createButton = screen.getByText("settings:providers.createProfile")
		expect(createButton).toBeDisabled()
		expect(mockOnUpsertConfig).not.toHaveBeenCalled()
	})

	it("allows renaming the current config", () => {
		render(<ApiConfigManager {...defaultProps} />)

		// Start rename
		const renameButton = screen.getByTestId("rename-profile-button")
		fireEvent.click(renameButton)

		// Find input and enter new name
		const input = screen.getByDisplayValue("Default Config")
		fireEvent.input(input, { target: { value: "New Name" } })

		// Save
		const saveButton = screen.getByTestId("save-rename-button")
		fireEvent.click(saveButton)

		expect(mockOnRenameConfig).toHaveBeenCalledWith("Default Config", "New Name")
	})

	it("shows error when renaming to existing config name", () => {
		render(<ApiConfigManager {...defaultProps} />)

		// Start rename
		const renameButton = screen.getByTestId("rename-profile-button")
		fireEvent.click(renameButton)

		// Find input and enter existing name
		const input = screen.getByDisplayValue("Default Config")
		fireEvent.input(input, { target: { value: "Another Config" } })

		// Save to trigger validation
		const saveButton = screen.getByTestId("save-rename-button")
		fireEvent.click(saveButton)

		// Verify error message
		const renameForm = getRenameForm()
		const errorMessage = within(renameForm).getByTestId("error-message")
		expect(errorMessage).toHaveTextContent("settings:providers.nameExists")
		expect(mockOnRenameConfig).not.toHaveBeenCalled()
	})

	it("prevents renaming to empty name", () => {
		render(<ApiConfigManager {...defaultProps} />)

		// Start rename
		const renameButton = screen.getByTestId("rename-profile-button")
		fireEvent.click(renameButton)

		// Find input and enter empty name
		const input = screen.getByDisplayValue("Default Config")
		fireEvent.input(input, { target: { value: "   " } })

		// Verify save button is disabled
		const saveButton = screen.getByTestId("save-rename-button")
		expect(saveButton).toBeDisabled()
		expect(mockOnRenameConfig).not.toHaveBeenCalled()
	})

	it("allows selecting a different config", () => {
		render(<ApiConfigManager {...defaultProps} />)

		// Find the config item for "Another Config" and click it
		const configItems = screen.getAllByRole("option")
		const anotherConfigItem = configItems.find((item) =>
			item.getAttribute("aria-label")?.includes("Another Config"),
		)

		expect(anotherConfigItem).toBeDefined()
		fireEvent.click(anotherConfigItem!)

		expect(mockOnSelectConfig).toHaveBeenCalledWith("Another Config")
	})

	it("allows deleting the current config when not the only one", () => {
		render(<ApiConfigManager {...defaultProps} />)

		const deleteButton = screen.getByTestId("delete-profile-button")
		expect(deleteButton).not.toBeDisabled()

		fireEvent.click(deleteButton)
		expect(mockOnDeleteConfig).toHaveBeenCalledWith("Default Config")
	})

	it("disables delete button when only one config exists", () => {
		render(<ApiConfigManager {...defaultProps} listApiConfigMeta={[{ id: "default", name: "Default Config" }]} />)

		const deleteButton = screen.getByTestId("delete-profile-button")
		expect(deleteButton).toHaveAttribute("disabled")
	})

	it("cancels rename operation when clicking cancel", () => {
		render(<ApiConfigManager {...defaultProps} />)

		// Start rename
		const renameButton = screen.getByTestId("rename-profile-button")
		fireEvent.click(renameButton)

		// Find input and enter new name
		const input = screen.getByDisplayValue("Default Config")
		fireEvent.input(input, { target: { value: "New Name" } })

		// Cancel
		const cancelButton = screen.getByTestId("cancel-rename-button")
		fireEvent.click(cancelButton)

		// Verify rename was not called
		expect(mockOnRenameConfig).not.toHaveBeenCalled()

		// Verify we're back to normal view
		expect(screen.queryByDisplayValue("New Name")).not.toBeInTheDocument()
	})

	it("handles keyboard events in new profile dialog", () => {
		render(<ApiConfigManager {...defaultProps} />)

		// Open dialog
		const addButton = screen.getByTestId("add-profile-button")
		fireEvent.click(addButton)

		const input = screen.getByTestId("new-profile-input")

		// Test Enter key
		fireEvent.input(input, { target: { value: "New Profile" } })
		fireEvent.keyDown(input, { key: "Enter" })
		expect(mockOnUpsertConfig).toHaveBeenCalledWith("New Profile")

		// Test Escape key
		fireEvent.keyDown(input, { key: "Escape" })
		expect(screen.getByTestId("dialog")).not.toBeVisible()
	})

	it("handles keyboard events in rename mode", () => {
		render(<ApiConfigManager {...defaultProps} />)

		// Start rename
		const renameButton = screen.getByTestId("rename-profile-button")
		fireEvent.click(renameButton)

		const input = screen.getByDisplayValue("Default Config")

		// Test Enter key
		fireEvent.input(input, { target: { value: "New Name" } })
		fireEvent.keyDown(input, { key: "Enter" })
		expect(mockOnRenameConfig).toHaveBeenCalledWith("Default Config", "New Name")

		// Test Escape key
		fireEvent.keyDown(input, { key: "Escape" })
		expect(screen.queryByDisplayValue("New Name")).not.toBeInTheDocument()
	})

	describe("Reordering Mode", () => {
		const mockConfigsForReordering = [
			{ id: "1", name: "config1", apiProvider: "openai" as const, modelId: "gpt-4" },
			{ id: "2", name: "config2", apiProvider: "anthropic" as const, modelId: "claude-3" },
			{ id: "3", name: "config3", apiProvider: "openai" as const, modelId: "gpt-3.5" },
		]

		const reorderingProps = {
			...defaultProps,
			currentApiConfigName: "config1",
			listApiConfigMeta: mockConfigsForReordering,
		}

		it("should render reorder toggle button", () => {
			render(<ApiConfigManager {...reorderingProps} />)

			const reorderButton = screen.getByTestId("reorder-toggle-button")
			expect(reorderButton).toBeInTheDocument()
		})

		it("should toggle reordering mode when reorder button is clicked", () => {
			render(<ApiConfigManager {...reorderingProps} />)

			const reorderButton = screen.getByTestId("reorder-toggle-button")

			// Initially not in reordering mode
			expect(reorderButton).not.toHaveClass("bg-vscode-button-background")

			// Click to enter reordering mode
			fireEvent.click(reorderButton)
			expect(reorderButton).toHaveClass("bg-vscode-button-background")

			// Click again to exit reordering mode
			fireEvent.click(reorderButton)
			expect(reorderButton).not.toHaveClass("bg-vscode-button-background")
		})

		it("should show different help text based on reordering mode", () => {
			render(<ApiConfigManager {...reorderingProps} />)

			const reorderButton = screen.getByTestId("reorder-toggle-button")

			// Initially shows normal help text
			expect(screen.getByText("settings:providers.normalModeHelpText")).toBeInTheDocument()

			// Enter reordering mode
			fireEvent.click(reorderButton)
			expect(screen.getByText("settings:providers.reorderModeHelpText")).toBeInTheDocument()
		})

		it("should show checkmark for current config when not in reordering mode", () => {
			render(<ApiConfigManager {...reorderingProps} />)

			// Should show checkmark for current config
			const checkmarks = screen.getAllByText("", { selector: ".codicon-check" })
			expect(checkmarks.length).toBeGreaterThan(0)
		})

		it("should disable regular click behavior in reordering mode", () => {
			render(<ApiConfigManager {...reorderingProps} />)

			const reorderButton = screen.getByTestId("reorder-toggle-button")
			const configItems = screen.getAllByRole("option")

			// Enter reordering mode
			fireEvent.click(reorderButton)

			// Click on a config item should not trigger selection
			fireEvent.click(configItems[1])
			expect(mockOnSelectConfig).not.toHaveBeenCalled()
		})

		it("should allow regular click behavior when not in reordering mode", () => {
			render(<ApiConfigManager {...reorderingProps} />)

			const configItems = screen.getAllByRole("option")

			// Click on a config item should trigger selection
			// The actual order depends on the sorting logic, so let's just test that clicking works
			fireEvent.click(configItems[0])
			expect(mockOnSelectConfig).toHaveBeenCalled()
		})
	})
})
