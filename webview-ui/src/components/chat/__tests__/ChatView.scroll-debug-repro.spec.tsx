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
}

interface VirtuosoHarnessState {
	scrollCalls: number
	atBottomAfterCalls: number
	signalDelayMs: number
	emitFalseOnDataChange: boolean
	followOutput: FollowOutput | undefined
}

const harness = vi.hoisted<VirtuosoHarnessState>(() => ({
	scrollCalls: 0,
	atBottomAfterCalls: Number.POSITIVE_INFINITY,
	signalDelayMs: 20,
	emitFalseOnDataChange: true,
	followOutput: undefined,
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
		{ data, itemContent, atBottomStateChange, followOutput, className },
		ref,
	) {
		const atBottomRef = useRef(atBottomStateChange)
		const timeoutIdsRef = useRef<number[]>([])

		harness.followOutput = followOutput

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

	window.postMessage(message, "*")
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
		postState(buildMessages(Date.now() - 3_000))
	})
}

const waitForCalls = async (min: number, timeout = 1_500) => {
	await waitFor(() => expect(harness.scrollCalls).toBeGreaterThanOrEqual(min), { timeout })
}

const expectCallsStable = async (ms = 120) => {
	await sleep(ms)
	const snapshot = harness.scrollCalls
	await sleep(ms)
	expect(harness.scrollCalls).toBe(snapshot)
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
		harness.followOutput = undefined
	})

	it("rehydration converges to bottom", async () => {
		await hydrate(6)
		await waitForCalls(6, 2_000)
		await expectCallsStable()
		expect(document.querySelector(".codicon-chevron-down")).toBeNull()
	})

	it("transient settle-time not-at-bottom signals do not disable sticky follow", async () => {
		await hydrate(8)
		await waitForCalls(2, 1_200)
		expect(resolveFollowOutput(false)).toBe("auto")
		expect(document.querySelector(".codicon-chevron-down")).toBeNull()

		await waitForCalls(8, 2_000)
		await expectCallsStable()
		expect(resolveFollowOutput(false)).toBe("auto")
	})

	it("user escape hatch during settle stops forced follow", async () => {
		await hydrate(Number.POSITIVE_INFINITY)
		await waitForCalls(3, 1_200)

		await act(async () => {
			fireEvent.keyDown(window, { key: "PageUp" })
		})

		expect(resolveFollowOutput(false)).toBe(false)
		const callsAfterEscape = harness.scrollCalls
		await sleep(260)
		expect(harness.scrollCalls).toBe(callsAfterEscape)

		await waitFor(() => expect(document.querySelector(".codicon-chevron-down")).toBeTruthy(), {
			timeout: 1_200,
		})
	})

	it("non-wheel upward intent disengages sticky follow", async () => {
		await hydrate(4)
		await waitForCalls(4)
		await expectCallsStable()
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

	it("wheel-up intent disengages sticky follow", async () => {
		await hydrate(4)
		await waitForCalls(4)
		await expectCallsStable()
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

	it("scroll-to-bottom CTA re-anchors with one interaction", async () => {
		await hydrate(4)
		await waitForCalls(4)
		await expectCallsStable()
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
		await waitFor(() => expect(harness.scrollCalls).toBeGreaterThanOrEqual(callsBeforeClick + 2), {
			timeout: 1_200,
		})
		await waitFor(() => expect(document.querySelector(".codicon-chevron-down")).toBeNull(), { timeout: 1_200 })
	})
})
