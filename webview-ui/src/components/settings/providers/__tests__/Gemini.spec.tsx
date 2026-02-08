import { render, screen } from "@testing-library/react"
import { Gemini } from "../Gemini"
import type { ProviderSettings } from "@roo-code/types"

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeTextField: ({ children, value, onInput, type }: any) => (
		<div>
			{children}
			<input type={type} value={value} onChange={(e) => onInput(e)} />
		</div>
	),
}))

vi.mock("vscrui", () => ({
	Checkbox: ({ children, checked, onChange, "data-testid": testId, _ }: any) => (
		<label data-testid={testId}>
			<input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
			{children}
		</label>
	),
}))

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@src/components/common/VSCodeButtonLink", () => ({
	VSCodeButtonLink: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

describe("Gemini", () => {
	const defaultApiConfiguration: ProviderSettings = {
		geminiApiKey: "",
	}

	const mockSetApiConfigurationField = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should render custom base URL checkbox", () => {
		render(
			<Gemini
				apiConfiguration={defaultApiConfiguration}
				setApiConfigurationField={mockSetApiConfigurationField}
			/>,
		)

		expect(screen.getByTestId("checkbox-custom-base-url")).toBeInTheDocument()
	})

	it("should not render URL context or grounding search checkboxes", () => {
		render(
			<Gemini
				apiConfiguration={defaultApiConfiguration}
				setApiConfigurationField={mockSetApiConfigurationField}
			/>,
		)

		expect(screen.queryByTestId("checkbox-url-context")).not.toBeInTheDocument()
		expect(screen.queryByTestId("checkbox-grounding-search")).not.toBeInTheDocument()
	})
})
