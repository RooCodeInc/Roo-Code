// npx vitest run src/components/chat/__tests__/ChatRow.spec.tsx

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { ChatRowContent } from "../ChatRow"
import type { ClineMessage } from "@roo-code/types"

// Mock the clipboard utility
const mockCopyWithFeedback = vi.fn().mockResolvedValue(true)
vi.mock("@src/utils/clipboard", () => ({
	useCopyToClipboard: () => ({
		copyWithFeedback: mockCopyWithFeedback,
	}),
}))

// Mock the extension state context
vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		mcpServers: [],
		alwaysAllowMcp: false,
		currentCheckpoint: null,
		mode: "code",
	}),
}))

// Mock the translation hook
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"chat:error": "Error",
				"chat:diffError.title": "Edit Unsuccessful",
			}
			return translations[key] || key
		},
	}),
	Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	initReactI18next: {
		type: "3rdParty",
		init: () => {},
	},
}))

// Mock vscode API
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock CodeBlock component to avoid Tooltip issues
vi.mock("../../common/CodeBlock", () => ({
	default: ({ source }: { source: string }) => <pre>{source}</pre>,
}))

describe("ChatRow Error Display", () => {
	const mockOnToggleExpand = vi.fn()
	const mockOnSuggestionClick = vi.fn()
	const mockOnBatchFileResponse = vi.fn()
	const mockOnFollowUpUnmount = vi.fn()

	const baseProps = {
		isExpanded: false,
		isLast: false,
		isStreaming: false,
		onToggleExpand: mockOnToggleExpand,
		onSuggestionClick: mockOnSuggestionClick,
		onBatchFileResponse: mockOnBatchFileResponse,
		onFollowUpUnmount: mockOnFollowUpUnmount,
		isFollowUpAnswered: false,
		editable: false,
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Error Message Display", () => {
		it("should render error message with collapsible section", () => {
			const errorMessage: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "error",
				text: "This is an error message",
			}

			render(<ChatRowContent {...baseProps} message={errorMessage} />)

			// Check that warning icon is present (matching diff_error style)
			const warningIcon = document.querySelector(".codicon-warning")
			expect(warningIcon).toBeTruthy()

			// Check that error title is present
			expect(screen.getByText("Error")).toBeTruthy()

			// Check that error text is NOT visible by default (collapsed)
			expect(screen.queryByText("This is an error message")).toBeFalsy()

			// Check that chevron-down icon is present (collapsed state)
			const chevronDown = document.querySelector(".codicon-chevron-down")
			expect(chevronDown).toBeTruthy()

			// Check that copy button is present
			const copyButton = document.querySelector(".codicon-copy")
			expect(copyButton).toBeTruthy()
		})

		it("should toggle error message visibility when clicked", () => {
			const errorMessage: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "error",
				text: "This is a collapsible error",
			}

			render(<ChatRowContent {...baseProps} message={errorMessage} />)

			// Initially collapsed - chevron should be down
			let chevron = document.querySelector(".codicon-chevron-down")
			expect(chevron).toBeTruthy()
			expect(screen.queryByText("This is a collapsible error")).toBeFalsy()

			// Click to expand
			const header = screen.getByText("Error").closest("div")?.parentElement
			if (header) {
				fireEvent.click(header)
			}

			// After expand - chevron should be up and text visible
			chevron = document.querySelector(".codicon-chevron-up")
			expect(chevron).toBeTruthy()

			// The text is now in a CodeBlock (pre element) due to matching diff_error
			const codeBlock = document.querySelector("pre")
			expect(codeBlock?.textContent).toBe("This is a collapsible error")

			// Click to collapse again
			if (header) {
				fireEvent.click(header)
			}

			// Should be collapsed again
			chevron = document.querySelector(".codicon-chevron-down")
			expect(chevron).toBeTruthy()
			expect(document.querySelector("pre")).toBeFalsy()
		})

		it("should handle copy button click for error messages", async () => {
			const errorMessage: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "error",
				text: "Error to copy",
			}

			render(<ChatRowContent {...baseProps} message={errorMessage} />)

			// Find and click copy button (VSCodeButton component)
			const copyIcon = document.querySelector(".codicon-copy")
			expect(copyIcon).toBeTruthy()

			// Click on the VSCodeButton which contains the copy icon
			const vscodeButton = copyIcon?.closest("vscode-button")
			expect(vscodeButton).toBeTruthy()

			if (vscodeButton) {
				fireEvent.click(vscodeButton)
			}

			// Verify copy function was called with correct text
			await waitFor(() => {
				expect(mockCopyWithFeedback).toHaveBeenCalledWith("Error to copy")
			})
		})

		it("should show check icon after successful copy", async () => {
			const errorMessage: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "error",
				text: "Error to copy with feedback",
			}

			render(<ChatRowContent {...baseProps} message={errorMessage} />)

			// Initially should show copy icon
			const copyIcon = document.querySelector(".codicon-copy")
			expect(copyIcon).toBeTruthy()

			// Click copy button (VSCodeButton component)
			const vscodeButton = copyIcon?.closest("vscode-button")
			if (vscodeButton) {
				fireEvent.click(vscodeButton)
			}

			// Should show check icon after successful copy
			await waitFor(() => {
				const checkIcon = document.querySelector(".codicon-check")
				expect(checkIcon).toBeTruthy()
			})
		})

		it("should handle empty error text gracefully", () => {
			const errorMessage: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "error",
				text: "",
			}

			render(<ChatRowContent {...baseProps} message={errorMessage} />)

			// Should still render the collapsible structure
			expect(screen.getByText("Error")).toBeTruthy()
			const copyButton = document.querySelector(".codicon-copy")
			expect(copyButton).toBeTruthy()
		})

		it("should handle null error text gracefully", () => {
			const errorMessage: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "error",
				text: null as any,
			}

			render(<ChatRowContent {...baseProps} message={errorMessage} />)

			// Should still render the collapsible structure
			expect(screen.getByText("Error")).toBeTruthy()
			const copyButton = document.querySelector(".codicon-copy")
			expect(copyButton).toBeTruthy()
		})

		it("should use warning icon with warning color", () => {
			const errorMessage: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "error",
				text: "Styled error message",
			}

			render(<ChatRowContent {...baseProps} message={errorMessage} />)

			// Check that warning icon is present with warning color class
			const warningIcon = document.querySelector(".codicon-warning")
			expect(warningIcon).toBeTruthy()
			// Check that the warning icon has the correct Tailwind class
			expect(warningIcon?.classList.contains("text-vscode-editorWarning-foreground")).toBeTruthy()
		})

		it("should display custom title when provided", () => {
			const errorMessage: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "error",
				text: "This is a custom error",
				title: "File Not Found",
			}

			render(<ChatRowContent {...baseProps} message={errorMessage} />)

			// Custom title should be visible
			expect(screen.getByText("File Not Found")).toBeTruthy()
			// Default "Error" title should not be visible
			expect(screen.queryByText("Error")).toBeFalsy()
		})

		it("should fall back to default 'Error' title when custom title is not provided", () => {
			const errorMessage: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "error",
				text: "This is a default error",
				// No title field provided
			}

			render(<ChatRowContent {...baseProps} message={errorMessage} />)

			// Default "Error" title should be visible
			expect(screen.getByText("Error")).toBeTruthy()
		})

		it("should handle empty custom title by falling back to default", () => {
			const errorMessage: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "error",
				text: "Error with empty title",
				title: "", // Empty title
			}

			render(<ChatRowContent {...baseProps} message={errorMessage} />)

			// Should fall back to default "Error" title
			expect(screen.getByText("Error")).toBeTruthy()
		})

		it("should display custom title with special characters correctly", () => {
			const errorMessage: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "error",
				text: "Special character error",
				title: "Error: File 'test.ts' not found!",
			}

			render(<ChatRowContent {...baseProps} message={errorMessage} />)

			// Custom title with special characters should be visible
			expect(screen.getByText("Error: File 'test.ts' not found!")).toBeTruthy()
		})
	})

	describe("Diff Error Display", () => {
		it("should render diff_error with collapsible section", () => {
			const diffErrorMessage: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "diff_error",
				text: "<error>Diff application failed</error>",
			}

			render(<ChatRowContent {...baseProps} message={diffErrorMessage} />)

			// Check that warning icon is present
			const warningIcon = document.querySelector(".codicon-warning")
			expect(warningIcon).toBeTruthy()

			// Check that diff error title is present
			expect(screen.getByText("Edit Unsuccessful")).toBeTruthy()

			// Check that copy button is present
			const copyButton = document.querySelector(".codicon-copy")
			expect(copyButton).toBeTruthy()

			// Should be collapsed by default for diff_error
			const chevronDown = document.querySelector(".codicon-chevron-down")
			expect(chevronDown).toBeTruthy()
		})

		it("should toggle diff_error visibility when clicked", () => {
			const diffErrorMessage: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "diff_error",
				text: "<error>Diff content</error>",
			}

			render(<ChatRowContent {...baseProps} message={diffErrorMessage} />)

			// Initially collapsed
			let chevron = document.querySelector(".codicon-chevron-down")
			expect(chevron).toBeTruthy()

			// Click to expand
			const header = screen.getByText("Edit Unsuccessful").closest("div")?.parentElement
			if (header) {
				fireEvent.click(header)
			}

			// Should be expanded
			chevron = document.querySelector(".codicon-chevron-up")
			expect(chevron).toBeTruthy()
		})
	})

	describe("Consistency Between Error Types", () => {
		it("should have similar structure for error and diff_error", () => {
			const errorMessage: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "error",
				text: "Regular error",
			}

			const { container: errorContainer } = render(<ChatRowContent {...baseProps} message={errorMessage} />)

			// Both should have collapsible structure
			const errorChevron = errorContainer.querySelector(".codicon-chevron-up, .codicon-chevron-down")
			expect(errorChevron).toBeTruthy()

			// Both should have copy button
			const errorCopyButton = errorContainer.querySelector(".codicon-copy")
			expect(errorCopyButton).toBeTruthy()

			// Clean up
			errorContainer.remove()

			const diffErrorMessage: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "diff_error",
				text: "Diff error",
			}

			const { container: diffErrorContainer } = render(
				<ChatRowContent {...baseProps} message={diffErrorMessage} />,
			)

			const diffErrorChevron = diffErrorContainer.querySelector(".codicon-chevron-up, .codicon-chevron-down")
			expect(diffErrorChevron).toBeTruthy()

			const diffErrorCopyButton = diffErrorContainer.querySelector(".codicon-copy")
			expect(diffErrorCopyButton).toBeTruthy()
		})

		it("should handle multi-line error messages", () => {
			const multiLineError: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "error",
				text: "Line 1\nLine 2\nLine 3\nLine 4",
			}

			render(<ChatRowContent {...baseProps} message={multiLineError} />)

			// Should render as collapsible
			const chevron = document.querySelector(".codicon-chevron-up, .codicon-chevron-down")
			expect(chevron).toBeTruthy()

			// Should have copy button
			const copyButton = document.querySelector(".codicon-copy")
			expect(copyButton).toBeTruthy()

			// Click to expand
			const header = screen.getByText("Error").closest("div")?.parentElement
			if (header) {
				fireEvent.click(header)
			}

			// Text should be visible when expanded (in CodeBlock/pre element)
			const codeBlock = document.querySelector("pre")
			expect(codeBlock).toBeTruthy()
			expect(codeBlock?.textContent).toBe("Line 1\nLine 2\nLine 3\nLine 4")
		})

		it("should handle very long single-line error messages", () => {
			const longError: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "error",
				text: "A".repeat(300), // 300 character error
			}

			render(<ChatRowContent {...baseProps} message={longError} />)

			// Should render as collapsible
			const chevron = document.querySelector(".codicon-chevron-up, .codicon-chevron-down")
			expect(chevron).toBeTruthy()

			// Should have copy button
			const copyButton = document.querySelector(".codicon-copy")
			expect(copyButton).toBeTruthy()
		})
	})
})
