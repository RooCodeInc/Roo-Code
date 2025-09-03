import { render, screen } from "@/utils/test-utils"

import { UISettings } from "@src/components/settings/UISettings"

// Mock translation hook to return the key as the translation
vitest.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("UISettings", () => {
	beforeEach(() => {
		vitest.clearAllMocks()
	})

	it("renders the UI settings section", () => {
		render(<UISettings />)

		// Check that the section header is rendered
		expect(screen.getByText("settings:sections.ui")).toBeInTheDocument()
		expect(screen.getByText("settings:ui.description")).toBeInTheDocument()
	})

	describe("Integration with translation system", () => {
		it("uses translation keys for all text content", () => {
			render(<UISettings />)

			// Verify that translation keys are being used (mocked to return the key)
			expect(screen.getByText("settings:sections.ui")).toBeInTheDocument()
			expect(screen.getByText("settings:ui.description")).toBeInTheDocument()
		})
	})

	describe("Component structure", () => {
		it("renders with custom className", () => {
			const { container } = render(<UISettings className="custom-class" />)

			const uiSettingsDiv = container.firstChild as HTMLElement
			expect(uiSettingsDiv).toHaveClass("custom-class")
		})

		it("passes through additional props", () => {
			const { container } = render(<UISettings data-custom="test-value" />)

			const uiSettingsDiv = container.firstChild as HTMLElement
			expect(uiSettingsDiv).toHaveAttribute("data-custom", "test-value")
		})
	})
})
