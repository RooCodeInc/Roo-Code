import React from "react"
import { render, fireEvent, screen } from "@/utils/test-utils"

import { ToggleSwitch } from "../toggle-switch"

describe("ToggleSwitch", () => {
	it("renders with correct initial state", () => {
		const onChange = vi.fn()
		render(<ToggleSwitch checked={true} onChange={onChange} aria-label="Test toggle" />)

		const toggle = screen.getByRole("switch")
		expect(toggle).toBeInTheDocument()
		expect(toggle).toHaveAttribute("aria-checked", "true")
		expect(toggle).toHaveAttribute("aria-label", "Test toggle")
	})

	it("renders unchecked state correctly", () => {
		const onChange = vi.fn()
		render(<ToggleSwitch checked={false} onChange={onChange} aria-label="Test toggle" />)

		const toggle = screen.getByRole("switch")
		expect(toggle).toHaveAttribute("aria-checked", "false")
	})

	it("calls onChange when clicked", () => {
		const onChange = vi.fn()
		render(<ToggleSwitch checked={false} onChange={onChange} aria-label="Test toggle" />)

		const toggle = screen.getByRole("switch")
		fireEvent.click(toggle)

		expect(onChange).toHaveBeenCalledTimes(1)
	})

	it("calls onChange when Enter key is pressed", () => {
		const onChange = vi.fn()
		render(<ToggleSwitch checked={false} onChange={onChange} aria-label="Test toggle" />)

		const toggle = screen.getByRole("switch")
		fireEvent.keyDown(toggle, { key: "Enter" })

		expect(onChange).toHaveBeenCalledTimes(1)
	})

	it("calls onChange when Space key is pressed", () => {
		const onChange = vi.fn()
		render(<ToggleSwitch checked={false} onChange={onChange} aria-label="Test toggle" />)

		const toggle = screen.getByRole("switch")
		fireEvent.keyDown(toggle, { key: " " })

		expect(onChange).toHaveBeenCalledTimes(1)
	})

	it("does not call onChange when disabled", () => {
		const onChange = vi.fn()
		render(<ToggleSwitch checked={false} onChange={onChange} disabled={true} aria-label="Test toggle" />)

		const toggle = screen.getByRole("switch")
		fireEvent.click(toggle)
		fireEvent.keyDown(toggle, { key: "Enter" })

		expect(onChange).not.toHaveBeenCalled()
	})

	it("is disabled when disabled prop is true", () => {
		const onChange = vi.fn()
		render(<ToggleSwitch checked={false} onChange={onChange} disabled={true} aria-label="Test toggle" />)

		const toggle = screen.getByRole("switch")
		expect(toggle).toBeDisabled()
	})

	it("renders with custom data-testid", () => {
		const onChange = vi.fn()
		render(<ToggleSwitch checked={false} onChange={onChange} data-testid="custom-toggle" />)

		const toggle = screen.getByTestId("custom-toggle")
		expect(toggle).toBeInTheDocument()
	})

	it("supports medium size", () => {
		const onChange = vi.fn()
		render(<ToggleSwitch checked={false} onChange={onChange} size="medium" aria-label="Test toggle" />)

		const toggle = screen.getByRole("switch")
		expect(toggle).toBeInTheDocument()
		// Medium size should be 40px x 22px
		expect(toggle).toHaveStyle({ width: "40px", height: "22px" })
	})

	it("defaults to medium size", () => {
		const onChange = vi.fn()
		render(<ToggleSwitch checked={false} onChange={onChange} aria-label="Test toggle" />)

		const toggle = screen.getByRole("switch")
		expect(toggle).toBeInTheDocument()
		// Default (medium) size should be 40px x 22px
		expect(toggle).toHaveStyle({ width: "40px", height: "22px" })
	})

	it("supports small size", () => {
		const onChange = vi.fn()
		render(<ToggleSwitch checked={false} onChange={onChange} size="small" aria-label="Test toggle" />)

		const toggle = screen.getByRole("switch")
		expect(toggle).toBeInTheDocument()
		// Small size should be 32px x 18px
		expect(toggle).toHaveStyle({ width: "32px", height: "18px" })
	})

	it("supports large size", () => {
		const onChange = vi.fn()
		render(<ToggleSwitch checked={false} onChange={onChange} size="large" aria-label="Test toggle" />)

		const toggle = screen.getByRole("switch")
		expect(toggle).toBeInTheDocument()
		// Large size should be 48px x 26px
		expect(toggle).toHaveStyle({ width: "48px", height: "26px" })
	})
})
