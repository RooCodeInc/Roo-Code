import { render, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { UISettings } from "../UISettings"

// Mock useAppTranslation
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock telemetry
vi.mock("@/utils/TelemetryClient", () => ({
	telemetryClient: { capture: vi.fn() },
}))

// Mock SearchableSetting to render children directly
vi.mock("../SearchableSetting", () => ({
	SearchableSetting: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Mock SectionHeader to render children
vi.mock("../SectionHeader", () => ({
	SectionHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Mock Section to render children
vi.mock("../Section", () => ({
	Section: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe("UISettings", () => {
	const defaultProps = {
		reasoningBlockCollapsed: false,
		enterBehavior: "send" as const,
		taskHeaderHighlightEnabled: false,
		setCachedStateField: vi.fn(),
	}

	it("renders the collapse thinking checkbox", () => {
		const { getByTestId } = render(<UISettings {...defaultProps} />)
		const checkbox = getByTestId("collapse-thinking-checkbox")
		expect(checkbox).toBeTruthy()
	})

	it("displays the correct initial state", () => {
		const { getByTestId } = render(<UISettings {...defaultProps} reasoningBlockCollapsed={true} />)
		const checkbox = getByTestId("collapse-thinking-checkbox") as HTMLInputElement
		expect(checkbox.checked).toBe(true)
	})

	it("calls setCachedStateField when checkbox is toggled", async () => {
		const setCachedStateField = vi.fn()
		const { getByTestId } = render(<UISettings {...defaultProps} setCachedStateField={setCachedStateField} />)

		const checkbox = getByTestId("collapse-thinking-checkbox")
		fireEvent.click(checkbox)

		await waitFor(() => {
			expect(setCachedStateField).toHaveBeenCalledWith("reasoningBlockCollapsed", true)
		})
	})

	it("updates checkbox state when prop changes", () => {
		const { getByTestId, rerender } = render(<UISettings {...defaultProps} reasoningBlockCollapsed={false} />)
		const checkbox = getByTestId("collapse-thinking-checkbox") as HTMLInputElement
		expect(checkbox.checked).toBe(false)

		rerender(<UISettings {...defaultProps} reasoningBlockCollapsed={true} />)
		expect(checkbox.checked).toBe(true)
	})

	describe("Task header highlight", () => {
		it("renders checkbox unchecked when taskHeaderHighlightEnabled is false", () => {
			const { getByTestId } = render(<UISettings {...defaultProps} taskHeaderHighlightEnabled={false} />)
			const checkbox = getByTestId("task-header-highlight-checkbox") as HTMLInputElement
			expect(checkbox).toBeTruthy()
			expect(checkbox.checked).toBe(false)
		})

		it("renders checkbox checked when taskHeaderHighlightEnabled is true", () => {
			const { getByTestId } = render(<UISettings {...defaultProps} taskHeaderHighlightEnabled={true} />)
			const checkbox = getByTestId("task-header-highlight-checkbox") as HTMLInputElement
			expect(checkbox.checked).toBe(true)
		})

		it("calls setCachedStateField with true when toggling on", async () => {
			const setCachedStateField = vi.fn()
			const { getByTestId } = render(
				<UISettings
					{...defaultProps}
					taskHeaderHighlightEnabled={false}
					setCachedStateField={setCachedStateField}
				/>,
			)

			const checkbox = getByTestId("task-header-highlight-checkbox")
			fireEvent.click(checkbox)

			await waitFor(() => {
				expect(setCachedStateField).toHaveBeenCalledWith("taskHeaderHighlightEnabled", true)
			})
		})

		it("calls setCachedStateField with false when toggling off", async () => {
			const setCachedStateField = vi.fn()
			const { getByTestId } = render(
				<UISettings
					{...defaultProps}
					taskHeaderHighlightEnabled={true}
					setCachedStateField={setCachedStateField}
				/>,
			)

			const checkbox = getByTestId("task-header-highlight-checkbox")
			fireEvent.click(checkbox)

			await waitFor(() => {
				expect(setCachedStateField).toHaveBeenCalledWith("taskHeaderHighlightEnabled", false)
			})
		})
	})
})
