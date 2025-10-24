import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { KangarooEasterEgg } from "../KangarooEasterEgg"

describe("KangarooEasterEgg", () => {
	const mockOnClose = vi.fn()

	beforeEach(() => {
		mockOnClose.mockClear()
	})

	it("renders the kangaroo emoji", () => {
		render(<KangarooEasterEgg onClose={mockOnClose} />)
		expect(screen.getByText("🦘")).toBeInTheDocument()
	})

	it("displays a joke setup immediately", () => {
		render(<KangarooEasterEgg onClose={mockOnClose} />)
		// Check that some joke setup text is present (we don't know which random one)
		const jokeSetups = [
			"Why don't kangaroos make good dancers?",
			"What do you call a lazy kangaroo?",
			"What's a kangaroo's favorite year?",
			"Why did the kangaroo stop drinking coffee?",
			"What do you call a kangaroo at the North Pole?",
		]
		const hasSetup = jokeSetups.some((setup) => {
			try {
				screen.getByText(setup)
				return true
			} catch {
				return false
			}
		})
		expect(hasSetup).toBe(true)
	})

	it("displays the punchline after a delay", async () => {
		render(<KangarooEasterEgg onClose={mockOnClose} />)

		// Punchline should appear after 1.5 seconds
		await waitFor(
			() => {
				const punchlines = [
					"Because they have two left feet!",
					"A pouch potato!",
					"Leap year!",
					"It made him too jumpy!",
					"Lost!",
				]
				const hasPunchline = punchlines.some((punchline) => {
					try {
						screen.getByText(punchline)
						return true
					} catch {
						return false
					}
				})
				expect(hasPunchline).toBe(true)
			},
			{ timeout: 2000 },
		)
	})

	it("displays the Easter egg message", () => {
		render(<KangarooEasterEgg onClose={mockOnClose} />)
		expect(screen.getByText("You found the Roo Code Easter egg!")).toBeInTheDocument()
	})

	it("calls onClose when close button is clicked", async () => {
		const user = userEvent.setup()
		render(<KangarooEasterEgg onClose={mockOnClose} />)

		const closeButton = screen.getByRole("button", { name: /close/i })
		await user.click(closeButton)

		expect(mockOnClose).toHaveBeenCalledTimes(1)
	})

	it("calls onClose when clicking the backdrop", async () => {
		const user = userEvent.setup()
		const { container } = render(<KangarooEasterEgg onClose={mockOnClose} />)

		// Click on the backdrop (the fixed div with the blur)
		const backdrop = container.firstChild as HTMLElement
		await user.click(backdrop)

		expect(mockOnClose).toHaveBeenCalledTimes(1)
	})

	it("does not close when clicking inside the dialog", async () => {
		const user = userEvent.setup()
		render(<KangarooEasterEgg onClose={mockOnClose} />)

		// Click on the kangaroo emoji (inside the dialog)
		const emoji = screen.getByText("🦘")
		await user.click(emoji)

		expect(mockOnClose).not.toHaveBeenCalled()
	})
})
