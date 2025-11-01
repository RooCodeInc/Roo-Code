import { memo, useMemo, useEffect, useRef } from "react"
import { ClineMessage } from "@roo-code/types"
import { ClineSayBrowserAction } from "@roo/ExtensionMessage"
import { vscode } from "@src/utils/vscode"
import {
	MousePointer as MousePointerIcon,
	Keyboard,
	ArrowDown,
	ArrowUp,
	Pointer,
	Play,
	Check,
	Maximize2,
} from "lucide-react"
import { useExtensionState } from "@src/context/ExtensionStateContext"

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

interface BrowserActionRowProps {
	message: ClineMessage
	nextMessage?: ClineMessage
	actionIndex?: number
	totalActions?: number
}

// Get icon for each action type
const getActionIcon = (action: string) => {
	switch (action) {
		case "click":
			return <MousePointerIcon className="w-3.5 h-3.5 opacity-70" />
		case "type":
		case "press":
			return <Keyboard className="w-3.5 h-3.5 opacity-70" />
		case "scroll_down":
			return <ArrowDown className="w-3.5 h-3.5 opacity-70" />
		case "scroll_up":
			return <ArrowUp className="w-3.5 h-3.5 opacity-70" />
		case "launch":
			return <Play className="w-3.5 h-3.5 opacity-70" />
		case "close":
			return <Check className="w-3.5 h-3.5 opacity-70" />
		case "resize":
			return <Maximize2 className="w-3.5 h-3.5 opacity-70" />
		case "hover":
		default:
			return <Pointer className="w-3.5 h-3.5 opacity-70" />
	}
}

const BrowserActionRow = memo(({ message, nextMessage, actionIndex, totalActions }: BrowserActionRowProps) => {
	const { isBrowserSessionActive } = useExtensionState()
	const hasHandledAutoOpenRef = useRef(false)

	// Parse this specific browser action
	const browserAction = useMemo<ClineSayBrowserAction | null>(() => {
		try {
			return JSON.parse(message.text || "{}") as ClineSayBrowserAction
		} catch {
			return null
		}
	}, [message.text])

	// Get viewport dimensions from the result message if available
	const viewportDimensions = useMemo(() => {
		if (!nextMessage || nextMessage.say !== "browser_action_result") return null
		try {
			const result = JSON.parse(nextMessage.text || "{}")
			return {
				width: result.viewportWidth,
				height: result.viewportHeight,
			}
		} catch {
			return null
		}
	}, [nextMessage])

	// Format action display text
	const actionText = useMemo(() => {
		if (!browserAction) return "Browser action"

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
			if (!viewportDimensions?.width || !viewportDimensions?.height) {
				return `${x},${y}`
			}

			// Scale coordinates from image dimensions to viewport dimensions (same as backend)
			const scaledX = Math.round((x / imgWidth) * viewportDimensions.width)
			const scaledY = Math.round((y / imgHeight) * viewportDimensions.height)

			return `${scaledX},${scaledY}`
		}

		switch (browserAction.action) {
			case "launch":
				return `Launched browser`
			case "click":
				return `Clicked at: ${getViewportCoordinate(browserAction.coordinate)}`
			case "type":
				return `Typed: ${browserAction.text}`
			case "press":
				return `Pressed key: ${prettyKey(browserAction.text)}`
			case "hover":
				return `Hovered at: ${getViewportCoordinate(browserAction.coordinate)}`
			case "scroll_down":
				return "Scrolled down"
			case "scroll_up":
				return "Scrolled up"
			case "resize":
				return `Resized to: ${browserAction.size?.split(/[x,]/).join(" x ")}`
			case "close":
				return "Closed browser"
			default:
				return browserAction.action
		}
	}, [browserAction, viewportDimensions])

	// Auto-open Browser Session panel when:
	// 1. This is a "launch" action (new browser session) - always opens and navigates to launch
	// 2. Regular actions - only open panel if user hasn't manually closed it, let internal auto-advance logic handle step
	// Only run this once per action to avoid re-sending messages when scrolling
	useEffect(() => {
		if (!isBrowserSessionActive || hasHandledAutoOpenRef.current) {
			return
		}

		const isLaunchAction = browserAction?.action === "launch"

		if (isLaunchAction) {
			// Launch action: navigate to step 0 (the launch)
			vscode.postMessage({
				type: "showBrowserSessionPanelAtStep",
				stepIndex: 0,
				isLaunchAction: true,
			})
			hasHandledAutoOpenRef.current = true
		} else {
			// Regular actions: just show panel, don't navigate
			// BrowserSessionRow's internal auto-advance logic will handle jumping to new steps
			// only if user is currently on the most recent step
			vscode.postMessage({
				type: "showBrowserSessionPanelAtStep",
				isLaunchAction: false,
			})
			hasHandledAutoOpenRef.current = true
		}
	}, [isBrowserSessionActive, browserAction])

	const headerStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: "10px",
		marginBottom: "10px",
		wordBreak: "break-word",
	}

	return (
		<div className="px-[15px] py-[10px] pr-[6px]">
			{/* Header with action description - clicking opens Browser Session panel at this step */}
			<div
				style={headerStyle}
				className="cursor-pointer"
				onClick={() => {
					const idx = typeof actionIndex === "number" ? Math.max(0, actionIndex - 1) : 0
					vscode.postMessage({ type: "showBrowserSessionPanelAtStep", stepIndex: idx, forceShow: true })
				}}>
				<span
					className="codicon codicon-globe text-vscode-testing-iconPassed shrink-0"
					style={{ marginBottom: "-1.5px" }}
				/>
				<span style={{ fontWeight: "bold" }}>Browser Action</span>
				{actionIndex !== undefined && totalActions !== undefined && (
					<span style={{ fontWeight: "bold" }}>
						{" "}
						- {actionIndex}/{totalActions} -{" "}
					</span>
				)}
				{browserAction && (
					<>
						<span className="shrink-0">{getActionIcon(browserAction.action)}</span>
						<span className="flex-1 truncate">{actionText}</span>
					</>
				)}
			</div>
		</div>
	)
})

BrowserActionRow.displayName = "BrowserActionRow"

export default BrowserActionRow
