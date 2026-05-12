// npx vitest run src/components/__tests__/LoadingView.spec.tsx

import React from "react"
import { render, screen, act } from "@testing-library/react"
import LoadingView from "../LoadingView"

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"common:ui.initializing": "Initializing...",
				"common:ui.retry_connection": "Retry Connection",
				"common:ui.connection_failed":
					"Unable to connect to the extension host. Click the button below to retry.",
			}
			return translations[key] ?? key
		},
	}),
}))

describe("LoadingView", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("renders a spinner and initializing text", () => {
		render(<LoadingView />)
		expect(screen.getByText("Initializing...")).toBeInTheDocument()
	})

	it("does not show retry button initially", () => {
		render(<LoadingView />)
		expect(screen.queryByText("Retry Connection")).not.toBeInTheDocument()
	})

	it("retries webviewDidLaunch after timeout", async () => {
		const { vscode } = await import("@src/utils/vscode")
		render(<LoadingView />)

		// Advance past the first retry interval (5s)
		act(() => {
			vi.advanceTimersByTime(5_000)
		})

		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "webviewDidLaunch" })
	})

	it("shows retry button after max retries", async () => {
		render(<LoadingView />)

		// Advance through all 3 retries (5s each) + one more to trigger the button
		for (let i = 0; i < 4; i++) {
			act(() => {
				vi.advanceTimersByTime(5_000)
			})
		}

		expect(screen.getByText("Retry Connection")).toBeInTheDocument()
		expect(
			screen.getByText("Unable to connect to the extension host. Click the button below to retry."),
		).toBeInTheDocument()
	})

	it("allows manual retry when button is clicked", async () => {
		const { vscode } = await import("@src/utils/vscode")
		render(<LoadingView />)

		// Advance through all retries to show the button
		for (let i = 0; i < 4; i++) {
			act(() => {
				vi.advanceTimersByTime(5_000)
			})
		}

		const calls = (vscode.postMessage as ReturnType<typeof vi.fn>).mock.calls.length

		const retryButton = screen.getByText("Retry Connection")
		act(() => {
			retryButton.click()
		})

		// Should have sent another webviewDidLaunch
		expect((vscode.postMessage as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(calls)
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "webviewDidLaunch" })

		// Should go back to showing the spinner
		expect(screen.getByText("Initializing...")).toBeInTheDocument()
	})
})
