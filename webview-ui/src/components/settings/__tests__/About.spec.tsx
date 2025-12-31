import { render, screen } from "@/utils/test-utils"

import { TranslationProvider } from "@/i18n/__mocks__/TranslationContext"

import { About } from "../About"

vi.mock("@/utils/vscode", () => ({
	vscode: { postMessage: vi.fn() },
}))

vi.mock("@/i18n/TranslationContext", () => {
	const actual = vi.importActual("@/i18n/TranslationContext")
	return {
		...actual,
		useAppTranslation: () => ({
			t: (key: string) => key,
		}),
	}
})

vi.mock("@roo/package", () => ({
	Package: {
		version: "1.0.0",
		sha: "abc12345",
	},
}))

describe("About", () => {
	const defaultProps = {
		telemetrySetting: "enabled" as const,
		setTelemetrySetting: vi.fn(),
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders the About section header", () => {
		render(
			<TranslationProvider>
				<About {...defaultProps} />
			</TranslationProvider>,
		)
		expect(screen.getByText("settings:sections.about")).toBeInTheDocument()
	})

	it("renders export and import buttons", () => {
		render(
			<TranslationProvider>
				<About {...defaultProps} />
			</TranslationProvider>,
		)
		expect(screen.getByText("settings:footer.settings.export")).toBeInTheDocument()
		expect(screen.getByText("settings:footer.settings.import")).toBeInTheDocument()
	})
})
