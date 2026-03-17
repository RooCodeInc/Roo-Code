/**
 * useScrollLifecycle
 *
 * Simplified chat scroll lifecycle with a short, time-boxed hydration window.
 *
 * - Task switch enters `HYDRATING_PINNED_TO_BOTTOM`
 * - We issue one immediate `scrollToIndex("LAST")` and one post-render retry
 * - During hydration, transient Virtuoso `atBottomStateChange(false)` signals
 *   are ignored so follow mode does not flicker off
 * - User escape intent (wheel / keyboard / pointer-upward drag / row expansion)
 *   moves to `USER_BROWSING_HISTORY` and prevents forced re-pinning
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useEvent } from "react-use"
import debounce from "debounce"
import type { VirtuosoHandle } from "react-virtuoso"

const HYDRATION_WINDOW_MS = 600
const HYDRATION_RETRY_WINDOW_MS = 160

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

	// --- Hydration window ---
	const isHydratingRef = useRef(false)
	const hydrationTimeoutRef = useRef<number | null>(null)
	const hydrationRetryUsedRef = useRef(false)

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

	const cancelReanchorFrame = useCallback(() => {
		if (reanchorAnimationFrameRef.current !== null) {
			cancelAnimationFrame(reanchorAnimationFrameRef.current)
			reanchorAnimationFrameRef.current = null
		}
	}, [])

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

	const clearHydrationWindow = useCallback(() => {
		isHydratingRef.current = false
		hydrationRetryUsedRef.current = false
		if (hydrationTimeoutRef.current !== null) {
			window.clearTimeout(hydrationTimeoutRef.current)
			hydrationTimeoutRef.current = null
		}
	}, [])

	const finishHydrationWindow = useCallback(() => {
		if (!isMountedRef.current || !isHydratingRef.current) {
			return
		}

		if (scrollPhaseRef.current === "HYDRATING_PINNED_TO_BOTTOM") {
			if (isAtBottomRef.current) {
				enterAnchoredFollowing()
			} else {
				if (!hydrationRetryUsedRef.current) {
					hydrationRetryUsedRef.current = true
					scrollToBottomAuto()
					hydrationTimeoutRef.current = window.setTimeout(() => {
						finishHydrationWindow()
					}, HYDRATION_RETRY_WINDOW_MS)
					return
				}

				// Retry budget exhausted. Keep anchored follow rather than
				// downgrading to browsing mode due to non-user transient drift.
				enterAnchoredFollowing()
			}
		}

		clearHydrationWindow()
	}, [clearHydrationWindow, enterAnchoredFollowing, scrollToBottomAuto])

	const startHydrationWindow = useCallback(() => {
		isHydratingRef.current = true
		hydrationRetryUsedRef.current = false
		if (hydrationTimeoutRef.current !== null) {
			window.clearTimeout(hydrationTimeoutRef.current)
		}
		hydrationTimeoutRef.current = window.setTimeout(() => {
			finishHydrationWindow()
		}, HYDRATION_WINDOW_MS)

		scrollToBottomAuto()
	}, [finishHydrationWindow, scrollToBottomAuto])

	// -----------------------------------------------------------------------
	// Lifecycle effects
	// -----------------------------------------------------------------------

	// Mounted guard + global cleanup
	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
			clearHydrationWindow()
			cancelReanchorFrame()
			scrollToBottomSmooth.clear()
		}
	}, [cancelReanchorFrame, clearHydrationWindow, scrollToBottomSmooth])

	// Keep phase ref in sync with state
	useEffect(() => {
		scrollPhaseRef.current = scrollPhase
	}, [scrollPhase])

	// Task switch: reset and begin a short hydration window
	useEffect(() => {
		isAtBottomRef.current = false
		clearHydrationWindow()
		cancelReanchorFrame()

		if (taskTs) {
			transitionScrollPhase("HYDRATING_PINNED_TO_BOTTOM")
			setShowScrollToBottom(false)
			startHydrationWindow()
		} else {
			transitionScrollPhase("USER_BROWSING_HISTORY")
			setShowScrollToBottom(false)
		}

		return () => {
			clearHydrationWindow()
			cancelReanchorFrame()
		}
	}, [cancelReanchorFrame, clearHydrationWindow, startHydrationWindow, taskTs, transitionScrollPhase])

	// -----------------------------------------------------------------------
	// Row height change handler
	// -----------------------------------------------------------------------

	const handleRowHeightChange = useCallback(
		(isTaller: boolean) => {
			if (
				scrollPhaseRef.current === "USER_BROWSING_HISTORY" ||
				scrollPhaseRef.current === "HYDRATING_PINNED_TO_BOTTOM"
			) {
				return
			}

			const shouldForcePinForAnchoredStreaming = scrollPhaseRef.current === "ANCHORED_FOLLOWING" && isStreaming
			if (isAtBottomRef.current || shouldForcePinForAnchoredStreaming) {
				if (isTaller) {
					scrollToBottomSmooth()
				} else {
					scrollToBottomAuto()
				}
			}
		},
		[isStreaming, scrollToBottomSmooth, scrollToBottomAuto],
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

			if (!isAtBottom && isHydratingRef.current && currentPhase !== "USER_BROWSING_HISTORY") {
				setShowScrollToBottom(false)
				return
			}

			if (isAtBottom) {
				if (currentPhase === "USER_BROWSING_HISTORY" && isHydratingRef.current) {
					setShowScrollToBottom(true)
					return
				}

				enterAnchoredFollowing()
				return
			}

			if (currentPhase === "ANCHORED_FOLLOWING" && !isAtBottom && pointerScrollActiveRef.current) {
				enterUserBrowsingHistory("pointer-scroll-up")
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
