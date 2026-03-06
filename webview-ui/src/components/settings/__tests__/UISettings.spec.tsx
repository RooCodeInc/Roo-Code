import { render, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { UISettings } from "../UISettings"

// Mock telemetryClient
const mockCapture = vi.fn()
vi.mock("@/utils/TelemetryClient", () => ({
	telemetryClient: {
		capture: (eventName: string, properties?: Record<string, any>) => mockCapture(eventName, properties),
	},
}))

describe("UISettings", () => {
	const defaultProps = {
		reasoningBlockCollapsed: false,
		enterBehavior: "send" as const,
		chatFontSizeMultiplier: 1,
		setCachedStateField: vi.fn(),
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

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

	describe("Chat Font Size Multiplier", () => {
		it("renders the font size input with the correct default value", () => {
			const { getByTestId } = render(<UISettings {...defaultProps} />)
			const input = getByTestId("chat-font-size-input") as HTMLInputElement
			expect(input).toBeTruthy()
			expect(input.value).toBe("1")
		})

		it("renders the reset button", () => {
			const { getByTestId } = render(<UISettings {...defaultProps} />)
			const resetButton = getByTestId("chat-font-size-reset-button")
			expect(resetButton).toBeTruthy()
		})

		it("displays custom multiplier value from props", () => {
			const { getByTestId } = render(<UISettings {...defaultProps} chatFontSizeMultiplier={1.5} />)
			const input = getByTestId("chat-font-size-input") as HTMLInputElement
			expect(input.value).toBe("1.5")
		})

		it("calls setCachedStateField on change with a valid value", () => {
			const setCachedStateField = vi.fn()
			const { getByTestId } = render(<UISettings {...defaultProps} setCachedStateField={setCachedStateField} />)
			const input = getByTestId("chat-font-size-input")

			fireEvent.change(input, { target: { value: "1.5" } })

			expect(setCachedStateField).toHaveBeenCalledWith("chatFontSizeMultiplier", 1.5)
		})

		it("does not call setCachedStateField on change with NaN input", () => {
			const setCachedStateField = vi.fn()
			const { getByTestId } = render(<UISettings {...defaultProps} setCachedStateField={setCachedStateField} />)
			const input = getByTestId("chat-font-size-input")

			fireEvent.change(input, { target: { value: "abc" } })

			expect(setCachedStateField).not.toHaveBeenCalledWith("chatFontSizeMultiplier", expect.anything())
		})

		it("clamps values below 0.5 to 0.5 on change", () => {
			const setCachedStateField = vi.fn()
			const { getByTestId } = render(<UISettings {...defaultProps} setCachedStateField={setCachedStateField} />)
			const input = getByTestId("chat-font-size-input")

			fireEvent.change(input, { target: { value: "0.1" } })

			expect(setCachedStateField).toHaveBeenCalledWith("chatFontSizeMultiplier", 0.5)
		})

		it("clamps values above 2 to 2 on change", () => {
			const setCachedStateField = vi.fn()
			const { getByTestId } = render(<UISettings {...defaultProps} setCachedStateField={setCachedStateField} />)
			const input = getByTestId("chat-font-size-input")

			fireEvent.change(input, { target: { value: "5" } })

			expect(setCachedStateField).toHaveBeenCalledWith("chatFontSizeMultiplier", 2)
		})

		it("normalizes the display value on blur for a valid value", () => {
			const { getByTestId } = render(<UISettings {...defaultProps} />)
			const input = getByTestId("chat-font-size-input") as HTMLInputElement

			fireEvent.change(input, { target: { value: "0.3" } })
			fireEvent.blur(input)

			// Should be clamped to 0.5 in the display
			expect(input.value).toBe("0.5")
		})

		it("resets display value to prop on blur with NaN input", () => {
			const { getByTestId } = render(<UISettings {...defaultProps} chatFontSizeMultiplier={1.2} />)
			const input = getByTestId("chat-font-size-input") as HTMLInputElement

			fireEvent.change(input, { target: { value: "abc" } })
			fireEvent.blur(input)

			// Should reset to the prop value
			expect(input.value).toBe("1.2")
		})

		it("fires telemetry on blur, not on change", () => {
			const { getByTestId } = render(<UISettings {...defaultProps} />)
			const input = getByTestId("chat-font-size-input")

			fireEvent.change(input, { target: { value: "1.5" } })

			// Telemetry should NOT have fired on change
			expect(mockCapture).not.toHaveBeenCalledWith("ui_settings_chat_font_size_changed", expect.anything())

			fireEvent.blur(input)

			// Telemetry should fire on blur with the clamped value
			expect(mockCapture).toHaveBeenCalledWith("ui_settings_chat_font_size_changed", {
				multiplier: 1.5,
			})
		})

		it("does not fire telemetry on blur with NaN input", () => {
			const { getByTestId } = render(<UISettings {...defaultProps} />)
			const input = getByTestId("chat-font-size-input")

			fireEvent.change(input, { target: { value: "abc" } })
			fireEvent.blur(input)

			expect(mockCapture).not.toHaveBeenCalledWith("ui_settings_chat_font_size_changed", expect.anything())
		})

		it("resets font size to 1 when reset button is clicked", () => {
			const setCachedStateField = vi.fn()
			const { getByTestId } = render(
				<UISettings {...defaultProps} chatFontSizeMultiplier={1.5} setCachedStateField={setCachedStateField} />,
			)
			const input = getByTestId("chat-font-size-input") as HTMLInputElement
			const resetButton = getByTestId("chat-font-size-reset-button")

			fireEvent.click(resetButton)

			expect(setCachedStateField).toHaveBeenCalledWith("chatFontSizeMultiplier", 1)
			expect(input.value).toBe("1")
		})

		it("fires reset telemetry when reset button is clicked", () => {
			const { getByTestId } = render(<UISettings {...defaultProps} chatFontSizeMultiplier={1.5} />)
			const resetButton = getByTestId("chat-font-size-reset-button")

			fireEvent.click(resetButton)

			expect(mockCapture).toHaveBeenCalledWith("ui_settings_chat_font_size_reset", {})
		})

		it("syncs local state when chatFontSizeMultiplier prop changes", () => {
			const { getByTestId, rerender } = render(<UISettings {...defaultProps} chatFontSizeMultiplier={1} />)
			const input = getByTestId("chat-font-size-input") as HTMLInputElement
			expect(input.value).toBe("1")

			rerender(<UISettings {...defaultProps} chatFontSizeMultiplier={1.8} />)
			expect(input.value).toBe("1.8")
		})
	})
})
