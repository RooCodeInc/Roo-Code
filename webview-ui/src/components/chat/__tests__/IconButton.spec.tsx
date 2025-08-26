import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { IconButton } from "../IconButton"
import { TooltipProvider } from "@/components/ui/tooltip"
import { STANDARD_TOOLTIP_DELAY } from "@/components/ui/standard-tooltip"

describe("IconButton", () => {
	const renderWithProvider = (ui: React.ReactElement) => {
		return render(<TooltipProvider delayDuration={STANDARD_TOOLTIP_DELAY}>{ui}</TooltipProvider>)
	}

	it("should render button with icon", () => {
		renderWithProvider(<IconButton iconClass="codicon-settings-gear" title="Settings" onClick={() => {}} />)

		const button = screen.getByRole("button", { name: "Settings" })
		expect(button).toBeInTheDocument()

		const icon = button.querySelector(".codicon-settings-gear")
		expect(icon).toBeInTheDocument()
	})

	it("should not show tooltip immediately on render", () => {
		renderWithProvider(<IconButton iconClass="codicon-settings-gear" title="Settings" onClick={() => {}} />)

		// The tooltip content should not be visible immediately
		// There should be no tooltip role element visible
		const tooltips = screen.queryAllByRole("tooltip")
		expect(tooltips).toHaveLength(0)
	})

	it("should show tooltip on hover after delay", async () => {
		const user = userEvent.setup()

		renderWithProvider(<IconButton iconClass="codicon-settings-gear" title="Settings" onClick={() => {}} />)

		const button = screen.getByRole("button", { name: "Settings" })

		// Initially no tooltip
		expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

		// Hover over the button
		await user.hover(button)

		// Wait for tooltip to appear after delay
		await waitFor(
			() => {
				expect(screen.getByRole("tooltip")).toHaveTextContent("Settings")
			},
			{ timeout: STANDARD_TOOLTIP_DELAY + 100 },
		)
	})

	it("should handle click events", async () => {
		const user = userEvent.setup()
		const handleClick = vi.fn()

		renderWithProvider(<IconButton iconClass="codicon-settings-gear" title="Settings" onClick={handleClick} />)

		const button = screen.getByRole("button", { name: "Settings" })
		await user.click(button)

		expect(handleClick).toHaveBeenCalledTimes(1)
	})

	it("should not trigger click when disabled", async () => {
		const user = userEvent.setup()
		const handleClick = vi.fn()

		renderWithProvider(
			<IconButton iconClass="codicon-settings-gear" title="Settings" onClick={handleClick} disabled />,
		)

		const button = screen.getByRole("button", { name: "Settings" })
		expect(button).toBeDisabled()

		await user.click(button)
		expect(handleClick).not.toHaveBeenCalled()
	})

	it("should show loading spinner when isLoading is true", () => {
		renderWithProvider(
			<IconButton iconClass="codicon-settings-gear" title="Settings" onClick={() => {}} isLoading />,
		)

		const button = screen.getByRole("button", { name: "Settings" })
		const icon = button.querySelector(".codicon-settings-gear")

		expect(icon).toHaveClass("codicon-modifier-spin")
	})
})
