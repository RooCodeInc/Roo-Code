import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { UserPromptNavigation } from "../UserPromptNavigation"
import type { ClineMessage } from "@roo-code/types"
import type { VirtuosoHandle } from "react-virtuoso"

// Mock the translation hook
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, params?: any) => {
			if (key === "chat:promptNavigation.position") {
				return `${params?.current} of ${params?.total}`
			}
			if (key === "chat:promptNavigation.total") {
				return `${params?.total} prompts`
			}
			if (key === "chat:promptNavigation.previousTooltip") {
				return "Jump to previous user prompt"
			}
			if (key === "chat:promptNavigation.nextTooltip") {
				return "Jump to next user prompt"
			}
			return key
		},
	}),
}))

// Mock CSS import
vi.mock("../UserPromptNavigation.css", () => ({}))

// Mock StandardTooltip to avoid TooltipProvider requirement
vi.mock("@src/components/ui", () => ({
	StandardTooltip: ({ children, content }: { children: React.ReactNode; content: string }) => (
		<div title={content}>{children}</div>
	),
}))

// Mock LucideIconButton
vi.mock("../LucideIconButton", () => ({
	LucideIconButton: ({ onClick, disabled, title }: any) => (
		<button onClick={onClick} disabled={disabled} title={title}>
			{title}
		</button>
	),
}))

describe("UserPromptNavigation", () => {
	const mockVirtuosoRef = {
		current: {
			scrollToIndex: vi.fn(),
		} as unknown as VirtuosoHandle,
	}

	const createMessage = (say: string, text: string, ts: number): ClineMessage =>
		({
			type: "say",
			say,
			text,
			ts,
		}) as ClineMessage

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should not render when there are no user prompts", () => {
		const messages: ClineMessage[] = [
			createMessage("text", "AI response", 1000),
			createMessage("api_req_started", "API request", 2000),
		]

		const { container } = render(
			<UserPromptNavigation
				messages={messages}
				virtuosoRef={mockVirtuosoRef as React.RefObject<VirtuosoHandle>}
				visibleMessages={messages}
			/>,
		)

		expect(container.firstChild).toBeNull()
	})

	it("should render navigation buttons when there are user prompts", () => {
		const messages: ClineMessage[] = [
			createMessage("user_feedback", "First prompt", 1000),
			createMessage("text", "AI response", 2000),
			createMessage("user_feedback", "Second prompt", 3000),
		]

		render(
			<UserPromptNavigation
				messages={messages}
				virtuosoRef={mockVirtuosoRef as React.RefObject<VirtuosoHandle>}
				visibleMessages={messages}
			/>,
		)

		// Check for navigation buttons
		expect(screen.getByTitle("chat:promptNavigation.previous")).toBeInTheDocument()
		expect(screen.getByTitle("chat:promptNavigation.next")).toBeInTheDocument()
	})

	it("should navigate to the last prompt when clicking previous for the first time", async () => {
		const messages: ClineMessage[] = [
			createMessage("user_feedback", "First prompt", 1000),
			createMessage("text", "AI response", 2000),
			createMessage("user_feedback", "Second prompt", 3000),
			createMessage("text", "AI response 2", 4000),
			createMessage("user_feedback", "Third prompt", 5000),
		]

		render(
			<UserPromptNavigation
				messages={messages}
				virtuosoRef={mockVirtuosoRef as React.RefObject<VirtuosoHandle>}
				visibleMessages={messages}
			/>,
		)

		const prevButton = screen.getByTitle("chat:promptNavigation.previous")
		fireEvent.click(prevButton)

		await waitFor(() => {
			expect(mockVirtuosoRef.current?.scrollToIndex).toHaveBeenCalledWith({
				index: 4, // Index of the third prompt
				behavior: "smooth",
				align: "center",
			})
		})
	})

	it("should navigate to the first prompt when clicking next for the first time", async () => {
		const messages: ClineMessage[] = [
			createMessage("user_feedback", "First prompt", 1000),
			createMessage("text", "AI response", 2000),
			createMessage("user_feedback", "Second prompt", 3000),
		]

		render(
			<UserPromptNavigation
				messages={messages}
				virtuosoRef={mockVirtuosoRef as React.RefObject<VirtuosoHandle>}
				visibleMessages={messages}
			/>,
		)

		const nextButton = screen.getByTitle("chat:promptNavigation.next")
		fireEvent.click(nextButton)

		await waitFor(() => {
			expect(mockVirtuosoRef.current?.scrollToIndex).toHaveBeenCalledWith({
				index: 0, // Index of the first prompt
				behavior: "smooth",
				align: "center",
			})
		})
	})

	it("should cycle through prompts when navigating multiple times", async () => {
		const messages: ClineMessage[] = [
			createMessage("user_feedback", "First prompt", 1000),
			createMessage("user_feedback", "Second prompt", 2000),
			createMessage("user_feedback", "Third prompt", 3000),
		]

		render(
			<UserPromptNavigation
				messages={messages}
				virtuosoRef={mockVirtuosoRef as React.RefObject<VirtuosoHandle>}
				visibleMessages={messages}
			/>,
		)

		const nextButton = screen.getByTitle("chat:promptNavigation.next")

		// First click - go to first prompt
		fireEvent.click(nextButton)
		await waitFor(() => {
			expect(mockVirtuosoRef.current?.scrollToIndex).toHaveBeenCalledWith({
				index: 0,
				behavior: "smooth",
				align: "center",
			})
		})

		// Wait a bit and click again - should go to second prompt
		await new Promise((resolve) => setTimeout(resolve, 100))
		fireEvent.click(nextButton)
		await waitFor(() => {
			expect(mockVirtuosoRef.current?.scrollToIndex).toHaveBeenCalledWith({
				index: 1,
				behavior: "smooth",
				align: "center",
			})
		})
	})

	it("should filter out empty user prompts", () => {
		const messages: ClineMessage[] = [
			createMessage("user_feedback", "Valid prompt", 1000),
			createMessage("user_feedback", "", 2000), // Empty prompt
			createMessage("user_feedback", "   ", 3000), // Whitespace only
			createMessage("user_feedback", "Another valid prompt", 4000),
		]

		render(
			<UserPromptNavigation
				messages={messages}
				virtuosoRef={mockVirtuosoRef as React.RefObject<VirtuosoHandle>}
				visibleMessages={messages}
			/>,
		)

		const nextButton = screen.getByTitle("chat:promptNavigation.next")
		fireEvent.click(nextButton)

		// Should navigate to first valid prompt (index 0)
		expect(mockVirtuosoRef.current?.scrollToIndex).toHaveBeenCalledWith({
			index: 0,
			behavior: "smooth",
			align: "center",
		})
	})

	it("should show navigation info when navigating", async () => {
		const messages: ClineMessage[] = [
			createMessage("user_feedback", "First prompt", 1000),
			createMessage("user_feedback", "Second prompt", 2000),
		]

		const { container } = render(
			<UserPromptNavigation
				messages={messages}
				virtuosoRef={mockVirtuosoRef as React.RefObject<VirtuosoHandle>}
				visibleMessages={messages}
			/>,
		)

		const nextButton = screen.getByTitle("chat:promptNavigation.next")
		fireEvent.click(nextButton)

		// Should show position info briefly
		await waitFor(() => {
			const info = container.querySelector(".text-xs")
			expect(info?.textContent).toContain("1 of 2")
		})
	})

	it("should have proper tooltips with keyboard shortcuts", () => {
		const messages: ClineMessage[] = [createMessage("user_feedback", "First prompt", 1000)]

		render(
			<UserPromptNavigation
				messages={messages}
				virtuosoRef={mockVirtuosoRef as React.RefObject<VirtuosoHandle>}
				visibleMessages={messages}
			/>,
		)

		// Check for data attributes for keyboard navigation
		expect(document.querySelector('[data-prompt-nav="prev"]')).toBeInTheDocument()
		expect(document.querySelector('[data-prompt-nav="next"]')).toBeInTheDocument()
	})

	it("should apply custom className when provided", () => {
		const messages: ClineMessage[] = [createMessage("user_feedback", "First prompt", 1000)]

		const { container } = render(
			<UserPromptNavigation
				messages={messages}
				virtuosoRef={mockVirtuosoRef as React.RefObject<VirtuosoHandle>}
				visibleMessages={messages}
				className="custom-class"
			/>,
		)

		expect(container.firstChild).toHaveClass("custom-class")
	})
})
