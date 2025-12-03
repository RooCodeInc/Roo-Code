import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"

import type { ClineMessage, ContextCondense, ContextTruncation } from "@roo-code/types"
import { isContextManagementEvent, CONTEXT_MANAGEMENT_EVENTS, assertNever } from "@roo-code/types"

import { ContextManagementRow, isContextManagementMessage } from "../context-management"

// Mock the translation hook
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			const translations: Record<string, string> = {
				"chat:contextCondense.title": "Context Condensed",
				"chat:contextCondense.condensing": "Condensing context...",
				"chat:contextCondense.errorHeader": "Failed to condense context",
				"chat:contextManagement.truncating": "Truncating context...",
				"chat:contextManagement.truncation.title": "Context Truncated",
				"chat:contextManagement.truncation.previousTokens": "Previous token count",
				"chat:contextManagement.truncation.description":
					"Older messages were removed from the conversation to stay within the context window limit.",
				tokens: "tokens",
			}

			// Handle pluralization
			if (key === "chat:contextManagement.truncation.messagesRemoved" && options?.count !== undefined) {
				const count = options.count as number
				return count === 1 ? `${count} message removed` : `${count} messages removed`
			}

			return translations[key] || key
		},
	}),
}))

// Mock the Markdown component
vi.mock("../Markdown", () => ({
	Markdown: ({ markdown }: { markdown: string }) => <div data-testid="markdown">{markdown}</div>,
}))

// Mock the ProgressIndicator component
vi.mock("../ProgressIndicator", () => ({
	ProgressIndicator: () => <div data-testid="progress-indicator">Loading...</div>,
}))

describe("Context Management Types", () => {
	describe("CONTEXT_MANAGEMENT_EVENTS", () => {
		it("should contain all expected event types", () => {
			expect(CONTEXT_MANAGEMENT_EVENTS).toContain("condense_context")
			expect(CONTEXT_MANAGEMENT_EVENTS).toContain("condense_context_error")
			expect(CONTEXT_MANAGEMENT_EVENTS).toContain("sliding_window_truncation")
			expect(CONTEXT_MANAGEMENT_EVENTS).toHaveLength(3)
		})
	})

	describe("isContextManagementEvent", () => {
		it("should return true for valid context management events", () => {
			expect(isContextManagementEvent("condense_context")).toBe(true)
			expect(isContextManagementEvent("condense_context_error")).toBe(true)
			expect(isContextManagementEvent("sliding_window_truncation")).toBe(true)
		})

		it("should return false for non-context-management events", () => {
			expect(isContextManagementEvent("text")).toBe(false)
			expect(isContextManagementEvent("error")).toBe(false)
			expect(isContextManagementEvent("api_req_started")).toBe(false)
			expect(isContextManagementEvent(null)).toBe(false)
			expect(isContextManagementEvent(undefined)).toBe(false)
			expect(isContextManagementEvent(123)).toBe(false)
		})
	})

	describe("assertNever", () => {
		it("should throw an error when called", () => {
			// This tests the exhaustiveness helper
			expect(() => assertNever("unexpected_value" as never)).toThrow(
				'Unhandled context management event: "unexpected_value"',
			)
		})
	})
})

describe("isContextManagementMessage", () => {
	it("should return true for condense_context messages", () => {
		const message: ClineMessage = {
			ts: Date.now(),
			type: "say",
			say: "condense_context",
		}
		expect(isContextManagementMessage(message)).toBe(true)
	})

	it("should return true for condense_context_error messages", () => {
		const message: ClineMessage = {
			ts: Date.now(),
			type: "say",
			say: "condense_context_error",
		}
		expect(isContextManagementMessage(message)).toBe(true)
	})

	it("should return true for sliding_window_truncation messages", () => {
		const message: ClineMessage = {
			ts: Date.now(),
			type: "say",
			say: "sliding_window_truncation",
		}
		expect(isContextManagementMessage(message)).toBe(true)
	})

	it("should return false for non-context-management say messages", () => {
		const message: ClineMessage = {
			ts: Date.now(),
			type: "say",
			say: "text",
		}
		expect(isContextManagementMessage(message)).toBe(false)
	})

	it("should return false for ask messages", () => {
		const message: ClineMessage = {
			ts: Date.now(),
			type: "ask",
			ask: "followup",
		}
		expect(isContextManagementMessage(message)).toBe(false)
	})
})

describe("ContextManagementRow", () => {
	describe("condense_context - in progress", () => {
		it("should render progress indicator for partial condensation", () => {
			const message: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "condense_context",
				partial: true,
			}

			render(<ContextManagementRow message={message} />)

			expect(screen.getByTestId("progress-indicator")).toBeInTheDocument()
			expect(screen.getByText("Condensing context...")).toBeInTheDocument()
		})
	})

	describe("condense_context - completed", () => {
		it("should render condensation result with token reduction", () => {
			const contextCondense: ContextCondense = {
				cost: 0.05,
				prevContextTokens: 50000,
				newContextTokens: 10000,
				summary: "This is the condensed summary of the conversation.",
			}

			const message: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "condense_context",
				partial: false,
				contextCondense,
			}

			render(<ContextManagementRow message={message} />)

			expect(screen.getByText("Context Condensed")).toBeInTheDocument()
			expect(screen.getByText(/50,000/)).toBeInTheDocument()
			expect(screen.getByText(/10,000/)).toBeInTheDocument()
			expect(screen.getByText("$0.05")).toBeInTheDocument()
		})

		it("should expand to show summary on click", () => {
			const contextCondense: ContextCondense = {
				cost: 0.02,
				prevContextTokens: 30000,
				newContextTokens: 8000,
				summary: "Condensed conversation summary goes here.",
			}

			const message: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "condense_context",
				partial: false,
				contextCondense,
			}

			render(<ContextManagementRow message={message} />)

			// Summary should not be visible initially
			expect(screen.queryByTestId("markdown")).not.toBeInTheDocument()

			// Click to expand
			const row = screen.getByText("Context Condensed").parentElement?.parentElement
			fireEvent.click(row!)

			// Summary should now be visible
			expect(screen.getByTestId("markdown")).toBeInTheDocument()
			expect(screen.getByText("Condensed conversation summary goes here.")).toBeInTheDocument()
		})

		it("should handle missing contextCondense data gracefully", () => {
			const message: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "condense_context",
				partial: false,
				// No contextCondense data
			}

			const { container } = render(<ContextManagementRow message={message} />)
			expect(container.firstChild).toBeNull()
		})

		it("should handle zero cost gracefully", () => {
			const contextCondense: ContextCondense = {
				cost: 0,
				prevContextTokens: 20000,
				newContextTokens: 5000,
				summary: "Summary",
			}

			const message: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "condense_context",
				partial: false,
				contextCondense,
			}

			render(<ContextManagementRow message={message} />)

			// Cost badge should have opacity-0 class when cost is 0
			const badge = screen.getByText("$0.00")
			expect(badge).toHaveClass("opacity-0")
		})
	})

	describe("condense_context_error", () => {
		it("should render error message", () => {
			const message: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "condense_context_error",
				text: "API request failed due to rate limiting",
			}

			render(<ContextManagementRow message={message} />)

			expect(screen.getByText("Failed to condense context")).toBeInTheDocument()
			expect(screen.getByText("API request failed due to rate limiting")).toBeInTheDocument()
		})

		it("should render with warning icon", () => {
			const message: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "condense_context_error",
				text: "Error message",
			}

			render(<ContextManagementRow message={message} />)

			const warningIcon = document.querySelector(".codicon-warning")
			expect(warningIcon).toBeInTheDocument()
		})

		it("should handle missing error text", () => {
			const message: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "condense_context_error",
				// No text
			}

			render(<ContextManagementRow message={message} />)

			expect(screen.getByText("Failed to condense context")).toBeInTheDocument()
		})
	})

	describe("sliding_window_truncation", () => {
		it("should render truncation result with token counts in header", () => {
			const contextTruncation: ContextTruncation = {
				truncationId: "trunc-123",
				messagesRemoved: 5,
				prevContextTokens: 100000,
				newContextTokens: 75000,
			}

			const message: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "sliding_window_truncation",
				contextTruncation,
			}

			render(<ContextManagementRow message={message} />)

			expect(screen.getByText("Context Truncated")).toBeInTheDocument()
			// Token counts should be in header
			expect(screen.getByText(/100,000/)).toBeInTheDocument()
			expect(screen.getByText(/75,000/)).toBeInTheDocument()
		})

		it("should show messages removed in expanded section", () => {
			const contextTruncation: ContextTruncation = {
				truncationId: "trunc-456",
				messagesRemoved: 1,
				prevContextTokens: 80000,
				newContextTokens: 60000,
			}

			const message: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "sliding_window_truncation",
				contextTruncation,
			}

			render(<ContextManagementRow message={message} />)

			// Messages removed should not be visible initially (in expanded section)
			expect(screen.queryByText("1 message removed")).not.toBeInTheDocument()

			// Click to expand
			const row = screen.getByText("Context Truncated").parentElement?.parentElement
			fireEvent.click(row!)

			// Messages removed should now be visible
			expect(screen.getByText("1 message removed")).toBeInTheDocument()
		})

		it("should expand to show details on click", () => {
			const contextTruncation: ContextTruncation = {
				truncationId: "trunc-789",
				messagesRemoved: 10,
				prevContextTokens: 150000,
				newContextTokens: 120000,
			}

			const message: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "sliding_window_truncation",
				contextTruncation,
			}

			render(<ContextManagementRow message={message} />)

			// Messages removed should not be visible initially (in expanded section)
			expect(screen.queryByText("10 messages removed")).not.toBeInTheDocument()

			// Click to expand
			const row = screen.getByText("Context Truncated").parentElement?.parentElement
			fireEvent.click(row!)

			// Details should now be visible - messages removed and description
			expect(screen.getByText("10 messages removed")).toBeInTheDocument()
			expect(
				screen.getByText(
					"Older messages were removed from the conversation to stay within the context window limit.",
				),
			).toBeInTheDocument()
		})

		it("should handle missing contextTruncation data gracefully", () => {
			const message: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "sliding_window_truncation",
				// No contextTruncation data
			}

			const { container } = render(<ContextManagementRow message={message} />)
			expect(container.firstChild).toBeNull()
		})

		it("should render fold icon for truncation", () => {
			const contextTruncation: ContextTruncation = {
				truncationId: "trunc-abc",
				messagesRemoved: 3,
				prevContextTokens: 60000,
				newContextTokens: 45000,
			}

			const message: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "sliding_window_truncation",
				contextTruncation,
			}

			render(<ContextManagementRow message={message} />)

			const foldIcon = document.querySelector(".codicon-fold")
			expect(foldIcon).toBeInTheDocument()
		})
	})

	describe("non-context-management messages", () => {
		it("should return null for non-context-management say messages", () => {
			const message: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Hello world",
			}

			const { container } = render(<ContextManagementRow message={message} />)
			expect(container.firstChild).toBeNull()
		})

		it("should return null for ask messages", () => {
			const message: ClineMessage = {
				ts: Date.now(),
				type: "ask",
				ask: "followup",
			}

			const { container } = render(<ContextManagementRow message={message} />)
			expect(container.firstChild).toBeNull()
		})
	})

	describe("exhaustiveness", () => {
		it("should handle all context management event types", () => {
			// This test ensures that all event types in CONTEXT_MANAGEMENT_EVENTS
			// are handled by the ContextManagementRow component
			const eventTypes = CONTEXT_MANAGEMENT_EVENTS

			for (const eventType of eventTypes) {
				const message: ClineMessage = {
					ts: Date.now(),
					type: "say",
					say: eventType,
					// Add required data based on event type
					...(eventType === "condense_context" && {
						contextCondense: {
							cost: 0.01,
							prevContextTokens: 1000,
							newContextTokens: 500,
							summary: "Test",
						},
					}),
					...(eventType === "condense_context_error" && {
						text: "Error",
					}),
					...(eventType === "sliding_window_truncation" && {
						contextTruncation: {
							truncationId: "test",
							messagesRemoved: 1,
							prevContextTokens: 1000,
							newContextTokens: 800,
						},
					}),
				}

				// Should not throw
				expect(() => render(<ContextManagementRow message={message} />)).not.toThrow()
			}
		})
	})
})
