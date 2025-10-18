// npx vitest run src/components/settings/__tests__/UISettings.fontsize.spec.tsx

import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom"
import { UISettings } from "../UISettings"
import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import React from "react"

// Mock vscode API
const mockPostMessage = vi.fn()
;(global as any).vscode = {
	postMessage: mockPostMessage,
}

// Mock the useTranslation hook
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock VSCode webview UI toolkit components
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeDropdown: ({ children, value, onChange }: any) => (
		<select role="combobox" value={value} onChange={(e) => onChange && onChange(e)}>
			{children}
		</select>
	),
	VSCodeOption: ({ children, value }: any) => (
		<option role="option" value={value}>
			{children}
		</option>
	),
	VSCodeCheckbox: ({ children }: any) => <label>{children}</label>,
}))

// Mock useExtensionState hook to provide consistent state
vi.mock("@src/context/ExtensionStateContext", async () => {
	const actual = await vi.importActual("@src/context/ExtensionStateContext")
	return {
		...actual,
		useExtensionState: () => ({
			chatMessageFontSize: "default",
			setChatMessageFontSize: vi.fn(),
			soundEnabled: true,
			setSoundEnabled: vi.fn(),
			soundVolume: 0.5,
			setSoundVolume: vi.fn(),
			diffEnabled: true,
			setDiffEnabled: vi.fn(),
			browserActionType: "auto",
			setBrowserActionType: vi.fn(),
		}),
	}
})

describe("UISettings - Chat Message Font Size", () => {
	const defaultProps = {
		expandedRows: {},
		setExpandedRows: vi.fn(),
		isHidden: false,
		hideAnnouncement: vi.fn(),
		soundEnabled: true,
		soundVolume: 0.5,
		diffEnabled: true,
		allowedCommands: [],
		deniedCommands: [],
		historyPreviewCollapsed: false,
		chatMessageFontSize: "default",
		reasoningBlockCollapsed: false,
		setCachedStateField: vi.fn(),
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should render chat message font size dropdown with all options", () => {
		render(
			<ExtensionStateContextProvider>
				<UISettings {...defaultProps} />
			</ExtensionStateContextProvider>,
		)

		// Check that the dropdown is rendered
		const dropdown = screen.getByRole("combobox")
		expect(dropdown).toBeInTheDocument()

		// Check that all font size options are available
		const options = screen.getAllByRole("option")
		const optionTexts = options.map((opt) => opt.textContent)

		expect(optionTexts).toContain("Default")
		expect(optionTexts).toContain("Extra Small (90%)")
		expect(optionTexts).toContain("Small (95%)")
		expect(optionTexts).toContain("Large (105%)")
		expect(optionTexts).toContain("Extra Large (110%)")
	})

	it("should display the current font size setting", () => {
		const props = { ...defaultProps, chatMessageFontSize: "large" }
		render(
			<ExtensionStateContextProvider>
				<UISettings {...props} />
			</ExtensionStateContextProvider>,
		)

		const dropdown = screen.getByRole("combobox")
		expect(dropdown).toHaveValue("large")
	})

	it("should handle undefined chatMessageFontSize gracefully", () => {
		// Use type assertion to test undefined case
		const props = { ...defaultProps, chatMessageFontSize: undefined as any }
		render(
			<ExtensionStateContextProvider>
				<UISettings {...props} />
			</ExtensionStateContextProvider>,
		)

		const dropdown = screen.getByRole("combobox")
		// Should default to "default" when undefined
		expect(dropdown).toHaveValue("default")
	})
})
