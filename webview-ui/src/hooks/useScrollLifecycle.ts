/**
 * useScrollLifecycle
 *
 * Encapsulates the chat scroll lifecycle extracted from ChatView, making the
 * scroll logic testable in isolation and preventing it from growing the
 * component further.
 *
 * ## Scroll Phase Model
 *
 * 1. **HYDRATING_PINNED_TO_BOTTOM** – Active during task switch / rehydration.
 *    A settle loop repeatedly calls `scrollToIndex` until Virtuoso confirms
 *    the viewport is at the bottom for a stable run of consecutive frames.
 *    Transient `atBottomStateChange(false)` signals from Virtuoso layout
 *    reflows are suppressed during this phase.
 *
 * 2. **ANCHORED_FOLLOWING** – The user is at the bottom and new content should
 *    be followed automatically. `followOutput` returns `"auto"`.
 *
 * 3. **USER_BROWSING_HISTORY** – The user scrolled away from the bottom (via
 *    wheel, keyboard, pointer drag, or row expansion). `followOutput` returns
 *    `false` and the scroll-to-bottom CTA appears.
 *
 * ## Note on scrollToIndex vs scrollTo
 *
 * This implementation uses `scrollToIndex({ index: "LAST", align: "end" })`
 * rather than `scrollTo({ top: Number.MAX_SAFE_INTEGER })`.
 *
 * PR #6780 removed `scrollToIndex` because it caused scroll jitter. However,
 * that issue was triggered by passing a *numeric* index that could become
 * stale mid-render. The `"LAST"` constant is a Virtuoso built-in that
 * resolves to the current last item at call time, avoiding the stale-index
 * problem. Using `"LAST"` with `align: "end"` provides deterministic
 * bottom-anchoring without the `MAX_SAFE_INTEGER` overshooting that
 * `scrollTo` relied on.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useEvent } from "react-use"
import debounce from "debounce"
import type { VirtuosoHandle } from "react-virtuoso"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Soft deadline: resets on every new mutation observed during settle. */
const INITIAL_LOAD_SETTLE_TIMEOUT_MS = 2500

/**
 * Hard deadline: absolute upper bound for the settle window.
 *
 * Reduced from the original 10 s to 5 s. If rehydration takes longer than
 * this, there is likely a rendering performance issue worth investigating
 * separately rather than accommodating with a longer timeout.
 */
const INITIAL_LOAD_SETTLE_HARD_CAP_MS = 5000

/** Number of consecutive "at-bottom + stable tail" frames before we accept convergence. */
const INITIAL_LOAD_SETTLE_STABLE_FRAME_TARGET = 3

/** Frame-count safety valve derived from the hard cap at ~60 fps. */
const INITIAL_LOAD_SETTLE_MAX_FRAMES = Math.ceil(INITIAL_LOAD_SETTLE_HARD_CAP_MS / (1000 / 60))

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScrollPhase = "HYDRATING_PINNED_TO_BOTTOM" | "ANCHORED_FOLLOWING" | "USER_BROWSING_HISTORY"

export type ScrollFollowDisengageSource = "wheel-up" | "row-expansion" | "keyboard-nav-up" | "pointer-scroll-up"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isEditableKeyboardTarget = (target: EventTarget | null): boolean => {
	if (!(target instanceof HTMLElement)) {
		return false
	}
	if (target.isContentEditable) {
		return true
	}
	const tagName = target.tagName
	return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT"
}

// ---------------------------------------------------------------------------
// Hook interface
// ---------------------------------------------------------------------------

export interface UseScrollLifecycleOptions {
	virtuosoRef: React.RefObject<VirtuosoHandle | null>
	scrollContainerRef: React.RefObject<HTMLDivElement | null>
	taskTs: number | undefined
	isStreaming: boolean
	isHidden: boolean
	hasTask: boolean
	groupedMessagesLength: number
}

export interface UseScrollLifecycleReturn {
	scrollPhase: ScrollPhase
	showScrollToBottom: boolean
	handleRowHeightChange: (isTaller: boolean) => void
	handleScrollToBottomClick: () => void
	enterUserBrowsingHistory: (source: ScrollFollowDisengageSource) => void
	followOutputCallback: () => "auto" | false
	atBottomStateChangeCallback: (isAtBottom: boolean) => void
	scrollToBottomAuto: () => void
	isAtBottomRef: React.MutableRefObject<boolean>
	scrollPhaseRef: React.MutableRefObject<ScrollPhase>
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useScrollLifecycle({
	virtuosoRef,
	scrollContainerRef,
	taskTs,
	isStreaming,
	isHidden,
	hasTask,
	groupedMessagesLength,
}: UseScrollLifecycleOptions): UseScrollLifecycleReturn {
	// --- Mounted guard ---
	const isMountedRef = useRef(true)

	// --- Phase state ---
	const [scrollPhase, setScrollPhase] = useState<ScrollPhase>("USER_BROWSING_HISTORY")
	const scrollPhaseRef = useRef<ScrollPhase>("USER_BROWSING_HISTORY")

	// --- Visibility state ---
	const [showScrollToBottom, setShowScrollToBottom] = useState(false)

	// --- Bottom detection ---
	const isAtBottomRef = useRef(false)

	// --- Settle lifecycle refs ---
	const isSettlingRef = useRef(false)
	const settleTaskTsRef = useRef<number | null>(null)
	const settleDeadlineMsRef = useRef<number | null>(null)
	const settleHardDeadlineMsRef = useRef<number | null>(null)
	const settleAnimationFrameRef = useRef<number | null>(null)
	const settleStableFramesRef = useRef(0)
	const settleFrameCountRef = useRef(0)
	const settleBottomConfirmedRef = useRef(false)
	const settleMutationVersionRef = useRef(0)
	const settleObservedMutationVersionRef = useRef(0)

	// --- Mutation tracking ---
	const groupedMessagesLengthRef = useRef(0)

	// --- Pointer scroll tracking ---
	const pointerScrollActiveRef = useRef(false)
	const pointerScrollElementRef = useRef<HTMLElement | null>(null)
	const pointerScrollLastTopRef = useRef<number | null>(null)

	// --- Re-anchor frame ---
	const reanchorAnimationFrameRef = useRef<number | null>(null)

	// -----------------------------------------------------------------------
	// Phase transitions
	// -----------------------------------------------------------------------

	const transitionScrollPhase = useCallback((nextPhase: ScrollPhase) => {
		if (scrollPhaseRef.current === nextPhase) {
			return
		}
		scrollPhaseRef.current = nextPhase
		setScrollPhase(nextPhase)
	}, [])

	const beginHydrationPinnedToBottom = useCallback(() => {
		isAtBottomRef.current = false
		settleBottomConfirmedRef.current = false
		settleFrameCountRef.current = 0
		transitionScrollPhase("HYDRATING_PINNED_TO_BOTTOM")
		setShowScrollToBottom(false)
	}, [transitionScrollPhase])

	const enterAnchoredFollowing = useCallback(() => {
		transitionScrollPhase("ANCHORED_FOLLOWING")
		setShowScrollToBottom(false)
	}, [transitionScrollPhase])

	const enterUserBrowsingHistory = useCallback(
		(_source: ScrollFollowDisengageSource) => {
			transitionScrollPhase("USER_BROWSING_HISTORY")
			// Always show the scroll-to-bottom CTA when the user explicitly
			// disengages. If they happen to still be at the physical bottom,
			// the next Virtuoso atBottomStateChange(true) will hide it.
			setShowScrollToBottom(true)
		},
		[transitionScrollPhase],
	)

	// -----------------------------------------------------------------------
	// Settle window management
	// -----------------------------------------------------------------------

	const isSettleWindowOpen = useCallback((ts: number): boolean => {
		if (scrollPhaseRef.current !== "HYDRATING_PINNED_TO_BOTTOM") {
			return false
		}
		if (settleTaskTsRef.current !== ts) {
			return false
		}
		const nowMs = Date.now()
		const deadlineMs = settleDeadlineMsRef.current
		if (deadlineMs === null || nowMs > deadlineMs) {
			return false
		}
		const hardDeadlineMs = settleHardDeadlineMsRef.current
		return hardDeadlineMs === null || nowMs <= hardDeadlineMs
	}, [])

	const extendInitialSettleWindow = useCallback((ts: number): boolean => {
		if (scrollPhaseRef.current !== "HYDRATING_PINNED_TO_BOTTOM") {
			return false
		}
		if (settleTaskTsRef.current !== ts) {
			return false
		}
		const nowMs = Date.now()
		const hardDeadlineMs = settleHardDeadlineMsRef.current
		if (hardDeadlineMs !== null && nowMs > hardDeadlineMs) {
			return false
		}
		settleDeadlineMsRef.current = nowMs + INITIAL_LOAD_SETTLE_TIMEOUT_MS
		if (hardDeadlineMs === null) {
			settleHardDeadlineMsRef.current = nowMs + INITIAL_LOAD_SETTLE_HARD_CAP_MS
		}
		return true
	}, [])

	// -----------------------------------------------------------------------
	// Animation frame management
	// -----------------------------------------------------------------------

	const cancelInitialSettleFrame = useCallback(() => {
		if (settleAnimationFrameRef.current !== null) {
			cancelAnimationFrame(settleAnimationFrameRef.current)
			settleAnimationFrameRef.current = null
		}
	}, [])

	const cancelReanchorFrame = useCallback(() => {
		if (reanchorAnimationFrameRef.current !== null) {
			cancelAnimationFrame(reanchorAnimationFrameRef.current)
			reanchorAnimationFrameRef.current = null
		}
	}, [])

	// -----------------------------------------------------------------------
	// Settle completion
	// -----------------------------------------------------------------------

	const completeInitialSettle = useCallback(
		(ts: number) => {
			if (settleTaskTsRef.current !== ts) {
				return
			}

			cancelInitialSettleFrame()
			isSettlingRef.current = false

			if (scrollPhaseRef.current !== "HYDRATING_PINNED_TO_BOTTOM") {
				return
			}

			if (isAtBottomRef.current && settleBottomConfirmedRef.current) {
				enterAnchoredFollowing()
				return
			}
			transitionScrollPhase("USER_BROWSING_HISTORY")
			setShowScrollToBottom(true)
		},
		[cancelInitialSettleFrame, enterAnchoredFollowing, transitionScrollPhase],
	)

	// -----------------------------------------------------------------------
	// Settle frame loop
	// -----------------------------------------------------------------------

	const runInitialSettleFrame = useCallback(
		(ts: number) => {
			if (!isMountedRef.current) {
				return
			}
			if (!isSettlingRef.current || settleTaskTsRef.current !== ts) {
				return
			}

			settleFrameCountRef.current += 1
			if (settleFrameCountRef.current > INITIAL_LOAD_SETTLE_MAX_FRAMES) {
				completeInitialSettle(ts)
				return
			}

			if (!isSettleWindowOpen(ts)) {
				completeInitialSettle(ts)
				return
			}

			const mutationVersion = settleMutationVersionRef.current
			const isTailStable = mutationVersion === settleObservedMutationVersionRef.current
			settleObservedMutationVersionRef.current = mutationVersion

			if (isAtBottomRef.current && settleBottomConfirmedRef.current && isTailStable) {
				settleStableFramesRef.current += 1
			} else {
				settleStableFramesRef.current = 0
			}

			virtuosoRef.current?.scrollToIndex({ index: "LAST", align: "end", behavior: "auto" })

			if (settleStableFramesRef.current >= INITIAL_LOAD_SETTLE_STABLE_FRAME_TARGET) {
				completeInitialSettle(ts)
				return
			}

			settleAnimationFrameRef.current = requestAnimationFrame(() => runInitialSettleFrame(ts))
		},
		[completeInitialSettle, isSettleWindowOpen, virtuosoRef],
	)

	// -----------------------------------------------------------------------
	// Start settle
	// -----------------------------------------------------------------------

	const startInitialSettle = useCallback(
		(ts: number) => {
			if (scrollPhaseRef.current !== "HYDRATING_PINNED_TO_BOTTOM") {
				return
			}
			if (!isSettleWindowOpen(ts)) {
				return
			}
			if (isSettlingRef.current && settleTaskTsRef.current === ts) {
				return
			}

			cancelInitialSettleFrame()
			settleTaskTsRef.current = ts
			isSettlingRef.current = true
			settleStableFramesRef.current = 0
			settleFrameCountRef.current = 0
			settleObservedMutationVersionRef.current = settleMutationVersionRef.current
			settleAnimationFrameRef.current = requestAnimationFrame(() => runInitialSettleFrame(ts))
		},
		[cancelInitialSettleFrame, isSettleWindowOpen, runInitialSettleFrame],
	)

	// -----------------------------------------------------------------------
	// Scroll commands
	// -----------------------------------------------------------------------

	const scrollToBottomSmooth = useMemo(
		() =>
			debounce(
				() => virtuosoRef.current?.scrollToIndex({ index: "LAST", align: "end", behavior: "smooth" }),
				10,
				{ immediate: true },
			),
		[virtuosoRef],
	)

	const scrollToBottomAuto = useCallback(() => {
		virtuosoRef.current?.scrollToIndex({
			index: "LAST",
			align: "end",
			behavior: "auto",
		})
	}, [virtuosoRef])

	// -----------------------------------------------------------------------
	// Lifecycle effects
	// -----------------------------------------------------------------------

	// Mounted guard + global cleanup
	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
			cancelReanchorFrame()
			scrollToBottomSmooth.clear()
		}
	}, [cancelReanchorFrame, scrollToBottomSmooth])

	// Keep phase ref in sync with state
	useEffect(() => {
		scrollPhaseRef.current = scrollPhase
	}, [scrollPhase])

	// Task switch: reset settle state and begin hydration
	useEffect(() => {
		const taskSwitchMs = Date.now()
		settleStableFramesRef.current = 0
		settleFrameCountRef.current = 0
		settleBottomConfirmedRef.current = false
		settleMutationVersionRef.current = 0
		settleObservedMutationVersionRef.current = 0
		isAtBottomRef.current = false
		cancelInitialSettleFrame()
		cancelReanchorFrame()
		settleTaskTsRef.current = taskTs ?? null
		settleDeadlineMsRef.current = null
		settleHardDeadlineMsRef.current = null

		if (taskTs) {
			beginHydrationPinnedToBottom()
			isSettlingRef.current = false
			settleDeadlineMsRef.current = taskSwitchMs + INITIAL_LOAD_SETTLE_TIMEOUT_MS
			settleHardDeadlineMsRef.current = taskSwitchMs + INITIAL_LOAD_SETTLE_HARD_CAP_MS
			startInitialSettle(taskTs)
		} else {
			transitionScrollPhase("USER_BROWSING_HISTORY")
			setShowScrollToBottom(false)
		}

		return () => {
			cancelInitialSettleFrame()
			cancelReanchorFrame()
			settleTaskTsRef.current = null
			settleDeadlineMsRef.current = null
			settleHardDeadlineMsRef.current = null
			isSettlingRef.current = false
			settleBottomConfirmedRef.current = false
		}
	}, [
		beginHydrationPinnedToBottom,
		cancelInitialSettleFrame,
		cancelReanchorFrame,
		startInitialSettle,
		taskTs,
		transitionScrollPhase,
	])

	// Grouped messages mutation tracking
	useEffect(() => {
		const previousLength = groupedMessagesLengthRef.current
		groupedMessagesLengthRef.current = groupedMessagesLength

		if (previousLength === groupedMessagesLength) {
			return
		}

		settleMutationVersionRef.current += 1

		const settleTaskTs = settleTaskTsRef.current
		if (settleTaskTs !== null && extendInitialSettleWindow(settleTaskTs)) {
			startInitialSettle(settleTaskTs)
		}
	}, [groupedMessagesLength, extendInitialSettleWindow, startInitialSettle])

	// -----------------------------------------------------------------------
	// Row height change handler
	// -----------------------------------------------------------------------

	const handleRowHeightChange = useCallback(
		(isTaller: boolean) => {
			settleMutationVersionRef.current += 1

			const settleTaskTs = settleTaskTsRef.current
			if (isTaller && settleTaskTs !== null && extendInitialSettleWindow(settleTaskTs)) {
				startInitialSettle(settleTaskTs)
			}

			const shouldAutoFollowBottom = scrollPhaseRef.current !== "USER_BROWSING_HISTORY"
			const shouldForcePinForAnchoredStreaming = scrollPhaseRef.current === "ANCHORED_FOLLOWING" && isStreaming
			if ((isAtBottomRef.current || shouldForcePinForAnchoredStreaming) && shouldAutoFollowBottom) {
				if (isTaller) {
					scrollToBottomSmooth()
				} else {
					scrollToBottomAuto()
				}
			}
		},
		[extendInitialSettleWindow, isStreaming, scrollToBottomSmooth, scrollToBottomAuto, startInitialSettle],
	)

	// -----------------------------------------------------------------------
	// Scroll-to-bottom click handler
	// -----------------------------------------------------------------------

	const handleScrollToBottomClick = useCallback(() => {
		enterAnchoredFollowing()
		scrollToBottomAuto()
		cancelReanchorFrame()
		reanchorAnimationFrameRef.current = requestAnimationFrame(() => {
			reanchorAnimationFrameRef.current = null
			if (scrollPhaseRef.current === "ANCHORED_FOLLOWING") {
				scrollToBottomAuto()
			}
		})
	}, [cancelReanchorFrame, enterAnchoredFollowing, scrollToBottomAuto])

	// -----------------------------------------------------------------------
	// Virtuoso callback: followOutput
	// -----------------------------------------------------------------------

	const followOutputCallback = useCallback((): "auto" | false => {
		return scrollPhase === "USER_BROWSING_HISTORY" ? false : "auto"
	}, [scrollPhase])

	// -----------------------------------------------------------------------
	// Virtuoso callback: atBottomStateChange
	// -----------------------------------------------------------------------

	const atBottomStateChangeCallback = useCallback(
		(isAtBottom: boolean) => {
			isAtBottomRef.current = isAtBottom

			const currentPhase = scrollPhaseRef.current

			if (currentPhase === "HYDRATING_PINNED_TO_BOTTOM" && isAtBottom) {
				settleBottomConfirmedRef.current = true
			}

			if (currentPhase === "HYDRATING_PINNED_TO_BOTTOM" && !isAtBottom) {
				return
			}

			if (currentPhase === "ANCHORED_FOLLOWING" && !isAtBottom && pointerScrollActiveRef.current) {
				enterUserBrowsingHistory("pointer-scroll-up")
				return
			}

			if (isAtBottom) {
				setShowScrollToBottom(false)
				if (currentPhase === "USER_BROWSING_HISTORY") {
					enterAnchoredFollowing()
				}
				return
			}

			if (currentPhase === "ANCHORED_FOLLOWING" && isStreaming) {
				scrollToBottomAuto()
				setShowScrollToBottom(false)
				return
			}

			setShowScrollToBottom(currentPhase === "USER_BROWSING_HISTORY")
		},
		[enterAnchoredFollowing, enterUserBrowsingHistory, isStreaming, scrollToBottomAuto],
	)

	// -----------------------------------------------------------------------
	// User intent: wheel
	// -----------------------------------------------------------------------

	const handleWheel = useCallback(
		(event: Event) => {
			const wheelEvent = event as WheelEvent
			if (wheelEvent.deltaY < 0 && scrollContainerRef.current?.contains(wheelEvent.target as Node)) {
				enterUserBrowsingHistory("wheel-up")
			}
		},
		[enterUserBrowsingHistory, scrollContainerRef],
	)
	useEvent("wheel", handleWheel, window, { passive: true })

	// -----------------------------------------------------------------------
	// User intent: pointer drag
	// -----------------------------------------------------------------------

	const handlePointerDown = useCallback(
		(event: Event) => {
			const pointerEvent = event as PointerEvent
			const pointerTarget = pointerEvent.target
			if (!(pointerTarget instanceof HTMLElement)) {
				pointerScrollActiveRef.current = false
				pointerScrollElementRef.current = null
				pointerScrollLastTopRef.current = null
				return
			}

			if (!scrollContainerRef.current?.contains(pointerTarget)) {
				pointerScrollActiveRef.current = false
				pointerScrollElementRef.current = null
				pointerScrollLastTopRef.current = null
				return
			}

			const scroller =
				(pointerTarget.closest(".scrollable") as HTMLElement | null) ??
				(pointerTarget.scrollHeight > pointerTarget.clientHeight ? pointerTarget : null)

			pointerScrollActiveRef.current = scroller !== null
			pointerScrollElementRef.current = scroller
			pointerScrollLastTopRef.current = scroller?.scrollTop ?? null
		},
		[scrollContainerRef],
	)

	const handlePointerEnd = useCallback(() => {
		pointerScrollActiveRef.current = false
		pointerScrollElementRef.current = null
		pointerScrollLastTopRef.current = null
	}, [])

	const handlePointerActiveScroll = useCallback(
		(event: Event) => {
			if (!pointerScrollActiveRef.current) {
				return
			}

			const scrollTarget = event.target
			if (!(scrollTarget instanceof HTMLElement)) {
				return
			}

			if (!scrollContainerRef.current?.contains(scrollTarget)) {
				return
			}

			if (pointerScrollElementRef.current !== scrollTarget) {
				return
			}

			const previousTop = pointerScrollLastTopRef.current
			const currentTop = scrollTarget.scrollTop
			pointerScrollLastTopRef.current = currentTop

			if (previousTop !== null && currentTop < previousTop) {
				enterUserBrowsingHistory("pointer-scroll-up")
			}
		},
		[enterUserBrowsingHistory, scrollContainerRef],
	)

	useEvent("pointerdown", handlePointerDown, window, { passive: true })
	useEvent("pointerup", handlePointerEnd, window, { passive: true })
	useEvent("pointercancel", handlePointerEnd, window, { passive: true })
	useEvent("scroll", handlePointerActiveScroll, window, { passive: true, capture: true })

	// -----------------------------------------------------------------------
	// User intent: keyboard navigation
	// -----------------------------------------------------------------------

	const handleScrollKeyDown = useCallback(
		(event: Event) => {
			const keyEvent = event as KeyboardEvent

			if (!hasTask || isHidden) {
				return
			}

			if (keyEvent.metaKey || keyEvent.ctrlKey || keyEvent.altKey) {
				return
			}

			if (keyEvent.key !== "PageUp" && keyEvent.key !== "Home" && keyEvent.key !== "ArrowUp") {
				return
			}

			if (isEditableKeyboardTarget(keyEvent.target)) {
				return
			}

			const activeElement = document.activeElement
			const focusInsideChat =
				activeElement instanceof HTMLElement && !!scrollContainerRef.current?.contains(activeElement)
			const eventTargetInsideChat =
				keyEvent.target instanceof Node && !!scrollContainerRef.current?.contains(keyEvent.target)

			if (focusInsideChat || eventTargetInsideChat || activeElement === document.body) {
				enterUserBrowsingHistory("keyboard-nav-up")
			}
		},
		[enterUserBrowsingHistory, hasTask, isHidden, scrollContainerRef],
	)
	useEvent("keydown", handleScrollKeyDown, window)

	// -----------------------------------------------------------------------
	// Return public API
	// -----------------------------------------------------------------------

	return {
		scrollPhase,
		showScrollToBottom,
		handleRowHeightChange,
		handleScrollToBottomClick,
		enterUserBrowsingHistory,
		followOutputCallback,
		atBottomStateChangeCallback,
		scrollToBottomAuto,
		isAtBottomRef,
		scrollPhaseRef,
	}
}
