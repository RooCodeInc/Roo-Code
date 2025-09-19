import { render, screen, act, waitFor, renderHook } from "@testing-library/react"
import { DismissedUpsellsProvider, useDismissedUpsells, useIsUpsellVisible } from "../DismissedUpsellsContext"
import { vscode } from "@src/utils/vscode"
import { UPSELL_IDS } from "@src/constants/upsellIds"
import React from "react"

// Mock vscode
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

describe("DismissedUpsellsContext", () => {
	let messageHandler: ((event: MessageEvent) => void) | null = null

	beforeEach(() => {
		vi.clearAllMocks()

		// Capture the message event handler
		window.addEventListener = vi.fn((event, handler) => {
			if (event === "message") {
				messageHandler = handler as (event: MessageEvent) => void
			}
		})

		window.removeEventListener = vi.fn()
	})

	afterEach(() => {
		messageHandler = null
	})

	describe("DismissedUpsellsProvider", () => {
		it("should request dismissed upsells on mount", () => {
			render(
				<DismissedUpsellsProvider>
					<div>Test</div>
				</DismissedUpsellsProvider>,
			)

			expect(vscode.postMessage).toHaveBeenCalledWith({ type: "getDismissedUpsells" })
		})

		it("should handle dismissed upsells message from extension", async () => {
			const TestComponent = () => {
				const { dismissedUpsells, isLoading } = useDismissedUpsells()
				return (
					<div>
						<div data-testid="loading">{isLoading.toString()}</div>
						<div data-testid="count">{dismissedUpsells.length}</div>
						{dismissedUpsells.map((id) => (
							<div key={id} data-testid={`dismissed-${id}`}>
								{id}
							</div>
						))}
					</div>
				)
			}

			render(
				<DismissedUpsellsProvider>
					<TestComponent />
				</DismissedUpsellsProvider>,
			)

			// Initially loading
			expect(screen.getByTestId("loading")).toHaveTextContent("true")
			expect(screen.getByTestId("count")).toHaveTextContent("0")

			// Simulate message from extension
			act(() => {
				messageHandler?.({
					data: {
						type: "dismissedUpsells",
						list: ["upsell-1", "upsell-2"],
					},
				} as MessageEvent)
			})

			await waitFor(() => {
				expect(screen.getByTestId("loading")).toHaveTextContent("false")
				expect(screen.getByTestId("count")).toHaveTextContent("2")
				expect(screen.getByTestId("dismissed-upsell-1")).toHaveTextContent("upsell-1")
				expect(screen.getByTestId("dismissed-upsell-2")).toHaveTextContent("upsell-2")
			})
		})

		it("should handle empty dismissed upsells list", async () => {
			const TestComponent = () => {
				const { isLoading } = useDismissedUpsells()
				return <div data-testid="loading">{isLoading.toString()}</div>
			}

			render(
				<DismissedUpsellsProvider>
					<TestComponent />
				</DismissedUpsellsProvider>,
			)

			act(() => {
				messageHandler?.({
					data: {
						type: "dismissedUpsells",
						list: [],
					},
				} as MessageEvent)
			})

			await waitFor(() => {
				expect(screen.getByTestId("loading")).toHaveTextContent("false")
			})
		})

		it("should ignore invalid messages", () => {
			const TestComponent = () => {
				const { isLoading } = useDismissedUpsells()
				return <div data-testid="loading">{isLoading.toString()}</div>
			}

			render(
				<DismissedUpsellsProvider>
					<TestComponent />
				</DismissedUpsellsProvider>,
			)

			// Invalid message type
			act(() => {
				messageHandler?.({
					data: {
						type: "otherType",
						list: ["upsell-1"],
					},
				} as MessageEvent)
			})

			// Still loading
			expect(screen.getByTestId("loading")).toHaveTextContent("true")

			// Invalid list format
			act(() => {
				messageHandler?.({
					data: {
						type: "dismissedUpsells",
						list: "not-an-array",
					},
				} as MessageEvent)
			})

			// Still loading
			expect(screen.getByTestId("loading")).toHaveTextContent("true")
		})
	})

	describe("useDismissedUpsells", () => {
		it("should throw error when used outside provider", () => {
			// Suppress console.error for this test
			const spy = vi.spyOn(console, "error").mockImplementation(() => {})

			const { result } = renderHook(() => {
				try {
					return useDismissedUpsells()
				} catch (error: any) {
					return { error }
				}
			})

			expect((result.current as any).error).toBeDefined()
			expect((result.current as any).error.message).toBe(
				"useDismissedUpsells must be used within a DismissedUpsellsProvider",
			)

			spy.mockRestore()
		})

		it("should check if upsell is visible", async () => {
			const TestComponent = () => {
				const { isUpsellVisible } = useDismissedUpsells()
				return (
					<div>
						<div data-testid="visible-1">{isUpsellVisible("upsell-1").toString()}</div>
						<div data-testid="visible-2">{isUpsellVisible("upsell-2").toString()}</div>
						<div data-testid="visible-3">{isUpsellVisible("upsell-3").toString()}</div>
					</div>
				)
			}

			render(
				<DismissedUpsellsProvider>
					<TestComponent />
				</DismissedUpsellsProvider>,
			)

			// Send dismissed list
			act(() => {
				messageHandler?.({
					data: {
						type: "dismissedUpsells",
						list: ["upsell-1", "upsell-3"],
					},
				} as MessageEvent)
			})

			await waitFor(() => {
				expect(screen.getByTestId("visible-1")).toHaveTextContent("false")
				expect(screen.getByTestId("visible-2")).toHaveTextContent("true")
				expect(screen.getByTestId("visible-3")).toHaveTextContent("false")
			})
		})

		it("should dismiss an upsell", async () => {
			const TestComponent = () => {
				const { dismissUpsell, isUpsellVisible } = useDismissedUpsells()
				return (
					<div>
						<div data-testid="visible">{isUpsellVisible("test-upsell").toString()}</div>
						<button onClick={() => dismissUpsell("test-upsell")}>Dismiss</button>
					</div>
				)
			}

			const { getByText } = render(
				<DismissedUpsellsProvider>
					<TestComponent />
				</DismissedUpsellsProvider>,
			)

			// Initially visible
			act(() => {
				messageHandler?.({
					data: {
						type: "dismissedUpsells",
						list: [],
					},
				} as MessageEvent)
			})

			await waitFor(() => {
				expect(screen.getByTestId("visible")).toHaveTextContent("true")
			})

			// Dismiss the upsell
			act(() => {
				getByText("Dismiss").click()
			})

			// Should send message to extension
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "dismissUpsell",
				upsellId: "test-upsell",
			})

			// Should update local state optimistically
			await waitFor(() => {
				expect(screen.getByTestId("visible")).toHaveTextContent("false")
			})
		})

		it("should not dismiss already dismissed upsell", async () => {
			const TestComponent = () => {
				const { dismissUpsell } = useDismissedUpsells()
				return <button onClick={() => dismissUpsell("already-dismissed")}>Dismiss</button>
			}

			const { getByText } = render(
				<DismissedUpsellsProvider>
					<TestComponent />
				</DismissedUpsellsProvider>,
			)

			// Set already dismissed
			act(() => {
				messageHandler?.({
					data: {
						type: "dismissedUpsells",
						list: ["already-dismissed"],
					},
				} as MessageEvent)
			})

			// Clear previous calls
			vi.clearAllMocks()

			// Try to dismiss again
			act(() => {
				getByText("Dismiss").click()
			})

			// Should not send message
			expect(vscode.postMessage).not.toHaveBeenCalled()
		})

		it("should refresh dismissed upsells", () => {
			const TestComponent = () => {
				const { refreshDismissedUpsells } = useDismissedUpsells()
				return <button onClick={refreshDismissedUpsells}>Refresh</button>
			}

			const { getByText } = render(
				<DismissedUpsellsProvider>
					<TestComponent />
				</DismissedUpsellsProvider>,
			)

			// Clear initial call
			vi.clearAllMocks()

			act(() => {
				getByText("Refresh").click()
			})

			expect(vscode.postMessage).toHaveBeenCalledWith({ type: "getDismissedUpsells" })
		})
	})

	describe("useIsUpsellVisible", () => {
		it("should return visibility status for specific upsell", async () => {
			const TestComponent = ({ upsellId }: { upsellId: string }) => {
				const isVisible = useIsUpsellVisible(upsellId)
				return <div data-testid="visible">{isVisible.toString()}</div>
			}

			render(
				<DismissedUpsellsProvider>
					<TestComponent upsellId="test-upsell" />
				</DismissedUpsellsProvider>,
			)

			// Send dismissed list without the test upsell
			act(() => {
				messageHandler?.({
					data: {
						type: "dismissedUpsells",
						list: ["other-upsell"],
					},
				} as MessageEvent)
			})

			await waitFor(() => {
				expect(screen.getByTestId("visible")).toHaveTextContent("true")
			})

			// Send dismissed list with the test upsell
			act(() => {
				messageHandler?.({
					data: {
						type: "dismissedUpsells",
						list: ["test-upsell", "other-upsell"],
					},
				} as MessageEvent)
			})

			await waitFor(() => {
				expect(screen.getByTestId("visible")).toHaveTextContent("false")
			})
		})

		it("should work with UPSELL_IDS constants", async () => {
			const TestComponent = () => {
				const isVisible = useIsUpsellVisible(UPSELL_IDS.TASK_LIST)
				return <div data-testid="visible">{isVisible.toString()}</div>
			}

			render(
				<DismissedUpsellsProvider>
					<TestComponent />
				</DismissedUpsellsProvider>,
			)

			// Send dismissed list with the constant
			act(() => {
				messageHandler?.({
					data: {
						type: "dismissedUpsells",
						list: [UPSELL_IDS.TASK_LIST],
					},
				} as MessageEvent)
			})

			await waitFor(() => {
				expect(screen.getByTestId("visible")).toHaveTextContent("false")
			})
		})
	})
})
