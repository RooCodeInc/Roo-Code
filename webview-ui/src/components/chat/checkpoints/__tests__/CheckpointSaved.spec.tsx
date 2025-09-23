// npx vitest run src/components/chat/checkpoints/__tests__/CheckpointSaved.spec.tsx

import { render, waitFor } from "@/utils/test-utils"
import React from "react"
import { CheckpointSaved } from "../CheckpointSaved"

// Capture onOpenChange from Popover to control open/close in tests
let lastOnOpenChange: ((open: boolean) => void) | undefined

vi.mock("@/components/ui", async () => {
	const actual = await vi.importActual<any>("@/components/ui")
	return {
		...actual,
		Popover: ({
			children,
			onOpenChange,
			open,
		}: {
			children: React.ReactNode
			open?: boolean
			onOpenChange?: (open: boolean) => void
		}) => {
			lastOnOpenChange = onOpenChange
			return (
				<div data-testid="popover-root" data-open={open}>
					{children}
				</div>
			)
		},
		PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
			<div data-testid="popover-trigger">{children}</div>
		),
		PopoverContent: ({ children }: { children: React.ReactNode }) => (
			<div data-testid="popover-content">{children}</div>
		),
	}
})

describe("CheckpointSaved popover visibility", () => {
	const baseProps = {
		ts: 123,
		commitHash: "abc123",
		currentHash: "zzz999",
		checkpoint: { from: "prev123", to: "abc123" } as Record<string, unknown>,
	}

	it("shows menu while popover is open and hides when closed", async () => {
		const { container } = render(<CheckpointSaved {...baseProps} />)

		const getMenu = () => container.querySelector("div.h-4.-mt-2") as HTMLElement

		// Initially hidden (relies on group-hover)
		expect(getMenu()).toBeTruthy()
		expect(getMenu().className).toContain("hidden")

		// Open via captured handler
		lastOnOpenChange?.(true)

		await waitFor(() => {
			expect(getMenu().className).toContain("block")
			expect(getMenu().className).not.toContain("hidden")
		})

		// Close via captured handler
		lastOnOpenChange?.(false)

		await waitFor(() => {
			expect(getMenu().className).toContain("hidden")
		})
	})
})
