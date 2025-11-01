import React, { memo, useEffect, useMemo, useRef, useState } from "react"
import deepEqual from "fast-deep-equal"
import { useTranslation } from "react-i18next"
import type { ClineMessage } from "@roo-code/types"

import { BrowserAction, BrowserActionResult, ClineSayBrowserAction } from "@roo/ExtensionMessage"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"

import CodeBlock from "../common/CodeBlock"
import { Button, StandardTooltip } from "@src/components/ui"
import {
	Globe,
	Pointer,
	SquareTerminal,
	MousePointer as MousePointerIcon,
	Keyboard,
	ArrowDown,
	ArrowUp,
	Play,
	Check,
	Maximize2,
	OctagonX,
	ArrowLeft,
	ArrowRight,
	ChevronsLeft,
	ChevronsRight,
	ExternalLink,
	Copy,
} from "lucide-react"

const prettyKey = (k?: string): string => {
	if (!k) return ""
	return k
		.split("+")
		.map((part) => {
			const p = part.trim()
			const lower = p.toLowerCase()
			const map: Record<string, string> = {
				enter: "Enter",
				tab: "Tab",
				escape: "Esc",
				esc: "Esc",
				backspace: "Backspace",
				space: "Space",
				shift: "Shift",
				control: "Ctrl",
				ctrl: "Ctrl",
				alt: "Alt",
				meta: "Meta",
				command: "Cmd",
				cmd: "Cmd",
				arrowup: "Arrow Up",
				arrowdown: "Arrow Down",
				arrowleft: "Arrow Left",
				arrowright: "Arrow Right",
				pageup: "Page Up",
				pagedown: "Page Down",
				home: "Home",
				end: "End",
			}
			if (map[lower]) return map[lower]
			const keyMatch = /^Key([A-Z])$/.exec(p)
			if (keyMatch) return keyMatch[1].toUpperCase()
			const digitMatch = /^Digit([0-9])$/.exec(p)
			if (digitMatch) return digitMatch[1]
			const spaced = p.replace(/([a-z])([A-Z])/g, "$1 $2")
			return spaced.charAt(0).toUpperCase() + spaced.slice(1)
		})
		.join(" + ")
}

const getBrowserActionText = (
	action: BrowserAction,
	coordinate?: string,
	text?: string,
	size?: string,
	viewportWidth?: number,
	viewportHeight?: number,
) => {
	// Helper to scale coordinates from screenshot dimensions to viewport dimensions
	// Matches the backend's scaleCoordinate function logic
	const getViewportCoordinate = (coord?: string): string => {
		if (!coord) return ""

		// Parse "x,y@widthxheight" format
		const match = /^\s*(\d+)\s*,\s*(\d+)\s*@\s*(\d+)\s*[x,]\s*(\d+)\s*$/.exec(coord)
		if (!match) {
			// If no @dimensions, return as-is (might be plain x,y format)
			const simpleMatch = /^\s*(\d+)\s*,\s*(\d+)/.exec(coord)
			return simpleMatch ? `${simpleMatch[1]},${simpleMatch[2]}` : coord
		}

		const x = parseInt(match[1], 10)
		const y = parseInt(match[2], 10)
		const imgWidth = parseInt(match[3], 10)
		const imgHeight = parseInt(match[4], 10)

		// If we don't have viewport dimensions, just return the screenshot coordinates
		if (!viewportWidth || !viewportHeight) {
			return `${x},${y}`
		}

		// Scale coordinates from image dimensions to viewport dimensions (same as backend)
		const scaledX = Math.round((x / imgWidth) * viewportWidth)
		const scaledY = Math.round((y / imgHeight) * viewportHeight)

		return `${scaledX},${scaledY}`
	}

	switch (action) {
		case "launch":
			return `Launched browser`
		case "click":
			return `Clicked at: ${getViewportCoordinate(coordinate)}`
		case "type":
			return `Typed: ${text}`
		case "press":
			return `Pressed key: ${prettyKey(text)}`
		case "scroll_down":
			return "Scrolled down"
		case "scroll_up":
			return "Scrolled up"
		case "hover":
			return `Hovered at: ${getViewportCoordinate(coordinate)}`
		case "resize":
			return `Resized to: ${size?.split(/[x,]/).join(" x ")}`
		case "close":
			return "Closed browser"
		default:
			return action
	}
}

const getActionIcon = (action: BrowserAction) => {
	switch (action) {
		case "click":
			return <MousePointerIcon className="w-4 h-4 opacity-80" />
		case "type":
		case "press":
			return <Keyboard className="w-4 h-4 opacity-80" />
		case "scroll_down":
			return <ArrowDown className="w-4 h-4 opacity-80" />
		case "scroll_up":
			return <ArrowUp className="w-4 h-4 opacity-80" />
		case "launch":
			return <Play className="w-4 h-4 opacity-80" />
		case "close":
			return <Check className="w-4 h-4 opacity-80" />
		case "resize":
			return <Maximize2 className="w-4 h-4 opacity-80" />
		case "hover":
		default:
			return <Pointer className="w-4 h-4 opacity-80" />
	}
}

interface BrowserSessionRowProps {
	messages: ClineMessage[]
	isExpanded: (messageTs: number) => boolean
	onToggleExpand: (messageTs: number) => void
	lastModifiedMessage?: ClineMessage
	isLast: boolean
	onHeightChange: (isTaller: boolean) => void
	isStreaming: boolean
	onExpandChange?: (expanded: boolean) => void
	fullScreen?: boolean
	// Optional props for standalone panel (when not using ExtensionStateContext)
	browserViewportSizeProp?: string
	isBrowserSessionActiveProp?: boolean
	// Optional: navigate to a specific page index (used by Browser Session panel)
	navigateToPageIndex?: number
}

const BrowserSessionRow = memo((props: BrowserSessionRowProps) => {
	const { messages, isLast, onHeightChange, lastModifiedMessage, onExpandChange, fullScreen } = props
	const { t } = useTranslation()
	const prevHeightRef = useRef(0)
	const [consoleLogsExpanded, setConsoleLogsExpanded] = useState(false)
	const [nextActionsExpanded, setNextActionsExpanded] = useState(false)
	const [logFilter, setLogFilter] = useState<"all" | "debug" | "info" | "warn" | "error" | "log">("all")
	// Track screenshot container size for precise cursor positioning with object-fit: contain
	const screenshotRef = useRef<HTMLDivElement>(null)
	const [sW, setSW] = useState(0)
	const [sH, setSH] = useState(0)

	// Auto-expand drawer when in fullScreen takeover mode so content is visible immediately
	useEffect(() => {
		if (fullScreen) {
			setNextActionsExpanded(true)
		}
	}, [fullScreen])

	// Observe screenshot container size to align cursor correctly with letterboxing
	useEffect(() => {
		const el = screenshotRef.current
		if (!el) return
		const update = () => {
			const r = el.getBoundingClientRect()
			setSW(r.width)
			setSH(r.height)
		}
		update()
		const ro =
			typeof window !== "undefined" && "ResizeObserver" in window ? new ResizeObserver(() => update()) : null
		if (ro) ro.observe(el)
		return () => {
			if (ro) ro.disconnect()
		}
	}, [])

	// Try to use ExtensionStateContext if available, otherwise use props
	let browserViewportSize = props.browserViewportSizeProp || "900x600"
	let isBrowserSessionActive = props.isBrowserSessionActiveProp || false

	try {
		const extensionState = useExtensionState()
		browserViewportSize = extensionState.browserViewportSize || "900x600"
		isBrowserSessionActive = extensionState.isBrowserSessionActive || false
	} catch (_e) {
		// Not in ExtensionStateContext, use props
	}

	const [viewportWidth, viewportHeight] = browserViewportSize.split("x").map(Number)
	const defaultMousePosition = `${Math.round(viewportWidth / 2)},${Math.round(viewportHeight / 2)}`

	const isLastApiReqInterrupted = useMemo(() => {
		// Check if last api_req_started is cancelled
		const lastApiReqStarted = [...messages].reverse().find((m) => m.say === "api_req_started")
		if (lastApiReqStarted?.text) {
			const info = JSON.parse(lastApiReqStarted.text) as { cancelReason: string | null }
			if (info && info.cancelReason !== null) {
				return true
			}
		}
		const lastApiReqFailed = isLast && lastModifiedMessage?.ask === "api_req_failed"
		if (lastApiReqFailed) {
			return true
		}
		return false
	}, [messages, lastModifiedMessage, isLast])

	const isBrowsing = useMemo(() => {
		return isLast && messages.some((m) => m.say === "browser_action_result") && !isLastApiReqInterrupted // after user approves, browser_action_result with "" is sent to indicate that the session has started
	}, [isLast, messages, isLastApiReqInterrupted])

	// Organize messages into pages based on ALL browser actions (including those without screenshots)
	const pages = useMemo(() => {
		const result: {
			url?: string
			screenshot?: string
			mousePosition?: string
			consoleLogs?: string
			action?: ClineSayBrowserAction
			size?: string
			viewportWidth?: number
			viewportHeight?: number
		}[] = []

		// Build pages from browser_action messages and pair with results
		messages.forEach((message) => {
			if (message.say === "browser_action") {
				try {
					const action = JSON.parse(message.text || "{}") as ClineSayBrowserAction
					// Find the corresponding result message
					const resultMessage = messages.find(
						(m) => m.say === "browser_action_result" && m.ts > message.ts && m.text !== "",
					)

					if (resultMessage) {
						const resultData = JSON.parse(resultMessage.text || "{}") as BrowserActionResult
						result.push({
							url: resultData.currentUrl,
							screenshot: resultData.screenshot,
							mousePosition: resultData.currentMousePosition,
							consoleLogs: resultData.logs,
							action,
							size: action.size,
							viewportWidth: resultData.viewportWidth,
							viewportHeight: resultData.viewportHeight,
						})
					} else {
						// For actions without results (like close), add a page without screenshot
						result.push({ action, size: action.size })
					}
				} catch {
					// ignore parse errors
				}
			}
		})

		// Add placeholder page if no actions yet
		if (result.length === 0) {
			result.push({})
		}

		return result
	}, [messages])

	// Page index + user navigation guard (don't auto-jump while exploring history)
	const [currentPageIndex, setCurrentPageIndex] = useState(0)
	const hasUserNavigatedRef = useRef(false)
	const didInitIndexRef = useRef(false)
	const prevPagesLengthRef = useRef(0)

	useEffect(() => {
		// Initialize to last page on mount
		if (!didInitIndexRef.current && pages.length > 0) {
			didInitIndexRef.current = true
			setCurrentPageIndex(pages.length - 1)
			prevPagesLengthRef.current = pages.length
			return
		}

		// Auto-advance if user is on the most recent step and a new step arrives
		if (pages.length > prevPagesLengthRef.current) {
			const wasOnLastPage = currentPageIndex === prevPagesLengthRef.current - 1
			if (wasOnLastPage && !hasUserNavigatedRef.current) {
				// User was on the most recent step, auto-advance to the new step
				setCurrentPageIndex(pages.length - 1)
			}
			prevPagesLengthRef.current = pages.length
		}
	}, [pages.length, currentPageIndex])

	// External navigation request (from panel host)
	// Only navigate when navigateToPageIndex actually changes, not when pages.length changes
	const prevNavigateToPageIndexRef = useRef<number | undefined>()
	useEffect(() => {
		if (
			typeof props.navigateToPageIndex === "number" &&
			props.navigateToPageIndex !== prevNavigateToPageIndexRef.current &&
			pages.length > 0
		) {
			const idx = Math.max(0, Math.min(pages.length - 1, props.navigateToPageIndex))
			setCurrentPageIndex(idx)
			// Only reset manual navigation guard if navigating to the last page
			// This allows auto-advance to work when clicking to the most recent step
			// but prevents unwanted auto-advance when viewing historical steps
			if (idx === pages.length - 1) {
				hasUserNavigatedRef.current = false
			}
			prevNavigateToPageIndexRef.current = props.navigateToPageIndex
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [props.navigateToPageIndex])

	// Get initial URL from launch message
	const initialUrl = useMemo(() => {
		const launchMessage = messages.find((m) => m.ask === "browser_action_launch")
		return launchMessage?.text || ""
	}, [messages])

	const currentPage = pages[currentPageIndex]

	// Use actual viewport dimensions from result if available, otherwise fall back to settings

	// Find the last available screenshot and its associated data to use as placeholders
	const lastPageWithScreenshot = useMemo(() => {
		for (let i = pages.length - 1; i >= 0; i--) {
			if (pages[i].screenshot) {
				return pages[i]
			}
		}
		return undefined
	}, [pages])

	// Find last mouse position up to current page (not from future pages)
	const lastPageWithMousePositionUpToCurrent = useMemo(() => {
		for (let i = currentPageIndex; i >= 0; i--) {
			if (pages[i].mousePosition) {
				return pages[i]
			}
		}
		return undefined
	}, [pages, currentPageIndex])

	// Display state from current page, with smart fallbacks
	const displayState = {
		url: currentPage?.url || initialUrl,
		mousePosition:
			currentPage?.mousePosition || lastPageWithMousePositionUpToCurrent?.mousePosition || defaultMousePosition,
		consoleLogs: currentPage?.consoleLogs,
		screenshot: currentPage?.screenshot || lastPageWithScreenshot?.screenshot,
	}

	// Parse logs for counts and filtering
	const parsedLogs = useMemo(() => {
		const counts = { debug: 0, info: 0, warn: 0, error: 0, log: 0 }
		const byType: Record<"debug" | "info" | "warn" | "error" | "log", string[]> = {
			debug: [],
			info: [],
			warn: [],
			error: [],
			log: [],
		}
		const raw = displayState.consoleLogs || ""
		raw.split(/\r?\n/).forEach((line) => {
			const trimmed = line.trim()
			if (!trimmed) return
			const m = /^\[([^\]]+)\]\s*/i.exec(trimmed)
			let type = (m?.[1] || "").toLowerCase()
			if (type === "warning") type = "warn"
			if (!["debug", "info", "warn", "error", "log"].includes(type)) type = "log"
			counts[type as keyof typeof counts]++
			byType[type as keyof typeof byType].push(line)
		})
		return { counts, byType }
	}, [displayState.consoleLogs])

	const logsToShow = useMemo(() => {
		if (!displayState.consoleLogs) return t("chat:browser.noNewLogs") as string
		if (logFilter === "all") return displayState.consoleLogs
		const arr = parsedLogs.byType[logFilter]
		return arr.length ? arr.join("\n") : (t("chat:browser.noNewLogs") as string)
	}, [displayState.consoleLogs, logFilter, parsedLogs, t])

	// Meta for log badges (include "All" first)
	const logTypeMeta = [
		{ key: "all", label: "All" },
		{ key: "debug", label: "Debug" },
		{ key: "info", label: "Info" },
		{ key: "warn", label: "Warn" },
		{ key: "error", label: "Error" },
		{ key: "log", label: "Log" },
	] as const

	// Use a fixed standard aspect ratio and dimensions for the drawer to prevent flickering
	// Even if viewport changes, the drawer maintains consistent size
	const fixedDrawerWidth = 900
	const fixedDrawerHeight = 600
	const drawerAspectRatio = (fixedDrawerHeight / fixedDrawerWidth) * 100

	// For cursor positioning, use the viewport dimensions from the same page as the data we're displaying
	// This ensures cursor position matches the screenshot/mouse position being shown
	let cursorViewportWidth: number
	let cursorViewportHeight: number

	if (currentPage?.screenshot) {
		// Current page has screenshot - use its dimensions
		cursorViewportWidth = currentPage.viewportWidth ?? viewportWidth
		cursorViewportHeight = currentPage.viewportHeight ?? viewportHeight
	} else if (lastPageWithScreenshot) {
		// Using placeholder screenshot - use dimensions from that page
		cursorViewportWidth = lastPageWithScreenshot.viewportWidth ?? viewportWidth
		cursorViewportHeight = lastPageWithScreenshot.viewportHeight ?? viewportHeight
	} else {
		// No screenshot available - use default settings
		cursorViewportWidth = viewportWidth
		cursorViewportHeight = viewportHeight
	}

	// Get browser action for current page (now stored in pages array)
	const currentPageAction = useMemo(() => {
		return pages[currentPageIndex]?.action
	}, [pages, currentPageIndex])

	// Latest non-close browser_action for header summary (fallback)

	// Determine if the overall browser session is still active (spins until 'close')
	const lastBrowserActionOverall = useMemo(() => {
		const all = messages.filter((m) => m.say === "browser_action")
		return all.at(-1)
	}, [messages])

	// Use actual Playwright session state from extension (not message parsing)
	const isBrowserSessionOpen = isBrowserSessionActive

	// Check if currently performing a browser action (for spinner)
	const _isSessionActive = useMemo(() => {
		// Only show active spinner if a session has started
		const started = messages.some((m) => m.say === "browser_action_result")
		if (!started) return false
		// If the last API request got interrupted/cancelled, treat session as inactive
		if (isLastApiReqInterrupted) return false
		if (!lastBrowserActionOverall) return true
		try {
			const act = JSON.parse(lastBrowserActionOverall.text || "{}") as ClineSayBrowserAction
			return act.action !== "close"
		} catch {
			return true
		}
	}, [messages, lastBrowserActionOverall, isLastApiReqInterrupted])

	// Browser session drawer never auto-expands - user must manually toggle it

	// Calculate total API cost for the browser session
	const totalApiCost = useMemo(() => {
		let total = 0
		messages.forEach((message) => {
			if (message.say === "api_req_started" && message.text) {
				try {
					const data = JSON.parse(message.text)
					if (data.cost && typeof data.cost === "number") {
						total += data.cost
					}
				} catch {
					// Ignore parsing errors
				}
			}
		})
		return total
	}, [messages])

	// Local size tracking without react-use to avoid timers after unmount in tests
	const containerRef = useRef<HTMLDivElement>(null)
	const [rowHeight, setRowHeight] = useState(0)
	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		let mounted = true
		const setH = (h: number) => {
			if (mounted) setRowHeight(h)
		}
		const ro =
			typeof window !== "undefined" && "ResizeObserver" in window
				? new ResizeObserver((entries) => {
						const entry = entries[0]
						setH(entry?.contentRect?.height ?? el.getBoundingClientRect().height)
					})
				: null
		// initial
		setH(el.getBoundingClientRect().height)
		if (ro) ro.observe(el)
		return () => {
			mounted = false
			if (ro) ro.disconnect()
		}
	}, [])

	const browserSessionRow = (
		<div
			ref={containerRef}
			style={{
				padding: "6px 10px",
				background: "var(--vscode-editor-background,transparent)",
				height: "100%",
			}}>
			{/* Main header - clickable to expand/collapse, mimics TodoList style */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					marginBottom: 0,
					userSelect: "none",
				}}>
				{/* Globe icon - green when browser session is open */}
				<Globe
					className="w-4 h-4 shrink-0"
					style={{
						opacity: 0.7,
						color: isBrowserSessionOpen ? "#4ade80" : undefined, // green-400 when session is open
						cursor: fullScreen ? "default" : "pointer",
					}}
					aria-label="Browser interaction"
					{...(fullScreen
						? {}
						: {
								onClick: () =>
									setNextActionsExpanded((v) => {
										const nv = !v
										onExpandChange?.(nv)
										return nv
									}),
							})}
				/>

				{/* Simple text: "Browser Session" with step counter */}
				<span
					{...(fullScreen
						? {}
						: {
								onClick: () =>
									setNextActionsExpanded((v) => {
										const nv = !v
										onExpandChange?.(nv)
										return nv
									}),
							})}
					style={{
						flex: 1,
						fontSize: 13,
						fontWeight: 500,
						lineHeight: "22px",
						color: "var(--vscode-editor-foreground)",
						cursor: fullScreen ? "default" : "pointer",
						display: "flex",
						alignItems: "center",
						gap: 8,
					}}>
					{t("chat:browser.session")}
					{pages.length > 0 && (
						<span
							style={{
								fontSize: 11,
								opacity: 0.6,
								fontWeight: 400,
							}}>
							{currentPageIndex + 1}/{pages.length}
						</span>
					)}
					{/* Inline action summary to the right, similar to ChatView */}
					<span
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 6,
							fontSize: 12,
							color: "var(--vscode-descriptionForeground)",
							fontWeight: 400,
						}}>
						{(() => {
							const action = currentPageAction
							const pageSize = pages[currentPageIndex]?.size
							const pageViewportWidth = pages[currentPageIndex]?.viewportWidth
							const pageViewportHeight = pages[currentPageIndex]?.viewportHeight
							if (action) {
								return (
									<>
										{getActionIcon(action.action)}
										<span>
											{getBrowserActionText(
												action.action,
												action.coordinate,
												action.text,
												pageSize,
												pageViewportWidth,
												pageViewportHeight,
											)}
										</span>
									</>
								)
							} else if (initialUrl) {
								return (
									<>
										{getActionIcon("launch" as any)}
										<span>{getBrowserActionText("launch", undefined, initialUrl, undefined)}</span>
									</>
								)
							}
							return null
						})()}
					</span>
				</span>

				{/* Right side: cost badge and chevron */}
				{totalApiCost > 0 && (
					<div
						className="text-xs text-vscode-dropdown-foreground border-vscode-dropdown-border/50 border px-1.5 py-0.5 rounded-lg"
						style={{
							opacity: 0.4,
							height: "22px",
							display: "flex",
							alignItems: "center",
						}}>
						${totalApiCost.toFixed(4)}
					</div>
				)}

				{/* Chevron toggle hidden in fullScreen */}
				{!fullScreen && (
					<span
						onClick={() =>
							setNextActionsExpanded((v) => {
								const nv = !v
								onExpandChange?.(nv)
								return nv
							})
						}
						className={`codicon ${nextActionsExpanded ? "codicon-chevron-up" : "codicon-chevron-down"}`}
						style={{
							fontSize: 13,
							fontWeight: 500,
							lineHeight: "22px",
							color: "var(--vscode-editor-foreground)",
							cursor: "pointer",
							display: "inline-block",
							transition: "transform 150ms ease",
						}}
					/>
				)}

				{/* Kill browser button hidden from header in fullScreen; kept in toolbar */}
				{isBrowserSessionOpen && !fullScreen && (
					<StandardTooltip content="Disconnect session">
						<Button
							variant="ghost"
							size="icon"
							onClick={(e) => {
								e.stopPropagation()
								vscode.postMessage({ type: "killBrowserSession" })
							}}
							aria-label="Disconnect session">
							<OctagonX className="size-4" />
						</Button>
					</StandardTooltip>
				)}
			</div>

			{/* Expanded drawer content - inline/fullscreen */}
			{nextActionsExpanded && (
				<div
					style={{
						marginTop: fullScreen ? 0 : 6,
						background: "var(--vscode-editor-background)",
						border: "1px solid var(--vscode-panel-border)",
						borderRadius: fullScreen ? 0 : 6,
						overflow: "hidden",
						height: fullScreen ? "100%" : undefined,
						display: fullScreen ? "flex" : undefined,
						flexDirection: fullScreen ? "column" : undefined,
					}}>
					{/* Browser-like Toolbar */}
					<div
						style={{
							padding: "6px 8px",
							display: "flex",
							alignItems: "center",
							gap: "8px",
							borderBottom: "1px solid var(--vscode-panel-border)",
							background: "var(--vscode-editor-background)",
						}}>
						{/* Go to beginning */}
						<StandardTooltip content="Go to beginning">
							<button
								onClick={(e) => {
									e.stopPropagation()
									hasUserNavigatedRef.current = true
									setCurrentPageIndex(0)
								}}
								disabled={currentPageIndex === 0 || isBrowsing}
								style={{
									background: "none",
									border: "1px solid var(--vscode-panel-border)",
									borderRadius: 4,
									cursor: currentPageIndex === 0 || isBrowsing ? "not-allowed" : "pointer",
									opacity: currentPageIndex === 0 || isBrowsing ? 0.4 : 0.85,
									padding: "4px",
									display: "flex",
									alignItems: "center",
									color: "var(--vscode-foreground)",
								}}
								aria-label="Go to beginning">
								<ChevronsLeft className="w-4 h-4" />
							</button>
						</StandardTooltip>

						{/* Back */}
						<StandardTooltip content="Back">
							<button
								onClick={(e) => {
									e.stopPropagation()
									hasUserNavigatedRef.current = true
									setCurrentPageIndex((i) => Math.max(0, i - 1))
								}}
								disabled={currentPageIndex === 0 || isBrowsing}
								style={{
									background: "none",
									border: "1px solid var(--vscode-panel-border)",
									borderRadius: 4,
									cursor: currentPageIndex === 0 || isBrowsing ? "not-allowed" : "pointer",
									opacity: currentPageIndex === 0 || isBrowsing ? 0.4 : 0.85,
									padding: "4px",
									display: "flex",
									alignItems: "center",
									color: "var(--vscode-foreground)",
								}}
								aria-label="Back">
								<ArrowLeft className="w-4 h-4" />
							</button>
						</StandardTooltip>

						{/* Forward */}
						<StandardTooltip content="Forward">
							<button
								onClick={(e) => {
									e.stopPropagation()
									const nextIndex = Math.min(pages.length - 1, currentPageIndex + 1)
									// Reset user navigation flag if going to the last page
									hasUserNavigatedRef.current = nextIndex !== pages.length - 1
									setCurrentPageIndex(nextIndex)
								}}
								disabled={currentPageIndex === pages.length - 1 || isBrowsing}
								style={{
									background: "none",
									border: "1px solid var(--vscode-panel-border)",
									borderRadius: 4,
									cursor:
										currentPageIndex === pages.length - 1 || isBrowsing ? "not-allowed" : "pointer",
									opacity: currentPageIndex === pages.length - 1 || isBrowsing ? 0.4 : 0.85,
									padding: "4px",
									display: "flex",
									alignItems: "center",
									color: "var(--vscode-foreground)",
								}}
								aria-label="Forward">
								<ArrowRight className="w-4 h-4" />
							</button>
						</StandardTooltip>

						{/* Go to end */}
						<StandardTooltip content="Go to end">
							<button
								onClick={(e) => {
									e.stopPropagation()
									// Reset user navigation flag since we're going to the most recent page
									hasUserNavigatedRef.current = false
									setCurrentPageIndex(pages.length - 1)
								}}
								disabled={currentPageIndex === pages.length - 1 || isBrowsing}
								style={{
									background: "none",
									border: "1px solid var(--vscode-panel-border)",
									borderRadius: 4,
									cursor:
										currentPageIndex === pages.length - 1 || isBrowsing ? "not-allowed" : "pointer",
									opacity: currentPageIndex === pages.length - 1 || isBrowsing ? 0.4 : 0.85,
									padding: "4px",
									display: "flex",
									alignItems: "center",
									color: "var(--vscode-foreground)",
								}}
								aria-label="Go to end">
								<ChevronsRight className="w-4 h-4" />
							</button>
						</StandardTooltip>

						{/* Address Bar */}
						<div
							role="group"
							aria-label="Address bar"
							style={{
								flex: 1,
								display: "flex",
								alignItems: "center",
								gap: 8,
								border: "1px solid var(--vscode-panel-border)",
								borderRadius: 999,
								padding: "4px 10px",
								background: "var(--vscode-input-background)",
								color: "var(--vscode-descriptionForeground)",
								minHeight: 26,
								overflow: "hidden",
							}}>
							<Globe className="w-3 h-3 shrink-0 opacity-60" />
							<span
								style={{
									fontSize: 12,
									lineHeight: "18px",
									textOverflow: "ellipsis",
									overflow: "hidden",
									whiteSpace: "nowrap",
									color: "var(--vscode-foreground)",
								}}>
								{displayState.url || "about:blank"}
							</span>
							{/* Step counter removed */}
						</div>

						{/* Kill (Disconnect) replaces Reload */}
						<StandardTooltip content="Disconnect session">
							<button
								onClick={(e) => {
									e.stopPropagation()
									vscode.postMessage({ type: "killBrowserSession" })
								}}
								style={{
									background: "none",
									border: "1px solid var(--vscode-panel-border)",
									borderRadius: 4,
									cursor: "pointer",
									opacity: 0.85,
									padding: "4px",
									display: "flex",
									alignItems: "center",
									color: "var(--vscode-foreground)",
								}}
								aria-label="Disconnect session">
								<OctagonX className="w-4 h-4" />
							</button>
						</StandardTooltip>

						{/* Open External */}
						<StandardTooltip content="Open in external browser">
							<button
								onClick={(e) => {
									e.stopPropagation()
									if (displayState.url) {
										vscode.postMessage({ type: "openExternal", url: displayState.url })
									}
								}}
								style={{
									background: "none",
									border: "1px solid var(--vscode-panel-border)",
									borderRadius: 4,
									cursor: displayState.url ? "pointer" : "not-allowed",
									opacity: displayState.url ? 0.85 : 0.4,
									padding: "4px",
									display: "flex",
									alignItems: "center",
									color: "var(--vscode-foreground)",
								}}
								aria-label="Open external"
								disabled={!displayState.url}>
								<ExternalLink className="w-4 h-4" />
							</button>
						</StandardTooltip>

						{/* Copy URL */}
						<StandardTooltip content="Copy URL">
							<button
								onClick={async (e) => {
									e.stopPropagation()
									try {
										await navigator.clipboard.writeText(displayState.url || "")
									} catch {
										// ignore
									}
								}}
								style={{
									background: "none",
									border: "1px solid var(--vscode-panel-border)",
									borderRadius: 4,
									cursor: "pointer",
									opacity: 0.85,
									padding: "4px",
									display: "flex",
									alignItems: "center",
									color: "var(--vscode-foreground)",
								}}
								aria-label="Copy URL">
								<Copy className="w-4 h-4" />
							</button>
						</StandardTooltip>
					</div>

					{/* Screenshot Area */}
					<div
						data-testid="screenshot-container"
						ref={screenshotRef}
						style={{
							width: "100%",
							position: "relative",
							backgroundColor: "var(--vscode-input-background)",
							borderBottom: "1px solid var(--vscode-panel-border)",
							...(fullScreen
								? { flex: 1, minHeight: 0 }
								: { paddingBottom: `${drawerAspectRatio.toFixed(2)}%` }),
						}}>
						{displayState.screenshot ? (
							<img
								src={displayState.screenshot}
								alt={t("chat:browser.screenshot")}
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									width: "100%",
									height: "100%",
									objectFit: "contain",
									objectPosition: "top center",
									cursor: "pointer",
								}}
								onClick={() =>
									vscode.postMessage({
										type: "openImage",
										text: displayState.screenshot,
									})
								}
							/>
						) : (
							<div
								style={{
									position: "absolute",
									top: "50%",
									left: "50%",
									transform: "translate(-50%, -50%)",
								}}>
								<span
									className="codicon codicon-globe"
									style={{ fontSize: "80px", color: "var(--vscode-descriptionForeground)" }}
								/>
							</div>
						)}
						{displayState.mousePosition &&
							(() => {
								// Use measured size if available; otherwise fall back to current client size so cursor remains visible
								const containerW = sW || (screenshotRef.current?.clientWidth ?? 0)
								const containerH = sH || (screenshotRef.current?.clientHeight ?? 0)
								if (containerW <= 0 || containerH <= 0) {
									// Minimal fallback to keep cursor visible before first measurement
									return (
										<BrowserCursor
											style={{
												position: "absolute",
												top: `0px`,
												left: `0px`,
												zIndex: 2,
												pointerEvents: "none",
											}}
										/>
									)
								}

								// Compute displayed image box within the container for object-fit: contain; objectPosition: top center
								const imgAspect = cursorViewportWidth / cursorViewportHeight
								const containerAspect = containerW / containerH
								let displayW = containerW
								let displayH = containerH
								let offsetX = 0
								let offsetY = 0
								if (containerAspect > imgAspect) {
									// Full height, letterboxed left/right; top aligned
									displayH = containerH
									displayW = containerH * imgAspect
									offsetX = (containerW - displayW) / 2
									offsetY = 0
								} else {
									// Full width, potential space below; top aligned
									displayW = containerW
									displayH = containerW / imgAspect
									offsetX = 0
									offsetY = 0
								}

								// Parse "x,y" or "x,y@widthxheight" for original basis
								const m = /^\s*(\d+)\s*,\s*(\d+)(?:\s*@\s*(\d+)\s*[x,]\s*(\d+))?\s*$/.exec(
									displayState.mousePosition || "",
								)
								const mx = parseInt(m?.[1] || "0", 10)
								const my = parseInt(m?.[2] || "0", 10)
								const baseW = m?.[3] ? parseInt(m[3], 10) : cursorViewportWidth
								const baseH = m?.[4] ? parseInt(m[4], 10) : cursorViewportHeight

								const leftPx = offsetX + (baseW > 0 ? (mx / baseW) * displayW : 0)
								const topPx = offsetY + (baseH > 0 ? (my / baseH) * displayH : 0)

								return (
									<BrowserCursor
										style={{
											position: "absolute",
											top: `${topPx}px`,
											left: `${leftPx}px`,
											zIndex: 2,
											pointerEvents: "none",
											transition: "top 0.15s ease-out, left 0.15s ease-out",
										}}
									/>
								)
							})()}
					</div>

					{/* Browser Action summary moved inline to header; row removed */}

					{/* Console Logs Section (collapsible, default collapsed) */}
					<div
						style={{
							padding: "8px 10px",
							// Pin logs to bottom of the fullscreen drawer
							marginTop: fullScreen ? "auto" : undefined,
						}}>
						<div
							onClick={(e) => {
								e.stopPropagation()
								setConsoleLogsExpanded((v) => !v)
							}}
							className="text-vscode-editor-foreground/70 hover:text-vscode-editor-foreground transition-colors"
							style={{
								display: "flex",
								alignItems: "center",
								gap: "8px",
								marginBottom: consoleLogsExpanded ? "6px" : 0,
								cursor: "pointer",
							}}>
							<SquareTerminal className="w-3" />
							<span className="text-xs" style={{ fontWeight: 500 }}>
								{t("chat:browser.consoleLogs")}
							</span>

							{/* Log type indicators */}
							<div
								onClick={(e) => e.stopPropagation()}
								style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
								{logTypeMeta.map(({ key, label }) => {
									const isAll = key === "all"
									const count = isAll
										? (Object.values(parsedLogs.counts) as number[]).reduce((a, b) => a + b, 0)
										: parsedLogs.counts[key as "debug" | "info" | "warn" | "error" | "log"]
									const isActive = logFilter === (key as any)
									const disabled = count === 0
									return (
										<button
											key={key}
											onClick={() => {
												setConsoleLogsExpanded(true)
												setLogFilter(
													isAll
														? "all"
														: (prev) => (prev === (key as any) ? "all" : (key as any)),
												)
											}}
											disabled={disabled}
											title={`${label}: ${count}`}
											style={{
												border: "1px solid var(--vscode-panel-border)",
												borderRadius: 999,
												padding: "0 6px",
												height: 18,
												lineHeight: "16px",
												fontSize: 10,
												color: "var(--vscode-foreground)",
												background: isActive
													? "var(--vscode-editor-selectionBackground)"
													: "transparent",
												opacity: disabled ? 0.35 : 0.85,
												cursor: disabled ? "not-allowed" : "pointer",
											}}>
											{label}: {count}
										</button>
									)
								})}
								<span
									onClick={() => setConsoleLogsExpanded((v) => !v)}
									className={`codicon codicon-chevron-${consoleLogsExpanded ? "down" : "right"}`}
									style={{ marginLeft: 6 }}
								/>
							</div>
						</div>
						{consoleLogsExpanded && (
							<div style={{ marginTop: "6px" }}>
								<CodeBlock source={logsToShow} language="shell" />
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	)

	// Height change effect
	useEffect(() => {
		const isInitialRender = prevHeightRef.current === 0
		if (isLast && rowHeight !== 0 && rowHeight !== Infinity && rowHeight !== prevHeightRef.current) {
			if (!isInitialRender) {
				onHeightChange(rowHeight > prevHeightRef.current)
			}
			prevHeightRef.current = rowHeight
		}
	}, [rowHeight, isLast, onHeightChange])

	return browserSessionRow
}, deepEqual)

const BrowserCursor: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
	const { t } = useTranslation()
	// (can't use svgs in vsc extensions)
	const cursorBase64 =
		"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAYCAYAAAAVibZIAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAFaADAAQAAAABAAAAGAAAAADwi9a/AAADGElEQVQ4EZ2VbUiTURTH772be/PxZdsz3cZwC4RVaB8SAjMpxQwSWZbQG/TFkN7oW1Df+h6IRV9C+hCpKUSIZUXOfGM5tAKViijFFEyfZ7Ol29S1Pbdzl8Uw9+aBu91zzv3/nt17zt2DEZjBYOAkKrtFMXIghAWM8U2vMN/FctsxGRMpM7NbEEYNMM2CYUSInlJx3OpawO9i+XSNQYkmk2uFb9njzkcfVSr1p/GJiQKMULVaw2WuBv296UKRxWJR6wxGCmM1EAhSNppv33GBH9qI32cPTAtss9lUm6EM3N7R+RbigT+5/CeosFCZKpjEW+iorS1pb30wDUXzQfHqtD/9L3ieZ2ee1OJCmbL8QHnRs+4uj0wmW4QzrpCwvJ8zGg3JqAmhTLynuLiwv8/5KyND8Q3cEkUEDWu15oJE4KRQJt5hs1rcriGNRqP+DK4dyyWXXm/aFQ+cEpSJ8/LyDGPuEZNOmzsOroUSOqzXG/dtBU4ZysTZYKNut91sNo2Cq6cE9enz86s2g9OCMrFSqVC5hgb32u072W3jKMU90Hb1seC0oUwsB+t92bO/rKx0EFGkgFCnjjc1/gVvC8rE0L+4o63t4InjxwbAJQjTe3qD8QrLkXA4DC24fWtuajp06cLFYSBIFKGmXKPRRmAnME9sPt+yLwIWb9WN69fKoTneQz4Dh2mpPNkvfeV0jjecb9wNAkwIEVQq5VJOds4Kb+DXoAsiVquVwI1Dougpij6UyGYx+5cKroeDEFibm5lWRRMbH1+npmYrq6qhwlQHIbajZEf1fElcqGGFpGg9HMuKzpfBjhytCTMgkJ56RX09zy/ysENTBElmjIgJnmNChJqohDVQqpEfwkILE8v/o0GAnV9F1eEvofVQCbiTBEXOIPQh5PGgefDZeAcjrpGZjULBr/m3tZOnz7oEQWRAQZLjWlEU/XEJWySiILgRc5Cz1DkcAyuBFcnpfF0JiXWKpcolQXizhS5hKAqFpr0MVbgbuxJ6+5xX+P4wNpbqPPrugZfbmIbLmgQR3Aw8QSi66hUXulOFbF73GxqjE5BNXWNeAAAAAElFTkSuQmCC"

	return (
		<img
			src={cursorBase64}
			style={{
				width: "17px",
				height: "22px",
				...style,
			}}
			alt={t("chat:browser.cursor")}
			aria-label={t("chat:browser.cursor")}
		/>
	)
}

export default BrowserSessionRow
