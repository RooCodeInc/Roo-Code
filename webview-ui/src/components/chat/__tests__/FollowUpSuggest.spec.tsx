import React, { createContext, useContext } from "react"
import { render, screen, act, fireEvent } from "@testing-library/react"
import { TooltipProvider } from "@radix-ui/react-tooltip"

import { FollowUpSuggest } from "../FollowUpSuggest"
import {
	setFollowUpInteractionInstrumentationSink,
	type FollowUpInteractionMarker,
} from "../followUpInteractionInstrumentation"

// Mock the translation hook
vi.mock("@src/i18n/TranslationContext", () => ({
	TranslationProvider: ({ children }: { children: React.ReactNode }) => children,
	useAppTranslation: () => ({
		t: (key: string, options?: any) => {
			if (key === "chat:followUpSuggest.countdownDisplay" && options?.count !== undefined) {
				return `${options.count}s`
			}
			if (key === "chat:followUpSuggest.copyToInput") {
				return "Copy to input"
			}
			if (key === "chat:followUpSuggest.timerPrefix" && options?.seconds !== undefined) {
				return "Auto-approve enabled. Selecting in " + options.seconds + "s…"
			}

			return key
		},
	}),
}))

// Test-specific extension state context that only provides the values needed by FollowUpSuggest
interface TestExtensionState {
	autoApprovalEnabled: boolean
	alwaysAllowFollowupQuestions: boolean
	followupAutoApproveTimeoutMs: number
}

const TestExtensionStateContext = createContext<TestExtensionState | undefined>(undefined)

// Mock the useExtensionState hook to use our test context
vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => {
		const context = useContext(TestExtensionStateContext)
		if (!context) {
			throw new Error("useExtensionState must be used within TestExtensionStateProvider")
		}
		return context
	},
}))

// Test provider that only provides the specific values needed by FollowUpSuggest
const TestExtensionStateProvider: React.FC<{
	children: React.ReactNode
	value: TestExtensionState
}> = ({ children, value }) => {
	return <TestExtensionStateContext.Provider value={value}>{children}</TestExtensionStateContext.Provider>
}

// Helper function to render component with test providers
const renderWithTestProviders = (component: React.ReactElement, extensionState: TestExtensionState) => {
	return render(
		<TestExtensionStateProvider value={extensionState}>
			<TooltipProvider>{component}</TooltipProvider>
		</TestExtensionStateProvider>,
	)
}

describe("FollowUpSuggest", () => {
	const mockSuggestions = [{ answer: "First suggestion" }, { answer: "Second suggestion" }]

	const mockOnSuggestionClick = vi.fn()
	const mockOnCancelAutoApproval = vi.fn()

	// Default test state with auto-approval enabled
	const defaultTestState: TestExtensionState = {
		autoApprovalEnabled: true,
		alwaysAllowFollowupQuestions: true,
		followupAutoApproveTimeoutMs: 3000, // 3 seconds for testing
	}

	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		setFollowUpInteractionInstrumentationSink(undefined)
	})

	it("should display countdown timer when auto-approval is enabled", () => {
		renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
			/>,
			defaultTestState,
		)

		// Should countdown and mention
		expect(screen.getByText(/3s/)).toBeInTheDocument()
		expect(screen.getByText(/Selecting in 3s/)).toBeInTheDocument()
	})

	it("should not display countdown timer when isAnswered is true", () => {
		renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
				isAnswered={true}
			/>,
			defaultTestState,
		)

		// Should not show countdown
		expect(screen.queryByText(/\d+s/)).not.toBeInTheDocument()
	})

	it("should clear interval and call onCancelAutoApproval when component unmounts", () => {
		const { unmount } = renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
			/>,
			defaultTestState,
		)

		// Unmount the component
		unmount()

		// onCancelAutoApproval should have been called
		expect(mockOnCancelAutoApproval).toHaveBeenCalled()
	})

	it("should not show countdown when auto-approval is disabled", () => {
		const testState: TestExtensionState = {
			...defaultTestState,
			autoApprovalEnabled: false,
		}

		renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
			/>,
			testState,
		)

		// Should not show countdown
		expect(screen.queryByText(/\d+s/)).not.toBeInTheDocument()
	})

	it("should not show countdown when alwaysAllowFollowupQuestions is false", () => {
		const testState: TestExtensionState = {
			...defaultTestState,
			alwaysAllowFollowupQuestions: false,
		}

		renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
			/>,
			testState,
		)

		// Should not show countdown
		expect(screen.queryByText(/\d+s/)).not.toBeInTheDocument()
	})

	it("should use custom timeout value from extension state", () => {
		const testState: TestExtensionState = {
			...defaultTestState,
			followupAutoApproveTimeoutMs: 5000, // 5 seconds
		}

		renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
			/>,
			testState,
		)

		// Should show initial countdown (5 seconds)
		expect(screen.getByText(/5s/)).toBeInTheDocument()
	})

	it("should render suggestions without countdown when both auto-approval settings are disabled", () => {
		const testState: TestExtensionState = {
			autoApprovalEnabled: false,
			alwaysAllowFollowupQuestions: false,
			followupAutoApproveTimeoutMs: 3000,
		}

		renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
			/>,
			testState,
		)

		// Should render suggestions
		expect(screen.getByText("First suggestion")).toBeInTheDocument()
		expect(screen.getByText("Second suggestion")).toBeInTheDocument()

		// Should not show countdown
		expect(screen.queryByText(/\d+s/)).not.toBeInTheDocument()
	})

	it("should not render when no suggestions are provided", () => {
		const { container } = renderWithTestProviders(
			<FollowUpSuggest
				suggestions={[]}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
			/>,
			defaultTestState,
		)

		// Component should not render anything
		expect(container.firstChild).toBeNull()
	})

	it("should not render when onSuggestionClick is not provided", () => {
		const { container } = renderWithTestProviders(
			<FollowUpSuggest suggestions={mockSuggestions} ts={123} onCancelAutoApproval={mockOnCancelAutoApproval} />,
			defaultTestState,
		)

		// Component should not render anything
		expect(container.firstChild).toBeNull()
	})

	it("should stop countdown when user manually responds (isAnswered becomes true)", () => {
		const { rerender } = renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
				isAnswered={false}
			/>,
			defaultTestState,
		)

		// Initially should show countdown
		expect(screen.getByText(/3s/)).toBeInTheDocument()

		// Simulate user manually responding by setting isAnswered to true
		rerender(
			<TestExtensionStateProvider value={defaultTestState}>
				<TooltipProvider>
					<FollowUpSuggest
						suggestions={mockSuggestions}
						onSuggestionClick={mockOnSuggestionClick}
						ts={123}
						onCancelAutoApproval={mockOnCancelAutoApproval}
						isAnswered={true}
					/>
				</TooltipProvider>
			</TestExtensionStateProvider>,
		)

		// Countdown should no longer be visible immediately after isAnswered becomes true
		expect(screen.queryByText(/\d+s/)).not.toBeInTheDocument()

		// Advance timer to ensure countdown doesn't restart or continue
		vi.advanceTimersByTime(5000)

		// onSuggestionClick should not have been called (auto-selection stopped)
		expect(mockOnSuggestionClick).not.toHaveBeenCalled()

		// Countdown should still not be visible
		expect(screen.queryByText(/\d+s/)).not.toBeInTheDocument()

		// Verify onCancelAutoApproval was called when the countdown was stopped
		expect(mockOnCancelAutoApproval).toHaveBeenCalled()
	})

	it("should hide follow-up controls immediately after accepting a suggestion", () => {
		renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
				isAnswered={false}
			/>,
			defaultTestState,
		)

		const firstSuggestionButton = screen.getByRole("button", { name: "First suggestion" })
		fireEvent.click(firstSuggestionButton)

		expect(mockOnSuggestionClick).toHaveBeenCalledWith(mockSuggestions[0], expect.any(Object))
		expect(mockOnCancelAutoApproval).toHaveBeenCalled()

		// Terminal follow-up state should remove actionable controls on the next render cycle.
		expect(screen.queryByRole("button", { name: "First suggestion" })).not.toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "Second suggestion" })).not.toBeInTheDocument()
		expect(screen.queryByText(/Selecting in \d+s/)).not.toBeInTheDocument()
	})

	it("emits deterministic click instrumentation marker when a suggestion is clicked", () => {
		const markers: FollowUpInteractionMarker[] = []
		setFollowUpInteractionInstrumentationSink((marker) => {
			markers.push(marker)
		})

		renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
				isAnswered={false}
			/>,
			defaultTestState,
		)

		const firstSuggestionButton = screen.getByRole("button", { name: "First suggestion" })
		fireEvent.click(firstSuggestionButton)

		expect(markers).toHaveLength(1)
		expect(markers[0]).toMatchObject({
			stage: "click",
			followUpTs: 123,
			source: "follow_up_suggest",
		})
		expect(typeof markers[0].atMs).toBe("number")
	})

	it("prevents duplicate non-shift clicks from re-firing handler and instrumentation after terminal transition", () => {
		const markers: FollowUpInteractionMarker[] = []
		setFollowUpInteractionInstrumentationSink((marker) => {
			markers.push(marker)
		})

		renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
				isAnswered={false}
			/>,
			defaultTestState,
		)

		const firstSuggestionButton = screen.getByRole("button", { name: "First suggestion" })

		fireEvent.click(firstSuggestionButton)
		// Immediate second click before React commit should be blocked by followUpTerminalRef.
		fireEvent.click(firstSuggestionButton)

		expect(mockOnSuggestionClick).toHaveBeenCalledTimes(1)
		expect(mockOnCancelAutoApproval).toHaveBeenCalled()
		expect(markers.map((marker) => marker.stage)).toEqual(["click"])
		expect(markers[0]).toMatchObject({
			followUpTs: 123,
			source: "follow_up_suggest",
		})
	})

	/**
	 * Verifies state-machine style suppression when a second suggestion click is attempted
	 * before the first click's terminal transition has fully committed to the DOM.
	 */
	it("rejects rapid cross-suggestion clicks while pending, allowing only the first dispatch", () => {
		const markers: FollowUpInteractionMarker[] = []
		setFollowUpInteractionInstrumentationSink((marker) => {
			markers.push(marker)
		})

		renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
				isAnswered={false}
			/>,
			defaultTestState,
		)

		const firstSuggestionButton = screen.getByRole("button", { name: "First suggestion" })
		const secondSuggestionButton = screen.getByRole("button", { name: "Second suggestion" })

		fireEvent.click(firstSuggestionButton)
		// Attempt a competing click against another option in the same interaction turn.
		fireEvent.click(secondSuggestionButton)

		expect(mockOnSuggestionClick).toHaveBeenCalledTimes(1)
		expect(mockOnSuggestionClick).toHaveBeenCalledWith(mockSuggestions[0], expect.any(Object))
		expect(markers.map((marker) => marker.stage)).toEqual(["click"])
		expect(screen.queryByRole("button", { name: "First suggestion" })).not.toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "Second suggestion" })).not.toBeInTheDocument()
	})

	it("keeps follow-up actionable for shift-click copy behavior, then transitions terminal on normal click", () => {
		const markers: FollowUpInteractionMarker[] = []
		setFollowUpInteractionInstrumentationSink((marker) => {
			markers.push(marker)
		})

		renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
				isAnswered={false}
			/>,
			defaultTestState,
		)

		const firstSuggestionButton = screen.getByRole("button", { name: "First suggestion" })

		fireEvent.click(firstSuggestionButton, { shiftKey: true })

		expect(mockOnSuggestionClick).toHaveBeenCalledTimes(1)
		expect(mockOnSuggestionClick).toHaveBeenNthCalledWith(
			1,
			mockSuggestions[0],
			expect.objectContaining({ shiftKey: true }),
		)
		// Shift-click should not terminalize the follow-up controls.
		expect(screen.getByRole("button", { name: "First suggestion" })).toBeInTheDocument()

		fireEvent.click(screen.getByRole("button", { name: "First suggestion" }))

		expect(mockOnSuggestionClick).toHaveBeenCalledTimes(2)
		expect(mockOnSuggestionClick).toHaveBeenNthCalledWith(
			2,
			mockSuggestions[0],
			expect.objectContaining({ shiftKey: false }),
		)
		expect(screen.queryByRole("button", { name: "First suggestion" })).not.toBeInTheDocument()
		expect(markers.map((marker) => marker.stage)).toEqual(["click", "click"])
	})

	/**
	 * Ensures once terminalized, rerenders cannot regress the component back to an actionable state.
	 * This guards against invalid/out-of-order lifecycle progression under parent rerenders.
	 */
	it("accepts only forward follow-up lifecycle progression under rerender pressure", () => {
		const markers: FollowUpInteractionMarker[] = []
		setFollowUpInteractionInstrumentationSink((marker) => {
			markers.push(marker)
		})

		const { rerender } = renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
				isAnswered={false}
			/>,
			defaultTestState,
		)

		const firstSuggestionButton = screen.getByRole("button", { name: "First suggestion" })
		fireEvent.click(firstSuggestionButton)

		expect(mockOnSuggestionClick).toHaveBeenCalledTimes(1)
		expect(markers.map((marker) => marker.stage)).toEqual(["click"])
		expect(screen.queryByRole("button", { name: "First suggestion" })).not.toBeInTheDocument()

		const rerenderSequence: boolean[] = [false, true, false]
		for (const isAnswered of rerenderSequence) {
			rerender(
				<TestExtensionStateProvider value={defaultTestState}>
					<TooltipProvider>
						<FollowUpSuggest
							suggestions={mockSuggestions}
							onSuggestionClick={mockOnSuggestionClick}
							ts={123}
							onCancelAutoApproval={mockOnCancelAutoApproval}
							isAnswered={isAnswered}
						/>
					</TooltipProvider>
				</TestExtensionStateProvider>,
			)

			expect(screen.queryByRole("button", { name: "First suggestion" })).not.toBeInTheDocument()
			expect(screen.queryByRole("button", { name: "Second suggestion" })).not.toBeInTheDocument()
		}

		expect(mockOnSuggestionClick).toHaveBeenCalledTimes(1)
	})

	it("keeps answered state forward-only for a single follow-up interaction even if parent rerenders isAnswered out-of-order", () => {
		const markers: FollowUpInteractionMarker[] = []
		setFollowUpInteractionInstrumentationSink((marker) => {
			markers.push(marker)
		})

		const { rerender } = renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
				isAnswered={true}
			/>,
			defaultTestState,
		)

		expect(screen.queryByRole("button", { name: "First suggestion" })).not.toBeInTheDocument()

		rerender(
			<TestExtensionStateProvider value={defaultTestState}>
				<TooltipProvider>
					<FollowUpSuggest
						suggestions={mockSuggestions}
						onSuggestionClick={mockOnSuggestionClick}
						ts={123}
						onCancelAutoApproval={mockOnCancelAutoApproval}
						isAnswered={false}
					/>
				</TooltipProvider>
			</TestExtensionStateProvider>,
		)

		expect(screen.queryByRole("button", { name: "First suggestion" })).not.toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "Second suggestion" })).not.toBeInTheDocument()
		expect(markers).toHaveLength(0)
		expect(mockOnSuggestionClick).not.toHaveBeenCalled()
	})

	it("allows deterministic retry on remount without stale disabled or hidden controls", () => {
		const markers: FollowUpInteractionMarker[] = []
		setFollowUpInteractionInstrumentationSink((marker) => {
			markers.push(marker)
		})

		const firstRender = renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
				isAnswered={false}
			/>,
			defaultTestState,
		)

		fireEvent.click(screen.getByRole("button", { name: "First suggestion" }))

		expect(mockOnSuggestionClick).toHaveBeenCalledTimes(1)
		expect(screen.queryByRole("button", { name: "First suggestion" })).not.toBeInTheDocument()

		firstRender.unmount()

		renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={456}
				onCancelAutoApproval={mockOnCancelAutoApproval}
				isAnswered={false}
			/>,
			defaultTestState,
		)

		const retryButton = screen.getByRole("button", { name: "First suggestion" })
		expect(retryButton).toBeEnabled()

		fireEvent.click(retryButton)

		expect(mockOnSuggestionClick).toHaveBeenCalledTimes(2)
		expect(markers.map((marker) => marker.stage)).toEqual(["click", "click"])
		expect(markers.map((marker) => marker.followUpTs)).toEqual([123, 456])
	})

	it("should handle race condition when timeout fires but user has already responded", () => {
		// This test simulates the scenario where:
		// 1. Auto-approval countdown starts
		// 2. User manually responds (isAnswered becomes true)
		// 3. The timeout still fires (because it was already scheduled)
		// 4. The auto-selection should NOT happen because user already responded

		const { rerender } = renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
				isAnswered={false}
			/>,
			defaultTestState,
		)

		// Initially should show countdown
		expect(screen.getByText(/3s/)).toBeInTheDocument()

		// Advance timer to just before timeout completes (2.5 seconds)
		vi.advanceTimersByTime(2500)

		// User manually responds before timeout completes
		rerender(
			<TestExtensionStateProvider value={defaultTestState}>
				<TooltipProvider>
					<FollowUpSuggest
						suggestions={mockSuggestions}
						onSuggestionClick={mockOnSuggestionClick}
						ts={123}
						onCancelAutoApproval={mockOnCancelAutoApproval}
						isAnswered={true}
					/>
				</TooltipProvider>
			</TestExtensionStateProvider>,
		)

		// Countdown should be hidden immediately
		expect(screen.queryByText(/\d+s/)).not.toBeInTheDocument()

		// Now advance timer past the original timeout duration
		vi.advanceTimersByTime(1000) // Total: 3.5 seconds

		// onSuggestionClick should NOT have been called
		// This verifies the fix for the race condition
		expect(mockOnSuggestionClick).not.toHaveBeenCalled()
	})

	it("should update countdown display as time progresses", async () => {
		renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
				isAnswered={false}
			/>,
			defaultTestState,
		)

		// Initially should show 3s
		expect(screen.getByText(/3s/)).toBeInTheDocument()

		// Advance timer by 1 second and wait for React to update
		await act(async () => {
			vi.advanceTimersByTime(1000)
		})

		// Check countdown updated to 2s
		expect(screen.getByText(/2s/)).toBeInTheDocument()

		// Advance timer by another second
		await act(async () => {
			vi.advanceTimersByTime(1000)
		})

		// Check countdown updated to 1s
		expect(screen.getByText(/1s/)).toBeInTheDocument()

		// Advance timer to completion - countdown should disappear
		await act(async () => {
			vi.advanceTimersByTime(1000)
		})

		// Countdown should no longer be visible after reaching 0
		expect(screen.queryByText(/\d+s/)).not.toBeInTheDocument()

		// The component itself doesn't trigger auto-selection, that's handled by ChatView
		expect(mockOnSuggestionClick).not.toHaveBeenCalled()
	})

	it("should handle component unmounting during countdown", () => {
		const { unmount } = renderWithTestProviders(
			<FollowUpSuggest
				suggestions={mockSuggestions}
				onSuggestionClick={mockOnSuggestionClick}
				ts={123}
				onCancelAutoApproval={mockOnCancelAutoApproval}
				isAnswered={false}
			/>,
			defaultTestState,
		)

		// Initially should show countdown
		expect(screen.getByText(/3s/)).toBeInTheDocument()

		// Advance timer partially
		vi.advanceTimersByTime(1500)

		// Unmount component before countdown completes
		unmount()

		// onCancelAutoApproval should have been called
		expect(mockOnCancelAutoApproval).toHaveBeenCalled()

		// Advance timer past the original timeout
		vi.advanceTimersByTime(2000)

		// onSuggestionClick should NOT have been called (component doesn't auto-select)
		expect(mockOnSuggestionClick).not.toHaveBeenCalled()
	})

	describe("isFollowUpAutoApprovalPaused prop", () => {
		it("should not display countdown timer when isFollowUpAutoApprovalPaused is true", () => {
			renderWithTestProviders(
				<FollowUpSuggest
					suggestions={mockSuggestions}
					onSuggestionClick={mockOnSuggestionClick}
					ts={123}
					onCancelAutoApproval={mockOnCancelAutoApproval}
					isFollowUpAutoApprovalPaused={true}
				/>,
				defaultTestState,
			)

			// Should not show countdown when user is typing
			expect(screen.queryByText(/\d+s/)).not.toBeInTheDocument()
		})

		it("should stop countdown when user starts typing (isFollowUpAutoApprovalPaused becomes true)", () => {
			const { rerender } = renderWithTestProviders(
				<FollowUpSuggest
					suggestions={mockSuggestions}
					onSuggestionClick={mockOnSuggestionClick}
					ts={123}
					onCancelAutoApproval={mockOnCancelAutoApproval}
					isFollowUpAutoApprovalPaused={false}
				/>,
				defaultTestState,
			)

			// Initially should show countdown
			expect(screen.getByText(/3s/)).toBeInTheDocument()

			// Simulate user starting to type by setting isFollowUpAutoApprovalPaused to true
			rerender(
				<TestExtensionStateProvider value={defaultTestState}>
					<TooltipProvider>
						<FollowUpSuggest
							suggestions={mockSuggestions}
							onSuggestionClick={mockOnSuggestionClick}
							ts={123}
							onCancelAutoApproval={mockOnCancelAutoApproval}
							isFollowUpAutoApprovalPaused={true}
						/>
					</TooltipProvider>
				</TestExtensionStateProvider>,
			)

			// Countdown should be hidden immediately when user starts typing
			expect(screen.queryByText(/\d+s/)).not.toBeInTheDocument()

			// Advance timer to ensure countdown doesn't continue
			vi.advanceTimersByTime(5000)

			// onSuggestionClick should not have been called
			expect(mockOnSuggestionClick).not.toHaveBeenCalled()

			// Countdown should still not be visible
			expect(screen.queryByText(/\d+s/)).not.toBeInTheDocument()
		})

		it("should resume countdown when user clears input (isFollowUpAutoApprovalPaused becomes false)", async () => {
			const { rerender } = renderWithTestProviders(
				<FollowUpSuggest
					suggestions={mockSuggestions}
					onSuggestionClick={mockOnSuggestionClick}
					ts={123}
					onCancelAutoApproval={mockOnCancelAutoApproval}
					isFollowUpAutoApprovalPaused={true}
				/>,
				defaultTestState,
			)

			// Should not show countdown when paused
			expect(screen.queryByText(/\d+s/)).not.toBeInTheDocument()

			// Simulate user clearing input by setting isFollowUpAutoApprovalPaused to false
			rerender(
				<TestExtensionStateProvider value={defaultTestState}>
					<TooltipProvider>
						<FollowUpSuggest
							suggestions={mockSuggestions}
							onSuggestionClick={mockOnSuggestionClick}
							ts={123}
							onCancelAutoApproval={mockOnCancelAutoApproval}
							isFollowUpAutoApprovalPaused={false}
						/>
					</TooltipProvider>
				</TestExtensionStateProvider>,
			)

			// Countdown should resume from the full timeout
			expect(screen.getByText(/3s/)).toBeInTheDocument()
		})

		it("should not show countdown when both isAnswered and isFollowUpAutoApprovalPaused are true", () => {
			renderWithTestProviders(
				<FollowUpSuggest
					suggestions={mockSuggestions}
					onSuggestionClick={mockOnSuggestionClick}
					ts={123}
					onCancelAutoApproval={mockOnCancelAutoApproval}
					isAnswered={true}
					isFollowUpAutoApprovalPaused={true}
				/>,
				defaultTestState,
			)

			// Should not show countdown
			expect(screen.queryByText(/\d+s/)).not.toBeInTheDocument()
		})

		it("should handle pause during countdown progress", async () => {
			const { rerender } = renderWithTestProviders(
				<FollowUpSuggest
					suggestions={mockSuggestions}
					onSuggestionClick={mockOnSuggestionClick}
					ts={123}
					onCancelAutoApproval={mockOnCancelAutoApproval}
					isFollowUpAutoApprovalPaused={false}
				/>,
				defaultTestState,
			)

			// Initially should show 3s
			expect(screen.getByText(/3s/)).toBeInTheDocument()

			// Advance timer by 1 second
			await act(async () => {
				vi.advanceTimersByTime(1000)
			})

			// Should show 2s
			expect(screen.getByText(/2s/)).toBeInTheDocument()

			// User starts typing (pause)
			rerender(
				<TestExtensionStateProvider value={defaultTestState}>
					<TooltipProvider>
						<FollowUpSuggest
							suggestions={mockSuggestions}
							onSuggestionClick={mockOnSuggestionClick}
							ts={123}
							onCancelAutoApproval={mockOnCancelAutoApproval}
							isFollowUpAutoApprovalPaused={true}
						/>
					</TooltipProvider>
				</TestExtensionStateProvider>,
			)

			// Countdown should be hidden
			expect(screen.queryByText(/\d+s/)).not.toBeInTheDocument()

			// Advance timer while paused
			await act(async () => {
				vi.advanceTimersByTime(2000)
			})

			// Countdown should still be hidden
			expect(screen.queryByText(/\d+s/)).not.toBeInTheDocument()

			// User clears input (unpause) - countdown should restart from full duration
			rerender(
				<TestExtensionStateProvider value={defaultTestState}>
					<TooltipProvider>
						<FollowUpSuggest
							suggestions={mockSuggestions}
							onSuggestionClick={mockOnSuggestionClick}
							ts={123}
							onCancelAutoApproval={mockOnCancelAutoApproval}
							isFollowUpAutoApprovalPaused={false}
						/>
					</TooltipProvider>
				</TestExtensionStateProvider>,
			)

			// Countdown should restart from full timeout (3s)
			expect(screen.getByText(/3s/)).toBeInTheDocument()
		})
	})
})
