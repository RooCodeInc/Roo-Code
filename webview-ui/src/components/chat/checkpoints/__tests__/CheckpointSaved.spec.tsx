// npx vitest run src/components/chat/checkpoints/__tests__/CheckpointSaved.spec.tsx

// Capture onOpenChange from Popover to control open/close in tests
let lastOnOpenChange: ((open: boolean) => void) | undefined

vi.mock("@/components/ui", () => {
	// Minimal UI primitives to ensure deterministic behavior in tests
	return {
		Button: ({ children, ...rest }: any) => <button {...rest}>{children}</button>,
		StandardTooltip: ({ children }: any) => <>{children}</>,
		Popover: (props: any) => {
			const { children, onOpenChange, open, ...rest } = props
			if (rest["data-testid"] === "restore-popover") {
				lastOnOpenChange = onOpenChange
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

import { render, waitFor, screen, fireEvent } from "@/utils/test-utils"
import React from "react"
import userEvent from "@testing-library/user-event"
import { CheckpointSaved } from "../CheckpointSaved"

const waitForOpenHandler = async () => {
	await waitFor(() => {
		// ensure Popover mock captured the onOpenChange handler before using it
		expect(lastOnOpenChange).toBeTruthy()
	})
}

describe("CheckpointSaved popover visibility", () => {
	// Timers are controlled per-test to avoid interfering with i18n init
	const baseProps = {
		ts: 123,
		commitHash: "abc123",
		currentHash: "zzz999",
		checkpoint: { from: "prev123", to: "abc123" } as Record<string, unknown>,
	}

	it("shows menu while popover is open and hides when closed", async () => {
		const { getByTestId } = render(<CheckpointSaved {...baseProps} />)

		const getMenu = () => getByTestId("checkpoint-menu-container") as HTMLElement

		// Initially hidden (not hovering)
		expect(getMenu()).toBeTruthy()
		expect(getMenu().className).toContain("hidden")

		// Open via captured handler
		await waitForOpenHandler()
		lastOnOpenChange?.(true)

		await waitFor(() => {
			expect(getMenu().className).toContain("block")
			expect(getMenu().className).not.toContain("hidden")
		})

		// Close via captured handler — menu remains visible briefly, then hides
		lastOnOpenChange?.(false)

		await waitFor(() => {
			expect(getMenu().className).toContain("block")
		})

		await waitFor(() => {
			expect(getMenu().className).toContain("hidden")
		})
	})

	it("resets confirm state when popover closes", async () => {
		const { getByTestId, container } = render(<CheckpointSaved {...baseProps} />)
		const getParentDiv = () =>
			container.querySelector("[class*='flex items-center justify-between']") as HTMLElement

		// Hover to make menu visible
		fireEvent.mouseEnter(getParentDiv())

		// Open the popover
		await waitForOpenHandler()
		lastOnOpenChange?.(true)

		// Enter confirm state
		const restoreFilesAndTaskBtn = await waitFor(() => getByTestId("restore-files-and-task-btn"))
		await userEvent.click(restoreFilesAndTaskBtn)

		// Confirm warning should be visible
		expect(getByTestId("checkpoint-confirm-warning")).toBeTruthy()

		// Close popover -> confirm state should reset
		lastOnOpenChange?.(false)

		// Reopen
		lastOnOpenChange?.(true)

		// Confirm warning should be gone after reopening
		await waitFor(() => {
			expect(screen.queryByTestId("checkpoint-confirm-warning")).toBeNull()
		})
	})

	it("closes popover after preview and after confirm restore", async () => {
		const { getByTestId, container } = render(<CheckpointSaved {...baseProps} />)

		const popoverRoot = () => getByTestId("restore-popover")
		const menuContainer = () => getByTestId("checkpoint-menu-container")
		const getParentDiv = () =>
			container.querySelector("[class*='flex items-center justify-between']") as HTMLElement

		// Open
		await waitForOpenHandler()
		lastOnOpenChange?.(true)
		await waitFor(() => {
			expect(popoverRoot().getAttribute("data-open")).toBe("true")
			expect(menuContainer().className).toContain("block")
		})

		// Click preview -> popover closes; menu remains briefly visible, then hides
		await userEvent.click(getByTestId("restore-files-btn"))
		await waitFor(() => {
			expect(popoverRoot().getAttribute("data-open")).toBe("false")
			expect(menuContainer().className).toContain("block")
		})

		// Simulate mouse leaving the component to trigger hide
		fireEvent.mouseLeave(getParentDiv())

		await waitFor(() => {
			expect(menuContainer().className).toContain("hidden")
		})

		// Hover to make menu visible again, then reopen
		fireEvent.mouseEnter(getParentDiv())
		lastOnOpenChange?.(true)
		await waitFor(() => {
			expect(popoverRoot().getAttribute("data-open")).toBe("true")
		})

		// Enter confirm and confirm restore -> popover closes; menu then hides
		await userEvent.click(getByTestId("restore-files-and-task-btn"))
		await userEvent.click(getByTestId("confirm-restore-btn"))
		await waitFor(() => {
			expect(popoverRoot().getAttribute("data-open")).toBe("false")
		})

		// Simulate mouse leaving the component to trigger hide
		fireEvent.mouseLeave(getParentDiv())

		await waitFor(() => {
			expect(menuContainer().className).toContain("hidden")
		})
	})

	it("shows menu on hover and hides when mouse leaves", async () => {
		const { getByTestId, container } = render(<CheckpointSaved {...baseProps} />)

		const getMenu = () => getByTestId("checkpoint-menu-container") as HTMLElement
		const getParentDiv = () =>
			container.querySelector("[class*='flex items-center justify-between']") as HTMLElement

		// Initially hidden (not hovering)
		expect(getMenu().className).toContain("hidden")

		// Hover over the component
		fireEvent.mouseEnter(getParentDiv())
		await waitFor(() => {
			expect(getMenu().className).toContain("block")
			expect(getMenu().className).not.toContain("hidden")
		})

		// Mouse leaves the component
		fireEvent.mouseLeave(getParentDiv())
		await waitFor(() => {
			expect(getMenu().className).toContain("hidden")
		})
	})
})

describe("CheckpointSaved label rendering", () => {
	const baseProps = {
		ts: 123,
		commitHash: "abc123",
		currentHash: "zzz999",
	}

	it("renders initial checkpoint label when isInitial is true", () => {
		const { getByText } = render(
			<CheckpointSaved
				{...baseProps}
				checkpoint={{ from: "abc123", to: "abc123", isInitial: true } as Record<string, unknown>}
			/>,
		)

		// Test uses i18n key since translations may not be loaded in test environment
		expect(getByText("chat:checkpoint.initial")).toBeTruthy()
	})

	it("renders regular checkpoint label when isInitial is false", () => {
		const { getByText } = render(
			<CheckpointSaved
				{...baseProps}
				checkpoint={{ from: "prev123", to: "abc123", isInitial: false } as Record<string, unknown>}
			/>,
		)

		expect(getByText("chat:checkpoint.regular")).toBeTruthy()
	})

	it("renders regular checkpoint label when isInitial is undefined", () => {
		const { getByText } = render(
			<CheckpointSaved
				{...baseProps}
				checkpoint={{ from: "prev123", to: "abc123" } as Record<string, unknown>}
			/>,
		)

		expect(getByText("chat:checkpoint.regular")).toBeTruthy()
	})
})

describe("CheckpointMenu isInitial behavior", () => {
	const baseProps = {
		ts: 123,
		commitHash: "abc123",
		currentHash: "zzz999",
	}

	it("hides View Diff button when isInitial is true", () => {
		const { container } = render(
			<CheckpointSaved
				{...baseProps}
				checkpoint={{ from: "abc123", to: "abc123", isInitial: true } as Record<string, unknown>}
			/>,
		)

		// The View Diff button should not be rendered
		const diffButton = container.querySelector('[aria-label="View Diff"]')
		expect(diffButton).toBeNull()
	})

	it("shows View Diff button when isInitial is false", async () => {
		const { container } = render(
			<CheckpointSaved
				{...baseProps}
				checkpoint={{ from: "prev123", to: "abc123", isInitial: false } as Record<string, unknown>}
			/>,
		)

		// Hover to make menu visible
		const parentDiv = container.querySelector("[class*='flex items-center justify-between']") as HTMLElement
		fireEvent.mouseEnter(parentDiv)

		// The View Diff button should be rendered (using codicon class as identifier)
		await waitFor(() => {
			const diffIcon = container.querySelector(".codicon-diff-single")
			expect(diffIcon).toBeTruthy()
		})
	})

	it("hides View All Changes button when isInitial is true", async () => {
		const { container } = render(
			<CheckpointSaved
				{...baseProps}
				checkpoint={{ from: "abc123", to: "abc123", isInitial: true } as Record<string, unknown>}
			/>,
		)

		// Hover to make menu visible
		const parentDiv = container.querySelector("[class*='flex items-center justify-between']") as HTMLElement
		fireEvent.mouseEnter(parentDiv)

		// Open the "more" popover
		await waitForOpenHandler()

		// The "View All Changes" button with codicon-versions should not be rendered
		const versionsIcon = container.querySelector(".codicon-versions")
		expect(versionsIcon).toBeNull()
	})

	it("shows View Changes Since This Checkpoint regardless of isInitial", async () => {
		const { container } = render(
			<CheckpointSaved
				{...baseProps}
				checkpoint={{ from: "abc123", to: "abc123", isInitial: true } as Record<string, unknown>}
			/>,
		)

		// Hover to make menu visible
		const parentDiv = container.querySelector("[class*='flex items-center justify-between']") as HTMLElement
		fireEvent.mouseEnter(parentDiv)

		// The "View Changes Since This Checkpoint" button with codicon-diff should be present
		await waitFor(() => {
			const diffIcon = container.querySelector(".codicon-diff")
			expect(diffIcon).toBeTruthy()
		})
	})

	it("shows restore options regardless of isInitial", async () => {
		const { getByTestId, container } = render(
			<CheckpointSaved
				{...baseProps}
				checkpoint={{ from: "abc123", to: "abc123", isInitial: true } as Record<string, unknown>}
			/>,
		)

		// Hover to make menu visible
		const parentDiv = container.querySelector("[class*='flex items-center justify-between']") as HTMLElement
		fireEvent.mouseEnter(parentDiv)

		// Open the restore popover
		await waitForOpenHandler()
		lastOnOpenChange?.(true)

		// Restore buttons should be available
		await waitFor(() => {
			expect(getByTestId("restore-files-btn")).toBeTruthy()
			expect(getByTestId("restore-files-and-task-btn")).toBeTruthy()
		})
	})
})
