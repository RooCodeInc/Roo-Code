// npx vitest run src/components/chat/checkpoints/__tests__/InitialCheckpoint.spec.tsx

// Capture onOpenChange from Popover to control open/close in tests
let _lastOnOpenChange: ((open: boolean) => void) | undefined

vi.mock("@/components/ui", () => {
	// Minimal UI primitives to ensure deterministic behavior in tests
	return {
		Button: ({ children, ...rest }: any) => <button {...rest}>{children}</button>,
		StandardTooltip: ({ children }: any) => <>{children}</>,
		Popover: (props: any) => {
			const { children, onOpenChange, open, ...rest } = props
			if (rest["data-testid"] === "restore-popover") {
				_lastOnOpenChange = onOpenChange
			}
			return (
				<div data-testid={rest["data-testid"]} data-open={open}>
					{children}
				</div>
			)
		},
		PopoverTrigger: ({ children }: any) => <div data-testid="popover-trigger">{children}</div>,
		PopoverContent: ({ children, className, ...rest }: any) => (
			<div data-testid="popover-content" className={className} {...rest}>
				{children}
			</div>
		),
	}
})

import { render, screen, fireEvent, waitFor } from "@/utils/test-utils"
import React from "react"
import { InitialCheckpoint } from "../InitialCheckpoint"

describe("InitialCheckpoint", () => {
	beforeEach(() => {
		_lastOnOpenChange = undefined
	})

	describe("visual states", () => {
		it("renders pending state correctly", () => {
			const { getByTestId, getByText } = render(<InitialCheckpoint state="pending" />)

			const container = getByTestId("initial-checkpoint")
			expect(container).toBeTruthy()

			// Should show spinner
			expect(getByTestId("initial-checkpoint-spinner")).toBeTruthy()

			// Should show initializing text
			expect(getByText("chat:checkpoint.initializing")).toBeTruthy()

			// Menu should not be visible
			expect(screen.queryByTestId("initial-checkpoint-menu-container")).toBeNull()
		})

		it("renders ready state correctly", () => {
			const { getByTestId, getByText } = render(<InitialCheckpoint state="ready" hash="abc123" />)

			const container = getByTestId("initial-checkpoint")
			expect(container).toBeTruthy()

			// Should not show spinner
			expect(screen.queryByTestId("initial-checkpoint-spinner")).toBeNull()

			// Should show "Initial State" text
			expect(getByText("chat:checkpoint.initial")).toBeTruthy()

			// Menu container should exist
			expect(getByTestId("initial-checkpoint-menu-container")).toBeTruthy()
		})

		it("renders failed state correctly", () => {
			const { getByTestId, getByText } = render(<InitialCheckpoint state="failed" />)

			const container = getByTestId("initial-checkpoint")
			expect(container).toBeTruthy()

			// Should not show spinner
			expect(screen.queryByTestId("initial-checkpoint-spinner")).toBeNull()

			// Should show failed text
			expect(getByText("chat:checkpoint.failed")).toBeTruthy()

			// Menu should not be visible
			expect(screen.queryByTestId("initial-checkpoint-menu-container")).toBeNull()
		})
	})

	describe("menu visibility in ready state", () => {
		it("hides menu by default when not hovering", () => {
			const { getByTestId } = render(<InitialCheckpoint state="ready" hash="abc123" />)

			const menuContainer = getByTestId("initial-checkpoint-menu-container")
			expect(menuContainer.className).toContain("hidden")
		})

		it("shows menu when hovering", async () => {
			const { getByTestId } = render(<InitialCheckpoint state="ready" hash="abc123" />)

			const container = getByTestId("initial-checkpoint")
			const menuContainer = getByTestId("initial-checkpoint-menu-container")

			// Initially hidden
			expect(menuContainer.className).toContain("hidden")

			// Hover to show menu
			fireEvent.mouseEnter(container)

			await waitFor(() => {
				expect(menuContainer.className).toContain("block")
				expect(menuContainer.className).not.toContain("hidden")
			})

			// Mouse leave to hide menu
			fireEvent.mouseLeave(container)

			await waitFor(() => {
				expect(menuContainer.className).toContain("hidden")
			})
		})
	})

	describe("styling", () => {
		it("applies opacity styling for pending state", () => {
			const { getByTestId } = render(<InitialCheckpoint state="pending" />)

			const container = getByTestId("initial-checkpoint")
			expect(container.className).toContain("opacity-50")
		})

		it("applies opacity styling for failed state", () => {
			const { getByTestId } = render(<InitialCheckpoint state="failed" />)

			const container = getByTestId("initial-checkpoint")
			expect(container.className).toContain("opacity-75")
		})

		it("does not apply opacity for ready state", () => {
			const { getByTestId } = render(<InitialCheckpoint state="ready" hash="abc123" />)

			const container = getByTestId("initial-checkpoint")
			expect(container.className).not.toContain("opacity-50")
			expect(container.className).not.toContain("opacity-75")
		})
	})

	describe("menu not rendered without hash in ready state", () => {
		it("does not render menu when hash is null in ready state", () => {
			render(<InitialCheckpoint state="ready" hash={null} />)

			expect(screen.queryByTestId("initial-checkpoint-menu-container")).toBeNull()
		})

		it("does not render menu when hash is undefined in ready state", () => {
			render(<InitialCheckpoint state="ready" />)

			expect(screen.queryByTestId("initial-checkpoint-menu-container")).toBeNull()
		})
	})
})
