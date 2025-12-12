import { render, screen } from "@/utils/test-utils"

import { TranslationProvider } from "@/i18n/__mocks__/TranslationContext"

import { AutoApproveToggle, autoApproveSettingsConfig } from "../AutoApproveToggle"

vi.mock("@/i18n/TranslationContext", () => {
	const actual = vi.importActual("@/i18n/TranslationContext")
	return {
		...actual,
		useAppTranslation: () => ({
			t: (key: string) => key,
		}),
	}
})

// Mock ExtensionState with browserToolEnabled = false to verify disabled state
vi.mock("@/context/ExtensionStateContext", () => {
	return {
		useExtensionState: () => ({ browserToolEnabled: false }),
		ExtensionStateContextProvider: ({ children }: any) => children,
	}
})

describe("AutoApproveToggle - disabled Browser toggle when browser tool disabled", () => {
	const initialProps = {
		alwaysAllowReadOnly: true,
		alwaysAllowWrite: false,
		alwaysAllowBrowser: false,
		alwaysApproveResubmit: true,
		alwaysAllowMcp: false,
		alwaysAllowModeSwitch: true,
		alwaysAllowSubtasks: false,
		alwaysAllowExecute: true,
		alwaysAllowFollowupQuestions: false,
		alwaysAllowUpdateTodoList: true,
		onToggle: vi.fn(),
	}

	test("renders the Browser auto-approve toggle as disabled when browserToolEnabled is false", () => {
		render(
			<TranslationProvider>
				<AutoApproveToggle {...initialProps} />
			</TranslationProvider>,
		)

		// Browser toggle should be present but disabled
		const browserToggle = screen.getByTestId(autoApproveSettingsConfig.alwaysAllowBrowser.testId)
		expect(browserToggle).toBeInTheDocument()
		expect(browserToggle).toBeDisabled()

		// A non-browser toggle should still be present and enabled
		const readOnlyToggle = screen.getByTestId(autoApproveSettingsConfig.alwaysAllowReadOnly.testId)
		expect(readOnlyToggle).toBeInTheDocument()
		expect(readOnlyToggle).not.toBeDisabled()
	})
})
