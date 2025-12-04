import { render, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { UISettings } from "../UISettings"

describe("UISettings", () => {
	const defaultProps = {
		reasoningBlockCollapsed: false,
		maxTasksHomeScreen: 4,
		setCachedStateField: vi.fn(),
	}

	it("renders the collapse thinking checkbox", () => {
		const { getByTestId } = render(<UISettings {...defaultProps} />)
		const checkbox = getByTestId("collapse-thinking-checkbox")
		expect(checkbox).toBeTruthy()
	})

	it("renders the max tasks home screen slider", () => {
		const { getByTestId } = render(<UISettings {...defaultProps} />)
		const slider = getByTestId("max-tasks-home-screen-slider")
		expect(slider).toBeTruthy()
	})

	it("displays the correct initial state for collapse thinking", () => {
		const { getByTestId } = render(<UISettings {...defaultProps} reasoningBlockCollapsed={true} />)
		const checkbox = getByTestId("collapse-thinking-checkbox") as HTMLInputElement
		expect(checkbox.checked).toBe(true)
	})

	it("displays the correct initial value for max tasks", () => {
		const { getByTestId } = render(<UISettings {...defaultProps} maxTasksHomeScreen={10} />)
		const slider = getByTestId("max-tasks-home-screen-slider")
		const thumb = slider.querySelector('[role="slider"]') as HTMLElement
		expect(thumb.getAttribute("aria-valuenow")).toBe("10")
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

	it("updates slider value when maxTasksHomeScreen prop changes", () => {
		const { getByTestId, rerender } = render(<UISettings {...defaultProps} maxTasksHomeScreen={4} />)
		let slider = getByTestId("max-tasks-home-screen-slider")
		let thumb = slider.querySelector('[role="slider"]') as HTMLElement
		expect(thumb.getAttribute("aria-valuenow")).toBe("4")

		rerender(<UISettings {...defaultProps} maxTasksHomeScreen={10} />)
		slider = getByTestId("max-tasks-home-screen-slider")
		thumb = slider.querySelector('[role="slider"]') as HTMLElement
		expect(thumb.getAttribute("aria-valuenow")).toBe("10")
	})
})
