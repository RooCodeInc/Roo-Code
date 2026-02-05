import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { GitCommitButton } from "../GitCommitButton"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, _options?: Record<string, unknown>) => {
			const translations: Record<string, string> = {
				"chat:gitCommit.title": "Git Commit & Push",
				"chat:gitCommit.tooltip": "Git operations",
				"chat:gitCommit.description": "Quick git commands for your changes",
				"chat:gitCommit.commitPush": "Commit & Push",
				"chat:gitCommit.terminal": "Terminal",
				"chat:gitCommit.currentBranch": "Current Branch",
				"chat:gitCommit.quickCommands": "Quick Commands",
				"chat:gitCommit.prompt": "Enter commit message",
				"chat:gitCommit.success": "Changes committed and pushed successfully!",
			}
			return translations[key] || key
		},
	}),
}))

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(() => ({
		currentTask: null,
		settings: {},
		claudeApiConfig: null,
	})),
}))

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

const queryClient = new QueryClient()

describe("GitCommitButton", () => {
	it("renders as a button when not in edit mode", () => {
		render(
			<QueryClientProvider client={queryClient}>
				<GitCommitButton />
			</QueryClientProvider>,
		)
		const button = screen.getByRole("button", { name: /Git operations/i })
		expect(button).toBeInTheDocument()
	})

	it("opens popover and shows content when clicked", async () => {
		render(
			<QueryClientProvider client={queryClient}>
				<GitCommitButton />
			</QueryClientProvider>,
		)
		const button = screen.getByRole("button", { name: /Git operations/i })
		fireEvent.click(button)

		await waitFor(() => {
			expect(screen.getByText("Git Commit & Push")).toBeInTheDocument()
			expect(screen.getByText(/Current Branch/i, { exact: false })).toBeInTheDocument()
			expect(screen.getByText("Quick Commands")).toBeInTheDocument()
			expect(screen.getByText("Commit & Push")).toBeInTheDocument()
			expect(screen.getByText("Terminal")).toBeInTheDocument()
		})
	})

	it("posts gitCommitPush message when Commit & Push is clicked", async () => {
		const { vscode } = await import("@src/utils/vscode")

		render(
			<QueryClientProvider client={queryClient}>
				<GitCommitButton />
			</QueryClientProvider>,
		)
		const button = screen.getByRole("button", { name: /Git operations/i })
		fireEvent.click(button)

		await waitFor(() => {
			const commitPushButton = screen.getByText("Commit & Push")
			fireEvent.click(commitPushButton)
		})

		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "gitCommitPush" })
	})

	it("posts openTerminal message with git status when Terminal is clicked", async () => {
		const { vscode } = await import("@src/utils/vscode")

		render(
			<QueryClientProvider client={queryClient}>
				<GitCommitButton />
			</QueryClientProvider>,
		)
		const button = screen.getByRole("button", { name: /Git operations/i })
		fireEvent.click(button)

		await waitFor(() => {
			const terminalButton = screen.getByText("Terminal")
			fireEvent.click(terminalButton)
		})

		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "openTerminal", text: "git status" })
	})

	it("shows loading state when Commit & Push is clicked", async () => {
		render(
			<QueryClientProvider client={queryClient}>
				<GitCommitButton />
			</QueryClientProvider>,
		)
		const button = screen.getByRole("button", { name: /Git operations/i })
		fireEvent.click(button)

		await waitFor(() => {
			const commitPushButton = screen.getByText("Commit & Push")
			fireEvent.click(commitPushButton)
		})

		// Button should show loading spinner (Loader2)
		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: /Git operations/i }).querySelector(".animate-spin"),
			).toBeInTheDocument()
		})
	})

	it("shows success message when git commit succeeds", async () => {
		render(
			<QueryClientProvider client={queryClient}>
				<GitCommitButton />
			</QueryClientProvider>,
		)
		const button = screen.getByRole("button", { name: /Git operations/i })
		fireEvent.click(button)

		await waitFor(() => {
			const commitPushButton = screen.getByText("Commit & Push")
			fireEvent.click(commitPushButton)
		})

		// Simulate success response from extension
		window.dispatchEvent(
			new MessageEvent("message", {
				data: { type: "gitCommitResult", success: true, text: "Changes committed and pushed successfully!" },
			}),
		)

		await waitFor(() => {
			expect(screen.getByText("Changes committed and pushed successfully!")).toBeInTheDocument()
			expect(
				screen.getByRole("button", { name: /Git operations/i }).querySelector(".animate-spin"),
			).not.toBeInTheDocument()
		})
	})

	it("shows error message when git commit fails", async () => {
		render(
			<QueryClientProvider client={queryClient}>
				<GitCommitButton />
			</QueryClientProvider>,
		)
		const button = screen.getByRole("button", { name: /Git operations/i })
		fireEvent.click(button)

		await waitFor(() => {
			const commitPushButton = screen.getByText("Commit & Push")
			fireEvent.click(commitPushButton)
		})

		// Simulate error response from extension
		window.dispatchEvent(
			new MessageEvent("message", {
				data: { type: "gitCommitResult", success: false, text: "No changes to commit" },
			}),
		)

		await waitFor(() => {
			expect(screen.getByText("No changes to commit")).toBeInTheDocument()
			expect(
				screen.getByRole("button", { name: /Git operations/i }).querySelector(".animate-spin"),
			).not.toBeInTheDocument()
		})
	})
})
