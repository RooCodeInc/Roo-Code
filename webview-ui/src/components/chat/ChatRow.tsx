import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { appendImages } from "@src/utils/imageUtils"
import { McpExecution } from "./McpExecution"
import { useSize } from "react-use"
import { useTranslation, Trans } from "react-i18next"
import deepEqual from "fast-deep-equal"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

import type { ClineMessage } from "@siid-code/types"
import { Mode } from "@roo/modes"

import { ClineApiReqInfo, ClineAskUseMcpServer, ClineSayTool } from "@roo/ExtensionMessage"
import { COMMAND_OUTPUT_STRING } from "@roo/combineCommandSequences"
import { safeJsonParse } from "@roo/safeJsonParse"
import { FollowUpData, SuggestionItem } from "@siid-code/types"

import { useCopyToClipboard } from "@src/utils/clipboard"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { findMatchingResourceOrTemplate } from "@src/utils/mcp"
import { vscode } from "@src/utils/vscode"
import { removeLeadingNonAlphanumeric } from "@src/utils/removeLeadingNonAlphanumeric"
import { calculateDiffStats } from "../../utils/diffStats"
// ...existing code...
import { Button } from "@src/components/ui"

import ChatTextArea from "./ChatTextArea"
import { MAX_IMAGES_PER_MESSAGE } from "./ChatView"

import CodeAccordian from "../common/CodeAccordian"
import CodeBlock from "../common/CodeBlock"
import MarkdownBlock from "../common/MarkdownBlock"
import { ReasoningBlock } from "./ReasoningBlock"
import Thumbnails from "../common/Thumbnails"
import McpResourceRow from "../mcp/McpResourceRow"

import { Mention } from "./Mention"
import { CheckpointSaved } from "./checkpoints/CheckpointSaved"
import { FollowUpSuggest } from "./FollowUpSuggest"
import { BatchFilePermission } from "./BatchFilePermission"
import { BatchDiffApproval } from "./BatchDiffApproval"
import { ProgressIndicator } from "./ProgressIndicator"
import { Markdown } from "./Markdown"
import { CommandExecution } from "./CommandExecution"
import { CommandExecutionError } from "./CommandExecutionError"
import { AutoApprovedRequestLimitWarning } from "./AutoApprovedRequestLimitWarning"
import { CondenseContextErrorRow, CondensingContextRow, ContextCondenseRow } from "./ContextCondenseRow"
import CodebaseSearchResultsDisplay from "./CodebaseSearchResultsDisplay"

interface ChatRowProps {
	message: ClineMessage
	lastModifiedMessage?: ClineMessage
	followingMessages?: ClineMessage[] // Messages that come after this one
	isExpanded: boolean
	isLast: boolean
	isStreaming: boolean
	onToggleExpand: (ts: number) => void
	onHeightChange: (isTaller: boolean) => void
	onSuggestionClick?: (suggestion: SuggestionItem, event?: React.MouseEvent) => void
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
	onFollowUpUnmount?: () => void
	isFollowUpAnswered?: boolean
	inputValue?: string
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ChatRowContentProps extends Omit<ChatRowProps, "onHeightChange"> {}

const ChatRow = memo(
	(props: ChatRowProps) => {
		const { isLast, onHeightChange, message } = props
		// Store the previous height to compare with the current height
		// This allows us to detect changes without causing re-renders
		const prevHeightRef = useRef(0)

		const [chatrow, { height }] = useSize(
			<div className="px-[15px] py-[10px] pr-[6px]">
				<ChatRowContent {...props} />
			</div>,
		)

		useEffect(() => {
			// used for partials, command output, etc.
			// NOTE: it's important we don't distinguish between partial or complete here since our scroll effects in chatview need to handle height change during partial -> complete
			const isInitialRender = prevHeightRef.current === 0 // prevents scrolling when new element is added since we already scroll for that
			// height starts off at Infinity
			if (isLast && height !== 0 && height !== Infinity && height !== prevHeightRef.current) {
				if (!isInitialRender) {
					onHeightChange(height > prevHeightRef.current)
				}
				prevHeightRef.current = height
			}
		}, [height, isLast, onHeightChange, message])

		// we cannot return null as virtuoso does not support it, so we use a separate visibleMessages array to filter out messages that should not be rendered
		return chatrow
	},
	// memo does shallow comparison of props, so we need to do deep comparison of arrays/objects whose properties might change
	deepEqual,
)

export default ChatRow

export const ChatRowContent = ({
	message,
	lastModifiedMessage,
	followingMessages,
	isExpanded,
	isLast,
	isStreaming,
	onToggleExpand,
	onSuggestionClick,
	onFollowUpUnmount,
	onBatchFileResponse,
	isFollowUpAnswered,
	inputValue,
}: ChatRowContentProps) => {
	const { t } = useTranslation()
	const { mcpServers, alwaysAllowMcp, currentCheckpoint, mode, developerMode } = useExtensionState()
	const [reasoningCollapsed, setReasoningCollapsed] = useState(true)
	useEffect(() => {
		setReasoningCollapsed(true)
	}, [developerMode])
	const [isDiffErrorExpanded, setIsDiffErrorExpanded] = useState(false)
	const [showCopySuccess, setShowCopySuccess] = useState(false)
	const [isEditing, setIsEditing] = useState(false)
	const [editedContent, setEditedContent] = useState("")
	const [editMode, setEditMode] = useState<Mode>(mode || "code")
	const [editImages, setEditImages] = useState<string[]>([])
	const [isFileHover, setIsFileHover] = useState(false)
	const [isTaskGuidesExpanded, setIsTaskGuidesExpanded] = useState(false)
	const { copyWithFeedback } = useCopyToClipboard()

	// Handle message events for image selection during edit mode
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const msg = event.data
			if (msg.type === "selectedImages" && msg.context === "edit" && msg.messageTs === message.ts && isEditing) {
				setEditImages((prevImages) => appendImages(prevImages, msg.images, MAX_IMAGES_PER_MESSAGE))
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [isEditing, message.ts])

	// Memoized callback to prevent re-renders caused by inline arrow functions
	const handleToggleExpand = useCallback(() => {
		onToggleExpand(message.ts)
	}, [onToggleExpand, message.ts])

	// Handle edit button click
	const handleEditClick = useCallback(() => {
		setIsEditing(true)
		setEditedContent(message.text || "")
		setEditImages(message.images || [])
		setEditMode(mode || "code")
		// Edit mode is now handled entirely in the frontend
		// No need to notify the backend
	}, [message.text, message.images, mode])

	// Handle cancel edit
	const handleCancelEdit = useCallback(() => {
		setIsEditing(false)
		setEditedContent(message.text || "")
		setEditImages(message.images || [])
		setEditMode(mode || "code")
	}, [message.text, message.images, mode])

	// Handle save edit
	const handleSaveEdit = useCallback(() => {
		setIsEditing(false)
		// Send edited message to backend
		vscode.postMessage({
			type: "submitEditedMessage",
			value: message.ts,
			editedMessageContent: editedContent,
			images: editImages,
		})
	}, [message.ts, editedContent, editImages])

	// Handle image selection for editing
	const handleSelectImages = useCallback(() => {
		vscode.postMessage({ type: "selectImages", context: "edit", messageTs: message.ts })
	}, [message.ts])

	const [cost, apiReqCancelReason, apiReqStreamingFailedMessage] = useMemo(() => {
		if (message.text !== null && message.text !== undefined && message.say === "api_req_started") {
			const info = safeJsonParse<ClineApiReqInfo>(message.text)
			return [info?.cost, info?.cancelReason, info?.streamingFailedMessage]
		}

		return [undefined, undefined, undefined]
	}, [message.text, message.say])

	// When resuming task, last wont be api_req_failed but a resume_task
	// message, so api_req_started will show loading spinner. That's why we just
	// remove the last api_req_started that failed without streaming anything.
	const apiRequestFailedMessage =
		isLast && lastModifiedMessage?.ask === "api_req_failed" // if request is retried then the latest message is a api_req_retried
			? lastModifiedMessage?.text
			: undefined

	const isCommandExecuting =
		isLast && lastModifiedMessage?.ask === "command" && lastModifiedMessage?.text?.includes(COMMAND_OUTPUT_STRING)

	const isMcpServerResponding = isLast && lastModifiedMessage?.say === "mcp_server_request_started"

	const type = message.type === "ask" ? message.ask : message.say

	const normalColor = "var(--vscode-foreground)"
	const errorColor = "var(--vscode-errorForeground)"
	const successColor = "var(--vscode-charts-green)"
	const cancelledColor = "var(--vscode-descriptionForeground)"

	const [icon, title] = useMemo(() => {
		const getIconSpan = (iconName: string, color: string) => (
			<div
				style={{
					width: 16,
					height: 16,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}>
				<span
					className={`codicon codicon-${iconName}`}
					style={{ color, fontSize: 16, marginBottom: "-1.5px" }}
				/>
			</div>
		)

		switch (type) {
			case "error":
				return [
					getIconSpan("error", errorColor),
					<span style={{ color: errorColor, fontWeight: "bold" }}>{t("chat:error")}</span>,
				]
			case "completion_result":
				return [
					getIconSpan("check", successColor),
					<span style={{ color: successColor, fontWeight: "bold" }}>{t("chat:taskCompleted")}</span>,
				]
			case "api_req_retry_delayed":
				return []
			case "api_req_started":
				// Use previously-calculated values (cost, apiReqCancelReason, apiRequestFailedMessage)
				if (apiReqCancelReason !== null && apiReqCancelReason !== undefined) {
					if (apiReqCancelReason === "user_cancelled") {
						return [
							getIconSpan("error", cancelledColor),
							<span style={{ color: normalColor, fontWeight: "bold" }}>
								{t("chat:apiRequest.cancelled")}
							</span>,
						]
					}
					return [
						getIconSpan("error", errorColor),
						<span style={{ color: errorColor, fontWeight: "bold" }}>
							{t("chat:apiRequest.streamingFailed")}
						</span>,
					]
				}
				if (cost !== null && cost !== undefined) {
					return [
						getIconSpan("check", successColor),
						<span style={{ color: normalColor, fontWeight: "bold" }}>{t("chat:apiRequest.title")}</span>,
					]
				}
				if (apiRequestFailedMessage) {
					return [
						getIconSpan("error", errorColor),
						<span style={{ color: errorColor, fontWeight: "bold" }}>{t("chat:apiRequest.failed")}</span>,
					]
				}
				if (isCommandExecuting) {
					return [
						<span
							className="codicon codicon-terminal"
							style={{ color: "var(--vscode-descriptionForeground)", fontSize: 16 }}
						/>,
						<span style={{ color: normalColor, fontWeight: "bold" }}>{t("chat:command.executing")}</span>,
					]
				}
				if (isMcpServerResponding) {
					return [
						<span
							className="codicon codicon-server"
							style={{ color: "var(--vscode-descriptionForeground)", fontSize: 16 }}
						/>,
						<span style={{ color: normalColor, fontWeight: "bold" }}>
							{t("chat:mcp.serverResponding")}
						</span>,
					]
				}
				// Default streaming indicator
				return [
					<ProgressIndicator />,
					<span style={{ color: normalColor, fontWeight: "bold" }}>{t("chat:apiRequest.streaming")}</span>,
				]
			case "followup":
				return [
					<span
						className="codicon codicon-question"
						style={{ color: normalColor, marginBottom: "-1.5px" }}
					/>,
					<span style={{ color: normalColor, fontWeight: "bold" }}>{t("chat:questions.hasQuestion")}</span>,
				]
			default:
				return [null, null]
		}
	}, [
		type,
		t,
		apiReqCancelReason,
		cost,
		apiRequestFailedMessage,
		isCommandExecuting,
		isMcpServerResponding,
		cancelledColor,
		normalColor,
		errorColor,
		successColor,
	])

	const headerStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: "10px",
		marginBottom: "10px",
		wordBreak: "break-word",
	}

	const pStyle: React.CSSProperties = {
		margin: 0,
		whiteSpace: "pre-wrap",
		wordBreak: "break-word",
		overflowWrap: "anywhere",
	}

	const tool = useMemo(
		() => (message.ask === "tool" || message.say === "tool" ? safeJsonParse<ClineSayTool>(message.text) : null),
		[message.ask, message.say, message.text],
	)

	const followUpData = useMemo(() => {
		if (message.type === "ask" && message.ask === "followup" && !message.partial) {
			return safeJsonParse<FollowUpData>(message.text)
		}
		return null
	}, [message.type, message.ask, message.partial, message.text])

	if (tool) {
		const toolIcon = (name: string) => (
			<span
				className={`codicon codicon-${name}`}
				style={{ color: "var(--vscode-foreground)", marginBottom: "-1.5px" }}></span>
		)

		switch (tool.tool) {
			case "editedExistingFile":
			case "appliedDiff":
				// Check if this is a batch diff request
				if (message.type === "ask" && tool.batchDiffs && Array.isArray(tool.batchDiffs)) {
					return (
						<>
							<div style={headerStyle}></div>
							<BatchDiffApproval files={tool.batchDiffs} ts={message.ts} />
						</>
					)
				}

				// Regular single file diff
				// Prefer explicit stats provided on the tool, fall back to parsing diff or content
				const linesAddedFromTool = (tool as any)?.linesAdded as number | undefined
				const linesRemovedFromTool = (tool as any)?.linesRemoved as number | undefined

				let linesAdded = linesAddedFromTool
				let linesRemoved = linesRemovedFromTool

				if (linesAdded === undefined && linesRemoved === undefined) {
					if (tool.diff) {
						const parsed = calculateDiffStats(tool.diff)
						linesAdded = parsed.linesAdded
						linesRemoved = parsed.linesRemoved
					} else if ((tool as any).content && (tool as any).previousContent) {
						// Fallback: calculate line count difference from previous and current content
						const prevLines = ((tool as any).previousContent as string).split("\n").length
						const currLines = ((tool as any).content as string).split("\n").length
						linesAdded = Math.max(currLines - prevLines, 0)
						linesRemoved = Math.max(prevLines - currLines, 0)
					} else if ((tool as any).content) {
						// If only new content is available, treat all lines as added
						const content = (tool as any).content as string
						linesAdded = content ? content.split("\n").length : 0
						linesRemoved = 0
					} else {
						linesAdded = 0
						linesRemoved = 0
					}
				}

				// Always search followingMessages for a matching user_feedback_diff for this file
				if (followingMessages && followingMessages.length > 0) {
					const matchingFeedback = followingMessages.find(
						(msg) =>
							msg.say === "user_feedback_diff" &&
							msg.text &&
							(() => {
								try {
									const lastTool = safeJsonParse<ClineSayTool>(msg.text)
									if (lastTool && lastTool.diff && lastTool.path && tool.path) {
										const normalize = (p: string) => p.toLowerCase().replace(/\\/g, "/")
										return normalize(lastTool.path) === normalize(tool.path)
									}
								} catch (_e) {
									// ignore parse errors
								}
								return false
							})(),
					)
					if (matchingFeedback) {
						try {
							const lastTool = safeJsonParse<ClineSayTool>(matchingFeedback.text)
							if (lastTool && lastTool.diff) {
								const parsed = calculateDiffStats(lastTool.diff)
								linesAdded = parsed.linesAdded
								linesRemoved = parsed.linesRemoved
							}
						} catch (_) {
							/* ignore parse errors */
						}
					}
				}

				const addedColor = "var(--vscode-charts-green)"
				const removedColor = "var(--vscode-errorForeground)"

				return (
					<>
						<div style={headerStyle}></div>
						<div style={{ margin: "6px 0 6px 0", display: "flex", alignItems: "center", gap: "6px" }}>
							<span
								style={{
									fontSize: "11px",
									color: "var(--vscode-descriptionForeground)",
									fontFamily: "monospace",
									border: `1px solid ${isFileHover ? "#007ACC" : "var(--vscode-sideBar-border)"}`,
									borderRadius: "3px",
									padding: "2px 6px",
									background: isFileHover
										? "rgba(0, 122, 204, 0.1)"
										: "var(--vscode-sideBar-background)",
									cursor: "pointer",
									display: "inline-block",
									transition: "all 120ms ease",
								}}
								onMouseEnter={() => setIsFileHover(true)}
								onMouseLeave={() => setIsFileHover(false)}
								onClick={() =>
									vscode.postMessage({
										type: "openFile",
										text: tool.path ? "./" + tool.path : tool.path,
									})
								}>
								Edit:{" "}
								{tool.path
									? tool.path.split(/[\\/]/).pop()
									: removeLeadingNonAlphanumeric(tool.path ?? "")}
							</span>

							{/* Added lines */}
							<span
								style={{
									fontSize: "11px",
									color: addedColor,
									fontFamily: "monospace",
									fontWeight: "bold",
								}}>
								+{linesAdded}
							</span>

							{/* Removed lines: always show in removed color (even when 0) per UX request */}
							<span
								style={{
									fontSize: "11px",
									color: removedColor,
									fontFamily: "monospace",
									fontWeight: "bold",
								}}>
								-{linesRemoved}
							</span>

							{/* View Diff button - opens VS Code native diff */}
							{tool.diff && (
								<span
									className="codicon codicon-diff"
									title="View Diff"
									style={{
										fontSize: "13px",
										cursor: "pointer",
										color: "var(--vscode-descriptionForeground)",
										marginLeft: "2px",
										padding: "2px",
										borderRadius: "3px",
									}}
									onClick={() =>
										vscode.postMessage({
											type: "openDiff",
											text: tool.path,
											values: {
												filePath: tool.path,
												diff: tool.diff,
												status: "modified",
											},
										})
									}
								/>
							)}
						</div>
					</>
				)
			case "insertContent":
				return (
					<>
						<div style={headerStyle}>
							{tool.isProtected ? (
								<span
									className="codicon codicon-lock"
									style={{ color: "var(--vscode-editorWarning-foreground)", marginBottom: "-1.5px" }}
								/>
							) : (
								toolIcon("insert")
							)}
							<span style={{ fontWeight: "bold" }}>
								{tool.isProtected
									? t("chat:fileOperations.wantsToEditProtected")
									: tool.isOutsideWorkspace
										? t("chat:fileOperations.wantsToEditOutsideWorkspace")
										: tool.lineNumber === 0
											? t("chat:fileOperations.wantsToInsertAtEnd")
											: t("chat:fileOperations.wantsToInsertWithLineNumber", {
													lineNumber: tool.lineNumber,
												})}
							</span>
						</div>
						<CodeAccordian
							path={tool.path}
							code={tool.diff}
							language="diff"
							progressStatus={message.progressStatus}
							isLoading={message.partial}
							isExpanded={isExpanded}
							onToggleExpand={handleToggleExpand}
						/>
					</>
				)
			case "searchAndReplace":
				return (
					<>
						<div style={headerStyle}>
							{tool.isProtected ? (
								<span
									className="codicon codicon-lock"
									style={{ color: "var(--vscode-editorWarning-foreground)", marginBottom: "-1.5px" }}
								/>
							) : (
								toolIcon("replace")
							)}
							<span style={{ fontWeight: "bold" }}>
								{tool.isProtected && message.type === "ask"
									? t("chat:fileOperations.wantsToEditProtected")
									: message.type === "ask"
										? t("chat:fileOperations.wantsToSearchReplace")
										: t("chat:fileOperations.didSearchReplace")}
							</span>
						</div>
						<CodeAccordian
							path={tool.path}
							code={tool.diff}
							language="diff"
							progressStatus={message.progressStatus}
							isLoading={message.partial}
							isExpanded={isExpanded}
							onToggleExpand={handleToggleExpand}
						/>
					</>
				)
			case "codebaseSearch": {
				return (
					<div style={headerStyle}>
						{toolIcon("search")}
						<span style={{ fontWeight: "bold" }}>
							{tool.path ? (
								<Trans
									i18nKey="chat:codebaseSearch.wantsToSearchWithPath"
									components={{ code: <code></code> }}
									values={{ query: tool.query, path: tool.path }}
								/>
							) : (
								<Trans
									i18nKey="chat:codebaseSearch.wantsToSearch"
									components={{ code: <code></code> }}
									values={{ query: tool.query }}
								/>
							)}
						</span>
					</div>
				)
			}
			case "newFileCreated": {
				// For new file creation show create badge and total added lines
				const content = (tool as any).content as string | undefined
				const linesAdded = (tool as any).linesAdded ?? (content ? content.split("\n").length : 0)
				return (
					<>
						<div style={headerStyle}></div>
						<div style={{ margin: "6px 0 6px 0", display: "flex", alignItems: "center", gap: 8 }}>
							<span
								style={{
									fontSize: "11px",
									color: "var(--vscode-descriptionForeground)",
									fontFamily: "monospace",
									border: `1px solid ${isFileHover ? "#007ACC" : "var(--vscode-sideBar-border)"}`,
									borderRadius: "3px",
									padding: "2px 6px",
									background: isFileHover
										? "rgba(0, 122, 204, 0.1)"
										: "var(--vscode-sideBar-background)",
									cursor: "pointer",
									display: "inline-block",
									transition: "all 120ms ease",
								}}
								onMouseEnter={() => setIsFileHover(true)}
								onMouseLeave={() => setIsFileHover(false)}
								onClick={() =>
									vscode.postMessage({
										type: "openFile",
										text: tool.path ? "./" + tool.path : tool.path,
									})
								}>
								Create:{" "}
								{tool.path
									? tool.path.split(/[\\/]/).pop()
									: removeLeadingNonAlphanumeric(tool.path ?? "")}
							</span>
							<span
								style={{
									fontSize: 12,
									fontFamily: "monospace",
									color: "var(--vscode-charts-green)",
									fontWeight: 700,
								}}>
								+{linesAdded}
							</span>

							{/* View Diff button - opens VS Code native diff for new file */}
							<span
								className="codicon codicon-diff"
								title="View Diff"
								style={{
									fontSize: "13px",
									cursor: "pointer",
									color: "var(--vscode-descriptionForeground)",
									marginLeft: "2px",
									padding: "2px",
									borderRadius: "3px",
								}}
								onClick={() =>
									vscode.postMessage({
										type: "openDiff",
										text: tool.path,
										values: {
											filePath: tool.path,
											diff: tool.diff || (tool as any).content,
											original: "", // new file - empty original
											status: "created",
										},
									})
								}
							/>
						</div>
					</>
				)
			}
			case "readFile":
				// Check if this is a batch file permission request
				const isBatchRequest = message.type === "ask" && tool.batchFiles && Array.isArray(tool.batchFiles)

				if (isBatchRequest) {
					return (
						<>
							<div style={headerStyle}></div>
							<BatchFilePermission
								files={tool.batchFiles || []}
								onPermissionResponse={(response) => {
									onBatchFileResponse?.(response)
								}}
								ts={message?.ts}
							/>
						</>
					)
				}

				// Regular single file read request
				// Generate a simple summary when developer mode is OFF
				const fileName = tool.path
					? tool.path.split(/[\\/]/).pop()
					: removeLeadingNonAlphanumeric(tool.path ?? "")
				const simpleReason = developerMode
					? tool.reason
					: message.type === "ask"
						? `Reading ${fileName} to understand its contents`
						: undefined

				return (
					<>
						<div style={headerStyle}></div>
						<div style={{ margin: "2px 0 2px 0", display: "flex", alignItems: "center", gap: "6px" }}>
							<span
								style={{
									fontSize: "11px",
									color: "var(--vscode-descriptionForeground)",
									fontFamily: "monospace",
									border: "1px solid var(--vscode-sideBar-border)",
									borderRadius: "3px",
									padding: "2px 6px",
									background: "var(--vscode-sideBar-background)",
									display: "inline-block",
								}}>
								Read: {fileName}
							</span>
							{simpleReason}
						</div>
					</>
				)
			case "fetchInstructions":
				return (
					<>
						<div style={headerStyle}></div>
						<div style={{ margin: "6px 0 6px 0", display: "flex", alignItems: "center", gap: 8 }}>
							<span
								style={{
									fontSize: "11px",
									color: "var(--vscode-descriptionForeground)",
									fontFamily: "monospace",
									border: `1px solid var(--vscode-sideBar-border)`,
									borderRadius: "3px",
									padding: "2px 6px",
									background: "var(--vscode-sideBar-background)",
									display: "inline-block",
								}}>
								Used {tool.content || "Instruction"}
							</span>
						</div>
					</>
				)
			case "getTaskGuides":
				return (
					<>
						<div style={headerStyle}></div>
						<div style={{ margin: "6px 0 6px 0", display: "flex", flexDirection: "column", gap: 4 }}>
							<div
								onClick={() => setIsTaskGuidesExpanded(!isTaskGuidesExpanded)}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 6,
									cursor: "pointer",
									userSelect: "none",
								}}>
								<span
									className={`codicon codicon-chevron-${isTaskGuidesExpanded ? "down" : "right"}`}
									style={{
										fontSize: "12px",
										color: "var(--vscode-descriptionForeground)",
									}}
								/>
								<span
									style={{
										fontSize: "11px",
										color: "var(--vscode-descriptionForeground)",
										fontFamily: "monospace",
										border: `1px solid var(--vscode-sideBar-border)`,
										borderRadius: "3px",
										padding: "2px 6px",
										background: "var(--vscode-sideBar-background)",
										display: "inline-block",
									}}>
									Loaded guides for: {tool.content || "Task"}
								</span>
							</div>
							{isTaskGuidesExpanded && tool.loadedGuides && tool.loadedGuides.length > 0 && (
								<div
									style={{
										marginLeft: 18,
										display: "flex",
										flexDirection: "column",
										gap: 2,
									}}>
									{tool.loadedGuides.map((guide: string, idx: number) => (
										<span
											key={idx}
											style={{
												fontSize: "10px",
												color: "var(--vscode-descriptionForeground)",
												fontFamily: "monospace",
												paddingLeft: 8,
												borderLeft: "2px solid var(--vscode-sideBar-border)",
											}}>
											• {guide}
										</span>
									))}
								</div>
							)}
						</div>
					</>
				)
			case "listFilesTopLevel":
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("folder-opened")}
							<span style={{ fontWeight: "bold" }}>
								{message.type === "ask"
									? tool.isOutsideWorkspace
										? t("chat:directoryOperations.wantsToViewTopLevelOutsideWorkspace")
										: t("chat:directoryOperations.wantsToViewTopLevel")
									: tool.isOutsideWorkspace
										? t("chat:directoryOperations.didViewTopLevelOutsideWorkspace")
										: t("chat:directoryOperations.didViewTopLevel")}
							</span>
						</div>
						<CodeAccordian
							path={tool.path}
							code={tool.content}
							language="shell-session"
							isExpanded={isExpanded}
							onToggleExpand={handleToggleExpand}
						/>
					</>
				)
			case "listFilesRecursive":
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("folder-opened")}
							<span style={{ fontWeight: "bold" }}>
								{message.type === "ask"
									? tool.isOutsideWorkspace
										? t("chat:directoryOperations.wantsToViewRecursiveOutsideWorkspace")
										: t("chat:directoryOperations.wantsToViewRecursive")
									: tool.isOutsideWorkspace
										? t("chat:directoryOperations.didViewRecursiveOutsideWorkspace")
										: t("chat:directoryOperations.didViewRecursive")}
							</span>
						</div>
						<CodeAccordian
							path={tool.path}
							code={tool.content}
							language="shellsession"
							isExpanded={isExpanded}
							onToggleExpand={handleToggleExpand}
						/>
					</>
				)
			case "listCodeDefinitionNames":
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("file-code")}
							<span style={{ fontWeight: "bold" }}>
								{message.type === "ask"
									? tool.isOutsideWorkspace
										? t("chat:directoryOperations.wantsToViewDefinitionsOutsideWorkspace")
										: t("chat:directoryOperations.wantsToViewDefinitions")
									: tool.isOutsideWorkspace
										? t("chat:directoryOperations.didViewDefinitionsOutsideWorkspace")
										: t("chat:directoryOperations.didViewDefinitions")}
							</span>
						</div>
						<CodeAccordian
							path={tool.path}
							code={tool.content}
							language="markdown"
							isExpanded={isExpanded}
							onToggleExpand={handleToggleExpand}
						/>
					</>
				)
			case "searchFiles":
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("search")}
							<span style={{ fontWeight: "bold" }}>
								{message.type === "ask" ? (
									<Trans
										i18nKey={
											tool.isOutsideWorkspace
												? "chat:directoryOperations.wantsToSearchOutsideWorkspace"
												: "chat:directoryOperations.wantsToSearch"
										}
										components={{ code: <code>{tool.regex}</code> }}
										values={{ regex: tool.regex }}
									/>
								) : (
									<Trans
										i18nKey={
											tool.isOutsideWorkspace
												? "chat:directoryOperations.didSearchOutsideWorkspace"
												: "chat:directoryOperations.didSearch"
										}
										components={{ code: <code>{tool.regex}</code> }}
										values={{ regex: tool.regex }}
									/>
								)}
							</span>
						</div>
						<CodeAccordian
							path={tool.path! + (tool.filePattern ? `/(${tool.filePattern})` : "")}
							code={tool.content}
							language="shellsession"
							isExpanded={isExpanded}
							onToggleExpand={handleToggleExpand}
						/>
					</>
				)
			case "switchMode":
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("symbol-enum")}
							<span style={{ fontWeight: "bold" }}>
								{message.type === "ask" ? (
									<>
										{tool.reason ? (
											<Trans
												i18nKey="chat:modes.wantsToSwitchWithReason"
												components={{ code: <code>{tool.mode}</code> }}
												values={{ mode: tool.mode, reason: tool.reason }}
											/>
										) : (
											<Trans
												i18nKey="chat:modes.wantsToSwitch"
												components={{ code: <code>{tool.mode}</code> }}
												values={{ mode: tool.mode }}
											/>
										)}
									</>
								) : (
									<>
										{tool.reason ? (
											<Trans
												i18nKey="chat:modes.didSwitchWithReason"
												components={{ code: <code>{tool.mode}</code> }}
												values={{ mode: tool.mode, reason: tool.reason }}
											/>
										) : (
											<Trans
												i18nKey="chat:modes.didSwitch"
												components={{ code: <code>{tool.mode}</code> }}
												values={{ mode: tool.mode }}
											/>
										)}
									</>
								)}
							</span>
						</div>
					</>
				)
			case "newTask":
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("tasklist")}
							<span style={{ fontWeight: "bold" }}>
								<Trans
									i18nKey="chat:subtasks.wantsToCreate"
									components={{ code: <code>{tool.mode}</code> }}
									values={{ mode: tool.mode }}
								/>
							</span>
						</div>
						<div
							style={{
								marginTop: "4px",
								backgroundColor: "var(--vscode-badge-background)",
								border: "1px solid var(--vscode-badge-background)",
								borderRadius: "4px 4px 0 0",
								overflow: "hidden",
								marginBottom: "2px",
							}}>
							<div
								style={{
									padding: "9px 10px 9px 14px",
									backgroundColor: "var(--vscode-badge-background)",
									borderBottom: "1px solid var(--vscode-editorGroup-border)",
									fontWeight: "bold",
									fontSize: "var(--vscode-font-size)",
									color: "var(--vscode-badge-foreground)",
									display: "flex",
									alignItems: "center",
									gap: "6px",
								}}>
								<span className="codicon codicon-arrow-right"></span>
								{t("chat:subtasks.newTaskContent")}
							</div>
							<div style={{ padding: "12px 16px", backgroundColor: "var(--vscode-editor-background)" }}>
								<MarkdownBlock markdown={tool.content} />
							</div>
						</div>
					</>
				)
			case "finishTask":
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("check-all")}
							<span style={{ fontWeight: "bold" }}>{t("chat:subtasks.wantsToFinish")}</span>
						</div>
						<div
							style={{
								marginTop: "4px",
								backgroundColor: "var(--vscode-editor-background)",
								border: "1px solid var(--vscode-badge-background)",
								borderRadius: "4px",
								overflow: "hidden",
								marginBottom: "8px",
							}}>
							<div
								style={{
									padding: "9px 10px 9px 14px",
									backgroundColor: "var(--vscode-badge-background)",
									borderBottom: "1px solid var(--vscode-editorGroup-border)",
									fontWeight: "bold",
									fontSize: "var(--vscode-font-size)",
									color: "var(--vscode-badge-foreground)",
									display: "flex",
									alignItems: "center",
									gap: "6px",
								}}>
								<span className="codicon codicon-check"></span>
								{t("chat:subtasks.completionContent")}
							</div>
							<div style={{ padding: "12px 16px", backgroundColor: "var(--vscode-editor-background)" }}>
								<MarkdownBlock markdown={t("chat:subtasks.completionInstructions")} />
							</div>
						</div>
					</>
				)
			case "deploySfMetadata":
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("cloud-upload")}
							<span style={{ fontWeight: "bold" }}>
								Deploy Salesforce Metadata: {tool.metadataType}
								{tool.metadataName && ` - ${tool.metadataName}`}
							</span>
						</div>
						{tool.content && (
							<div
								style={{
									marginTop: "4px",
									backgroundColor: "var(--vscode-editor-background)",
									border: "1px solid var(--vscode-badge-background)",
									borderRadius: "4px",
									overflow: "hidden",
									marginBottom: "8px",
								}}>
								<div style={{ padding: "12px 16px" }}>
									<MarkdownBlock markdown={tool.content} />
								</div>
							</div>
						)}
					</>
				)
			case "retrieveSfMetadata":
				return (
					<>
						<div style={headerStyle}>
							{toolIcon("cloud-download")}
							<span style={{ fontWeight: "bold" }}>
								Retrieve Salesforce Metadata: {tool.metadataType}
								{tool.metadataName && ` - ${tool.metadataName}`}
							</span>
						</div>
						{tool.content && (
							<div
								style={{
									marginTop: "4px",
									backgroundColor: "var(--vscode-editor-background)",
									border: "1px solid var(--vscode-badge-background)",
									borderRadius: "4px",
									overflow: "hidden",
									marginBottom: "8px",
								}}>
								<div style={{ padding: "12px 16px" }}>
									<MarkdownBlock markdown={tool.content} />
								</div>
							</div>
						)}
					</>
				)
			default:
				return null
		}
	}

	switch (message.type) {
		case "say":
			switch (message.say) {
				case "diff_error":
					return (
						<div>
							<div
								style={{
									marginTop: "0px",
									overflow: "hidden",
									marginBottom: "8px",
								}}>
								<div
									style={{
										borderBottom: isDiffErrorExpanded
											? "1px solid var(--vscode-editorGroup-border)"
											: "none",
										fontWeight: "normal",
										fontSize: "var(--vscode-font-size)",
										color: "var(--vscode-editor-foreground)",
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										cursor: "pointer",
									}}
									onClick={() => setIsDiffErrorExpanded(!isDiffErrorExpanded)}>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											gap: "10px",
											flexGrow: 1,
										}}>
										<span
											className="codicon codicon-warning"
											style={{
												color: "var(--vscode-editorWarning-foreground)",
												opacity: 0.8,
												fontSize: 16,
												marginBottom: "-1.5px",
											}}></span>
										<span style={{ fontWeight: "bold" }}>{t("chat:diffError.title")}</span>
									</div>
									<div style={{ display: "flex", alignItems: "center" }}>
										<VSCodeButton
											appearance="icon"
											style={{
												padding: "3px",
												height: "24px",
												marginRight: "4px",
												color: "var(--vscode-editor-foreground)",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												background: "transparent",
											}}
											onClick={(e) => {
												e.stopPropagation()

												// Call copyWithFeedback and handle the Promise
												copyWithFeedback(message.text || "").then((success) => {
													if (success) {
														// Show checkmark
														setShowCopySuccess(true)

														// Reset after a brief delay
														setTimeout(() => {
															setShowCopySuccess(false)
														}, 1000)
													}
												})
											}}>
											<span
												className={`codicon codicon-${showCopySuccess ? "check" : "copy"}`}></span>
										</VSCodeButton>
										<span
											className={`codicon codicon-chevron-${isDiffErrorExpanded ? "up" : "down"}`}></span>
									</div>
								</div>
								{isDiffErrorExpanded && (
									<div
										style={{
											padding: "8px",
											backgroundColor: "var(--vscode-editor-background)",
											borderTop: "none",
										}}>
										<CodeBlock source={message.text || ""} language="xml" />
									</div>
								)}
							</div>
						</div>
					)
				case "subtask_result":
					return (
						<div>
							<div
								style={{
									marginTop: "0px",
									backgroundColor: "var(--vscode-badge-background)",
									border: "1px solid var(--vscode-badge-background)",
									borderRadius: "0 0 4px 4px",
									overflow: "hidden",
									marginBottom: "8px",
								}}>
								<div
									style={{
										padding: "9px 10px 9px 14px",
										backgroundColor: "var(--vscode-badge-background)",
										borderBottom: "1px solid var(--vscode-editorGroup-border)",
										fontWeight: "bold",
										fontSize: "var(--vscode-font-size)",
										color: "var(--vscode-badge-foreground)",
										display: "flex",
										alignItems: "center",
										gap: "6px",
									}}>
									<span className="codicon codicon-arrow-left"></span>
									{t("chat:subtasks.resultContent")}
								</div>
								<div
									style={{
										padding: "12px 16px",
										backgroundColor: "var(--vscode-editor-background)",
									}}>
									<MarkdownBlock markdown={message.text} />
								</div>
							</div>
						</div>
					)
				case "reasoning":
					return (
						<ReasoningBlock
							content={message.text || ""}
							elapsed={isLast && isStreaming ? Date.now() - message.ts : undefined}
							isCollapsed={reasoningCollapsed}
							onToggleCollapse={() => setReasoningCollapsed(!reasoningCollapsed)}
						/>
					)
				case "api_req_started":
					// Generate a summary of what's being requested when developer mode is OFF
					let approvalSummary = ""
					if (!developerMode && isLast && followingMessages && followingMessages.length > 0) {
						// Look at the first tool message after api_req_started
						const toolMessage = followingMessages.find(
							(msg) => msg.type === "ask" && msg.ask === "tool" && msg.text,
						)
						if (toolMessage?.text) {
							try {
								const tool = JSON.parse(toolMessage.text)
								if (tool.tool === "readFile") {
									const fileName = tool.path?.split(/[\\/]/).pop() || tool.path || "file"
									approvalSummary = `Reading ${fileName} to analyze its contents`
								} else if (tool.tool === "write_to_file") {
									const fileName = tool.path?.split(/[\\/]/).pop() || tool.path || "file"
									const action = tool.diff ? "Modifying" : "Creating"
									approvalSummary = `${action} ${fileName}`
								} else if (tool.tool === "execute_command") {
									const cmd = (tool.command || "").split(" ")[0]
									approvalSummary = `Running command: ${cmd}`
								} else if (tool.tool === "apply_diff") {
									const fileName = tool.path?.split(/[\\/]/).pop() || tool.path || "file"
									approvalSummary = `Applying changes to ${fileName}`
								} else if (tool.tool === "insert_content") {
									const fileName = tool.path?.split(/[\\/]/).pop() || tool.path || "file"
									approvalSummary = `Inserting content into ${fileName}`
								}
							} catch (_e) {
								// If parsing fails, just show the generic message
							}
						}
					}

					return (
						<>
							<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
								<span
									className="codicon codicon-loading codicon-modifier-spin"
									style={{ fontSize: "14px", color: "var(--vscode-descriptionForeground)" }}
								/>
								<span
									style={{
										fontSize: "12px",
										color: "var(--vscode-descriptionForeground)",
										fontWeight: 500,
									}}>
									API Request...
								</span>
							</div>
							{approvalSummary && (
								<div
									style={{
										fontSize: "13px",
										color: "var(--vscode-foreground)",
										marginTop: "4px",
										padding: "6px 10px",
										background: "var(--vscode-editor-background)",
										border: "1px solid var(--vscode-sideBar-border)",
										borderRadius: "3px",
									}}>
									{approvalSummary}
								</div>
							)}
							{(((cost === null || cost === undefined) && apiRequestFailedMessage) ||
								apiReqStreamingFailedMessage) && (
								<>
									<p style={{ ...pStyle, color: "var(--vscode-errorForeground)" }}>
										{apiRequestFailedMessage || apiReqStreamingFailedMessage}
										{apiRequestFailedMessage?.toLowerCase().includes("powershell") && (
											<>
												<br />
												<br />
												{t("chat:powershell.issues")}{" "}
												<a
													href="https://github.com/cline/cline/wiki/TroubleShooting-%E2%80%90-%22PowerShell-is-not-recognized-as-an-internal-or-external-command%22"
													style={{ color: "inherit", textDecoration: "underline" }}>
													troubleshooting guide
												</a>
												.
											</>
										)}
									</p>
								</>
							)}
						</>
					)
				case "api_req_finished":
					return null // we should never see this message type
				case "text":
					return (
						<div>
							<Markdown markdown={message.text} partial={message.partial} />
						</div>
					)
				case "user_feedback":
					return (
						<div className="bg-vscode-editor-background border rounded-xs p-1 overflow-hidden whitespace-pre-wrap">
							{isEditing ? (
								<div className="flex flex-col gap-2 p-2">
									<ChatTextArea
										inputValue={editedContent}
										setInputValue={setEditedContent}
										sendingDisabled={false}
										selectApiConfigDisabled={true}
										placeholderText={t("chat:editMessage.placeholder")}
										selectedImages={editImages}
										setSelectedImages={setEditImages}
										onSend={handleSaveEdit}
										onSelectImages={handleSelectImages}
										shouldDisableImages={false}
										mode={editMode}
										setMode={setEditMode}
										modeShortcutText=""
										isEditMode={true}
										onCancel={handleCancelEdit}
									/>
								</div>
							) : (
								<div className="flex justify-between">
									<div className="flex-grow px-2 py-1 wrap-anywhere">
										<Mention text={message.text} withShadow />
									</div>
									<div className="flex">
										<Button
											variant="ghost"
											size="icon"
											className="shrink-0 hidden"
											disabled={isStreaming}
											onClick={(e) => {
												e.stopPropagation()
												handleEditClick()
											}}>
											<span className="codicon codicon-edit" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="shrink-0"
											disabled={isStreaming}
											onClick={(e) => {
												e.stopPropagation()
												vscode.postMessage({ type: "deleteMessage", value: message.ts })
											}}>
											<span className="codicon codicon-trash" />
										</Button>
									</div>
								</div>
							)}
							{!isEditing && message.images && message.images.length > 0 && (
								<Thumbnails images={message.images} style={{ marginTop: "8px" }} />
							)}
						</div>
					)
				case "user_feedback_diff":
					const tool = safeJsonParse<ClineSayTool>(message.text)
					return (
						<div style={{ marginTop: -10, width: "100%" }}>
							<CodeAccordian
								code={tool?.diff}
								language="diff"
								isFeedback={true}
								isExpanded={isExpanded}
								onToggleExpand={handleToggleExpand}
							/>
						</div>
					)
				case "error":
					return (
						<>
							{title && (
								<div style={headerStyle}>
									{icon}
									{title}
								</div>
							)}
							<p style={{ ...pStyle, color: "var(--vscode-errorForeground)" }}>{message.text}</p>
						</>
					)
				case "completion_result":
					return (
						<>
							<div style={headerStyle}>
								{icon}
								{title}
							</div>
							<div style={{ color: "var(--vscode-charts-green)", paddingTop: 4 }}>
								<Markdown markdown={message.text} />
							</div>
						</>
					)
				case "shell_integration_warning":
					return <CommandExecutionError />
				case "checkpoint_saved":
					return (
						<CheckpointSaved
							ts={message.ts!}
							commitHash={message.text!}
							currentHash={currentCheckpoint}
							checkpoint={message.checkpoint}
						/>
					)
				case "condense_context":
					if (message.partial) {
						return <CondensingContextRow />
					}
					return message.contextCondense ? <ContextCondenseRow {...message.contextCondense} /> : null
				case "condense_context_error":
					return <CondenseContextErrorRow errorText={message.text} />
				case "codebase_search_result":
					let parsed: {
						content: {
							query: string
							results: Array<{
								filePath: string
								score: number
								startLine: number
								endLine: number
								codeChunk: string
							}>
						}
					} | null = null

					try {
						if (message.text) {
							parsed = JSON.parse(message.text)
						}
					} catch (error) {
						console.error("Failed to parse codebaseSearch content:", error)
					}

					if (parsed && !parsed?.content) {
						console.error("Invalid codebaseSearch content structure:", parsed.content)
						return <div>Error displaying search results.</div>
					}

					const { results = [] } = parsed?.content || {}

					return <CodebaseSearchResultsDisplay results={results} />
				default:
					return (
						<>
							{title && (
								<div style={headerStyle}>
									{icon}
									{title}
								</div>
							)}
							<div style={{ paddingTop: 4 }}>
								<Markdown markdown={message.text} partial={message.partial} />
							</div>
						</>
					)
			}
		case "ask":
			switch (message.ask) {
				case "mistake_limit_reached":
					return (
						<>
							<div style={headerStyle}>
								{icon}
								{title}
							</div>
							<p style={{ ...pStyle, color: "var(--vscode-errorForeground)" }}>{message.text}</p>
						</>
					)
				case "command":
					return (
						<CommandExecution
							executionId={message.ts.toString()}
							text={message.text}
							icon={icon}
							title={title}
						/>
					)
				case "use_mcp_server":
					// Parse the message text to get the MCP server request
					const messageJson = safeJsonParse<any>(message.text, {})

					// Extract the response field if it exists
					const { response, ...mcpServerRequest } = messageJson

					// Create the useMcpServer object with the response field
					const useMcpServer: ClineAskUseMcpServer = {
						...mcpServerRequest,
						response,
					}

					if (!useMcpServer) {
						return null
					}

					const server = mcpServers.find((server) => server.name === useMcpServer.serverName)

					return (
						<>
							<div style={headerStyle}>
								{icon}
								{title}
							</div>
							<div className="w-full bg-vscode-editor-background border border-vscode-border rounded-xs p-2 mt-2">
								{useMcpServer.type === "access_mcp_resource" && (
									<McpResourceRow
										item={{
											// Use the matched resource/template details, with fallbacks
											...(findMatchingResourceOrTemplate(
												useMcpServer.uri || "",
												server?.resources,
												server?.resourceTemplates,
											) || {
												name: "",
												mimeType: "",
												description: "",
											}),
											// Always use the actual URI from the request
											uri: useMcpServer.uri || "",
										}}
									/>
								)}
								{useMcpServer.type === "use_mcp_tool" && (
									<McpExecution
										executionId={message.ts.toString()}
										text={useMcpServer.arguments !== "{}" ? useMcpServer.arguments : undefined}
										serverName={useMcpServer.serverName}
										toolName={useMcpServer.toolName}
										isArguments={true}
										server={server}
										useMcpServer={useMcpServer}
										alwaysAllowMcp={alwaysAllowMcp}
									/>
								)}
							</div>
						</>
					)
				case "completion_result":
					if (message.text) {
						return (
							<div>
								<div style={headerStyle}>
									{icon}
									{title}
								</div>
								<div style={{ color: "var(--vscode-charts-green)", paddingTop: 4 }}>
									<Markdown markdown={message.text} partial={message.partial} />
								</div>
							</div>
						)
					} else {
						return null // Don't render anything when we get a completion_result ask without text
					}
				case "followup":
					return (
						<>
							{title && (
								<div style={headerStyle}>
									{icon}
									{title}
								</div>
							)}
							<div style={{ paddingTop: 4, paddingBottom: 15 }}>
								<Markdown
									markdown={message.partial === true ? message?.text : followUpData?.question}
								/>
							</div>
							<FollowUpSuggest
								suggestions={followUpData?.suggest}
								onSuggestionClick={onSuggestionClick}
								ts={message?.ts}
								onCancelAutoApproval={onFollowUpUnmount}
								isAnswered={isFollowUpAnswered}
								inputValue={inputValue}
							/>
						</>
					)
				case "auto_approval_max_req_reached": {
					return <AutoApprovedRequestLimitWarning message={message} />
				}
				default:
					return null
			}
	}
}
