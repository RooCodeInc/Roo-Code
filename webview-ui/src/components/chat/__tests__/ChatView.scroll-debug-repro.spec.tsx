import React, { useEffect, useImperativeHandle, useRef } from "react"
import { act, fireEvent, render, waitFor } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import type { ClineMessage } from "@roo-code/types"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"

import ChatView, { type ChatViewProps } from "../ChatView"

type FollowOutput = ((isAtBottom: boolean) => "auto" | false) | "auto" | false

interface ExtensionStateMessage {
	type: "state"
	state: {
		version: string
		clineMessages: ClineMessage[]
		taskHistory: unknown[]
		shouldShowAnnouncement: boolean
		allowedCommands: string[]
		alwaysAllowExecute: boolean
		cloudIsAuthenticated: boolean
		telemetrySetting: "enabled" | "disabled" | "unset"
	}
}

interface MockVirtuosoHandle {
	scrollToIndex: (options: {
		index: number | "LAST"
		align?: "end" | "start" | "center"
		behavior?: "auto" | "smooth"
	}) => void
}

interface MockVirtuosoProps {
	data: ClineMessage[]
	itemContent: (index: number, item: ClineMessage) => React.ReactNode
	atBottomStateChange?: (isAtBottom: boolean) => void
	followOutput?: FollowOutput
	className?: string
	initialTopMostItemIndex?: number
}

interface VirtuosoHarnessState {
	scrollCalls: number
	atBottomAfterCalls: number
	signalDelayMs: number
	emitFalseOnDataChange: boolean
	delayedGrowthMs: number | null
	initialTopMostItemIndex: number | undefined
	followOutput: FollowOutput | undefined
	emitAtBottom: (isAtBottom: boolean) => void
}

const harness = vi.hoisted<VirtuosoHarnessState>(() => ({
	scrollCalls: 0,
	atBottomAfterCalls: Number.POSITIVE_INFINITY,
	signalDelayMs: 20,
	emitFalseOnDataChange: true,
	delayedGrowthMs: null,
	initialTopMostItemIndex: undefined,
	followOutput: undefined,
	emitAtBottom: () => {},
}))

function nullDefaultModule() {
	return { default: () => null }
}

vi.mock("@src/utils/vscode", () => ({ vscode: { postMessage: vi.fn() } }))
vi.mock("use-sound", () => ({ default: vi.fn().mockImplementation(() => [vi.fn()]) }))
vi.mock("@src/components/cloud/CloudUpsellDialog", () => ({ CloudUpsellDialog: () => null }))
vi.mock("@src/hooks/useCloudUpsell", () => ({
	useCloudUpsell: () => ({
		isOpen: false,
		openUpsell: vi.fn(),
		closeUpsell: vi.fn(),
		handleConnect: vi.fn(),
	}),
}))

vi.mock("../common/TelemetryBanner", nullDefaultModule)
vi.mock("../common/VersionIndicator", nullDefaultModule)
vi.mock("../history/HistoryPreview", nullDefaultModule)
vi.mock("@src/components/welcome/RooHero", nullDefaultModule)
vi.mock("@src/components/welcome/RooTips", nullDefaultModule)
vi.mock("../Announcement", nullDefaultModule)
vi.mock("./TaskHeader", () => ({ default: () => <div data-testid="task-header" /> }))
vi.mock("./ProfileViolationWarning", nullDefaultModule)
vi.mock("../common/DismissibleUpsell", nullDefaultModule)

vi.mock("./CheckpointWarning", () => ({ CheckpointWarning: () => null }))
vi.mock("./QueuedMessages", () => ({ QueuedMessages: () => null }))
vi.mock("./WorktreeSelector", () => ({ WorktreeSelector: () => null }))

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeLink: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ui", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/components/ui")>()
	return {
		...actual,
		StandardTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	}
})

vi.mock("../ChatTextArea", () => {
	const MockTextArea = React.forwardRef(function MockTextArea(
		props: {
			inputValue?: string
			setInputValue?: (value: string) => void
			onSend: () => void
			sendingDisabled?: boolean
		},
		ref: React.ForwardedRef<{ focus: () => void }>,
	) {
		useImperativeHandle(ref, () => ({ focus: () => {} }))

		return (
			<input
				value={props.inputValue ?? ""}
				onChange={(event) => props.setInputValue?.(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter" && !props.sendingDisabled) {
						props.onSend()
					}
				}}
			/>
		)
	})

	return { default: MockTextArea, ChatTextArea: MockTextArea }
})

vi.mock("../ChatRow", () => ({
	default: ({ message }: { message: ClineMessage }) => <div data-testid="chat-row">{message.ts}</div>,
}))

vi.mock("react-virtuoso", () => {
	const MockVirtuoso = React.forwardRef<MockVirtuosoHandle, MockVirtuosoProps>(function MockVirtuoso(
		{ data, itemContent, atBottomStateChange, followOutput, className, initialTopMostItemIndex },
		ref,
	) {
		const atBottomRef = useRef(atBottomStateChange)
		const timeoutIdsRef = useRef<number[]>([])

		harness.followOutput = followOutput
		harness.initialTopMostItemIndex = initialTopMostItemIndex
		harness.emitAtBottom = (isAtBottom: boolean) => {
			atBottomRef.current?.(isAtBottom)
		}

		useImperativeHandle(ref, () => ({
			scrollToIndex: () => {
				harness.scrollCalls += 1
				const reachedBottom = harness.scrollCalls >= harness.atBottomAfterCalls
				const timeoutId = window.setTimeout(() => {
					atBottomRef.current?.(reachedBottom)
				}, harness.signalDelayMs)
				timeoutIdsRef.current.push(timeoutId)
			},
		}))

		useEffect(() => {
			atBottomRef.current = atBottomStateChange
		}, [atBottomStateChange])

		useEffect(() => {
			if (harness.emitFalseOnDataChange) {
				atBottomStateChange?.(false)
			}

			if (harness.delayedGrowthMs !== null) {
				const timeoutId = window.setTimeout(() => {
					atBottomRef.current?.(false)
				}, harness.delayedGrowthMs)
				timeoutIdsRef.current.push(timeoutId)
			}
		}, [data.length, atBottomStateChange])

		useEffect(
			() => () => {
				timeoutIdsRef.current.forEach((id) => window.clearTimeout(id))
				timeoutIdsRef.current = []
			},
			[],
		)

		return (
			<div data-testid="virtuoso-item-list" className={className} data-count={data.length}>
				{data.map((item, index) => (
					<div key={item.ts} data-testid={`virtuoso-item-${index}`}>
						{itemContent(index, item)}
					</div>
				))}
			</div>
		)
	})

	return { Virtuoso: MockVirtuoso }
})

const props: ChatViewProps = {
	isHidden: false,
	showAnnouncement: false,
	hideAnnouncement: () => {},
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

const buildMessages = (baseTs: number): ClineMessage[] => [
	{ type: "say", say: "text", ts: baseTs, text: "task" },
	{ type: "say", say: "text", ts: baseTs + 1, text: "row-1" },
	{ type: "say", say: "text", ts: baseTs + 2, text: "row-2" },
]

const resolveFollowOutput = (isAtBottom: boolean): "auto" | false => {
	const followOutput = harness.followOutput
	if (typeof followOutput === "function") {
		return followOutput(isAtBottom)
	}
	return followOutput === "auto" ? "auto" : false
}

const postState = (clineMessages: ClineMessage[]) => {
	const message: ExtensionStateMessage = {
		type: "state",
		state: {
			version: "1.0.0",
			clineMessages,
			taskHistory: [],
			shouldShowAnnouncement: false,
			allowedCommands: [],
			alwaysAllowExecute: false,
			cloudIsAuthenticated: false,
			telemetrySetting: "enabled",
		},
	}

	window.dispatchEvent(
		new MessageEvent("message", {
			data: message,
		}),
	)
}

const renderView = () =>
	render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={new QueryClient()}>
				<ChatView {...props} />
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)

const hydrate = async (atBottomAfterCalls: number) => {
	harness.atBottomAfterCalls = atBottomAfterCalls
	renderView()
	await act(async () => {
		await Promise.resolve()
	})
	await act(async () => {
		postState(buildMessages(Date.now() - 3_000))
	})
	await waitFor(() => {
		const list = document.querySelector("[data-testid='virtuoso-item-list']")
		expect(list).toBeTruthy()
		expect(list?.getAttribute("data-count")).toBe("2")
	})
}

const waitForCalls = async (min: number, timeout = 1_500) => {
	await waitFor(() => expect(harness.scrollCalls).toBeGreaterThanOrEqual(min), { timeout })
}

const waitForCallsSettled = async (idleMs = 80, timeoutMs = 2_000) => {
	const deadline = Date.now() + timeoutMs
	let lastSeen = harness.scrollCalls

	while (Date.now() < deadline) {
		await sleep(idleMs)
		const current = harness.scrollCalls

		if (current === lastSeen) {
			await sleep(idleMs)
			if (harness.scrollCalls === current) {
				return
			}
		}

		lastSeen = current
	}

	throw new Error(`Expected scroll calls to settle within ${timeoutMs}ms, last count: ${harness.scrollCalls}`)
}

const getScrollable = (): HTMLElement => {
	const scrollable = document.querySelector(".scrollable")
	if (!(scrollable instanceof HTMLElement)) {
		throw new Error("Expected ChatView scrollable container")
	}
	return scrollable
}

const getScrollToBottomButton = (): HTMLButtonElement => {
	const icon = document.querySelector(".codicon-chevron-down")
	if (!(icon instanceof HTMLElement)) {
		throw new Error("Expected scroll-to-bottom icon")
	}

	const button = icon.closest("button")
	if (!(button instanceof HTMLButtonElement)) {
		throw new Error("Expected scroll-to-bottom button")
	}

	return button
}

describe("ChatView scroll behavior regression coverage", () => {
	beforeEach(() => {
		harness.scrollCalls = 0
		harness.atBottomAfterCalls = Number.POSITIVE_INFINITY
		harness.signalDelayMs = 20
		harness.emitFalseOnDataChange = true
		harness.delayedGrowthMs = null
		harness.initialTopMostItemIndex = undefined
		harness.followOutput = undefined
		harness.emitAtBottom = () => {}
	})

	it("existing-task entry does not set a top-most initial anchor", async () => {
		await hydrate(2)
		expect(harness.initialTopMostItemIndex).toBeUndefined()
	})

	it("rehydration uses bounded bottom pinning", async () => {
		await hydrate(2)
		await waitForCalls(2, 1_200)
		await waitForCallsSettled()
		expect(harness.scrollCalls).toBe(2)
		expect(resolveFollowOutput(false)).toBe("auto")
		expect(document.querySelector(".codicon-chevron-down")).toBeNull()
	})

	it("transient hydration-time not-at-bottom signals do not disable sticky follow", async () => {
		await hydrate(2)
		await waitForCalls(1, 1_200)
		expect(resolveFollowOutput(false)).toBe("auto")
		expect(document.querySelector(".codicon-chevron-down")).toBeNull()

		await act(async () => {
			harness.emitAtBottom(false)
		})

		expect(resolveFollowOutput(false)).toBe("auto")
		expect(document.querySelector(".codicon-chevron-down")).toBeNull()

		await waitForCalls(2, 1_200)
		await waitForCallsSettled()
		expect(harness.scrollCalls).toBe(2)
		expect(resolveFollowOutput(false)).toBe("auto")
	})

	it("delayed last-row growth during hydration keeps anchored follow with one bounded repin", async () => {
		harness.delayedGrowthMs = 320
		await hydrate(3)
		await waitForCalls(1, 1_200)

		await sleep(950)

		expect(harness.scrollCalls).toBe(2)
		expect(resolveFollowOutput(false)).toBe("auto")
		expect(document.querySelector(".codicon-chevron-down")).toBeNull()
	})

	it("user escape hatch during hydration prevents repinning", async () => {
		await hydrate(Number.POSITIVE_INFINITY)
		await waitForCalls(1, 1_200)

		await act(async () => {
			fireEvent.keyDown(window, { key: "PageUp" })
		})

		expect(resolveFollowOutput(false)).toBe(false)

		await act(async () => {
			harness.emitAtBottom(true)
		})

		expect(resolveFollowOutput(false)).toBe(false)

		await waitFor(() => expect(document.querySelector(".codicon-chevron-down")).toBeTruthy(), {
			timeout: 1_200,
		})
	})

	it("non-wheel upward intent disengages sticky follow", async () => {
		await hydrate(2)
		await waitForCalls(2)
		await waitForCallsSettled()
		expect(resolveFollowOutput(false)).toBe("auto")

		const scrollable = getScrollable()
		scrollable.scrollTop = 240

		await act(async () => {
			fireEvent.pointerDown(scrollable)
			scrollable.scrollTop = 120
			fireEvent.scroll(scrollable)
			fireEvent.pointerUp(window)
		})

		expect(resolveFollowOutput(false)).toBe(false)
	})

	it("nested scroller scroll events do not falsely disengage sticky follow", async () => {
		await hydrate(2)
		await waitForCalls(2)
		await waitForCallsSettled()
		expect(resolveFollowOutput(false)).toBe("auto")

		const scrollable = getScrollable()
		const nestedScrollable = document.createElement("div")
		nestedScrollable.style.overflowY = "auto"
		nestedScrollable.scrollTop = 0
		scrollable.appendChild(nestedScrollable)

		scrollable.scrollTop = 240

		await act(async () => {
			fireEvent.pointerDown(nestedScrollable)
			nestedScrollable.scrollTop = 120
			fireEvent.scroll(nestedScrollable)
			fireEvent.pointerUp(window)
		})

		expect(resolveFollowOutput(false)).toBe("auto")
		expect(document.querySelector(".codicon-chevron-down")).toBeNull()
	})

	it("wheel-up intent disengages sticky follow", async () => {
		await hydrate(2)
		await waitForCalls(2)
		await waitForCallsSettled()
		expect(resolveFollowOutput(false)).toBe("auto")

		const scrollable = getScrollable()

		await act(async () => {
			fireEvent.wheel(scrollable, { deltaY: -120 })
		})

		expect(resolveFollowOutput(false)).toBe(false)
		await waitFor(() => expect(document.querySelector(".codicon-chevron-down")).toBeTruthy(), {
			timeout: 1_200,
		})
	})

	it("hydration completion cannot override user escape hatch", async () => {
		await hydrate(Number.POSITIVE_INFINITY)
		await waitForCalls(1, 1_200)

		await act(async () => {
			fireEvent.keyDown(window, { key: "PageUp" })
		})

		expect(resolveFollowOutput(false)).toBe(false)

		await sleep(700)

		expect(resolveFollowOutput(false)).toBe(false)
		await waitFor(() => expect(document.querySelector(".codicon-chevron-down")).toBeTruthy(), {
			timeout: 1_200,
		})
	})

	it("scroll-to-bottom CTA re-anchors with one interaction", async () => {
		await hydrate(2)
		await waitForCalls(2)
		await waitForCallsSettled()
		expect(resolveFollowOutput(false)).toBe("auto")

		await act(async () => {
			fireEvent.keyDown(window, { key: "PageUp" })
		})

		expect(resolveFollowOutput(false)).toBe(false)
		await waitFor(() => expect(document.querySelector(".codicon-chevron-down")).toBeTruthy(), {
			timeout: 1_200,
		})

		const callsBeforeClick = harness.scrollCalls
		harness.atBottomAfterCalls = callsBeforeClick + 2

		await act(async () => {
			getScrollToBottomButton().click()
		})

		expect(resolveFollowOutput(false)).toBe("auto")
		await waitFor(() => expect(harness.scrollCalls).toBe(callsBeforeClick + 2), {
			timeout: 1_200,
		})
		await waitFor(() => expect(document.querySelector(".codicon-chevron-down")).toBeNull(), { timeout: 1_200 })
	})
})
