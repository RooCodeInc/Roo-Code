import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { OpenAI } from "../OpenAI"
import type { ProviderSettings, ModelInfo } from "@roo-code/types"

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeTextField: ({ children, value, onInput, type, placeholder }: any) => {
		const handleInput = (e: any) => {
			const event = { target: { value: e.target.value } }
			onInput?.(event)
		}
		return (
			<div>
				{children && <label>{children}</label>}
				<input type={type} value={value} onInput={handleInput} placeholder={placeholder} />
			</div>
		)
	},
}))

vi.mock("vscrui", () => ({
	Checkbox: ({ children, checked, onChange }: any) => (
		<label>
			<input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
			{children}
		</label>
	),
}))

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"settings:providers.openAiApiKey": "OpenAI API Key",
				"settings:providers.getOpenAiApiKey": "Get OpenAI API Key",
				"settings:providers.openAi.authenticated": "Authenticated with OpenAI",
				"settings:providers.openAi.updateKey": "Update API Key",
				"settings:providers.apiKeyStorageNotice": "API keys are stored securely in VSCode's Secret Storage",
				"settings:providers.useCustomBaseUrl": "Use custom base URL",
				"settings:placeholders.apiKey": "Enter API Key...",
				"settings:common.select": "Select",
			}
			return translations[key] || key
		},
	}),
}))

vi.mock("@src/components/common/VSCodeButtonLink", () => ({
	VSCodeButtonLink: ({ children, href, appearance }: any) => (
		<a href={href} data-appearance={appearance}>
			{children}
		</a>
	),
}))

vi.mock("@src/components/ui", () => ({
	Select: ({ children, value, onValueChange }: any) => (
		<select value={value} onChange={(e) => onValueChange(e.target.value)}>
			{children}
		</select>
	),
	SelectTrigger: ({ children }: any) => <div>{children}</div>,
	SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
	SelectContent: ({ children }: any) => <>{children}</>,
	SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
	StandardTooltip: ({ children, content }: any) => <span title={content}>{children}</span>,
}))

describe("OpenAI", () => {
	const defaultApiConfiguration: ProviderSettings = {
		openAiNativeApiKey: "",
		openAiNativeBaseUrl: "",
		openAiNativeServiceTier: "default",
	}

	const mockSetApiConfigurationField = vi.fn()
	const mockSelectedModelInfo: ModelInfo = {
		contextWindow: 128000,
		maxTokens: 8000,
		supportsPromptCache: false,
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Authentication UI", () => {
		it("should show 'Get OpenAI API Key' button when no API key is present", () => {
			render(
				<OpenAI
					apiConfiguration={defaultApiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					selectedModelInfo={mockSelectedModelInfo}
				/>,
			)

			const link = screen.getByText("Get OpenAI API Key")
			expect(link).toBeInTheDocument()
			expect(link.closest("a")).toHaveAttribute("href", "https://platform.openai.com/api-keys")
		})

		it("should show authenticated status and update button when API key is present", () => {
			const apiConfiguration = { ...defaultApiConfiguration, openAiNativeApiKey: "test-api-key" }
			render(
				<OpenAI
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					selectedModelInfo={mockSelectedModelInfo}
				/>,
			)

			expect(screen.getByText("✓ Authenticated with OpenAI")).toBeInTheDocument()
			const updateLink = screen.getByText("Update API Key")
			expect(updateLink).toBeInTheDocument()
			expect(updateLink.closest("a")).toHaveAttribute("href", "https://platform.openai.com/api-keys")
		})

		it("should not show authenticated status when no API key", () => {
			render(
				<OpenAI
					apiConfiguration={defaultApiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					selectedModelInfo={mockSelectedModelInfo}
				/>,
			)

			expect(screen.queryByText("✓ Authenticated with OpenAI")).not.toBeInTheDocument()
		})
	})

	describe("API Key Input", () => {
		it("should mask API key input", () => {
			render(
				<OpenAI
					apiConfiguration={defaultApiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					selectedModelInfo={mockSelectedModelInfo}
				/>,
			)

			const input = screen.getByPlaceholderText("Enter API Key...") as HTMLInputElement
			expect(input.type).toBe("password")
		})

		it("should show API key storage notice", () => {
			render(
				<OpenAI
					apiConfiguration={defaultApiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					selectedModelInfo={mockSelectedModelInfo}
				/>,
			)

			expect(screen.getByText("API keys are stored securely in VSCode's Secret Storage")).toBeInTheDocument()
		})
	})

	describe("Custom Base URL", () => {
		it("should not show base URL input by default", () => {
			render(
				<OpenAI
					apiConfiguration={defaultApiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					selectedModelInfo={mockSelectedModelInfo}
				/>,
			)

			expect(screen.queryByPlaceholderText("https://api.openai.com/v1")).not.toBeInTheDocument()
		})

		it("should show base URL input when checkbox is checked", async () => {
			const user = userEvent.setup()
			render(
				<OpenAI
					apiConfiguration={defaultApiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					selectedModelInfo={mockSelectedModelInfo}
				/>,
			)

			const checkbox = screen.getByRole("checkbox")
			await user.click(checkbox)

			expect(screen.getByPlaceholderText("https://api.openai.com/v1")).toBeInTheDocument()
		})

		it("should clear base URL when checkbox is unchecked", async () => {
			const user = userEvent.setup()
			const apiConfiguration = { ...defaultApiConfiguration, openAiNativeBaseUrl: "https://custom.url/v1" }
			render(
				<OpenAI
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					selectedModelInfo={mockSelectedModelInfo}
				/>,
			)

			const checkbox = screen.getByRole("checkbox")
			await user.click(checkbox)

			expect(mockSetApiConfigurationField).toHaveBeenCalledWith("openAiNativeBaseUrl", "")
		})
	})

	describe("Service Tier", () => {
		it("should not show service tier selector when model has no tiers", () => {
			render(
				<OpenAI
					apiConfiguration={defaultApiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					selectedModelInfo={mockSelectedModelInfo}
				/>,
			)

			expect(screen.queryByTestId("openai-service-tier")).not.toBeInTheDocument()
		})

		it("should show service tier selector when model has flex or priority tiers", () => {
			const modelInfo: ModelInfo = {
				contextWindow: 128000,
				maxTokens: 8000,
				supportsPromptCache: false,
				tiers: [
					{ name: "flex", contextWindow: 128000 },
					{ name: "priority", contextWindow: 128000 },
				],
			}

			render(
				<OpenAI
					apiConfiguration={defaultApiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					selectedModelInfo={modelInfo}
				/>,
			)

			expect(screen.getByTestId("openai-service-tier")).toBeInTheDocument()
			expect(screen.getByText("Standard")).toBeInTheDocument()
			expect(screen.getByText("Flex")).toBeInTheDocument()
			expect(screen.getByText("Priority")).toBeInTheDocument()
		})

		it("should update service tier when selection changes", async () => {
			const modelInfo: ModelInfo = {
				contextWindow: 128000,
				maxTokens: 8000,
				supportsPromptCache: false,
				tiers: [
					{ name: "flex", contextWindow: 128000 },
					{ name: "priority", contextWindow: 128000 },
				],
			}

			const user = userEvent.setup()
			render(
				<OpenAI
					apiConfiguration={defaultApiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					selectedModelInfo={modelInfo}
				/>,
			)

			const select = screen.getByRole("combobox")
			await user.selectOptions(select, "priority")

			expect(mockSetApiConfigurationField).toHaveBeenCalledWith("openAiNativeServiceTier", "priority")
		})
	})
})
