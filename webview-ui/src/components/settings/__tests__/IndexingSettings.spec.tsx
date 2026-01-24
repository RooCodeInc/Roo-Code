import { render, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { IndexingSettings } from "../IndexingSettings"
import { CodebaseIndexConfig } from "@roo-code/types"

// Mock ExtensionStateContext
const mockUseExtensionState = vi.fn()
vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => mockUseExtensionState(),
}))

// Mock useOpenRouterModelProviders
vi.mock("@src/components/ui/hooks/useOpenRouterModelProviders", () => ({
	useOpenRouterModelProviders: () => ({ data: undefined }),
	OPENROUTER_DEFAULT_PROVIDER_NAME: "Auto",
}))

// Mock useAppTranslation
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({ t: (key: string) => key }),
}))

// Mock VSCode webview UI toolkit components
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeCheckbox: ({ children, checked, onChange }: any) => (
		<label>
			<input type="checkbox" checked={checked} onChange={onChange} data-testid="enable-checkbox" />
			{children}
		</label>
	),
	VSCodeTextField: ({ value, onInput, onBlur, placeholder }: any) => (
		<input
			type="text"
			value={value}
			onChange={(e) => onInput?.({ target: { value: e.target.value } })}
			onBlur={(e) => onBlur?.({ target: { value: e.target.value } })}
			placeholder={placeholder}
			data-testid="text-field"
		/>
	),
	VSCodeDropdown: ({ value, onChange, children }: any) => (
		<select
			value={value}
			onChange={(e) => onChange?.({ target: { value: e.target.value } })}
			data-testid="dropdown">
			{children}
		</select>
	),
	VSCodeOption: ({ value, children }: any) => <option value={value}>{children}</option>,
	VSCodeLink: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

// Mock Section, SectionHeader, SearchableSetting
vi.mock("../Section", () => ({
	Section: ({ children }: any) => <div data-testid="section">{children}</div>,
}))

vi.mock("../SectionHeader", () => ({
	SectionHeader: ({ children }: any) => <h2 data-testid="section-header">{children}</h2>,
}))

vi.mock("../SearchableSetting", () => ({
	SearchableSetting: ({ children }: any) => <div data-testid="searchable-setting">{children}</div>,
}))

// Mock UI components
vi.mock("@/components/ui", () => ({
	Select: ({ value, onValueChange, children }: any) => (
		<div data-testid="select" data-value={value} onClick={() => onValueChange?.("ollama")}>
			{children}
		</div>
	),
	SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
	SelectItem: ({ value, children }: any) => (
		<div data-testid={`select-item-${value}`} data-value={value}>
			{children}
		</div>
	),
	SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
	SelectValue: () => <span data-testid="select-value" />,
	Slider: ({ value, onValueChange, min, max }: any) => (
		<input
			type="range"
			min={min}
			max={max}
			value={value?.[0]}
			onChange={(e) => onValueChange?.([parseFloat(e.target.value)])}
			data-testid="slider"
		/>
	),
}))

describe("IndexingSettings", () => {
	const defaultConfig: CodebaseIndexConfig = {
		codebaseIndexEnabled: true,
		codebaseIndexQdrantUrl: "http://localhost:6333",
		codebaseIndexEmbedderProvider: "openai",
		codebaseIndexEmbedderBaseUrl: "",
		codebaseIndexEmbedderModelId: "text-embedding-3-small",
		codebaseIndexEmbedderModelDimension: 1536,
		codebaseIndexOpenAiCompatibleBaseUrl: "",
		codebaseIndexBedrockRegion: "",
		codebaseIndexBedrockProfile: "",
		codebaseIndexSearchMaxResults: 20,
		codebaseIndexSearchMinScore: 0.4,
		codebaseIndexOpenRouterSpecificProvider: "",
	}

	const defaultExtensionState = {
		codebaseIndexModels: {
			openai: {
				"text-embedding-3-small": { dimension: 1536 },
				"text-embedding-3-large": { dimension: 3072 },
			},
			ollama: {},
		},
		apiConfiguration: {
			apiProvider: "anthropic",
		},
	}

	beforeEach(() => {
		vi.clearAllMocks()
		mockUseExtensionState.mockReturnValue(defaultExtensionState)
	})

	it("renders the enable checkbox", () => {
		const onConfigChange = vi.fn()
		const { getByTestId } = render(
			<IndexingSettings codebaseIndexConfig={defaultConfig} onConfigChange={onConfigChange} />,
		)

		const checkbox = getByTestId("enable-checkbox")
		expect(checkbox).toBeTruthy()
	})

	it("displays correct initial enabled state", () => {
		const onConfigChange = vi.fn()
		const { getByTestId } = render(
			<IndexingSettings codebaseIndexConfig={defaultConfig} onConfigChange={onConfigChange} />,
		)

		const checkbox = getByTestId("enable-checkbox") as HTMLInputElement
		expect(checkbox.checked).toBe(true)
	})

	it("calls onConfigChange when enable checkbox is toggled", async () => {
		const onConfigChange = vi.fn()
		const { getByTestId } = render(
			<IndexingSettings codebaseIndexConfig={defaultConfig} onConfigChange={onConfigChange} />,
		)

		const checkbox = getByTestId("enable-checkbox")
		fireEvent.click(checkbox)

		await waitFor(() => {
			expect(onConfigChange).toHaveBeenCalledWith({ codebaseIndexEnabled: false })
		})
	})

	it("hides configuration when disabled", () => {
		const disabledConfig = { ...defaultConfig, codebaseIndexEnabled: false }
		const onConfigChange = vi.fn()
		const { queryByText } = render(
			<IndexingSettings codebaseIndexConfig={disabledConfig} onConfigChange={onConfigChange} />,
		)

		// Should not find provider dropdown when disabled
		expect(queryByText("settings:codeIndex.embedderProviderLabel")).toBeNull()
	})

	it("shows configuration when enabled", () => {
		const onConfigChange = vi.fn()
		const { getAllByTestId } = render(
			<IndexingSettings codebaseIndexConfig={defaultConfig} onConfigChange={onConfigChange} />,
		)

		// Should find searchable settings when enabled
		const searchableSettings = getAllByTestId("searchable-setting")
		expect(searchableSettings.length).toBeGreaterThan(1)
	})

	it("renders section header", () => {
		const onConfigChange = vi.fn()
		const { getByTestId } = render(
			<IndexingSettings codebaseIndexConfig={defaultConfig} onConfigChange={onConfigChange} />,
		)

		const header = getByTestId("section-header")
		expect(header).toBeTruthy()
		expect(header.textContent).toBe("settings:sections.indexing")
	})

	it("calls onConfigChange with updated searchMinScore when slider changes", async () => {
		const onConfigChange = vi.fn()
		const { getAllByTestId } = render(
			<IndexingSettings codebaseIndexConfig={defaultConfig} onConfigChange={onConfigChange} />,
		)

		const sliders = getAllByTestId("slider")
		// First slider should be search score (second is max results)
		const scoreSlider = sliders[0]
		fireEvent.change(scoreSlider, { target: { value: "0.5" } })

		await waitFor(() => {
			expect(onConfigChange).toHaveBeenCalledWith({ codebaseIndexSearchMinScore: 0.5 })
		})
	})

	it("calls onConfigChange with updated searchMaxResults when slider changes", async () => {
		const onConfigChange = vi.fn()
		const { getAllByTestId } = render(
			<IndexingSettings codebaseIndexConfig={defaultConfig} onConfigChange={onConfigChange} />,
		)

		const sliders = getAllByTestId("slider")
		// Second slider should be max results
		const resultsSlider = sliders[1]
		fireEvent.change(resultsSlider, { target: { value: "30" } })

		await waitFor(() => {
			expect(onConfigChange).toHaveBeenCalledWith({ codebaseIndexSearchMaxResults: 30 })
		})
	})

	it("uses defaults when codebaseIndexConfig is undefined", () => {
		const onConfigChange = vi.fn()
		const { getByTestId } = render(
			<IndexingSettings codebaseIndexConfig={undefined} onConfigChange={onConfigChange} />,
		)

		// Should render without errors and show enable checkbox as unchecked by default
		const checkbox = getByTestId("enable-checkbox") as HTMLInputElement
		expect(checkbox.checked).toBe(false)
	})

	it("updates checkbox state when prop changes", () => {
		const onConfigChange = vi.fn()
		const { getByTestId, rerender } = render(
			<IndexingSettings
				codebaseIndexConfig={{ ...defaultConfig, codebaseIndexEnabled: true }}
				onConfigChange={onConfigChange}
			/>,
		)
		const checkbox = getByTestId("enable-checkbox") as HTMLInputElement
		expect(checkbox.checked).toBe(true)

		rerender(
			<IndexingSettings
				codebaseIndexConfig={{ ...defaultConfig, codebaseIndexEnabled: false }}
				onConfigChange={onConfigChange}
			/>,
		)
		expect(checkbox.checked).toBe(false)
	})
})
