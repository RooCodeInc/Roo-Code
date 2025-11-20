import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ClaudeCode } from "../ClaudeCode"
import type { ProviderSettings } from "@roo-code/types"

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeTextField: ({ children, value, onInput, type, placeholder }: any) => {
		const handleInput = (e: any) => {
			const event = { target: { value: e.target.value } }
			onInput?.(event)
		}
		return (
			<div>
				{children}
				<input type={type} value={value} onInput={handleInput} placeholder={placeholder} />
			</div>
		)
	},
	VSCodeButton: ({ children, onClick, disabled, appearance }: any) => (
		<button onClick={onClick} disabled={disabled} data-appearance={appearance}>
			{children}
		</button>
	),
}))

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"settings:providers.claudeCode.pathLabel": "Claude Code API Key",
				"settings:providers.claudeCode.placeholder": "Enter your Claude Code API key",
				"settings:providers.claudeCode.getApiKey": "Get API Key",
				"settings:providers.claudeCode.updateKey": "Update Key",
				"settings:providers.claudeCode.authenticated": "Authenticated with Claude Code",
				"settings:providers.claudeCode.description":
					"Optional path to your Claude Code CLI. Defaults to 'claude' if not set.",
				"settings:providers.claudeCode.maxTokensLabel": "Max Output Tokens",
				"settings:providers.claudeCode.maxTokensDescription":
					"Maximum number of output tokens for Claude Code responses. Default is 8000.",
			}
			return translations[key] || key
		},
	}),
}))

vi.mock("@src/components/ui", () => ({
	Slider: ({ value, onValueChange }: any) => (
		<input
			type="range"
			value={value[0]}
			onChange={(e) => onValueChange([Number(e.target.value)])}
			data-testid="slider"
		/>
	),
}))

describe("ClaudeCode", () => {
	const defaultApiConfiguration: ProviderSettings = {
		claudeCodePath: "",
		claudeCodeMaxOutputTokens: 8000,
	}

	const mockSetApiConfigurationField = vi.fn()
	const mockVscode = {
		postMessage: vi.fn(),
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Authentication UI", () => {
		it("should show 'Get API Key' button when no API key is present", () => {
			render(
				<ClaudeCode
					apiConfiguration={defaultApiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					vscode={mockVscode}
				/>,
			)

			const button = screen.getByRole("button")
			expect(button).toHaveTextContent("Get API Key")
		})

		it("should show 'Update Key' button when API key is present", () => {
			const apiConfiguration = { ...defaultApiConfiguration, claudeCodePath: "test-api-key" }
			render(
				<ClaudeCode
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					vscode={mockVscode}
				/>,
			)

			const button = screen.getByRole("button")
			expect(button).toHaveTextContent("Update Key")
		})

		it("should show authenticated status when API key is present", () => {
			const apiConfiguration = { ...defaultApiConfiguration, claudeCodePath: "test-api-key" }
			render(
				<ClaudeCode
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					vscode={mockVscode}
				/>,
			)

			expect(screen.getByText("✓ Authenticated with Claude Code")).toBeInTheDocument()
		})

		it("should not show authenticated status when no API key", () => {
			render(
				<ClaudeCode
					apiConfiguration={defaultApiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					vscode={mockVscode}
				/>,
			)

			expect(screen.queryByText("✓ Authenticated with Claude Code")).not.toBeInTheDocument()
		})

		it("should open external link when Get API Key button is clicked", async () => {
			const user = userEvent.setup()
			render(
				<ClaudeCode
					apiConfiguration={defaultApiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					vscode={mockVscode}
				/>,
			)

			const button = screen.getByRole("button")
			await user.click(button)

			expect(mockVscode.postMessage).toHaveBeenCalledWith({
				type: "openExternal",
				url: "https://console.anthropic.com/settings/keys",
			})
		})

		it("should show information message when Get API Key button is clicked", async () => {
			const user = userEvent.setup()
			render(
				<ClaudeCode
					apiConfiguration={defaultApiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					vscode={mockVscode}
				/>,
			)

			const button = screen.getByRole("button")
			await user.click(button)

			expect(mockVscode.postMessage).toHaveBeenCalledWith({
				type: "showInformationMessage",
				text: "Please create an API key on the Anthropic Console and paste it in the field above",
			})
		})
	})

	describe("API Key Input", () => {
		it("should mask API key input", () => {
			render(
				<ClaudeCode
					apiConfiguration={defaultApiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					vscode={mockVscode}
				/>,
			)

			const input = screen.getByPlaceholderText("Enter your Claude Code API key") as HTMLInputElement
			expect(input.type).toBe("password")
		})

		it("should show masked placeholder when API key exists", () => {
			const apiConfiguration = { ...defaultApiConfiguration, claudeCodePath: "test-api-key" }
			render(
				<ClaudeCode
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					vscode={mockVscode}
				/>,
			)

			const input = screen.getByPlaceholderText("••••••••••••••••") as HTMLInputElement
			expect(input).toBeInTheDocument()
		})
	})

	describe("Max Output Tokens", () => {
		it("should display current max output tokens value", () => {
			const apiConfiguration = { ...defaultApiConfiguration, claudeCodeMaxOutputTokens: 16000 }
			render(
				<ClaudeCode
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					vscode={mockVscode}
				/>,
			)

			expect(screen.getByText("16000")).toBeInTheDocument()
		})

		it("should use default value of 8000 when not specified", () => {
			render(
				<ClaudeCode
					apiConfiguration={{}}
					setApiConfigurationField={mockSetApiConfigurationField}
					vscode={mockVscode}
				/>,
			)

			expect(screen.getByText("8000")).toBeInTheDocument()
		})
	})
})
