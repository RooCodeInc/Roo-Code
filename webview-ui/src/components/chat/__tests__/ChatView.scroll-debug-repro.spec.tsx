import React, { useEffect, useImperativeHandle, useRef } from "react"
import { act, render, waitFor } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import { CHAT_SCROLL_DEBUG_EVENT_NAME } from "@src/utils/chatScrollDebug"

import ChatView, { type ChatViewProps } from "../ChatView"

interface ClineMessage {
	type: "say" | "ask"
	say?: string
	ask?: string
	ts: number
	text?: string
	partial?: boolean
}

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
		debug?: boolean
	}
}

interface ChatScrollDebugEventDetail {
	ts: number
	event: string
	[key: string]: unknown
}

interface VirtuosoHarnessState {
	scrollCalls: number
	atBottomAfterCalls: number
	atBottomSignalDelayMs: number
	emitFalseOnDataChange: boolean
}

const virtuosoHarness = vi.hoisted<VirtuosoHarnessState>(() => ({
	scrollCalls: 0,
	atBottomAfterCalls: Number.POSITIVE_INFINITY,
	atBottomSignalDelayMs: 20,
	emitFalseOnDataChange: true,
}))

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("use-sound", () => ({
	default: vi.fn().mockImplementation(() => [vi.fn()]),
}))

vi.mock("@/components/ui", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/components/ui")>()
	return {
		...actual,
		StandardTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	}
})

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeLink: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@src/hooks/useCloudUpsell", () => ({
	useCloudUpsell: () => ({
		isOpen: false,
		openUpsell: vi.fn(),
		closeUpsell: vi.fn(),
		handleConnect: vi.fn(),
	}),
}))

vi.mock("@src/components/cloud/CloudUpsellDialog", () => ({
	CloudUpsellDialog: () => null,
}))

vi.mock("../common/TelemetryBanner", () => ({
	default: () => null,
}))

vi.mock("../common/VersionIndicator", () => ({
	default: () => null,
}))

vi.mock("../history/HistoryPreview", () => ({
	default: () => null,
}))

vi.mock("@src/components/welcome/RooHero", () => ({
	default: () => null,
}))

vi.mock("@src/components/welcome/RooTips", () => ({
	default: () => null,
}))

vi.mock("../Announcement", () => ({
	default: () => null,
}))

vi.mock("./TaskHeader", () => ({
	default: () => <div data-testid="task-header" />,
}))

vi.mock("./ProfileViolationWarning", () => ({
	default: () => null,
}))

vi.mock("./CheckpointWarning", () => ({
	CheckpointWarning: () => null,
}))

vi.mock("./QueuedMessages", () => ({
	QueuedMessages: () => null,
}))

vi.mock("./WorktreeSelector", () => ({
	WorktreeSelector: () => null,
}))

vi.mock("../common/DismissibleUpsell", () => ({
	default: () => null,
}))

interface MockChatTextAreaProps {
	inputValue?: string
	setInputValue?: (value: string) => void
	onSend: () => void
	sendingDisabled?: boolean
}

vi.mock("../ChatTextArea", () => {
	const ChatTextAreaComponent = React.forwardRef(function MockChatTextArea(
		props: MockChatTextAreaProps,
		ref: React.ForwardedRef<{ focus: () => void }>,
	) {
		React.useImperativeHandle(ref, () => ({
			focus: () => {},
		}))

		return (
			<div data-testid="chat-textarea">
				<input
					value={props.inputValue ?? ""}
					onChange={(event) => props.setInputValue?.(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !props.sendingDisabled) {
							props.onSend()
						}
					}}
				/>
			</div>
		)
	})

	return {
		default: ChatTextAreaComponent,
		ChatTextArea: ChatTextAreaComponent,
	}
})

interface MockChatRowProps {
	message: ClineMessage
	isLast: boolean
	onHeightChange: (isTaller: boolean) => void
}

vi.mock("../ChatRow", () => ({
	default: function MockChatRow({ message, isLast, onHeightChange }: MockChatRowProps) {
		useEffect(() => {
			if (!isLast || message.type !== "say" || message.say !== "text") {
				return
			}

			if (!message.text?.includes("__LATE_GROW__")) {
				return
			}

			const timeoutA = window.setTimeout(() => onHeightChange(true), 1050)
			const timeoutB = window.setTimeout(() => onHeightChange(true), 1250)

			return () => {
				window.clearTimeout(timeoutA)
				window.clearTimeout(timeoutB)
			}
		}, [isLast, message, onHeightChange])

		return <div data-testid="chat-row">{message.ts}</div>
	},
}))

interface VirtuosoScrollOptions {
	index: number | "LAST"
	align?: "end" | "start" | "center"
	behavior?: "auto" | "smooth"
}

interface MockVirtuosoHandle {
	scrollToIndex: (options: VirtuosoScrollOptions) => void
}

interface MockVirtuosoProps {
	data: ClineMessage[]
	itemContent: (index: number, item: ClineMessage) => React.ReactNode
	atBottomStateChange?: (isAtBottom: boolean) => void
}

vi.mock("react-virtuoso", () => {
	const MockVirtuoso = React.forwardRef<MockVirtuosoHandle, MockVirtuosoProps>(function MockVirtuoso(
		{ data, itemContent, atBottomStateChange },
		ref,
	) {
		const atBottomCallbackRef = useRef(atBottomStateChange)
		const pendingAtBottomTimeoutsRef = useRef<number[]>([])

		useEffect(() => {
			atBottomCallbackRef.current = atBottomStateChange
		}, [atBottomStateChange])

		useEffect(() => {
			return () => {
				for (const timeoutId of pendingAtBottomTimeoutsRef.current) {
					window.clearTimeout(timeoutId)
				}
				pendingAtBottomTimeoutsRef.current = []
			}
		}, [])

		useEffect(() => {
			if (virtuosoHarness.emitFalseOnDataChange) {
				atBottomStateChange?.(false)
			}
		}, [data.length, atBottomStateChange])

		useImperativeHandle(ref, () => ({
			scrollToIndex: () => {
				virtuosoHarness.scrollCalls += 1
				const shouldReportAtBottom = virtuosoHarness.scrollCalls >= virtuosoHarness.atBottomAfterCalls

				const timeoutId = window.setTimeout(() => {
					atBottomCallbackRef.current?.(shouldReportAtBottom)
				}, virtuosoHarness.atBottomSignalDelayMs)
				pendingAtBottomTimeoutsRef.current.push(timeoutId)
			},
		}))

		return (
			<div data-testid="virtuoso-item-list" data-count={data.length}>
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

function mockPostMessage(state: Partial<ExtensionStateMessage["state"]>) {
	const message: ExtensionStateMessage = {
		type: "state",
		state: {
			version: "1.0.0",
			clineMessages: [],
			taskHistory: [],
			shouldShowAnnouncement: false,
			allowedCommands: [],
			alwaysAllowExecute: false,
			cloudIsAuthenticated: false,
			telemetrySetting: "enabled",
			...state,
		},
	}

	window.postMessage(message, "*")
}

function mockMessageUpdated(clineMessage: ClineMessage) {
	window.postMessage(
		{
			type: "messageUpdated",
			clineMessage,
		},
		"*",
	)
}

function getEventNumber(detail: ChatScrollDebugEventDetail, key: string): number | undefined {
	const value = detail[key]
	return typeof value === "number" ? value : undefined
}

function getEventBoolean(detail: ChatScrollDebugEventDetail, key: string): boolean | undefined {
	const value = detail[key]
	return typeof value === "boolean" ? value : undefined
}

function buildLongHeterogeneousHistory(baseTs: number, includeLateTailGrowth: boolean): ClineMessage[] {
	const messages: ClineMessage[] = [
		{
			type: "say",
			say: "task",
			ts: baseTs,
			text: "Investigate existing conversation",
		},
	]

	for (let i = 0; i < 12; i += 1) {
		messages.push({
			type: "say",
			say: i % 2 === 0 ? "text" : "user_feedback",
			ts: baseTs + 10 + i,
			text: `history-text-${i}`,
		})
	}

	for (let i = 0; i < 8; i += 1) {
		messages.push({
			type: "ask",
			ask: "tool",
			ts: baseTs + 100 + i,
			text: JSON.stringify({ tool: "readFile", path: `src/file-${i}.ts`, reason: `line-${i}` }),
		})
	}

	for (let i = 0; i < 8; i += 1) {
		messages.push({
			type: "ask",
			ask: "tool",
			ts: baseTs + 200 + i,
			text: JSON.stringify({ tool: "listFilesRecursive", path: `src/dir-${i}` }),
		})
	}

	for (let i = 0; i < 5; i += 1) {
		messages.push({
			type: "ask",
			ask: "tool",
			ts: baseTs + 300 + i,
			text: JSON.stringify({ tool: "editedExistingFile", path: `src/edit-${i}.ts`, diff: `@@ change ${i}` }),
		})
	}

	messages.push({
		type: "say",
		say: "text",
		ts: baseTs + 500,
		text: includeLateTailGrowth ? "tail message __LATE_GROW__" : "tail message stable",
	})

	return messages
}

function createDebugCapture() {
	const events: ChatScrollDebugEventDetail[] = []

	const handler = (event: Event) => {
		const customEvent = event as CustomEvent<ChatScrollDebugEventDetail>
		events.push(customEvent.detail)
	}

	window.addEventListener(CHAT_SCROLL_DEBUG_EVENT_NAME, handler)

	return {
		events,
		stop: () => window.removeEventListener(CHAT_SCROLL_DEBUG_EVENT_NAME, handler),
	}
}

async function sleep(ms: number) {
	await new Promise((resolve) => window.setTimeout(resolve, ms))
}

const defaultProps: ChatViewProps = {
	isHidden: false,
	showAnnouncement: false,
	hideAnnouncement: () => {},
}

function renderChatView() {
	return render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={new QueryClient()}>
				<ChatView {...defaultProps} />
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)
}

describe("ChatView scroll debug repro harness", () => {
	beforeEach(() => {
		virtuosoHarness.scrollCalls = 0
		virtuosoHarness.atBottomAfterCalls = Number.POSITIVE_INFINITY
		virtuosoHarness.atBottomSignalDelayMs = 20
		virtuosoHarness.emitFalseOnDataChange = true
		;(window as Window & { __ROO_CHAT_SCROLL_DEBUG__?: boolean }).__ROO_CHAT_SCROLL_DEBUG__ = true
		window.localStorage.setItem("roo.chatScrollDebug", "1")
	})

	afterEach(() => {
		window.localStorage.removeItem("roo.chatScrollDebug")
		;(window as Window & { __ROO_CHAT_SCROLL_DEBUG__?: boolean }).__ROO_CHAT_SCROLL_DEBUG__ = false
	})

	it("converges to bottom after delayed at-bottom measurement cycles", async () => {
		virtuosoHarness.scrollCalls = 0
		virtuosoHarness.atBottomAfterCalls = 7
		virtuosoHarness.atBottomSignalDelayMs = 18

		const capture = createDebugCapture()

		try {
			renderChatView()

			const baseTs = Date.now() - 20_000
			const initialMessages = buildLongHeterogeneousHistory(baseTs, false)

			await act(async () => {
				mockPostMessage({ debug: true, clineMessages: initialMessages })
			})

			await waitFor(
				() => {
					expect(capture.events.some((event) => event.event === "settle-complete")).toBe(true)
				},
				{ timeout: 2500 },
			)

			const firstAtBottomTrue = capture.events.find(
				(event) => event.event === "at-bottom-state-change" && event.isAtBottom === true,
			)
			const firstTrueTs =
				typeof firstAtBottomTrue?.ts === "number" ? firstAtBottomTrue.ts : Number.MAX_SAFE_INTEGER
			const settleAttemptsBeforeFirstTrue = capture.events.filter(
				(event) => event.event === "settle-attempt" && event.ts <= firstTrueTs,
			)
			const stableSettleComplete = capture.events.find(
				(event) => event.event === "settle-complete" && event.reason === "stable" && event.isAtBottom === true,
			)

			console.info(
				"[chat-scroll-repro][scenario=delayed-measurement-convergence]",
				JSON.stringify({
					scrollCalls: virtuosoHarness.scrollCalls,
					firstAtBottomTrue,
					settleAttemptsBeforeFirstTrue: settleAttemptsBeforeFirstTrue.length,
					stableSettleComplete,
				}),
			)

			expect(firstAtBottomTrue).toBeTruthy()
			expect(settleAttemptsBeforeFirstTrue.length).toBeGreaterThanOrEqual(5)
			expect(stableSettleComplete).toBeTruthy()
		} finally {
			capture.stop()
		}
	})

	it("re-arms on late tail growth during initial settle window and still converges", async () => {
		virtuosoHarness.scrollCalls = 0
		virtuosoHarness.atBottomAfterCalls = 6
		virtuosoHarness.atBottomSignalDelayMs = 20

		const capture = createDebugCapture()

		try {
			renderChatView()

			const baseTs = Date.now() - 10_000
			const initialMessages = buildLongHeterogeneousHistory(baseTs, true)

			await act(async () => {
				mockPostMessage({ debug: true, clineMessages: initialMessages })
			})

			await waitFor(
				() => {
					expect(
						capture.events.some(
							(event) => event.event === "row-height-change-callback" && event.shouldRearmSettle === true,
						),
					).toBe(true)
				},
				{ timeout: 2200 },
			)

			const rowGrowthRearmEvent = capture.events.find(
				(event) => event.event === "row-height-change-callback" && event.shouldRearmSettle === true,
			)
			const rowGrowthRearmTs = typeof rowGrowthRearmEvent?.ts === "number" ? rowGrowthRearmEvent.ts : 0

			await waitFor(
				() => {
					expect(
						capture.events.some(
							(event) =>
								event.event === "settle-start" &&
								event.source === "row-height-growth" &&
								event.ts >= rowGrowthRearmTs,
						),
					).toBe(true)
				},
				{ timeout: 2500 },
			)

			const rearmSettleStart = capture.events.find(
				(event) =>
					event.event === "settle-start" &&
					event.source === "row-height-growth" &&
					event.ts >= rowGrowthRearmTs,
			)
			const rearmSettleStartTs = typeof rearmSettleStart?.ts === "number" ? rearmSettleStart.ts : 0
			await waitFor(
				() => {
					expect(
						capture.events.some(
							(event) =>
								event.event === "settle-complete" &&
								event.reason === "stable" &&
								event.isAtBottom === true &&
								event.ts >= rearmSettleStartTs,
						),
					).toBe(true)
				},
				{ timeout: 1200 },
			)

			const stableCompleteAfterRearm = capture.events.find(
				(event) =>
					event.event === "settle-complete" &&
					event.reason === "stable" &&
					event.isAtBottom === true &&
					event.ts >= rearmSettleStartTs,
			)

			console.info(
				"[chat-scroll-repro][scenario=late-tail-growth-rearm-convergence]",
				JSON.stringify({
					rowGrowthRearmEvent,
					rearmSettleStart,
					stableCompleteAfterRearm,
				}),
			)

			expect(rowGrowthRearmEvent).toBeTruthy()
			expect(rearmSettleStart).toBeTruthy()
			expect(stableCompleteAfterRearm).toBeTruthy()
		} finally {
			capture.stop()
		}
	})

	it("uses the safety cap deterministically when bottom is never reached", async () => {
		virtuosoHarness.scrollCalls = 0
		virtuosoHarness.atBottomAfterCalls = Number.POSITIVE_INFINITY
		virtuosoHarness.atBottomSignalDelayMs = 20

		const capture = createDebugCapture()

		try {
			renderChatView()

			const baseTs = Date.now() - 30_000
			const initialMessages = buildLongHeterogeneousHistory(baseTs, false)

			await act(async () => {
				mockPostMessage({ debug: true, clineMessages: initialMessages })
			})

			await waitFor(
				() => {
					expect(capture.events.some((event) => event.event === "settle-complete")).toBe(true)
				},
				{ timeout: 3400 },
			)

			const timeoutSettleComplete = capture.events.find(
				(event) => event.event === "settle-complete" && event.reason === "timeout",
			)
			const elapsedMs =
				timeoutSettleComplete && typeof timeoutSettleComplete.elapsedMs === "number"
					? timeoutSettleComplete.elapsedMs
					: -1

			console.info(
				"[chat-scroll-repro][scenario=safety-cap-timeout]",
				JSON.stringify({
					timeoutSettleComplete,
					elapsedMs,
					scrollCalls: virtuosoHarness.scrollCalls,
				}),
			)

			expect(timeoutSettleComplete).toBeTruthy()
			expect(timeoutSettleComplete?.isAtBottom).toBe(false)
			expect(elapsedMs).toBeGreaterThanOrEqual(2400)
			expect(elapsedMs).toBeLessThanOrEqual(3300)
			expect(virtuosoHarness.scrollCalls).toBeGreaterThan(10)
		} finally {
			capture.stop()
		}
	})

	it("keeps settle lifecycle eligible across late rehydration waves and converges after re-arm", async () => {
		virtuosoHarness.scrollCalls = 0
		virtuosoHarness.atBottomAfterCalls = 5
		virtuosoHarness.atBottomSignalDelayMs = 18

		const capture = createDebugCapture()

		try {
			renderChatView()

			const baseTs = Date.now() - 45_000
			const initialMessages = buildLongHeterogeneousHistory(baseTs, false)

			await act(async () => {
				mockPostMessage({ debug: true, clineMessages: initialMessages })
			})

			await waitFor(
				() => {
					expect(capture.events.some((event) => event.event === "settle-window-opened")).toBe(true)
				},
				{ timeout: 1200 },
			)

			const windowOpened = capture.events.find((event) => event.event === "settle-window-opened")
			const deadlineMs = windowOpened ? getEventNumber(windowOpened, "deadlineMs") : undefined

			await waitFor(
				() => {
					expect(capture.events.some((event) => event.event === "settle-complete")).toBe(true)
				},
				{ timeout: 2500 },
			)

			const initialSettleComplete = capture.events.find((event) => event.event === "settle-complete")
			const initialSettleCompleteTs = typeof initialSettleComplete?.ts === "number" ? initialSettleComplete.ts : 0

			const waitMs = Math.max(0, (deadlineMs ?? Date.now()) - Date.now() + 220)
			await sleep(waitMs)

			const lateMessage: ClineMessage = {
				type: "say",
				say: "text",
				ts: baseTs + 700,
				text: "late hydration wave __LATE_GROW__",
			}
			const lateWaveMessages = [...initialMessages, lateMessage]

			await act(async () => {
				mockPostMessage({ debug: true, clineMessages: lateWaveMessages })
			})

			await act(async () => {
				mockMessageUpdated({ ...lateMessage, text: "late hydration wave __LATE_GROW__ updated" })
			})

			const lateMutationStartTs = Date.now()

			await waitFor(
				() => {
					expect(
						capture.events.some(
							(event) =>
								event.event === "grouped-messages-length-change" &&
								getEventBoolean(event, "budgetExtended") === true &&
								getEventBoolean(event, "windowOpen") === true,
						),
					).toBe(true)
				},
				{ timeout: 1700 },
			)

			await waitFor(
				() => {
					expect(
						capture.events.some(
							(event) =>
								event.event === "row-height-change-callback" &&
								getEventBoolean(event, "budgetExtended") === true &&
								getEventBoolean(event, "windowOpen") === true,
						),
					).toBe(true)
				},
				{ timeout: 3200 },
			)

			await waitFor(
				() => {
					expect(
						capture.events.some(
							(event) =>
								event.event === "settle-start" &&
								(event.source === "grouped-messages-length-change" ||
									event.source === "row-height-growth") &&
								event.ts >= lateMutationStartTs,
						),
					).toBe(true)
				},
				{ timeout: 2200 },
			)

			await waitFor(
				() => {
					expect(
						capture.events.some(
							(event) =>
								event.event === "settle-complete" &&
								event.reason === "stable" &&
								event.isAtBottom === true &&
								event.ts > initialSettleCompleteTs,
						),
					).toBe(true)
				},
				{ timeout: 2200 },
			)

			const firstAtBottomTrue = capture.events.find(
				(event) => event.event === "at-bottom-state-change" && event.isAtBottom === true,
			)

			const groupedLengthMutations = capture.events.filter(
				(event) => event.event === "grouped-messages-length-change",
			)
			const firstGroupedLengthMutation = groupedLengthMutations.at(0)
			const lastGroupedLengthMutation = groupedLengthMutations.at(-1)

			const lateRawLengthMutations = capture.events.filter((event) => {
				if (event.event !== "raw-messages-length-change") {
					return false
				}
				const eventTs = getEventNumber(event, "ts")
				return eventTs !== undefined && deadlineMs !== undefined && eventTs > deadlineMs
			})

			const successfulLateRearms = capture.events.filter((event) => {
				if (event.event !== "grouped-messages-length-change" && event.event !== "row-height-change-callback") {
					return false
				}
				const eventTs = getEventNumber(event, "ts")
				if (eventTs === undefined || eventTs <= (deadlineMs ?? 0)) {
					return false
				}
				return (
					getEventBoolean(event, "windowOpen") === true &&
					getEventBoolean(event, "shouldRearmSettle") === true
				)
			})

			const showScrollToBottomSuppressedWhileSettling = capture.events.filter(
				(event) =>
					event.event === "show-scroll-to-bottom-suppressed" && getEventBoolean(event, "windowOpen") === true,
			)

			const stableSettleAfterLateWave = capture.events.find(
				(event) =>
					event.event === "settle-complete" &&
					event.reason === "stable" &&
					event.isAtBottom === true &&
					event.ts > initialSettleCompleteTs,
			)

			console.info(
				"[chat-scroll-repro][scenario=hydration-aware-rearm-after-late-wave]",
				JSON.stringify({
					windowOpened,
					initialSettleComplete,
					firstAtBottomTrue,
					firstGroupedLengthMutation,
					lastGroupedLengthMutation,
					lateRawLengthMutations,
					successfulLateRearms,
					showScrollToBottomSuppressedWhileSettling,
					stableSettleAfterLateWave,
				}),
			)

			expect(deadlineMs).toBeTruthy()
			expect(firstAtBottomTrue).toBeTruthy()
			expect(firstGroupedLengthMutation).toBeTruthy()
			expect(lastGroupedLengthMutation).toBeTruthy()
			expect(lateRawLengthMutations.length).toBeGreaterThan(0)
			expect(successfulLateRearms.length).toBeGreaterThan(0)
			expect(showScrollToBottomSuppressedWhileSettling.length).toBeGreaterThan(0)
			expect(stableSettleAfterLateWave).toBeTruthy()
		} finally {
			capture.stop()
		}
	})
})
