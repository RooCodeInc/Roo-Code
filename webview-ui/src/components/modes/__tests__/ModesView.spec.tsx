// npx vitest src/components/modes/__tests__/ModesView.spec.tsx

import { render, screen, fireEvent, waitFor } from "@/utils/test-utils"
import ModesView from "../ModesView"
import { ExtensionStateContext } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"

// Mock vscode API
vitest.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vitest.fn(),
	},
}))

// Mock i18n TranslationContext
vitest.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			// Return actual English translations for MCP server keys
			const translations: Record<string, string> = {
				"prompts:mcpServers.title": "MCP Servers",
				"prompts:mcpServers.description": "Configure which MCP servers this mode can access.",
				"prompts:mcpServers.useAllServers": "Use all servers (default)",
				"prompts:mcpServers.useSelectedServers": "Use selected servers only",
			}
			return translations[key] || key
		},
	}),
}))

const baseMcpServers = [{ name: "serverA" }, { name: "serverB" }, { name: "serverC" }]

// Mock modes with mcp group enabled
const mockModesWithMcp = [
	{
		slug: "code",
		name: "Code",
		roleDefinition: "You are a code assistant",
		groups: ["read", "edit", "browser", "command", "mcp"] as const,
	},
	{
		slug: "ask",
		name: "Ask",
		roleDefinition: "You are a helpful assistant",
		groups: ["read", "mcp"] as const,
	},
	{
		slug: "architect",
		name: "Architect",
		roleDefinition: "You are an architect",
		groups: ["read", "mcp"] as const,
	},
]

const mockExtensionState = {
	customModePrompts: {},
	listApiConfigMeta: [
		{ id: "config1", name: "Config 1" },
		{ id: "config2", name: "Config 2" },
	],
	enhancementApiConfigId: "",
	setEnhancementApiConfigId: vitest.fn(),
	mode: "code",
	customModes: mockModesWithMcp,
	customSupportPrompts: [],
	currentApiConfigName: "",
	customInstructions: "Initial instructions",
	setCustomInstructions: vitest.fn(),
	mcpServers: baseMcpServers,
	mcpEnabled: true,
}

const renderPromptsView = (props = {}) => {
	return render(
		<ExtensionStateContext.Provider value={{ ...mockExtensionState, ...props } as any}>
			<ModesView />
		</ExtensionStateContext.Provider>,
	)
}

const renderModesView = renderPromptsView

Element.prototype.scrollIntoView = vitest.fn()

describe("PromptsView", () => {
	beforeEach(() => {
		vitest.clearAllMocks()
	})

	it("displays the current mode name in the select trigger", () => {
		renderPromptsView({ mode: "code" })
		const selectTrigger = screen.getByTestId("mode-select-trigger")
		expect(selectTrigger).toHaveTextContent("Code")
	})

	it("opens the mode selection popover when the trigger is clicked", async () => {
		renderPromptsView()
		const selectTrigger = screen.getByTestId("mode-select-trigger")
		fireEvent.click(selectTrigger)
		await waitFor(() => {
			expect(selectTrigger).toHaveAttribute("aria-expanded", "true")
		})
	})

	it("filters mode options based on search input", async () => {
		renderPromptsView()
		const selectTrigger = screen.getByTestId("mode-select-trigger")
		fireEvent.click(selectTrigger)

		const searchInput = screen.getByTestId("mode-search-input")
		fireEvent.change(searchInput, { target: { value: "ask" } })

		await waitFor(() => {
			expect(screen.getByTestId("mode-option-ask")).toBeInTheDocument()
			expect(screen.queryByTestId("mode-option-code")).not.toBeInTheDocument()
			expect(screen.queryByTestId("mode-option-architect")).not.toBeInTheDocument()
		})
	})

	it("selects a mode from the dropdown and sends update message", async () => {
		renderPromptsView()
		const selectTrigger = screen.getByTestId("mode-select-trigger")
		fireEvent.click(selectTrigger)

		const askOption = await waitFor(() => screen.getByTestId("mode-option-ask"))
		fireEvent.click(askOption)

		expect(mockExtensionState.setEnhancementApiConfigId).not.toHaveBeenCalled() // Ensure this is not called by mode switch
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "mode",
			text: "ask",
		})
		await waitFor(() => {
			expect(selectTrigger).toHaveAttribute("aria-expanded", "false")
		})
	})

	it("handles prompt changes correctly", async () => {
		// Use customModes: [] to ensure code is treated as a built-in mode for this test
		renderPromptsView({ customModes: [] })

		// Get the textarea
		const textarea = await waitFor(() => screen.getByTestId("code-prompt-textarea"))

		// Simulate VSCode TextArea change event
		const changeEvent = new CustomEvent("change", {
			detail: {
				target: {
					value: "New prompt value",
				},
			},
		})

		fireEvent(textarea, changeEvent)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "updatePrompt",
			promptMode: "code",
			customPrompt: { roleDefinition: "New prompt value" },
		})
	})

	it("resets role definition only for built-in modes", async () => {
		const customMode = {
			slug: "custom-mode",
			name: "Custom Mode",
			roleDefinition: "Custom role",
			groups: [],
		}

		// Test with built-in mode (code)
		const { unmount } = render(
			<ExtensionStateContext.Provider
				value={{ ...mockExtensionState, mode: "code", customModes: [customMode] } as any}>
				<ModesView />
			</ExtensionStateContext.Provider>,
		)

		// Find and click the role definition reset button
		const resetButton = screen.getByTestId("role-definition-reset")
		expect(resetButton).toBeInTheDocument()
		await fireEvent.click(resetButton)

		// Verify it only resets role definition
		// When resetting a built-in mode's role definition, the field should be removed entirely
		// from the customPrompt object, not set to undefined.
		// This allows the default role definition from the built-in mode to be used instead.
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "updatePrompt",
			promptMode: "code",
			customPrompt: {}, // Empty object because the role definition field is removed entirely
		})

		// Cleanup before testing custom mode
		unmount()

		// Test with custom mode
		render(
			<ExtensionStateContext.Provider
				value={{ ...mockExtensionState, mode: "custom-mode", customModes: [customMode] } as any}>
				<ModesView />
			</ExtensionStateContext.Provider>,
		)

		// Verify reset button is not present for custom mode
		expect(screen.queryByTestId("role-definition-reset")).not.toBeInTheDocument()
	})

	it("description section behavior for different mode types", async () => {
		const customMode = {
			slug: "custom-mode",
			name: "Custom Mode",
			roleDefinition: "Custom role",
			description: "Custom description",
			groups: [],
		}

		// Test with built-in mode (code) - description section should be shown with reset button
		const { unmount } = render(
			<ExtensionStateContext.Provider
				value={{ ...mockExtensionState, mode: "code", customModes: [customMode] } as any}>
				<ModesView />
			</ExtensionStateContext.Provider>,
		)

		// Verify description reset button IS present for built-in modes
		// because built-in modes can have their descriptions customized and reset
		expect(screen.queryByTestId("description-reset")).toBeInTheDocument()

		// Cleanup before testing custom mode
		unmount()

		// Test with custom mode - description section should be shown
		render(
			<ExtensionStateContext.Provider
				value={{ ...mockExtensionState, mode: "custom-mode", customModes: [customMode] } as any}>
				<ModesView />
			</ExtensionStateContext.Provider>,
		)

		// Verify description section is present for custom modes
		// but reset button is NOT present (since custom modes manage their own descriptions)
		expect(screen.queryByTestId("description-reset")).not.toBeInTheDocument()

		// Verify the description text field is present for custom modes
		expect(screen.getByTestId("custom-mode-description-textfield")).toBeInTheDocument()
	})

	it("handles clearing custom instructions correctly", async () => {
		const setCustomInstructions = vitest.fn()
		renderPromptsView({
			...mockExtensionState,
			customInstructions: "Initial instructions",
			setCustomInstructions,
		})

		const textarea = screen.getByTestId("global-custom-instructions-textarea")

		// Simulate VSCode TextArea change event with empty value
		// We need to simulate both the CustomEvent format and regular event format
		// since the component handles both
		Object.defineProperty(textarea, "value", {
			writable: true,
			value: "",
		})

		const changeEvent = new Event("change", { bubbles: true })
		fireEvent(textarea, changeEvent)

		// The component calls setCustomInstructions with value ?? undefined
		// With nullish coalescing, empty string is preserved (not treated as nullish)
		expect(setCustomInstructions).toHaveBeenCalledWith("")
		// The postMessage call will have multiple calls, we need to check the right one
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "customInstructions",
			text: "", // empty string is now preserved with ?? operator
		})
	})

	it("closes the mode selection popover when ESC key is pressed", async () => {
		renderPromptsView()
		const selectTrigger = screen.getByTestId("mode-select-trigger")

		// Open the popover
		fireEvent.click(selectTrigger)
		await waitFor(() => {
			expect(selectTrigger).toHaveAttribute("aria-expanded", "true")
		})

		// Press ESC key
		fireEvent.keyDown(window, { key: "Escape" })

		// Verify popover is closed
		await waitFor(() => {
			expect(selectTrigger).toHaveAttribute("aria-expanded", "false")
		})
	})

	it("does not close the popover when ESC is pressed while popover is closed", async () => {
		renderPromptsView()
		const selectTrigger = screen.getByTestId("mode-select-trigger")

		// Ensure popover is closed
		expect(selectTrigger).toHaveAttribute("aria-expanded", "false")

		// Press ESC key
		fireEvent.keyDown(window, { key: "Escape" })

		// Verify popover remains closed
		expect(selectTrigger).toHaveAttribute("aria-expanded", "false")
	})
})

describe("ModesView MCP Server Selection UI", () => {
	beforeEach(() => {
		vitest.clearAllMocks()
	})

	describe("Rendering Tests", () => {
		it("renders MCP servers section when enabled and servers exist", () => {
			renderModesView()
			expect(screen.getByText("MCP Servers")).toBeInTheDocument()
			// Radio buttons should be present
			expect(screen.getByLabelText(/Use all servers/i)).toBeInTheDocument()
			expect(screen.getByLabelText(/Use selected servers only/i)).toBeInTheDocument()
			// Server list is hidden by default (Use all servers mode)
			expect(screen.queryByTestId("mcp-server-serverA")).not.toBeInTheDocument()
		})

		it("does not render MCP servers section when MCP disabled", () => {
			renderModesView({ mcpEnabled: false })
			expect(screen.queryByText("MCP Servers")).not.toBeInTheDocument()
		})

		it("does not render MCP servers section when no servers", () => {
			renderModesView({ mcpServers: [] })
			expect(screen.queryByText("MCP Servers")).not.toBeInTheDocument()
		})

		it('defaults to "Use all servers" mode', () => {
			renderModesView({ mcpServers: baseMcpServers, mcpEnabled: true })
			const allRadio = screen.getByLabelText(/Use all servers/i)
			expect(allRadio).toBeChecked()
		})

		it('shows "Use selected servers only" option', () => {
			renderModesView({ mcpServers: baseMcpServers, mcpEnabled: true })
			expect(screen.getByLabelText(/Use selected servers only/i)).toBeInTheDocument()
		})

		it("hides server list when 'Use all servers' is selected", () => {
			renderModesView({ mcpServers: baseMcpServers, mcpEnabled: true })
			const allRadio = screen.getByLabelText(/Use all servers/i)
			expect(allRadio).toBeChecked()
			// Server list should not be visible
			expect(screen.queryByTestId("mcp-server-serverA")).not.toBeInTheDocument()
		})

		it("shows server list when 'Use selected servers' is selected", async () => {
			renderModesView({ mcpServers: baseMcpServers, mcpEnabled: true })
			const selectedRadio = screen.getByLabelText(/Use selected servers only/i)
			fireEvent.click(selectedRadio)

			await waitFor(() => {
				expect(screen.getByTestId("mcp-server-serverA")).toBeInTheDocument()
				expect(screen.getByTestId("mcp-server-serverB")).toBeInTheDocument()
				expect(screen.getByTestId("mcp-server-serverC")).toBeInTheDocument()
			})
		})

		it("shows selected server names when servers are selected", async () => {
			renderModesView({ mcpServers: baseMcpServers, mcpEnabled: true })
			// Switch to selected mode
			const selectedRadio = screen.getByLabelText(/Use selected servers only/i)
			fireEvent.click(selectedRadio)

			await waitFor(() => {
				expect(screen.getByTestId("mcp-server-serverA")).toBeInTheDocument()
			})

			const serverRowA = screen.getByTestId("mcp-server-serverA")
			const serverRowB = screen.getByTestId("mcp-server-serverB")
			const toggleA = serverRowA.querySelector('[role="switch"]') as HTMLElement
			const toggleB = serverRowB.querySelector('[role="switch"]') as HTMLElement

			fireEvent.click(toggleA)
			fireEvent.click(toggleB)

			await waitFor(() => {
				expect(screen.getByText("Selected: serverA, serverB")).toBeInTheDocument()
			})
		})
	})

	describe("Selection Tests", () => {
		it("clicking a server toggle in selected mode toggles selection", async () => {
			renderModesView()
			// Switch to selected mode first
			const selectedRadio = screen.getByLabelText(/Use selected servers only/i)
			fireEvent.click(selectedRadio)

			await waitFor(() => {
				expect(screen.getByTestId("mcp-server-serverA")).toBeInTheDocument()
			})

			const serverRow = screen.getByTestId("mcp-server-serverA")
			const toggle = serverRow.querySelector('[role="switch"]') as HTMLElement
			expect(toggle).toHaveAttribute("aria-checked", "false")

			fireEvent.click(toggle)
			await waitFor(() => {
				expect(toggle).toHaveAttribute("aria-checked", "true")
			})

			fireEvent.click(toggle)
			await waitFor(() => {
				expect(toggle).toHaveAttribute("aria-checked", "false")
			})
		})

		it("selected toggles have correct state", async () => {
			renderModesView()
			// Switch to selected mode
			const selectedRadio = screen.getByLabelText(/Use selected servers only/i)
			fireEvent.click(selectedRadio)

			await waitFor(() => {
				expect(screen.getByTestId("mcp-server-serverB")).toBeInTheDocument()
			})

			const serverRow = screen.getByTestId("mcp-server-serverB")
			const toggle = serverRow.querySelector('[role="switch"]') as HTMLElement
			expect(toggle).toHaveAttribute("aria-checked", "false")

			fireEvent.click(toggle)
			await waitFor(() => {
				expect(toggle).toHaveAttribute("aria-checked", "true")
			})
		})

		it("multiple servers can be selected", async () => {
			renderModesView()
			// Switch to selected mode
			const selectedRadio = screen.getByLabelText(/Use selected servers only/i)
			fireEvent.click(selectedRadio)

			await waitFor(() => {
				expect(screen.getByTestId("mcp-server-serverA")).toBeInTheDocument()
			})

			const serverRowA = screen.getByTestId("mcp-server-serverA")
			const serverRowB = screen.getByTestId("mcp-server-serverB")
			const toggleA = serverRowA.querySelector('[role="switch"]') as HTMLElement
			const toggleB = serverRowB.querySelector('[role="switch"]') as HTMLElement

			fireEvent.click(toggleA)
			fireEvent.click(toggleB)
			await waitFor(() => {
				expect(toggleA).toHaveAttribute("aria-checked", "true")
				expect(toggleB).toHaveAttribute("aria-checked", "true")
			})
		})

		it('switching back to "Use all servers" clears selection', async () => {
			renderModesView()
			// Switch to selected mode
			const selectedRadio = screen.getByLabelText(/Use selected servers only/i)
			fireEvent.click(selectedRadio)

			await waitFor(() => {
				expect(screen.getByTestId("mcp-server-serverA")).toBeInTheDocument()
			})

			// Select a server
			const serverRow = screen.getByTestId("mcp-server-serverA")
			const toggle = serverRow.querySelector('[role="switch"]') as HTMLElement
			fireEvent.click(toggle)

			// Switch back to all mode
			const allRadio = screen.getByLabelText(/Use all servers/i)
			fireEvent.click(allRadio)

			await waitFor(() => {
				// Server list should be hidden
				expect(screen.queryByTestId("mcp-server-serverA")).not.toBeInTheDocument()
			})
		})

		it("stays in selected mode when last server is toggled off", async () => {
			renderModesView()
			// Switch to selected mode
			const selectedRadio = screen.getByLabelText(/Use selected servers only/i)
			fireEvent.click(selectedRadio)

			await waitFor(() => {
				expect(screen.getByTestId("mcp-server-serverA")).toBeInTheDocument()
			})

			// Select one server
			const serverRow = screen.getByTestId("mcp-server-serverA")
			const toggle = serverRow.querySelector('[role="switch"]') as HTMLElement
			fireEvent.click(toggle)

			await waitFor(() => {
				expect(toggle).toHaveAttribute("aria-checked", "true")
			})

			// Toggle it off again
			fireEvent.click(toggle)

			await waitFor(() => {
				expect(toggle).toHaveAttribute("aria-checked", "false")
				// Should still be in selected mode (not switch back to "all")
				const selectedRadioAfter = screen.getByLabelText(/Use selected servers only/i)
				expect(selectedRadioAfter).toBeChecked()
				// Server list should still be visible
				expect(screen.getByTestId("mcp-server-serverA")).toBeInTheDocument()
			})
		})
	})

	describe("Mode Switching Tests", () => {
		it("loads correct server selection when switching modes", async () => {
			const mapping = { code: ["serverA"], ask: ["serverB"] }
			const { unmount } = renderModesView({ mode: "code" })

			// Simulate backend response with mapping
			window.dispatchEvent(new MessageEvent("message", { data: { type: "modeToProfileMapping", mapping } }))

			// code mode should be in "selected" mode with serverA selected
			await waitFor(() => {
				const selectedRadio = screen.getByLabelText(/Use selected servers only/i)
				expect(selectedRadio).toBeChecked()
			})

			// Cleanup before switching modes
			unmount()

			// Switch to ask mode
			renderModesView({ mode: "ask" })

			// Simulate backend response with mapping
			window.dispatchEvent(new MessageEvent("message", { data: { type: "modeToProfileMapping", mapping } }))

			await waitFor(() => {
				const selectedRadio = screen.getByLabelText(/Use selected servers only/i)
				expect(selectedRadio).toBeChecked()
			})
		})

		it("shows all mode for modes not in mapping", async () => {
			const mapping = { code: ["serverA"] }
			renderModesView({ mode: "ask" })

			// Simulate backend response with mapping
			window.dispatchEvent(new MessageEvent("message", { data: { type: "modeToProfileMapping", mapping } }))

			await waitFor(() => {
				const allRadio = screen.getByLabelText(/Use all servers/i)
				expect(allRadio).toBeChecked()
			})
		})

		it("handles undefined mode correctly", async () => {
			renderModesView({ mode: undefined })
			// MCP section should not show for undefined mode (no mcp group)
			expect(screen.queryByText("MCP Servers")).not.toBeInTheDocument()
		})
	})

	describe("Backend Communication Tests", () => {
		it("sends getModeToProfileMapping on mount", () => {
			renderModesView()
			expect(vscode.postMessage).toHaveBeenCalledWith({ type: "getModeToProfileMapping" })
		})

		it("sends updateModeToProfileMapping when selection changes", async () => {
			renderModesView()
			// Switch to selected mode first
			const selectedRadio = screen.getByLabelText(/Use selected servers only/i)
			fireEvent.click(selectedRadio)

			await waitFor(() => {
				expect(screen.getByTestId("mcp-server-serverA")).toBeInTheDocument()
			})

			const serverRow = screen.getByTestId("mcp-server-serverA")
			const toggle = serverRow.querySelector('[role="switch"]') as HTMLElement
			fireEvent.click(toggle)

			await waitFor(() => {
				expect(vscode.postMessage).toHaveBeenCalledWith(
					expect.objectContaining({ type: "updateModeToProfileMapping" }),
				)
			})
		})

		it("handles modeToProfileMapping response correctly", async () => {
			renderModesView()
			const mapping = { code: ["serverA"] }
			window.dispatchEvent(new MessageEvent("message", { data: { type: "modeToProfileMapping", mapping } }))
			await waitFor(() => {
				// Should switch to selected mode
				const selectedRadio = screen.getByLabelText(/Use selected servers only/i)
				expect(selectedRadio).toBeChecked()
				// Server list should be visible
				expect(screen.getByTestId("mcp-server-serverA")).toBeInTheDocument()
			})
		})
	})

	describe("Edge Cases", () => {
		it("handles empty modeToProfile mapping", () => {
			renderModesView({ modeToProfile: {} })
			// Should default to "Use all servers" mode
			const allRadio = screen.getByLabelText(/Use all servers/i)
			expect(allRadio).toBeChecked()
		})

		it("handles mode not in mapping", () => {
			renderModesView({ mode: "nonexistent", modeToProfile: { code: ["serverA"] } })
			// MCP section should not show for nonexistent mode (no mcp group)
			expect(screen.queryByText("MCP Servers")).not.toBeInTheDocument()
		})

		it("handles invalid server names gracefully", async () => {
			const mapping = { code: ["invalidServer"] }
			renderModesView({ mode: "code" })

			// Simulate backend response with mapping containing invalid server
			window.dispatchEvent(new MessageEvent("message", { data: { type: "modeToProfileMapping", mapping } }))

			// Should be in selected mode
			await waitFor(() => {
				const selectedRadio = screen.getByLabelText(/Use selected servers only/i)
				expect(selectedRadio).toBeChecked()
			})

			// All valid servers should still be rendered
			await waitFor(() => {
				baseMcpServers.forEach((s) => {
					expect(screen.getByTestId(`mcp-server-${s.name}`)).toBeInTheDocument()
				})
			})
		})
	})
})
