import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import DismissibleUpsell from "../DismissibleUpsell"

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
	beforeEach(() => {
		mockPostMessage.mockClear()
		vi.clearAllTimers()
	})

	afterEach(() => {
		vi.clearAllTimers()
	})

	it("renders children content", () => {
		render(
			<DismissibleUpsell id="test-upsell">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		expect(screen.getByText("Test content")).toBeInTheDocument()
	})

	it("applies the correct variant styles", () => {
		const { container, rerender } = render(
			<DismissibleUpsell id="test-upsell" variant="banner">
				<div>Banner content</div>
			</DismissibleUpsell>,
		)

		// Check banner variant has correct background color style
		const bannerContainer = container.firstChild
		expect(bannerContainer).toHaveStyle({
			backgroundColor: "var(--vscode-button-background)",
			color: "var(--vscode-button-foreground)",
		})

		// Re-render with default variant
		rerender(
			<DismissibleUpsell id="test-upsell" variant="default">
				<div>Default content</div>
			</DismissibleUpsell>,
		)

		const defaultContainer = container.firstChild
		expect(defaultContainer).toHaveStyle({
			backgroundColor: "var(--vscode-notifications-background)",
			color: "var(--vscode-notifications-foreground)",
		})
	})

	it("requests dismissed upsells list on mount", () => {
		render(
			<DismissibleUpsell id="test-upsell">
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
			<DismissibleUpsell id="test-upsell" onDismiss={onDismiss}>
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Find and click the dismiss button
		const dismissButton = screen.getByRole("button", { name: /dismiss/i })
		fireEvent.click(dismissButton)

		// Check that the dismiss message was sent BEFORE hiding
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
			<DismissibleUpsell id="test-upsell">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Simulate receiving a message that this upsell is dismissed
		const messageEvent = new MessageEvent("message", {
			data: {
				type: "dismissedUpsells",
				list: ["test-upsell", "other-upsell"],
			},
		})
		window.dispatchEvent(messageEvent)

		// Check that the component is no longer visible
		await waitFor(() => {
			expect(container.firstChild).toBeNull()
		})
	})

	it("remains visible if not in the dismissed list", async () => {
		render(
			<DismissibleUpsell id="test-upsell">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Simulate receiving a message that doesn't include this upsell
		const messageEvent = new MessageEvent("message", {
			data: {
				type: "dismissedUpsells",
				list: ["other-upsell"],
			},
		})
		window.dispatchEvent(messageEvent)

		// Check that the component is still visible
		await waitFor(() => {
			expect(screen.getByText("Test content")).toBeInTheDocument()
		})
	})

	it("applies the className prop to the container", () => {
		const { container } = render(
			<DismissibleUpsell id="test-upsell" className="custom-class">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		expect(container.firstChild).toHaveClass("custom-class")
	})

	it("dismiss button has proper accessibility attributes", () => {
		render(
			<DismissibleUpsell id="test-upsell">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		const dismissButton = screen.getByRole("button", { name: /dismiss/i })
		expect(dismissButton).toHaveAttribute("aria-label", "Dismiss")
		expect(dismissButton).toHaveAttribute("title", "Dismiss and don't show again")
	})

	// New edge case tests
	it("handles multiple rapid dismissals of the same component", async () => {
		const onDismiss = vi.fn()
		render(
			<DismissibleUpsell id="test-upsell" onDismiss={onDismiss}>
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		const dismissButton = screen.getByRole("button", { name: /dismiss/i })

		// Click multiple times rapidly
		fireEvent.click(dismissButton)
		fireEvent.click(dismissButton)
		fireEvent.click(dismissButton)

		// Should only send one message
		expect(mockPostMessage).toHaveBeenCalledTimes(2) // 1 for getDismissedUpsells, 1 for dismissUpsell
		expect(mockPostMessage).toHaveBeenCalledWith({
			type: "dismissUpsell",
			upsellId: "test-upsell",
		})

		// Callback should only be called once
		expect(onDismiss).toHaveBeenCalledTimes(1)
	})

	it("does not update state after component unmounts", async () => {
		const { unmount } = render(
			<DismissibleUpsell id="test-upsell">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Unmount the component
		unmount()

		// Simulate receiving a message after unmount
		const messageEvent = new MessageEvent("message", {
			data: {
				type: "dismissedUpsells",
				list: ["test-upsell"],
			},
		})

		// This should not cause any errors
		act(() => {
			window.dispatchEvent(messageEvent)
		})

		// No errors should be thrown
		expect(true).toBe(true)
	})

	it("handles invalid/malformed messages gracefully", () => {
		render(
			<DismissibleUpsell id="test-upsell">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Send various malformed messages
		const malformedMessages = [
			{ type: "dismissedUpsells", list: null },
			{ type: "dismissedUpsells", list: "not-an-array" },
			{ type: "dismissedUpsells" }, // missing list
			{ type: "wrongType", list: ["test-upsell"] },
			null,
			undefined,
			"string-message",
		]

		malformedMessages.forEach((data) => {
			const messageEvent = new MessageEvent("message", { data })
			window.dispatchEvent(messageEvent)
		})

		// Component should still be visible
		expect(screen.getByText("Test content")).toBeInTheDocument()
	})

	it("ensures message is sent before component unmounts on dismiss", async () => {
		const { unmount } = render(
			<DismissibleUpsell id="test-upsell">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		const dismissButton = screen.getByRole("button", { name: /dismiss/i })
		fireEvent.click(dismissButton)

		// Message should be sent immediately
		expect(mockPostMessage).toHaveBeenCalledWith({
			type: "dismissUpsell",
			upsellId: "test-upsell",
		})

		// Unmount immediately after clicking
		unmount()

		// Message was already sent before unmount
		expect(mockPostMessage).toHaveBeenCalledWith({
			type: "dismissUpsell",
			upsellId: "test-upsell",
		})
	})

	it("uses separate id and className props correctly", () => {
		const { container } = render(
			<DismissibleUpsell id="unique-id" className="styling-class">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// className should be applied to the container
		expect(container.firstChild).toHaveClass("styling-class")

		// When dismissed, should use the id, not className
		const dismissButton = screen.getByRole("button", { name: /dismiss/i })
		fireEvent.click(dismissButton)

		expect(mockPostMessage).toHaveBeenCalledWith({
			type: "dismissUpsell",
			upsellId: "unique-id",
		})
	})
})
