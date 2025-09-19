import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import DismissibleUpsell from "../DismissibleUpsell"
import React from "react"

// Mock the vscode API
const mockPostMessage = vi.fn()
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: (message: any) => mockPostMessage(message),
	},
}))

// Mock the translation hook
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"common:dismiss": "Dismiss",
				"common:dismissAndDontShowAgain": "Dismiss and don't show again",
			}
			return translations[key] || key
		},
	}),
}))

describe("DismissibleUpsell", () => {
	let messageHandler: ((event: MessageEvent) => void) | null = null

	beforeEach(() => {
		mockPostMessage.mockClear()
		vi.clearAllTimers()

		// Capture the message event handler
		window.addEventListener = vi.fn((event, handler) => {
			if (event === "message") {
				messageHandler = handler as (event: MessageEvent) => void
			}
		})

		window.removeEventListener = vi.fn()
	})

	afterEach(() => {
		vi.clearAllTimers()
		messageHandler = null
	})

	// Helper function to make the component visible
	const makeUpsellVisible = () => {
		act(() => {
			messageHandler?.({
				data: {
					type: "dismissedUpsells",
					list: [], // Empty list means no upsells are dismissed
				},
			} as MessageEvent)
		})
	}

	// Helper function to mark upsell as dismissed
	const makeUpsellDismissed = (upsellIds: string[]) => {
		act(() => {
			messageHandler?.({
				data: {
					type: "dismissedUpsells",
					list: upsellIds,
				},
			} as MessageEvent)
		})
	}

	it("renders children content when visible", async () => {
		render(
			<DismissibleUpsell upsellId="test-upsell">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Component starts hidden (loading), make it visible
		makeUpsellVisible()

		// Wait for component to become visible
		await waitFor(() => {
			expect(screen.getByText("Test content")).toBeInTheDocument()
		})
	})

	it("requests dismissed upsells list on mount via context", () => {
		render(
			<DismissibleUpsell upsellId="test-upsell">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		expect(mockPostMessage).toHaveBeenCalledWith({
			type: "getDismissedUpsells",
		})
	})

	it("hides the upsell when dismiss button is clicked", async () => {
		const onDismiss = vi.fn()
		const { container } = render(
			<DismissibleUpsell upsellId="test-upsell" onDismiss={onDismiss}>
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Make component visible first
		makeUpsellVisible()

		// Wait for component to be visible
		await waitFor(() => {
			expect(screen.getByText("Test content")).toBeInTheDocument()
		})

		// Find and click the dismiss button
		const dismissButton = screen.getByRole("button", { name: /dismiss/i })
		fireEvent.click(dismissButton)

		// Check that the dismiss message was sent
		expect(mockPostMessage).toHaveBeenCalledWith({
			type: "dismissUpsell",
			upsellId: "test-upsell",
		})

		// Check that the component is no longer visible
		await waitFor(() => {
			expect(container.firstChild).toBeNull()
		})

		// Check that the callback was called
		expect(onDismiss).toHaveBeenCalled()
	})

	it("hides the upsell if it's in the dismissed list", async () => {
		const { container } = render(
			<DismissibleUpsell upsellId="test-upsell">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Simulate receiving a message that this upsell is dismissed
		makeUpsellDismissed(["test-upsell", "other-upsell"])

		// Check that the component remains hidden
		await waitFor(() => {
			expect(container.firstChild).toBeNull()
		})
	})

	it("remains visible if not in the dismissed list", async () => {
		render(
			<DismissibleUpsell upsellId="test-upsell">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Simulate receiving a message that doesn't include this upsell
		makeUpsellDismissed(["other-upsell"])

		// Check that the component is visible
		await waitFor(() => {
			expect(screen.getByText("Test content")).toBeInTheDocument()
		})
	})

	it("applies the className prop to the container", async () => {
		const { container } = render(
			<DismissibleUpsell upsellId="test-upsell" className="custom-class">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Make component visible
		makeUpsellVisible()

		// Wait for component to be visible
		await waitFor(() => {
			expect(container.firstChild).not.toBeNull()
		})

		expect(container.firstChild).toHaveClass("custom-class")
	})

	it("dismiss button has proper accessibility attributes", async () => {
		render(
			<DismissibleUpsell upsellId="test-upsell">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Make component visible
		makeUpsellVisible()

		// Wait for component to be visible
		await waitFor(() => {
			expect(screen.getByText("Test content")).toBeInTheDocument()
		})

		const dismissButton = screen.getByRole("button", { name: /dismiss/i })
		expect(dismissButton).toHaveAttribute("aria-label", "Dismiss")
		expect(dismissButton).toHaveAttribute("title", "Dismiss and don't show again")
	})

	it("handles multiple rapid dismissals of the same component", async () => {
		const onDismiss = vi.fn()
		render(
			<DismissibleUpsell upsellId="test-upsell" onDismiss={onDismiss}>
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Make component visible
		makeUpsellVisible()

		// Wait for component to be visible
		await waitFor(() => {
			expect(screen.getByText("Test content")).toBeInTheDocument()
		})

		const dismissButton = screen.getByRole("button", { name: /dismiss/i })

		// Click multiple times rapidly
		fireEvent.click(dismissButton)
		fireEvent.click(dismissButton)
		fireEvent.click(dismissButton)

		// Should only send one dismiss message (plus initial getDismissedUpsells)
		const dismissCalls = mockPostMessage.mock.calls.filter(
			(call) => call[0].type === "dismissUpsell" && call[0].upsellId === "test-upsell",
		)
		expect(dismissCalls.length).toBe(1)

		// Callback should only be called once
		expect(onDismiss).toHaveBeenCalledTimes(1)
	})

	it("calls onClick when the container is clicked", async () => {
		const onClick = vi.fn()
		render(
			<DismissibleUpsell upsellId="test-upsell" onClick={onClick}>
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Make component visible
		makeUpsellVisible()

		// Wait for component to be visible
		await waitFor(() => {
			expect(screen.getByText("Test content")).toBeInTheDocument()
		})

		// Click on the container (not the dismiss button)
		const container = screen.getByText("Test content").parentElement as HTMLElement
		fireEvent.click(container)

		expect(onClick).toHaveBeenCalledTimes(1)
	})

	it("does not call onClick when dismiss button is clicked", async () => {
		const onClick = vi.fn()
		const onDismiss = vi.fn()
		render(
			<DismissibleUpsell upsellId="test-upsell" onClick={onClick} onDismiss={onDismiss}>
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Make component visible
		makeUpsellVisible()

		// Wait for component to be visible
		await waitFor(() => {
			expect(screen.getByText("Test content")).toBeInTheDocument()
		})

		// Click the dismiss button
		const dismissButton = screen.getByRole("button", { name: /dismiss/i })
		fireEvent.click(dismissButton)

		// onClick should not be called, but onDismiss should
		expect(onClick).not.toHaveBeenCalled()
		expect(onDismiss).toHaveBeenCalledTimes(1)
	})

	it("adds cursor-pointer class when onClick is provided", async () => {
		const { container, rerender } = render(
			<DismissibleUpsell upsellId="test-upsell" onClick={() => {}}>
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Make component visible
		makeUpsellVisible()

		// Wait for component to be visible
		await waitFor(() => {
			expect(container.firstChild).not.toBeNull()
		})

		// Should have cursor-pointer when onClick is provided
		expect(container.firstChild).toHaveClass("cursor-pointer")

		// Re-render without onClick
		rerender(
			<DismissibleUpsell upsellId="test-upsell">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Make sure it's still visible after re-render
		makeUpsellVisible()

		// Wait for component to be visible again
		await waitFor(() => {
			expect(container.firstChild).not.toBeNull()
		})

		// Should not have cursor-pointer when onClick is not provided
		expect(container.firstChild).not.toHaveClass("cursor-pointer")
	})

	it("handles both onClick and onDismiss independently", async () => {
		const onClick = vi.fn()
		const onDismiss = vi.fn()
		const { container } = render(
			<DismissibleUpsell upsellId="test-upsell" onClick={onClick} onDismiss={onDismiss}>
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Make component visible
		makeUpsellVisible()

		// Wait for component to be visible
		await waitFor(() => {
			expect(screen.getByText("Test content")).toBeInTheDocument()
		})

		// Click on the container
		const containerDiv = screen.getByText("Test content").parentElement as HTMLElement
		fireEvent.click(containerDiv)
		expect(onClick).toHaveBeenCalledTimes(1)
		expect(onDismiss).not.toHaveBeenCalled()

		// Reset mocks
		onClick.mockClear()
		onDismiss.mockClear()

		// Click the dismiss button
		const dismissButton = screen.getByRole("button", { name: /dismiss/i })
		fireEvent.click(dismissButton)

		// Only onDismiss should be called
		expect(onClick).not.toHaveBeenCalled()
		expect(onDismiss).toHaveBeenCalledTimes(1)

		// Component should be hidden after dismiss
		await waitFor(() => {
			expect(container.firstChild).toBeNull()
		})
	})

	it("dismisses when clicked if dismissOnClick is true", async () => {
		const onClick = vi.fn()
		const onDismiss = vi.fn()
		const { container } = render(
			<DismissibleUpsell upsellId="test-upsell" onClick={onClick} onDismiss={onDismiss} dismissOnClick={true}>
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Make component visible
		makeUpsellVisible()

		// Wait for component to be visible
		await waitFor(() => {
			expect(screen.getByText("Test content")).toBeInTheDocument()
		})

		const containerDiv = screen.getByText("Test content").parentElement as HTMLElement
		fireEvent.click(containerDiv)

		expect(onClick).toHaveBeenCalledTimes(1)
		expect(onDismiss).toHaveBeenCalledTimes(1)

		expect(mockPostMessage).toHaveBeenCalledWith({
			type: "dismissUpsell",
			upsellId: "test-upsell",
		})

		await waitFor(() => {
			expect(container.firstChild).toBeNull()
		})
	})

	it("does not dismiss when clicked if dismissOnClick is false", async () => {
		const onClick = vi.fn()
		const onDismiss = vi.fn()
		render(
			<DismissibleUpsell upsellId="test-upsell" onClick={onClick} onDismiss={onDismiss} dismissOnClick={false}>
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Make component visible
		makeUpsellVisible()

		// Wait for component to be visible
		await waitFor(() => {
			expect(screen.getByText("Test content")).toBeInTheDocument()
		})

		const containerDiv = screen.getByText("Test content").parentElement as HTMLElement
		fireEvent.click(containerDiv)

		expect(onClick).toHaveBeenCalledTimes(1)
		expect(onDismiss).not.toHaveBeenCalled()

		// Should not dismiss the upsell
		const dismissCalls = mockPostMessage.mock.calls.filter((call) => call[0].type === "dismissUpsell")
		expect(dismissCalls.length).toBe(0)

		expect(screen.getByText("Test content")).toBeInTheDocument()
	})

	it("does not dismiss when clicked if dismissOnClick is not provided (defaults to false)", async () => {
		const onClick = vi.fn()
		const onDismiss = vi.fn()
		render(
			<DismissibleUpsell upsellId="test-upsell" onClick={onClick} onDismiss={onDismiss}>
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Make component visible
		makeUpsellVisible()

		// Wait for component to be visible
		await waitFor(() => {
			expect(screen.getByText("Test content")).toBeInTheDocument()
		})

		const containerDiv = screen.getByText("Test content").parentElement as HTMLElement
		fireEvent.click(containerDiv)

		expect(onClick).toHaveBeenCalledTimes(1)
		expect(onDismiss).not.toHaveBeenCalled()
		expect(screen.getByText("Test content")).toBeInTheDocument()
	})

	it("renders icon when provided", async () => {
		const TestIcon = () => <span data-testid="test-icon">Icon</span>
		render(
			<DismissibleUpsell upsellId="test-upsell" icon={<TestIcon />}>
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Make component visible
		makeUpsellVisible()

		// Wait for component to be visible
		await waitFor(() => {
			expect(screen.getByText("Test content")).toBeInTheDocument()
			expect(screen.getByTestId("test-icon")).toBeInTheDocument()
		})
	})

	it("applies correct variant classes", async () => {
		const { container, rerender } = render(
			<DismissibleUpsell upsellId="test-upsell" variant="banner">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Make component visible
		makeUpsellVisible()

		// Wait for component to be visible
		await waitFor(() => {
			expect(container.firstChild).not.toBeNull()
		})

		// Should have banner variant classes
		expect(container.firstChild).toHaveClass("bg-vscode-badge-background/80")
		expect(container.firstChild).toHaveClass("text-vscode-badge-foreground")

		// Re-render with default variant
		rerender(
			<DismissibleUpsell upsellId="test-upsell-2" variant="default">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Make the new upsell visible
		makeUpsellVisible()

		// Should have default variant classes
		await waitFor(() => {
			expect(container.firstChild).toHaveClass("bg-vscode-notifications-background")
			expect(container.firstChild).toHaveClass("text-vscode-notifications-foreground")
		})
	})

	it("does not render while context is loading", async () => {
		const { container } = render(
			<DismissibleUpsell upsellId="test-upsell">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Component should not render while loading
		expect(container.firstChild).toBeNull()

		// Send dismissed list to complete loading
		makeUpsellVisible()

		// Now component should be visible
		await waitFor(() => {
			expect(screen.getByText("Test content")).toBeInTheDocument()
		})
	})
})
