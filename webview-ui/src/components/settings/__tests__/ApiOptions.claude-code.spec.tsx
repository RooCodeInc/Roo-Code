// npx vitest src/components/settings/__tests__/ApiOptions.claude-code.spec.tsx

import { render, screen, fireEvent, waitFor } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { type ProviderSettings } from "@roo-code/types"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"

import ApiOptions, { ApiOptionsProps } from "../ApiOptions"

// Mock VSCode components
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeTextField: ({ children, value, onInput }: any) => (
		<div>
			{children}
			<input type="text" value={value} onChange={onInput} />
		</div>
	),
	VSCodeLink: ({ children, href }: any) => <a href={href}>{children}</a>,
	VSCodeButton: ({ children }: any) => <button>{children}</button>,
}))

// Mock UI components
vi.mock("@/components/ui", () => {
	// Store the options from SelectItem components
	let selectOptions: any[] = []

	return {
		Select: ({ children, value, onValueChange }: any) => {
			// Reset options for each render
			selectOptions = []

			// Process children to extract options
			const processChildren = (children: any): any => {
				if (Array.isArray(children)) {
					return children.map(processChildren)
				}
				if (children?.type?.name === "SelectContent" || children?.props?.className === "select-content-mock") {
					// Extract options from SelectContent
					const extractOptions = (contentChildren: any): void => {
						if (Array.isArray(contentChildren)) {
							contentChildren.forEach(extractOptions)
						} else if (
							contentChildren?.type?.name === "SelectItem" ||
							contentChildren?.props?.className === "select-item-mock"
						) {
							selectOptions.push({
								value: contentChildren.props.value,
								label: contentChildren.props.children,
							})
						} else if (contentChildren?.props?.children) {
							extractOptions(contentChildren.props.children)
						}
					}
					if (children?.props?.children) {
						extractOptions(children.props.children)
					}
				}
				return children
			}

			// Process children to extract options
			processChildren(children)

			return (
				<div className="select-mock" data-testid="model-select">
					<select
						value={value || ""}
						onChange={(e) => onValueChange && onValueChange(e.target.value)}
						data-testid="model-select-element">
						{selectOptions.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
					{/* Also render original children for structure */}
					<div style={{ display: "none" }}>{children}</div>
				</div>
			)
		},
		SelectTrigger: ({ children }: any) => children,
		SelectValue: () => null,
		SelectContent: ({ children }: any) => <div className="select-content-mock">{children}</div>,
		SelectItem: ({ children, value }: any) => (
			<div className="select-item-mock" data-value={value}>
				{children}
			</div>
		),
		SearchableSelect: ({ value, onValueChange, options, placeholder, "data-testid": dataTestId }: any) => (
			<div className="searchable-select-mock" data-testid={dataTestId || "provider-select"}>
				<select value={value} onChange={(e) => onValueChange && onValueChange(e.target.value)}>
					<option value="">{placeholder || "Select..."}</option>
					{options?.map((option: any) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</div>
		),
		Slider: ({ value, onValueChange }: any) => (
			<input
				type="range"
				value={value?.[0] || 8000}
				onChange={(e) => onValueChange && onValueChange([parseInt(e.target.value)])}
			/>
		),
		Collapsible: ({ children }: any) => <div>{children}</div>,
		CollapsibleTrigger: ({ children }: any) => <div>{children}</div>,
		CollapsibleContent: ({ children }: any) => <div>{children}</div>,
	}
})

// Mock provider components
vi.mock("../providers/ClaudeCode", () => ({
	ClaudeCode: ({ apiConfiguration, setApiConfigurationField }: any) => (
		<div data-testid="claude-code-provider">
			<input
				data-testid="claude-code-path"
				type="text"
				value={apiConfiguration?.claudeCodePath || ""}
				onChange={(e) => setApiConfigurationField("claudeCodePath", e.target.value)}
			/>
			<div data-testid="claude-code-max-tokens">
				Max Tokens: {apiConfiguration?.claudeCodeMaxOutputTokens || 8000}
			</div>
		</div>
	),
}))

// Mock other required components
vi.mock("../ModelInfoView", () => ({
	ModelInfoView: () => <div data-testid="model-info-view">Model Info</div>,
}))

vi.mock("../ApiErrorMessage", () => ({
	ApiErrorMessage: ({ errorMessage }: any) => <div data-testid="api-error">{errorMessage}</div>,
}))

vi.mock("../ThinkingBudget", () => ({
	ThinkingBudget: () => null,
}))

vi.mock("../Verbosity", () => ({
	Verbosity: () => null,
}))

vi.mock("../DiffSettingsControl", () => ({
	DiffSettingsControl: () => null,
}))

vi.mock("../TodoListSettingsControl", () => ({
	TodoListSettingsControl: () => null,
}))

vi.mock("../TemperatureControl", () => ({
	TemperatureControl: () => null,
}))

vi.mock("../RateLimitSecondsControl", () => ({
	RateLimitSecondsControl: () => null,
}))

vi.mock("../ConsecutiveMistakeLimitControl", () => ({
	ConsecutiveMistakeLimitControl: () => null,
}))

// Mock the useSelectedModel hook
vi.mock("@src/components/ui/hooks/useSelectedModel", () => ({
	useSelectedModel: vi.fn((apiConfiguration: ProviderSettings) => {
		// Return the actual apiModelId from configuration
		return {
			provider: apiConfiguration.apiProvider || "anthropic",
			id: apiConfiguration.apiModelId || "claude-sonnet-4-20250514",
			info: {
				contextWindow: 200000,
				maxTokens: 8192,
				supportsPromptCache: true,
			},
		}
	}),
}))

// Mock other hooks
vi.mock("@src/components/ui/hooks/useRouterModels", () => ({
	useRouterModels: () => ({ data: {}, refetch: vi.fn() }),
}))

vi.mock("@src/components/ui/hooks/useOpenRouterModelProviders", () => ({
	useOpenRouterModelProviders: () => ({ data: {} }),
}))

const renderApiOptions = (props: Partial<ApiOptionsProps> = {}) => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	})

	return render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<ApiOptions
					errorMessage={undefined}
					setErrorMessage={() => {}}
					uriScheme={undefined}
					apiConfiguration={{
						apiProvider: "claude-code",
						apiModelId: "claude-sonnet-4-20250514",
					}}
					setApiConfigurationField={() => {}}
					{...props}
				/>
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)
}

describe("ApiOptions - Claude Code Provider", () => {
	it("renders Claude Code provider when selected", () => {
		renderApiOptions()

		expect(screen.getByTestId("claude-code-provider")).toBeInTheDocument()
	})

	it("displays model selector with claude-code models", () => {
		renderApiOptions()

		const modelSelect = screen.getByTestId("model-select")
		expect(modelSelect).toBeInTheDocument()

		// Check that the select element contains the expected models
		const selectElement = screen.getByTestId("model-select-element") as HTMLSelectElement
		const options = Array.from(selectElement.options).map((opt) => opt.value)

		expect(options).toContain("claude-sonnet-4-5")
		expect(options).toContain("claude-sonnet-4-20250514")
		expect(options).toContain("claude-opus-4-1-20250805")
		expect(options).toContain("claude-opus-4-20250514")
	})

	it("correctly displays the current selected model", () => {
		renderApiOptions({
			apiConfiguration: {
				apiProvider: "claude-code",
				apiModelId: "claude-sonnet-4-5",
			},
		})

		const selectElement = screen.getByTestId("model-select-element") as HTMLSelectElement
		expect(selectElement.value).toBe("claude-sonnet-4-5")
	})

	it("allows selecting claude-sonnet-4-5 model", async () => {
		const mockSetApiConfigurationField = vi.fn()

		renderApiOptions({
			apiConfiguration: {
				apiProvider: "claude-code",
				apiModelId: "claude-sonnet-4-20250514",
			},
			setApiConfigurationField: mockSetApiConfigurationField,
		})

		const selectElement = screen.getByTestId("model-select-element") as HTMLSelectElement

		// Initially should show claude-sonnet-4-20250514
		expect(selectElement.value).toBe("claude-sonnet-4-20250514")

		// Change to claude-sonnet-4-5
		fireEvent.change(selectElement, { target: { value: "claude-sonnet-4-5" } })

		// Should call setApiConfigurationField with the new model
		await waitFor(() => {
			expect(mockSetApiConfigurationField).toHaveBeenCalledWith("apiModelId", "claude-sonnet-4-5")
		})
	})

	it("maintains selected model after switching between models", async () => {
		const mockSetApiConfigurationField = vi.fn()
		let currentConfig = {
			apiProvider: "claude-code" as const,
			apiModelId: "claude-sonnet-4-20250514",
		}

		// Mock the setApiConfigurationField to update our local config
		mockSetApiConfigurationField.mockImplementation((field, value) => {
			currentConfig = { ...currentConfig, [field]: value }
		})

		const { rerender } = renderApiOptions({
			apiConfiguration: currentConfig,
			setApiConfigurationField: mockSetApiConfigurationField,
		})

		const selectElement = screen.getByTestId("model-select-element") as HTMLSelectElement

		// Change to claude-sonnet-4-5
		fireEvent.change(selectElement, { target: { value: "claude-sonnet-4-5" } })

		await waitFor(() => {
			expect(mockSetApiConfigurationField).toHaveBeenCalledWith("apiModelId", "claude-sonnet-4-5")
		})

		// Rerender with updated configuration
		rerender(
			<ExtensionStateContextProvider>
				<QueryClientProvider client={new QueryClient()}>
					<ApiOptions
						errorMessage={undefined}
						setErrorMessage={() => {}}
						uriScheme={undefined}
						apiConfiguration={currentConfig}
						setApiConfigurationField={mockSetApiConfigurationField}
					/>
				</QueryClientProvider>
			</ExtensionStateContextProvider>,
		)

		// Should still show claude-sonnet-4-5
		expect(selectElement.value).toBe("claude-sonnet-4-5")
	})

	it("uses apiModelId directly for value to avoid race conditions", () => {
		const apiConfiguration = {
			apiProvider: "claude-code" as const,
			apiModelId: "claude-sonnet-4-5",
		}

		renderApiOptions({ apiConfiguration })

		const selectElement = screen.getByTestId("model-select-element") as HTMLSelectElement

		// The select should use apiConfiguration.apiModelId directly
		// not the value from useSelectedModel hook
		expect(selectElement.value).toBe(apiConfiguration.apiModelId)
	})

	it("handles switching from another model to claude-sonnet-4-5", async () => {
		const mockSetApiConfigurationField = vi.fn()

		renderApiOptions({
			apiConfiguration: {
				apiProvider: "claude-code",
				apiModelId: "claude-opus-4-20250514",
			},
			setApiConfigurationField: mockSetApiConfigurationField,
		})

		const selectElement = screen.getByTestId("model-select-element") as HTMLSelectElement

		// Initially should show claude-opus-4-20250514
		expect(selectElement.value).toBe("claude-opus-4-20250514")

		// Change to claude-sonnet-4-5
		fireEvent.change(selectElement, { target: { value: "claude-sonnet-4-5" } })

		// Should update the apiModelId
		await waitFor(() => {
			expect(mockSetApiConfigurationField).toHaveBeenCalledWith("apiModelId", "claude-sonnet-4-5")
		})
	})
})
