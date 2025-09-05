import React, { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { VSCodeButton, VSCodeTextField, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"
import { useTranslation } from "react-i18next"
import type { ClineMessage } from "@roo-code/types"
import { ClineSayTool } from "@roo/ExtensionMessage"
import { safeJsonParse } from "@roo/safeJsonParse"

interface MessageNavigatorProps {
	messages: ClineMessage[]
	onNavigateToMessage: (messageIndex: number) => void
	isVisible: boolean
	onClose: () => void
}

type MessageType = "all" | "user" | "assistant" | "file_edit" | "command" | "error" | "api_request" | "tool_use"

interface FilteredMessage {
	message: ClineMessage
	originalIndex: number
	matchedText?: string
}

export const MessageNavigator: React.FC<MessageNavigatorProps> = ({
	messages,
	onNavigateToMessage,
	isVisible,
	onClose,
}) => {
	const { t } = useTranslation()
	const [searchQuery, setSearchQuery] = useState("")
	const [selectedFilter, setSelectedFilter] = useState<MessageType>("all")
	const [selectedIndex, setSelectedIndex] = useState(0)
	const searchInputRef = useRef<HTMLInputElement>(null)
	const navigatorRef = useRef<HTMLDivElement>(null)

	// Focus search input when navigator becomes visible
	useEffect(() => {
		if (isVisible && searchInputRef.current) {
			searchInputRef.current.focus()
		}
	}, [isVisible])

	// Get message type for filtering
	const getMessageType = useCallback((message: ClineMessage): MessageType[] => {
		const types: MessageType[] = []

		if (message.say === "user_feedback") {
			types.push("user")
		} else if (message.say === "text" || message.say === "completion_result") {
			types.push("assistant")
		}

		if (message.say === "error" || message.ask === "api_req_failed") {
			types.push("error")
		}

		if (message.ask === "command" || message.say === "command_output") {
			types.push("command")
		}

		if (message.say === "api_req_started") {
			types.push("api_request")
		}

		// Check for file operations
		if (message.ask === "tool") {
			const tool = safeJsonParse<ClineSayTool>(message.text)
			if (tool) {
				types.push("tool_use")
				if (
					[
						"editedExistingFile",
						"appliedDiff",
						"newFileCreated",
						"insertContent",
						"searchAndReplace",
					].includes(tool.tool)
				) {
					types.push("file_edit")
				}
			}
		}

		return types.length > 0 ? types : ["assistant"]
	}, [])

	// Filter and search messages
	const filteredMessages = useMemo((): FilteredMessage[] => {
		let filtered = messages.map((message, index) => ({
			message,
			originalIndex: index,
		}))

		// Apply type filter
		if (selectedFilter !== "all") {
			filtered = filtered.filter(({ message }) => {
				const types = getMessageType(message)
				return types.includes(selectedFilter)
			})
		}

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase()
			filtered = filtered.filter(({ message }) => {
				// Search in message text
				if (message.text && message.text.toLowerCase().includes(query)) {
					return true
				}

				// Search in tool details
				if (message.ask === "tool") {
					const tool = safeJsonParse<ClineSayTool>(message.text)
					if (tool) {
						// Search in file paths
						if (tool.path && tool.path.toLowerCase().includes(query)) {
							return true
						}
						// Search in content
						if (tool.content && tool.content.toLowerCase().includes(query)) {
							return true
						}
						// Search in diff
						if (tool.diff && tool.diff.toLowerCase().includes(query)) {
							return true
						}
					}
				}

				return false
			})

			// Add matched text for highlighting
			filtered = filtered.map((item) => {
				const message = item.message
				let matchedText = ""

				if (message.text && message.text.toLowerCase().includes(query)) {
					// Extract a snippet around the match
					const index = message.text.toLowerCase().indexOf(query)
					const start = Math.max(0, index - 30)
					const end = Math.min(message.text.length, index + query.length + 30)
					matchedText =
						(start > 0 ? "..." : "") +
						message.text.substring(start, end) +
						(end < message.text.length ? "..." : "")
				}

				return { ...item, matchedText }
			})
		}

		return filtered
	}, [messages, selectedFilter, searchQuery, getMessageType])

	// Handle keyboard navigation
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (!isVisible) return

			switch (e.key) {
				case "ArrowDown":
					e.preventDefault()
					setSelectedIndex((prev) => Math.min(prev + 1, filteredMessages.length - 1))
					break
				case "ArrowUp":
					e.preventDefault()
					setSelectedIndex((prev) => Math.max(prev - 1, 0))
					break
				case "Enter":
					e.preventDefault()
					if (filteredMessages[selectedIndex]) {
						onNavigateToMessage(filteredMessages[selectedIndex].originalIndex)
					}
					break
				case "Escape":
					e.preventDefault()
					onClose()
					break
			}
		},
		[isVisible, selectedIndex, filteredMessages, onNavigateToMessage, onClose],
	)

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [handleKeyDown])

	// Reset selected index when filters change
	useEffect(() => {
		setSelectedIndex(0)
	}, [searchQuery, selectedFilter])

	// Get display text for a message
	const getMessageDisplayText = useCallback(
		(message: ClineMessage, matchedText?: string): string => {
			if (matchedText) {
				return matchedText
			}

			if (message.say === "user_feedback") {
				return message.text || t("chat:navigator.userMessage")
			}

			if (message.say === "error") {
				return `${t("chat:error")}: ${message.text?.substring(0, 100)}...`
			}

			if (message.ask === "command") {
				return `${t("chat:runCommand.title")}: ${message.text?.substring(0, 100)}...`
			}

			if (message.ask === "tool") {
				const tool = safeJsonParse<ClineSayTool>(message.text)
				if (tool) {
					switch (tool.tool) {
						case "editedExistingFile":
						case "appliedDiff":
							return `${t("chat:fileOperations.wantsToEdit")}: ${tool.path}`
						case "newFileCreated":
							return `${t("chat:fileOperations.wantsToCreate")}: ${tool.path}`
						case "readFile":
							return `${t("chat:fileOperations.wantsToRead")}: ${tool.path}`
						case "searchFiles":
							return `${t("chat:directoryOperations.wantsToSearch")}: ${tool.regex}`
						default:
							return tool.tool
					}
				}
			}

			if (message.say === "api_req_started") {
				return t("chat:apiRequest.title")
			}

			if (message.text) {
				return message.text.substring(0, 100) + (message.text.length > 100 ? "..." : "")
			}

			return t("chat:navigator.message")
		},
		[t],
	)

	// Get icon for message type
	const getMessageIcon = useCallback((message: ClineMessage): string => {
		if (message.say === "user_feedback") {
			return "account"
		}

		if (message.say === "error" || message.ask === "api_req_failed") {
			return "error"
		}

		if (message.ask === "command") {
			return "terminal"
		}

		if (message.ask === "tool") {
			const tool = safeJsonParse<ClineSayTool>(message.text)
			if (tool) {
				switch (tool.tool) {
					case "editedExistingFile":
					case "appliedDiff":
						return "edit"
					case "newFileCreated":
						return "new-file"
					case "readFile":
						return "file-code"
					case "searchFiles":
						return "search"
					default:
						return "tools"
				}
			}
		}

		if (message.say === "api_req_started") {
			return "cloud"
		}

		return "comment"
	}, [])

	if (!isVisible) {
		return null
	}

	return (
		<div
			ref={navigatorRef}
			className="message-navigator"
			style={{
				position: "fixed",
				top: "50%",
				left: "50%",
				transform: "translate(-50%, -50%)",
				width: "600px",
				maxHeight: "500px",
				backgroundColor: "var(--vscode-editorWidget-background)",
				border: "1px solid var(--vscode-editorWidget-border)",
				borderRadius: "6px",
				boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
				zIndex: 1000,
				display: "flex",
				flexDirection: "column",
			}}>
			{/* Header */}
			<div
				style={{
					padding: "12px 16px",
					borderBottom: "1px solid var(--vscode-editorWidget-border)",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
				}}>
				<h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
					{t("chat:navigator.title", "Message Navigator")}
				</h3>
				<VSCodeButton appearance="icon" onClick={onClose} style={{ padding: "2px" }}>
					<span className="codicon codicon-close"></span>
				</VSCodeButton>
			</div>

			{/* Search and Filter Bar */}
			<div
				style={{
					padding: "12px 16px",
					borderBottom: "1px solid var(--vscode-editorWidget-border)",
					display: "flex",
					gap: "8px",
				}}>
				<VSCodeTextField
					ref={searchInputRef as any}
					placeholder={t("chat:navigator.searchPlaceholder", "Search messages...")}
					value={searchQuery}
					onInput={(e: any) => setSearchQuery(e.target.value)}
					style={{ flex: 1 }}>
					<span slot="start" className="codicon codicon-search"></span>
				</VSCodeTextField>
				<VSCodeDropdown
					value={selectedFilter}
					onChange={(e: any) => setSelectedFilter(e.target.value as MessageType)}
					style={{ minWidth: "150px" }}>
					<VSCodeOption value="all">{t("chat:navigator.filter.all", "All Messages")}</VSCodeOption>
					<VSCodeOption value="user">{t("chat:navigator.filter.user", "User Messages")}</VSCodeOption>
					<VSCodeOption value="assistant">{t("chat:navigator.filter.assistant", "Assistant")}</VSCodeOption>
					<VSCodeOption value="file_edit">{t("chat:navigator.filter.fileEdit", "File Edits")}</VSCodeOption>
					<VSCodeOption value="command">{t("chat:navigator.filter.command", "Commands")}</VSCodeOption>
					<VSCodeOption value="error">{t("chat:navigator.filter.error", "Errors")}</VSCodeOption>
					<VSCodeOption value="api_request">
						{t("chat:navigator.filter.apiRequest", "API Requests")}
					</VSCodeOption>
					<VSCodeOption value="tool_use">{t("chat:navigator.filter.toolUse", "Tool Uses")}</VSCodeOption>
				</VSCodeDropdown>
			</div>

			{/* Results List */}
			<div
				style={{
					flex: 1,
					overflowY: "auto",
					padding: "8px",
				}}>
				{filteredMessages.length === 0 ? (
					<div
						style={{
							padding: "24px",
							textAlign: "center",
							color: "var(--vscode-descriptionForeground)",
						}}>
						{searchQuery
							? t("chat:navigator.noResults", "No messages found matching your search")
							: t("chat:navigator.noMessages", "No messages to display")}
					</div>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
						{filteredMessages.map((item, index) => (
							<div
								key={`${item.originalIndex}-${item.message.ts}`}
								onClick={() => onNavigateToMessage(item.originalIndex)}
								onMouseEnter={() => setSelectedIndex(index)}
								style={{
									padding: "8px 12px",
									borderRadius: "4px",
									cursor: "pointer",
									backgroundColor:
										index === selectedIndex
											? "var(--vscode-list-activeSelectionBackground)"
											: "transparent",
									color:
										index === selectedIndex
											? "var(--vscode-list-activeSelectionForeground)"
											: "var(--vscode-foreground)",
									display: "flex",
									alignItems: "center",
									gap: "8px",
									transition: "background-color 0.1s",
								}}>
								<span
									className={`codicon codicon-${getMessageIcon(item.message)}`}
									style={{
										fontSize: "16px",
										opacity: 0.8,
										flexShrink: 0,
									}}></span>
								<div style={{ flex: 1, minWidth: 0 }}>
									<div
										style={{
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
											fontSize: "13px",
										}}>
										{getMessageDisplayText(item.message, item.matchedText)}
									</div>
									{item.matchedText && searchQuery && (
										<div
											style={{
												fontSize: "11px",
												color: "var(--vscode-descriptionForeground)",
												marginTop: "2px",
											}}>
											{t("chat:navigator.messageNumber", "Message #{{number}}", {
												number: item.originalIndex + 1,
											})}
										</div>
									)}
								</div>
								<span
									style={{
										fontSize: "11px",
										color: "var(--vscode-descriptionForeground)",
										flexShrink: 0,
									}}>
									#{item.originalIndex + 1}
								</span>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Footer */}
			<div
				style={{
					padding: "8px 16px",
					borderTop: "1px solid var(--vscode-editorWidget-border)",
					fontSize: "11px",
					color: "var(--vscode-descriptionForeground)",
					display: "flex",
					justifyContent: "space-between",
				}}>
				<span>
					{t("chat:navigator.showing", "Showing {{count}} of {{total}} messages", {
						count: filteredMessages.length,
						total: messages.length,
					})}
				</span>
				<span>{t("chat:navigator.shortcuts", "↑↓ Navigate • Enter Select • Esc Close")}</span>
			</div>
		</div>
	)
}
