import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import DismissibleUpsell from "../DismissibleUpsell"

// Mock the vscode API
const mockPostMessage = vi.fn()
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: (message: any) => mockPostMessage(message),
	},
}))

describe("DismissibleUpsell", () => {
	beforeEach(() => {
		mockPostMessage.mockClear()
	})

	it("renders children content", () => {
		render(
			<DismissibleUpsell className="test-upsell">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		expect(screen.getByText("Test content")).toBeInTheDocument()
	})

	it("applies the correct variant styles", () => {
		const { container, rerender } = render(
			<DismissibleUpsell className="test-upsell" variant="banner">
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
			<DismissibleUpsell className="test-upsell" variant="default">
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
			<DismissibleUpsell className="test-upsell">
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
			<DismissibleUpsell className="test-upsell" onDismiss={onDismiss}>
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		// Find and click the dismiss button
		const dismissButton = screen.getByRole("button", { name: /dismiss/i })
		fireEvent.click(dismissButton)

		// Check that the component is no longer visible
		await waitFor(() => {
			expect(container.firstChild).toBeNull()
		})

		// Check that the dismiss message was sent
		expect(mockPostMessage).toHaveBeenCalledWith({
			type: "dismissUpsell",
			upsellId: "test-upsell",
		})

		// Check that the callback was called
		expect(onDismiss).toHaveBeenCalled()
	})

	it("hides the upsell if it's in the dismissed list", async () => {
		const { container } = render(
			<DismissibleUpsell className="test-upsell">
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
			<DismissibleUpsell className="test-upsell">
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
			<DismissibleUpsell className="custom-class">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		expect(container.firstChild).toHaveClass("custom-class")
	})

	it("dismiss button has proper accessibility attributes", () => {
		render(
			<DismissibleUpsell className="test-upsell">
				<div>Test content</div>
			</DismissibleUpsell>,
		)

		const dismissButton = screen.getByRole("button", { name: /dismiss/i })
		expect(dismissButton).toHaveAttribute("aria-label", "Dismiss")
		expect(dismissButton).toHaveAttribute("title", "Dismiss and don't show again")
	})
})
