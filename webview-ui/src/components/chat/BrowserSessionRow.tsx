import React, { memo, useEffect, useMemo, useRef, useState } from "react"
import { useSize } from "react-use"
import deepEqual from "fast-deep-equal"
import { useTranslation } from "react-i18next"

import type { ClineMessage } from "@roo-code/types"

import { BrowserAction, BrowserActionResult, ClineSayBrowserAction } from "@roo/ExtensionMessage"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"

import CodeBlock, { CODE_BLOCK_BG_COLOR } from "../common/CodeBlock"
import { ProgressIndicator } from "./ProgressIndicator"
import { Globe, Pointer, SquareTerminal } from "lucide-react"

interface BrowserSessionRowProps {
	messages: ClineMessage[]
	isExpanded: (messageTs: number) => boolean
	onToggleExpand: (messageTs: number) => void
	lastModifiedMessage?: ClineMessage
	isLast: boolean
	onHeightChange: (isTaller: boolean) => void
	isStreaming: boolean
}

const BrowserSessionRow = memo((props: BrowserSessionRowProps) => {
	const { messages, isLast, onHeightChange, lastModifiedMessage } = props
	const { t } = useTranslation()
	const prevHeightRef = useRef(0)
	const [consoleLogsExpanded, setConsoleLogsExpanded] = useState(false)

	const { browserViewportSize = "900x600" } = useExtensionState()
	const [viewportWidth, viewportHeight] = browserViewportSize.split("x").map(Number)
	const aspectRatio = ((viewportHeight / viewportWidth) * 100).toFixed(2)
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
		return isLast && messages.some((m) => m.say === "browser_action_result") && !isLastApiReqInterrupted
	}, [isLast, messages, isLastApiReqInterrupted])

	// Get initial URL from launch message
	const initialUrl = useMemo(() => {
		const launchMessage = messages.find((m) => m.ask === "browser_action_launch")
		return launchMessage?.text || ""
	}, [messages])

	// Find the LATEST browser action result only (no history needed)
	const latestState = useMemo(() => {
		// Search backwards to find the most recent browser_action_result
		for (let i = messages.length - 1; i >= 0; i--) {
			const message = messages[i]
			if (message.say === "browser_action_result" && message.text && message.text !== "") {
				const resultData = JSON.parse(message.text) as BrowserActionResult
				return {
					url: resultData.currentUrl,
					screenshot: resultData.screenshot,
					mousePosition: resultData.currentMousePosition,
					consoleLogs: resultData.logs,
				}
			}
		}
		return { url: undefined, screenshot: undefined, mousePosition: undefined, consoleLogs: undefined }
	}, [messages])

	// Display state is simply the latest state or defaults
	const displayState = {
		url: latestState.url || initialUrl,
		screenshot: latestState.screenshot,
		mousePosition: latestState.mousePosition || defaultMousePosition,
		consoleLogs: latestState.consoleLogs,
	}

	// Find latest browser action and click position
	const latestBrowserAction = useMemo(() => {
		// Look through messages backwards for the latest browser_action
		for (let i = messages.length - 1; i >= 0; i--) {
			const message = messages[i]
			if (message.say === "browser_action" && message.text) {
				const browserAction = JSON.parse(message.text) as ClineSayBrowserAction
				return browserAction
			}
		}
		return undefined
	}, [messages])

	const latestClickPosition = useMemo(() => {
		if (!isBrowsing || !latestBrowserAction) return undefined
		if (latestBrowserAction.action === "click" && latestBrowserAction.coordinate) {
			return latestBrowserAction.coordinate
		}
		return undefined
	}, [isBrowsing, latestBrowserAction])

	const mousePosition = isBrowsing
		? latestClickPosition || displayState.mousePosition
		: displayState.mousePosition || defaultMousePosition

	const [browserSessionRow, { height: rowHeight }] = useSize(
		<div style={{ padding: "10px 6px 10px 15px", marginBottom: -10 }}>
			<div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
				{isBrowsing ? <ProgressIndicator /> : <Pointer className="w-4" aria-label="Browser action indicator" />}
				<span style={{ fontWeight: "bold" }}>
					<>{t("chat:browser.rooWantsToUse")}</>
				</span>
			</div>
			<div
				className="ml-6 mb-4 border-border"
				style={{
					borderRadius: 6,
					overflow: "hidden",
					backgroundColor: CODE_BLOCK_BG_COLOR,
				}}>
				{/* URL Bar */}
				<div
					style={{
						margin: "0px auto",
						width: "calc(100%)",
						boxSizing: "border-box", // includes padding in width calculation
						borderRadius: "4px 4px 0 0",
						padding: "5px",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "var(--vscode-descriptionForeground)",
						fontSize: "12px",
					}}>
					<div
						style={{
							cursor: "default",
							textOverflow: "ellipsis",
							overflow: "hidden",
							whiteSpace: "nowrap",
							width: "100%",
							textAlign: "center",
						}}>
						<Globe className="w-3 inline -mt-0.5 mr-2 opacity-50" />
						{displayState.url || "http"}
					</div>
				</div>

				{/* Screenshot Area */}
				<div
					data-testid="screenshot-container"
					className="hover:opacity-90 transition-all"
					style={{
						width: "100%",
						paddingBottom: `${aspectRatio}%`, // height/width ratio
						position: "relative",
						backgroundColor: "var(--vscode-input-background)",
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
					{displayState.mousePosition && (
						<BrowserCursor
							style={{
								position: "absolute",
								top: `${(parseInt(mousePosition.split(",")[1]) / viewportHeight) * 100}%`,
								left: `${(parseInt(mousePosition.split(",")[0]) / viewportWidth) * 100}%`,
								transition: "top 0.3s ease-out, left 0.3s ease-out",
							}}
						/>
					)}
				</div>

				{/* Console Logs Accordion */}
				<div
					onClick={() => {
						setConsoleLogsExpanded(!consoleLogsExpanded)
					}}
					className="flex items-center justify-between gap-2 text-vscode-editor-foreground/50 hover:text-vscode-editor-foreground transition-colors"
					style={{
						width: "100%",
						cursor: "pointer",
						padding: `9px 10px ${consoleLogsExpanded ? 0 : 8}px 10px`,
					}}>
					<SquareTerminal className="w-3" />
					<span className="grow text-xs">{t("chat:browser.consoleLogs")}</span>
					<span className={`codicon codicon-chevron-${consoleLogsExpanded ? "down" : "right"}`}></span>
				</div>
				{consoleLogsExpanded && (
					<CodeBlock source={displayState.consoleLogs || t("chat:browser.noNewLogs")} language="shell" />
				)}
			</div>

			{/* Show latest browser action */}
			{latestBrowserAction && (
				<BrowserActionBox
					action={latestBrowserAction.action}
					coordinate={latestBrowserAction.coordinate}
					text={latestBrowserAction.text}
				/>
			)}
		</div>,
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

const BrowserActionBox = ({
	action,
	coordinate,
	text,
}: {
	action: BrowserAction
	coordinate?: string
	text?: string
}) => {
	const { t } = useTranslation()
	const getBrowserActionText = (action: BrowserAction, coordinate?: string, text?: string) => {
		switch (action) {
			case "launch":
				return t("chat:browser.actions.launch", { url: text })
			case "click":
				return t("chat:browser.actions.click", { coordinate: coordinate?.replace(",", ", ") })
			case "type":
				return t("chat:browser.actions.type", { text })
			case "scroll_down":
				return t("chat:browser.actions.scrollDown")
			case "scroll_up":
				return t("chat:browser.actions.scrollUp")
			case "close":
				return t("chat:browser.actions.close")
			default:
				return action
		}
	}
	return (
		<div className="ml-6 mr-1.5 mb-4">
			<div
				style={{
					borderRadius: 3,
					backgroundColor: CODE_BLOCK_BG_COLOR,
					overflow: "hidden",
					border: "1px solid var(--vscode-editorGroup-border)",
				}}>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						padding: "9px 10px",
					}}>
					<span
						style={{
							whiteSpace: "normal",
							wordBreak: "break-word",
						}}>
						<span style={{ fontWeight: 500 }}>{t("chat:browser.actions.title")}</span>
						{getBrowserActionText(action, coordinate, text)}
					</span>
				</div>
			</div>
		</div>
	)
}

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
