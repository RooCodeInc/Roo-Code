import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { useDeepCompareEffect, useEvent } from "react-use"
import debounce from "debounce"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import removeMd from "remove-markdown"
// import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
// import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import useSound from "use-sound"
import { LRUCache } from "lru-cache"
// import { useTranslation } from "react-i18next"
// import { Trans } from "react-i18next"

import { useDebounceEffect } from "@src/utils/useDebounceEffect"
import { appendImages } from "@src/utils/imageUtils"

import type { ClineAsk, ClineMessage } from "@roo-code/types"

import { ClineSayTool, ExtensionMessage } from "@roo/ExtensionMessage"
import { findLast } from "@roo/array"
import { SuggestionItem } from "@roo-code/types"
import { combineApiRequests } from "@roo/combineApiRequests"
import { combineCommandSequences } from "@roo/combineCommandSequences"
import { getApiMetrics } from "@roo/getApiMetrics"
import { AudioType } from "@roo/WebviewMessage"
import { getAllModes } from "@roo/modes"
import { ProfileValidator } from "@roo/ProfileValidator"
import { getLatestTodo } from "@roo/todo"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useSelectedModel } from "@src/components/ui/hooks/useSelectedModel"
import RooHero from "@src/components/welcome/RooHero"
import RooTips from "@src/components/welcome/RooTips"
import { StandardTooltip, Button } from "@src/components/ui"
// import { CloudUpsellDialog } from "@src/components/cloud/CloudUpsellDialog"

// import TelemetryBanner from "../common/TelemetryBanner"
import NoticesBanner from "../common/NoticesBanner"
import VersionIndicator from "../common/VersionIndicator"
import HistoryPreview from "../history/HistoryPreview"
import type { SearchResult } from "./hooks/useChatSearch"
import { useChatSearch } from "./hooks/useChatSearch"
// import Announcement from "./Announcement"
// import BrowserSessionRow from "./BrowserSessionRow"
// import Announcement from "./Announcement"
import BrowserActionRow from "./BrowserActionRow"
import BrowserSessionStatusRow from "./BrowserSessionStatusRow"
import ChatRow from "./ChatRow"
import { ChatTextArea } from "./ChatTextArea"
import TaskHeader from "./TaskHeader"
import SystemPromptWarning from "./SystemPromptWarning"
import ProfileViolationWarning from "./ProfileViolationWarning"
import { CheckpointWarning } from "./CheckpointWarning"
import { QueuedMessages } from "./QueuedMessages"
import ChatSearch from "./ChatSearch"
// import DismissibleUpsell from "../common/DismissibleUpsell"
// import { useCloudUpsell } from "@src/hooks/useCloudUpsell"
// import { Cloud } from "lucide-react"
// import CloudAgents from "../cloud/CloudAgents"

export interface ChatViewProps {
	isHidden: boolean
	showAnnouncement: boolean
	hideAnnouncement: () => void
}

export interface ChatViewRef {
	acceptInput: () => void
}

export const MAX_IMAGES_PER_MESSAGE = 20 // This is the Anthropic limit.

const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0

const ChatViewComponent: React.ForwardRefRenderFunction<ChatViewRef, ChatViewProps> = (
	{ isHidden /* showAnnouncement, hideAnnouncement */ },
	ref,
) => {
	const isMountedRef = useRef(true)

	const [audioBaseUri] = useState(() => {
		const w = window as any
		return w.AUDIO_BASE_URI || ""
	})

	const { t } = useAppTranslation()
	const modeShortcutText = `${isMac ? "⌘" : "Ctrl"} + . ${t("chat:forNextMode")}, ${isMac ? "⌘" : "Ctrl"} + Shift + . ${t("chat:forPreviousMode")}`

	const {
		clineMessages: messages,
		currentTaskItem,
		currentTaskTodos,
		taskHistory,
		cwd,
		apiConfiguration,
		organizationAllowList,
		mode,
		setMode,
		alwaysAllowModeSwitch,
		alwaysAllowUpdateTodoList,
		customModes,
		// telemetrySetting,
		hasSystemPromptOverride,
		soundEnabled,
		soundVolume,
		// cloudIsAuthenticated,
		messageQueue = [],
		experiments,
		isBrowserSessionActive,
	} = useExtensionState()

	const messagesRef = useRef(messages)

	useEffect(() => {
		messagesRef.current = messages
	}, [messages])

	// Leaving this less safe version here since if the first message is not a
	// task, then the extension is in a bad state and needs to be debugged (see
	// Cline.abort).
	const task = useMemo(() => messages.at(0), [messages])
	const curWorkspaceHistory = useMemo(
		() => (taskHistory || []).filter((t) => t.workspace === cwd),
		[cwd, taskHistory],
	)
	const latestTodos = useMemo(() => {
		// First check if we have initial todos from the state (for new subtasks)
		if (currentTaskTodos && currentTaskTodos.length > 0) {
			// Check if there are any todo updates in messages
			const messageBasedTodos = getLatestTodo(messages)
			// If there are message-based todos, they take precedence (user has updated them)
			if (messageBasedTodos && messageBasedTodos.length > 0) {
				return messageBasedTodos
			}
			// Otherwise use the initial todos from state
			return currentTaskTodos
		}
		// Fall back to extracting from messages
		return getLatestTodo(messages)
	}, [messages, currentTaskTodos])

	const modifiedMessages = useMemo(() => combineApiRequests(combineCommandSequences(messages.slice(1))), [messages])

	// Get search results from useChatSearch
	const { searchResults, searchQuery, setSearchQuery } = useChatSearch(messages)

	// Create a mapping from original message ts to modifiedMessages index

	// Has to be after api_req_finished are all reduced into api_req_started messages.
	const apiMetrics = useMemo(() => getApiMetrics(modifiedMessages), [modifiedMessages])

	const [inputValue, setInputValue] = useState("")
	const inputValueRef = useRef(inputValue)
	const textAreaRef = useRef<HTMLTextAreaElement>(null)
	const [sendingDisabled, setSendingDisabled] = useState(false)
	const [selectedImages, setSelectedImages] = useState<string[]>([])

	// We need to hold on to the ask because useEffect > lastMessage will always
	// let us know when an ask comes in and handle it, but by the time
	// handleMessage is called, the last message might not be the ask anymore
	// (it could be a say that followed).
	const [clineAsk, setClineAsk] = useState<ClineAsk | undefined>(undefined)
	const [enableButtons, setEnableButtons] = useState<boolean>(false)
	const [primaryButtonText, setPrimaryButtonText] = useState<string | undefined>(undefined)
	const [secondaryButtonText, setSecondaryButtonText] = useState<string | undefined>(undefined)
	const [didClickCancel, setDidClickCancel] = useState(false)
	const virtuosoRef = useRef<VirtuosoHandle>(null)
	const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({})
	const prevExpandedRowsRef = useRef<Record<number, boolean>>()
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const disableAutoScrollRef = useRef(false)
	const [showScrollToBottom, setShowScrollToBottom] = useState(false)
	const [isAtBottom, setIsAtBottom] = useState(false)
	const lastTtsRef = useRef<string>("")
	const [wasStreaming, setWasStreaming] = useState<boolean>(false)
	const [checkpointWarning, setCheckpointWarning] = useState<
		{ type: "WAIT_TIMEOUT" | "INIT_TIMEOUT"; timeout: number } | undefined
	>(undefined)
	const [isCondensing, setIsCondensing] = useState<boolean>(false)
	// const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
	const [hoverPreviewMap, setHoverPreviewMap] = useState<Map<string, string>>(new Map())
	const [showSearch, setShowSearch] = useState(false)
	const everVisibleMessagesTsRef = useRef<LRUCache<number, boolean>>(
		new LRUCache({
			max: 100,
			ttl: 1000 * 60 * 5,
		}),
	)
	// const autoApproveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	const followUpAutoApproveTimeoutRef = useRef<number | undefined>()
	// const userRespondedRef = useRef<boolean>(false)
	const [currentFollowUpTs, setCurrentFollowUpTs] = useState<number | null>(null)

	const clineAskRef = useRef(clineAsk)
	useEffect(() => {
		clineAskRef.current = clineAsk
	}, [clineAsk])

	// const {
	// 	isOpen: isUpsellOpen,
	// 	openUpsell,
	// 	closeUpsell,
	// 	handleConnect,
	// } = useCloudUpsell({
	// 	autoOpenOnAuth: false,
	// })

	// Keep inputValueRef in sync with inputValue state
	useEffect(() => {
		inputValueRef.current = inputValue
	}, [inputValue])

	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
		}
	}, [])

	const isProfileDisabled = useMemo(
		() => !!apiConfiguration && !ProfileValidator.isProfileAllowed(apiConfiguration, organizationAllowList),
		[apiConfiguration, organizationAllowList],
	)

	// UI layout depends on the last 2 messages (since it relies on the content
	// of these messages, we are deep comparing) i.e. the button state after
	// hitting button sets enableButtons to false,  and this effect otherwise
	// would have to true again even if messages didn't change.
	const lastMessage = useMemo(() => messages.at(-1), [messages])
	const secondLastMessage = useMemo(() => messages.at(-2), [messages])

	const volume = typeof soundVolume === "number" ? soundVolume : 0.5
	const [playNotification] = useSound(`${audioBaseUri}/notification.wav`, { volume, soundEnabled })
	const [playCelebration] = useSound(`${audioBaseUri}/celebration.wav`, { volume, soundEnabled })
	const [playProgressLoop] = useSound(`${audioBaseUri}/progress_loop.wav`, { volume, soundEnabled })

	const playSound = useCallback(
		(audioType: AudioType) => {
			if (!soundEnabled) {
				return
			}

			switch (audioType) {
				case "notification":
					playNotification()
					break
				case "celebration":
					playCelebration()
					break
				case "progress_loop":
					playProgressLoop()
					break
				default:
					console.warn(`Unknown audio type: ${audioType}`)
			}
		},
		[soundEnabled, playNotification, playCelebration, playProgressLoop],
	)

	function playTts(text: string) {
		vscode.postMessage({ type: "playTts", text })
	}

	useDeepCompareEffect(() => {
		// if last message is an ask, show user ask UI
		// if user finished a task, then start a new task with a new conversation history since in this moment that the extension is waiting for user response, the user could close the extension and the conversation history would be lost.
		// basically as long as a task is active, the conversation history will be persisted
		if (lastMessage) {
			switch (lastMessage.type) {
				case "ask":
					// Reset user response flag when a new ask arrives to allow auto-approval
					// userRespondedRef.current = false
					const isPartial = lastMessage.partial === true
					switch (lastMessage.ask) {
						case "api_req_failed":
							playSound("progress_loop")
							setSendingDisabled(true)
							setClineAsk("api_req_failed")
							setEnableButtons(true)
							setPrimaryButtonText(t("chat:retry.title"))
							setSecondaryButtonText(t("chat:startNewTask.title"))
							break
						case "mistake_limit_reached":
							playSound("progress_loop")
							setSendingDisabled(false)
							setClineAsk("mistake_limit_reached")
							setEnableButtons(true)
							setPrimaryButtonText(t("chat:proceedAnyways.title"))
							setSecondaryButtonText(t("chat:startNewTask.title"))
							break
						case "followup":
							setSendingDisabled(isPartial)
							setClineAsk("followup")
							// setting enable buttons to `false` would trigger a focus grab when
							// the text area is enabled which is undesirable.
							// We have no buttons for this tool, so no problem having them "enabled"
							// to workaround this issue.  See #1358.
							setEnableButtons(true)
							setPrimaryButtonText(undefined)
							setSecondaryButtonText(undefined)
							break
						case "tool":
							setSendingDisabled(isPartial)
							setClineAsk("tool")
							setEnableButtons(!isPartial)
							const tool = JSON.parse(lastMessage.text || "{}") as ClineSayTool
							switch (tool.tool) {
								case "editedExistingFile":
								case "appliedDiff":
								case "newFileCreated":
								case "insertContent":
								case "generateImage":
									setPrimaryButtonText(t("chat:save.title"))
									setSecondaryButtonText(t("chat:reject.title"))
									break
								case "finishTask":
									setPrimaryButtonText(t("chat:completeSubtaskAndReturn"))
									setSecondaryButtonText(undefined)
									break
								case "readFile":
									if (tool.batchFiles && Array.isArray(tool.batchFiles)) {
										setPrimaryButtonText(t("chat:read-batch.approve.title"))
										setSecondaryButtonText(t("chat:read-batch.deny.title"))
									} else {
										setPrimaryButtonText(t("chat:approve.title"))
										setSecondaryButtonText(t("chat:reject.title"))
									}
									break
								default:
									setPrimaryButtonText(t("chat:approve.title"))
									setSecondaryButtonText(t("chat:reject.title"))
									break
							}
							break
						case "browser_action_launch":
							setSendingDisabled(isPartial)
							setClineAsk("browser_action_launch")
							setEnableButtons(!isPartial)
							setPrimaryButtonText(t("chat:approve.title"))
							setSecondaryButtonText(t("chat:reject.title"))
							break
						case "command":
							setSendingDisabled(isPartial)
							setClineAsk("command")
							setEnableButtons(!isPartial)
							setPrimaryButtonText(t("chat:runCommand.title"))
							setSecondaryButtonText(t("chat:reject.title"))
							break
						case "command_output":
							setSendingDisabled(false)
							setClineAsk("command_output")
							setEnableButtons(true)
							setPrimaryButtonText(t("chat:proceedWhileRunning.title"))
							setSecondaryButtonText(t("chat:killCommand.title"))
							break
						case "use_mcp_server":
							setSendingDisabled(isPartial)
							setClineAsk("use_mcp_server")
							setEnableButtons(!isPartial)
							setPrimaryButtonText(t("chat:approve.title"))
							setSecondaryButtonText(t("chat:reject.title"))
							break
						case "completion_result":
							// Extension waiting for feedback, but we can just present a new task button.
							// Only play celebration sound if there are no queued messages.
							if (!isPartial && messageQueue.length === 0) {
								playSound("celebration")
							}
							setSendingDisabled(isPartial)
							setClineAsk("completion_result")
							setEnableButtons(!isPartial)
							setPrimaryButtonText(t("chat:startNewTask.title"))
							setSecondaryButtonText(undefined)
							break
						case "resume_task":
							setSendingDisabled(false)
							setClineAsk("resume_task")
							setEnableButtons(true)
							setPrimaryButtonText(t("chat:resumeTask.title"))
							setSecondaryButtonText(t("chat:terminate.title"))
							setDidClickCancel(false) // special case where we reset the cancel button state
							break
						case "resume_completed_task":
							setSendingDisabled(false)
							setClineAsk("resume_completed_task")
							setEnableButtons(true)
							setPrimaryButtonText(t("chat:startNewTask.title"))
							setSecondaryButtonText(undefined)
							setDidClickCancel(false)
							break
					}
					break
				case "say":
					// Don't want to reset since there could be a "say" after
					// an "ask" while ask is waiting for response.
					switch (lastMessage.say) {
						case "api_req_retry_delayed":
							setSendingDisabled(true)
							break
						case "api_req_started":
							if (secondLastMessage?.ask === "command_output") {
								setSendingDisabled(true)
								setSelectedImages([])
								setClineAsk(undefined)
								setEnableButtons(false)
							}
							break
						case "api_req_finished":
						case "error":
						case "text":
						case "browser_action":
						case "browser_action_result":
						case "command_output":
						case "mcp_server_request_started":
						case "mcp_server_response":
						case "completion_result":
							break
					}
					break
			}
		}
	}, [lastMessage, secondLastMessage])

	useEffect(() => {
		if (messages.length === 0) {
			setSendingDisabled(false)
			setClineAsk(undefined)
			setEnableButtons(false)
			setPrimaryButtonText(undefined)
			setSecondaryButtonText(undefined)
		}
	}, [messages.length])

	useEffect(() => {
		// Reset UI states only when task changes
		setExpandedRows({})
		everVisibleMessagesTsRef.current.clear() // Clear for new task
		setCurrentFollowUpTs(null) // Clear follow-up answered state for new task
		setIsCondensing(false) // Reset condensing state when switching tasks
		// Note: sendingDisabled is not reset here as it's managed by message effects

		// Clear any pending auto-approval timeout from previous task
		// if (autoApproveTimeoutRef.current) {
		// 	clearTimeout(autoApproveTimeoutRef.current)
		// 	autoApproveTimeoutRef.current = null
		// }
		// Reset user response flag for new task
		// userRespondedRef.current = false
	}, [task?.ts])

	useEffect(() => {
		if (isHidden) {
			everVisibleMessagesTsRef.current.clear()
		}
	}, [isHidden])

	useEffect(() => {
		const cache = everVisibleMessagesTsRef.current
		return () => {
			cache.clear()
		}
	}, [])

	useEffect(() => {
		const prev = prevExpandedRowsRef.current
		let wasAnyRowExpandedByUser = false
		if (prev) {
			// Check if any row transitioned from false/undefined to true
			for (const [tsKey, isExpanded] of Object.entries(expandedRows)) {
				const ts = Number(tsKey)
				if (isExpanded && !(prev[ts] ?? false)) {
					wasAnyRowExpandedByUser = true
					break
				}
			}
		}

		if (wasAnyRowExpandedByUser) {
			disableAutoScrollRef.current = true
		}
		prevExpandedRowsRef.current = expandedRows // Store current state for next comparison
	}, [expandedRows])

	const isStreaming = useMemo(() => {
		// Checking clineAsk isn't enough since messages effect may be called
		// again for a tool for example, set clineAsk to its value, and if the
		// next message is not an ask then it doesn't reset. This is likely due
		// to how much more often we're updating messages as compared to before,
		// and should be resolved with optimizations as it's likely a rendering
		// bug. But as a final guard for now, the cancel button will show if the
		// last message is not an ask.
		const isLastAsk = !!modifiedMessages.at(-1)?.ask

		const isToolCurrentlyAsking =
			isLastAsk && clineAsk !== undefined && enableButtons && primaryButtonText !== undefined

		if (isToolCurrentlyAsking) {
			return false
		}

		const isLastMessagePartial = modifiedMessages.at(-1)?.partial === true

		if (isLastMessagePartial) {
			return true
		} else {
			const lastApiReqStarted = findLast(
				modifiedMessages,
				(message: ClineMessage) => message.say === "api_req_started",
			)

			if (
				lastApiReqStarted &&
				lastApiReqStarted.text !== null &&
				lastApiReqStarted.text !== undefined &&
				lastApiReqStarted.say === "api_req_started"
			) {
				const cost = JSON.parse(lastApiReqStarted.text).cost

				if (cost === undefined) {
					return true // API request has not finished yet.
				}
			}
		}

		return false
	}, [modifiedMessages, clineAsk, enableButtons, primaryButtonText])

	const markFollowUpAsAnswered = useCallback(() => {
		const lastFollowUpMessage = messagesRef.current.findLast((msg: ClineMessage) => msg.ask === "followup")
		if (lastFollowUpMessage) {
			setCurrentFollowUpTs(lastFollowUpMessage.ts)
		}
	}, [])

	const handleChatReset = useCallback((isCommandInput = false, askType?: ClineAsk) => {
		// Only reset message-specific state, preserving mode.
		setInputValue("")
		setSendingDisabled(!isCommandInput)
		setSelectedImages([])
		setClineAsk(isCommandInput ? askType : undefined)
		setEnableButtons(isCommandInput ?? false)
		// Do not reset mode here as it should persist.
		disableAutoScrollRef.current = false
	}, [])

	/**
	 * Handles sending messages to the extension
	 * @param text - The message text to send
	 * @param images - Array of image data URLs to send with the message
	 */
	const handleSendMessage = useCallback(
		(text: string, images: string[], chatType = "system") => {
			text = text.trim()

			if (text || images.length > 0) {
				// Queue message if:
				// - Task is busy (sendingDisabled)
				// - API request in progress (isStreaming)
				// - Queue has items (preserve message order during drain)
				if (sendingDisabled || isStreaming || messageQueue.length > 0) {
					try {
						vscode.postMessage({ type: "queueMessage", text, images })
						setInputValue("")
						setSelectedImages([])
					} catch (error) {
						console.error(
							`Failed to queue message: ${error instanceof Error ? error.message : String(error)}`,
						)
					}

					return
				}

				// Mark that user has responded - this prevents any pending auto-approvals.
				// userRespondedRef.current = true
				const isCommandInput = clineAskRef.current === "command_output"
				if (messagesRef.current.length === 0) {
					vscode.postMessage({ type: "newTask", text, images, values: { chatType } })
				} else if (clineAskRef.current) {
					if (clineAskRef.current === "followup") {
						markFollowUpAsAnswered()
					}

					// Use clineAskRef.current
					switch (
						clineAskRef.current // Use clineAskRef.current
					) {
						case "followup":
						case "tool":
						case "browser_action_launch":
						case "command": // User can provide feedback to a tool or command use.
						case "command_output": // User can send input to command stdin.
						case "use_mcp_server":
						case "completion_result": // If this happens then the user has feedback for the completion result.
						case "resume_task":
						case "resume_completed_task":
						case "mistake_limit_reached":
							vscode.postMessage({
								type: "askResponse",
								askResponse: "messageResponse",
								text,
								images,
								values: { chatType, isCommandInput },
							})
							break
						// There is no other case that a textfield should be enabled.
					}
				} else {
					// This is a new message in an ongoing task.
					vscode.postMessage({ type: "askResponse", askResponse: "messageResponse", text, images })
				}

				handleChatReset(isCommandInput, clineAskRef.current)
			}
		},
		[handleChatReset, markFollowUpAsAnswered, sendingDisabled, isStreaming, messageQueue.length], // messagesRef and clineAskRef are stable
	)

	const handleSetChatBoxMessage = useCallback(
		(text: string, images: string[], selectText: string = "") => {
			// Avoid nested template literals by breaking down the logic
			let newValue = text

			if (inputValue !== "") {
				newValue = `${inputValue}${inputValue.endsWith(" ") ? "" : " "}${text}`
			}
			setInputValue(newValue)
			setSelectedImages([...selectedImages, ...images])

			const filePathMatch = text.match(/\b[\w/\\.-]+:\d+-\d+\b/)
			if (filePathMatch) {
				setHoverPreviewMap((prev) => new Map(prev.set(filePathMatch[0], selectText)))
			}
			textAreaRef.current?.focus()
		},
		[inputValue, selectedImages],
	)

	const handeSetChatBoxMessageByContext = useCallback(
		(text: string, images: string[]) => {
			let newValue = text

			if (inputValue !== "") {
				newValue = inputValue + text
			}

			setInputValue(newValue)
			setSelectedImages([...selectedImages, ...images])
		},
		[inputValue, selectedImages],
	)

	const startNewTask = useCallback(() => vscode.postMessage({ type: "clearTask" }), [])

	// This logic depends on the useEffect[messages] above to set clineAsk,
	// after which buttons are shown and we then send an askResponse to the
	// extension.
	const handlePrimaryButtonClick = useCallback(
		(text?: string, images?: string[]) => {
			// Mark that user has responded
			// userRespondedRef.current = true

			const trimmedInput = text?.trim()

			switch (clineAsk) {
				case "api_req_failed":
				case "command":
				case "tool":
				case "browser_action_launch":
				case "use_mcp_server":
				case "resume_task":
				case "mistake_limit_reached":
					if (clineAsk === "resume_task") {
						markFollowUpAsAnswered()
					}
					// Only send text/images if they exist
					if (trimmedInput || (images && images.length > 0)) {
						vscode.postMessage({
							type: "askResponse",
							askResponse: "yesButtonClicked",
							text: trimmedInput,
							images: images,
						})
						// Clear input state after sending
						setInputValue("")
						setSelectedImages([])
					} else {
						vscode.postMessage({ type: "askResponse", askResponse: "yesButtonClicked" })
					}
					break
				case "completion_result":
				case "resume_completed_task":
					// Waiting for feedback, but we can just present a new task button
					startNewTask()
					break
				case "command_output":
					vscode.postMessage({ type: "terminalOperation", terminalOperation: "continue" })
					break
			}

			setSendingDisabled(true)
			setClineAsk(undefined)
			setEnableButtons(false)
		},
		[clineAsk, markFollowUpAsAnswered, startNewTask],
	)

	const handleSecondaryButtonClick = useCallback(
		(text?: string, images?: string[]) => {
			// Mark that user has responded
			// userRespondedRef.current = true

			const trimmedInput = text?.trim()

			if (isStreaming) {
				vscode.postMessage({ type: "cancelTask" })
				setDidClickCancel(true)
				return
			}

			switch (clineAsk) {
				case "api_req_failed":
				case "mistake_limit_reached":
				case "resume_task":
					startNewTask()
					break
				case "command":
				case "tool":
				case "browser_action_launch":
				case "use_mcp_server":
					// Only send text/images if they exist
					if (trimmedInput || (images && images.length > 0)) {
						vscode.postMessage({
							type: "askResponse",
							askResponse: "noButtonClicked",
							text: trimmedInput,
							images: images,
						})
						// Clear input state after sending
						setInputValue("")
						setSelectedImages([])
					} else {
						// Responds to the API with a "This operation failed" and lets it try again
						vscode.postMessage({ type: "askResponse", askResponse: "noButtonClicked" })
					}
					break
				case "command_output":
					vscode.postMessage({ type: "terminalOperation", terminalOperation: "abort" })
					break
			}
			setSendingDisabled(true)
			setClineAsk(undefined)
			setEnableButtons(false)
		},
		[clineAsk, startNewTask, isStreaming],
	)

	const { info: model } = useSelectedModel(apiConfiguration)

	const selectImages = useCallback(() => vscode.postMessage({ type: "selectImages" }), [])

	const shouldDisableImages = !model?.supportsImages || selectedImages.length >= MAX_IMAGES_PER_MESSAGE

	const handleMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data

			switch (message.type) {
				case "zgsmFollowupClearTimeout": {
					followUpAutoApproveTimeoutRef.current = message.value
					break
				}
				case "action":
					switch (message.action!) {
						case "didBecomeVisible":
							if (!isHidden && !sendingDisabled && !enableButtons) {
								textAreaRef.current?.focus()
							}
							break
						case "focusInput":
							textAreaRef.current?.focus()
							break
					}
					break
				case "selectedImages":
					// Only handle selectedImages if it's not for editing context
					// When context is "edit", ChatRow will handle the images
					if (message.context !== "edit") {
						setSelectedImages((prevImages: string[]) =>
							appendImages(prevImages, message.images, MAX_IMAGES_PER_MESSAGE),
						)
					}
					break
				case "invoke":
					switch (message.invoke!) {
						case "newChat":
							handleChatReset()
							break
						case "sendMessage":
							handleSendMessage(message.text ?? "", message.images ?? [], "user")
							break
						case "setChatBoxMessage":
							handleSetChatBoxMessage(message.text ?? "", message.images ?? [], message.selectText ?? "")
							break
						case "primaryButtonClick":
							handlePrimaryButtonClick(message.text ?? "", message.images ?? [])
							break
						case "secondaryButtonClick":
							handleSecondaryButtonClick(message.text ?? "", message.images ?? [])
							break
						case "setChatBoxMessageByContext":
							handeSetChatBoxMessageByContext(message.text ?? "", message.images ?? [])
					}
					break
				case "condenseTaskContextResponse":
					if (message.text && message.text === currentTaskItem?.id) {
						if (isCondensing && sendingDisabled) {
							setSendingDisabled(false)
						}
						setIsCondensing(false)
					}
					break
				case "checkpointInitWarning":
					setCheckpointWarning(message.checkpointWarning)
					break
				case "interactionRequired":
					playSound("notification")
					break
			}
			// textAreaRef.current is not explicitly required here since React
			// guarantees that ref will be stable across re-renders, and we're
			// not using its value but its reference.
		},
		[
			currentTaskItem?.id,
			isHidden,
			sendingDisabled,
			enableButtons,
			handleChatReset,
			handleSendMessage,
			handleSetChatBoxMessage,
			handlePrimaryButtonClick,
			handleSecondaryButtonClick,
			handeSetChatBoxMessageByContext,
			isCondensing,
			setCheckpointWarning,
			playSound,
		],
	)

	useEvent("message", handleMessage)

	const visibleMessages = useMemo(() => {
		// Pre-compute checkpoint hashes that have associated user messages for O(1) lookup
		const userMessageCheckpointHashes = new Set<string>()
		modifiedMessages.forEach((msg) => {
			if (
				msg.say === "user_feedback" &&
				msg.checkpoint &&
				(msg.checkpoint as any).type === "user_message" &&
				(msg.checkpoint as any).hash
			) {
				userMessageCheckpointHashes.add((msg.checkpoint as any).hash)
			}
		})

		// Remove the 500-message limit to prevent array index shifting
		// Virtuoso is designed to efficiently handle large lists through virtualization
		const newVisibleMessages = modifiedMessages.filter((message) => {
			// Filter out checkpoint_saved messages that should be suppressed
			if (message.say === "checkpoint_saved") {
				// Check if this checkpoint has the suppressMessage flag set
				if (
					message.checkpoint &&
					typeof message.checkpoint === "object" &&
					"suppressMessage" in message.checkpoint &&
					message.checkpoint.suppressMessage
				) {
					return false
				}
				// Also filter out checkpoint messages associated with user messages (legacy behavior)
				if (message.text && userMessageCheckpointHashes.has(message.text)) {
					return false
				}
			}

			if (everVisibleMessagesTsRef.current.has(message.ts)) {
				const alwaysHiddenOnceProcessedAsk: ClineAsk[] = [
					"api_req_failed",
					"resume_task",
					"resume_completed_task",
				]
				const alwaysHiddenOnceProcessedSay = [
					"api_req_finished",
					"api_req_retried",
					"api_req_deleted",
					"mcp_server_request_started",
				]
				if (message.ask && alwaysHiddenOnceProcessedAsk.includes(message.ask)) return false
				if (message.say && alwaysHiddenOnceProcessedSay.includes(message.say)) return false
				if (message.say === "text" && (message.text ?? "") === "" && (message.images?.length ?? 0) === 0) {
					return false
				}
				return true
			}

			switch (message.ask) {
				case "completion_result":
					if (message.text === "") return false
					break
				case "api_req_failed":
				case "resume_task":
				case "resume_completed_task":
					return false
			}
			switch (message.say) {
				case "api_req_finished":
				case "api_req_retried":
				case "api_req_deleted":
					return false
				case "api_req_retry_delayed":
					const last1 = modifiedMessages.at(-1)
					const last2 = modifiedMessages.at(-2)
					if (last1?.ask === "resume_task" && last2 === message) {
						return true
					} else if (message !== last1) {
						return false
					}
					break
				case "text":
					if ((message.text ?? "") === "" && (message.images?.length ?? 0) === 0) return false
					break
				case "mcp_server_request_started":
					return false
			}
			return true
		})

		const viewportStart = Math.max(0, newVisibleMessages.length - 100)
		newVisibleMessages
			.slice(viewportStart)
			.forEach((msg: ClineMessage) => everVisibleMessagesTsRef.current.set(msg.ts, true))

		return newVisibleMessages
	}, [modifiedMessages])

	useEffect(() => {
		const cleanupInterval = setInterval(() => {
			const cache = everVisibleMessagesTsRef.current
			const currentMessageIds = new Set(modifiedMessages.map((m: ClineMessage) => m.ts))
			const viewportMessages = visibleMessages.slice(Math.max(0, visibleMessages.length - 100))
			const viewportMessageIds = new Set(viewportMessages.map((m: ClineMessage) => m.ts))

			cache.forEach((_value: boolean, key: number) => {
				if (!currentMessageIds.has(key) && !viewportMessageIds.has(key)) {
					cache.delete(key)
				}
			})
		}, 60000)

		return () => clearInterval(cleanupInterval)
	}, [modifiedMessages, visibleMessages])

	useDebounceEffect(
		() => {
			if (!isHidden && !sendingDisabled && !enableButtons) {
				textAreaRef.current?.focus()
			}
		},
		50,
		[isHidden, sendingDisabled, enableButtons],
	)

	useEffect(() => {
		// This ensures the first message is not read, future user messages are
		// labeled as `user_feedback`.
		if (lastMessage && messages.length > 1) {
			if (
				lastMessage.text && // has text
				(lastMessage.say === "text" || lastMessage.say === "completion_result") && // is a text message
				!lastMessage.partial && // not a partial message
				!lastMessage.text.startsWith("{") // not a json object
			) {
				let text = lastMessage?.text || ""
				const mermaidRegex = /```mermaid[\s\S]*?```/g
				// remove mermaid diagrams from text
				text = text.replace(mermaidRegex, "")
				// remove markdown from text
				text = removeMd(text)

				// ensure message is not a duplicate of last read message
				if (text !== lastTtsRef.current) {
					try {
						playTts(text)
						lastTtsRef.current = text
					} catch (error) {
						console.error("Failed to execute text-to-speech:", error)
					}
				}
			}
		}

		// Update previous value.
		setWasStreaming(isStreaming)
	}, [isStreaming, lastMessage, wasStreaming, messages.length])

	// Compute current browser session messages for the top banner (not grouped into chat stream)
	// Find the FIRST browser session from the beginning to show ALL sessions
	const browserSessionStartIndex = useMemo(() => {
		for (let i = 0; i < messages.length; i++) {
			if (messages[i].ask === "browser_action_launch") {
				return i
			}
		}
		return -1
	}, [messages])

	const _browserSessionMessages = useMemo<ClineMessage[]>(() => {
		if (browserSessionStartIndex === -1) return []
		return messages.slice(browserSessionStartIndex)
	}, [browserSessionStartIndex, messages])

	// Show globe toggle only when in a task that has a browser session (active or inactive)
	const showBrowserDockToggle = useMemo(
		() => Boolean(task && (browserSessionStartIndex !== -1 || isBrowserSessionActive)),
		[task, browserSessionStartIndex, isBrowserSessionActive],
	)

	const isBrowserSessionMessage = useCallback((message: ClineMessage): boolean => {
		// Only the launch ask should be hidden from chat (it's shown in the drawer header)
		if (message.type === "ask" && message.ask === "browser_action_launch") {
			return true
		}
		// browser_action_result messages are paired with browser_action and should not appear independently
		if (message.type === "say" && message.say === "browser_action_result") {
			return true
		}
		return false
	}, [])

	const groupedMessages = useMemo(() => {
		// Only filter out the launch ask and result messages - browser actions appear in chat
		const result: ClineMessage[] = visibleMessages.filter(
			(msg) =>
				!isBrowserSessionMessage(msg) &&
				!msg?.metadata?.isRateLimitRetry && // Hide rate limit retries
				!["condense_context_error", "shell_integration_warning"].includes(msg.say!) && // Hide shell integration warning
				!(msg.type === "say" && msg.say === "reasoning" && !msg.text?.trim()) && // Hide empty reasoning messages
				msg.say !== "error" &&
				apiConfiguration?.apiProvider === "zgsm", // Hide error messages from ZGSM
		)

		if (isCondensing) {
			result.push({
				type: "say",
				say: "condense_context",
				ts: Date.now(),
				partial: true,
			} as any)
		}
		return result
	}, [visibleMessages, isCondensing, isBrowserSessionMessage, apiConfiguration?.apiProvider])

	// scrolling

	const scrollToBottomSmooth = useMemo(
		() =>
			debounce(() => virtuosoRef.current?.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior: "smooth" }), 10, {
				immediate: true,
			}),
		[],
	)

	useEffect(() => {
		return () => {
			if (scrollToBottomSmooth && typeof (scrollToBottomSmooth as any).cancel === "function") {
				;(scrollToBottomSmooth as any).cancel()
			}
		}
	}, [scrollToBottomSmooth])

	const scrollToBottomAuto = useCallback(() => {
		virtuosoRef.current?.scrollTo({
			top: Number.MAX_SAFE_INTEGER,
			behavior: "auto", // Instant causes crash.
		})
	}, [])

	const handleSetExpandedRow = useCallback(
		(ts: number, expand?: boolean) => {
			setExpandedRows((prev: Record<number, boolean>) => ({
				...prev,
				[ts]: expand === undefined ? !prev[ts] : expand,
			}))
		},
		[setExpandedRows], // setExpandedRows is stable
	)

	// Scroll to specified message
	const scrollToMessage = useCallback(
		(messageIndex: number) => {
			if (virtuosoRef.current && messageIndex >= 0 && messageIndex < groupedMessages.length && !isStreaming) {
				virtuosoRef.current.scrollToIndex({
					index: messageIndex,
					behavior: "smooth",
					align: "center",
				})
				// Disable auto-scrolling because user is manually navigating
				disableAutoScrollRef.current = true
			}
		},
		[groupedMessages.length, isStreaming],
	)

	// Scroll when user toggles certain rows.
	const toggleRowExpansion = useCallback(
		(ts: number) => {
			handleSetExpandedRow(ts)
			// The logic to set disableAutoScrollRef.current = true on expansion
			// is now handled by the useEffect hook that observes expandedRows.
		},
		[handleSetExpandedRow],
	)

	const handleRowHeightChange = useCallback(
		(isTaller: boolean) => {
			if (!disableAutoScrollRef.current) {
				if (isTaller) {
					scrollToBottomSmooth()
				} else {
					setTimeout(() => scrollToBottomAuto(), 0)
				}
			}
		},
		[scrollToBottomSmooth, scrollToBottomAuto],
	)

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined
		if (!disableAutoScrollRef.current) {
			timer = setTimeout(() => scrollToBottomSmooth(), 50)
		}
		return () => {
			if (timer) {
				clearTimeout(timer)
			}
		}
	}, [groupedMessages.length, scrollToBottomSmooth])

	const handleWheel = useCallback((event: Event) => {
		const wheelEvent = event as WheelEvent

		if (wheelEvent.deltaY && wheelEvent.deltaY < 0) {
			if (scrollContainerRef.current?.contains(wheelEvent.target as Node)) {
				// User scrolled up
				disableAutoScrollRef.current = true
			}
		}
	}, [])

	useEvent("wheel", handleWheel, window, { passive: true }) // passive improves scrolling performance

	// Effect to clear checkpoint warning when messages appear or task changes
	useEffect(() => {
		if (isHidden || !task) {
			setCheckpointWarning(undefined)
		}
	}, [modifiedMessages.length, isStreaming, isHidden, task])

	const placeholderText = task ? t("chat:typeMessage") : t("chat:typeTask")

	const switchToMode = useCallback(
		(modeSlug: string): void => {
			// Update local state and notify extension to sync mode change.
			setMode(modeSlug)

			// Send the mode switch message.
			vscode.postMessage({ type: "mode", text: modeSlug })
		},
		[setMode],
	)

	const handleSuggestionClickInRow = useCallback(
		(suggestion: SuggestionItem, event?: React.MouseEvent) => {
			// Mark that user has responded if this is a manual click (not auto-approval)
			// if (event) {
			// 	userRespondedRef.current = true
			// }

			// Mark the current follow-up question as answered when a suggestion is clicked
			if (clineAsk === "followup" && !event?.shiftKey) {
				markFollowUpAsAnswered()
			}

			// Check if we need to switch modes
			if (suggestion.mode) {
				// Only switch modes if it's a manual click (event exists) or auto-approval is allowed
				const isManualClick = !!event
				if (isManualClick || alwaysAllowModeSwitch) {
					// Switch mode without waiting
					switchToMode(suggestion.mode)
				}
			}

			if (event?.shiftKey) {
				// Always append to existing text, don't overwrite
				setInputValue((currentValue: string) => {
					return currentValue !== "" ? `${currentValue} \n${suggestion.answer}` : suggestion.answer
				})
			} else {
				// Don't clear the input value when sending a follow-up choice
				// The message should be sent but the text area should preserve what the user typed
				const preservedInput = inputValueRef.current
				handleSendMessage(suggestion.answer, [])
				// Restore the input value after sending
				setInputValue(preservedInput)
			}
		},
		[clineAsk, markFollowUpAsAnswered, alwaysAllowModeSwitch, switchToMode, handleSendMessage],
	)

	const handleBatchFileResponse = useCallback((response: { [key: string]: boolean }) => {
		// Handle batch file response, e.g., for file uploads
		vscode.postMessage({ type: "askResponse", askResponse: "objectResponse", text: JSON.stringify(response) })
	}, [])

	// Handler for when FollowUpSuggest component unmounts
	const handleFollowUpUnmount = useCallback(() => {
		// Mark that user has responded
		// userRespondedRef.current = true
		if (Number.isInteger(followUpAutoApproveTimeoutRef.current)) {
			vscode.postMessage({
				type: "zgsmFollowupClearTimeout",
				value: followUpAutoApproveTimeoutRef.current,
			})
		}
		followUpAutoApproveTimeoutRef.current = undefined
	}, [])
	const shouldHighlight = useCallback(
		(messageOrGroup?: ClineMessage, searchResults: SearchResult[] = [], showSearch?: boolean) => {
			if (!searchQuery || !showSearch || !messageOrGroup || !searchResults || searchResults.length === 0) {
				return false
			}

			// Find if this message is in searchResults
			// const matchingResult = searchResults.find((result) => result.ts === messageOrGroup.ts)
			return searchResults.find((result) => result.ts === messageOrGroup.ts) !== undefined
		},
		[searchQuery],
	)
	const itemContent = useCallback(
		(index: number, messageOrGroup: ClineMessage) => {
			const hasCheckpoint = modifiedMessages.some((message) => message.say === "checkpoint_saved")

			// Check if this is a browser action message
			if (messageOrGroup.type === "say" && messageOrGroup.say === "browser_action") {
				// Find the corresponding result message by looking for the next browser_action_result after this action's timestamp
				const nextMessage = modifiedMessages.find(
					(m) => m.ts > messageOrGroup.ts && m.say === "browser_action_result",
				)

				// Calculate action index and total count
				const browserActions = modifiedMessages.filter((m) => m.say === "browser_action")
				const actionIndex = browserActions.findIndex((m) => m.ts === messageOrGroup.ts) + 1
				const totalActions = browserActions.length

				return (
					<BrowserActionRow
						key={messageOrGroup.ts}
						message={messageOrGroup}
						nextMessage={nextMessage}
						actionIndex={actionIndex}
						totalActions={totalActions}
					/>
				)
			}

			// Check if this is a browser session status message
			if (messageOrGroup.type === "say" && messageOrGroup.say === "browser_session_status") {
				return <BrowserSessionStatusRow key={messageOrGroup.ts} message={messageOrGroup} />
			}

			// regular message
			return (
				<ChatRow
					key={messageOrGroup.ts}
					message={messageOrGroup}
					isExpanded={expandedRows[messageOrGroup.ts] || false}
					onToggleExpand={toggleRowExpansion} // This was already stabilized
					lastModifiedMessage={modifiedMessages.at(-1)} // Original direct access
					isLast={index === groupedMessages.length - 1} // Original direct access
					onHeightChange={handleRowHeightChange}
					isStreaming={isStreaming}
					onSuggestionClick={handleSuggestionClickInRow} // This was already stabilized
					onBatchFileResponse={handleBatchFileResponse}
					onFollowUpUnmount={handleFollowUpUnmount}
					isFollowUpAnswered={
						primaryButtonText === t("chat:resumeTask.title") ||
						primaryButtonText === t("chat:cancel.title") ||
						primaryButtonText === t("chat:startNewTask.title") ||
						(currentFollowUpTs != null && messageOrGroup.ts <= currentFollowUpTs)
					}
					editable={
						messageOrGroup.type === "ask" &&
						messageOrGroup.ask === "tool" &&
						(() => {
							let tool: any = {}
							try {
								tool = JSON.parse(messageOrGroup.text || "{}")
							} catch (_) {
								if (messageOrGroup.text?.includes("updateTodoList")) {
									tool = { tool: "updateTodoList" }
								}
							}
							if (tool.tool === "updateTodoList" && alwaysAllowUpdateTodoList) {
								return false
							}
							return tool.tool === "updateTodoList" && enableButtons && !!primaryButtonText
						})()
					}
					shouldHighlight={shouldHighlight(messageOrGroup, searchResults, showSearch)}
					searchResults={searchResults}
					searchQuery={searchQuery}
					hasCheckpoint={hasCheckpoint}
				/>
			)
		},
		[
			expandedRows,
			toggleRowExpansion,
			modifiedMessages,
			groupedMessages.length,
			handleRowHeightChange,
			isStreaming,
			handleSuggestionClickInRow,
			handleBatchFileResponse,
			handleFollowUpUnmount,
			primaryButtonText,
			t,
			currentFollowUpTs,
			shouldHighlight,
			searchResults,
			showSearch,
			searchQuery,
			alwaysAllowUpdateTodoList,
			enableButtons,
		],
	)

	// Function to handle mode switching
	const switchToNextMode = useCallback(() => {
		const allModes = getAllModes(customModes)
		const currentModeIndex = allModes.findIndex((m) => m.slug === mode)
		const nextModeIndex = (currentModeIndex + 1) % allModes.length
		// Update local state and notify extension to sync mode change
		switchToMode(allModes[nextModeIndex].slug)
	}, [mode, customModes, switchToMode])

	// Function to handle switching to previous mode
	const switchToPreviousMode = useCallback(() => {
		const allModes = getAllModes(customModes)
		const currentModeIndex = allModes.findIndex((m) => m.slug === mode)
		const previousModeIndex = (currentModeIndex - 1 + allModes.length) % allModes.length
		// Update local state and notify extension to sync mode change
		switchToMode(allModes[previousModeIndex].slug)
	}, [mode, customModes, switchToMode])

	// Add keyboard event handler
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			// Check for Command/Ctrl + Period (with or without Shift)
			// Using event.key to respect keyboard layouts (e.g., Dvorak)
			if ((event.metaKey || event.ctrlKey) && event.key === ".") {
				event.preventDefault() // Prevent default browser behavior

				if (event.shiftKey) {
					// Shift + Period = Previous mode
					switchToPreviousMode()
				} else {
					// Just Period = Next mode
					switchToNextMode()
				}
			}

			// Check for Command/Ctrl + F for search - toggle functionality
			if ((event.metaKey || event.ctrlKey) && event.key === "f") {
				event.preventDefault() // Prevent default browser behavior
				event.stopPropagation() // Prevent event from bubbling to VSCode
				setShowSearch((prev) => !prev)
			}

			// Escape key to close search
			if (event.key === "Escape" && showSearch) {
				event.preventDefault()
				event.stopPropagation() // Prevent event from bubbling to VSCode
				setShowSearch(false)
				setSearchQuery("")
			}
		},
		[showSearch, switchToPreviousMode, switchToNextMode, setSearchQuery],
	)

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown)

		return () => {
			window.removeEventListener("keydown", handleKeyDown)
		}
	}, [handleKeyDown])

	useImperativeHandle(ref, () => ({
		acceptInput: () => {
			if (enableButtons && primaryButtonText) {
				handlePrimaryButtonClick(inputValue, selectedImages)
			} else if (!sendingDisabled && !isProfileDisabled && (inputValue.trim() || selectedImages.length > 0)) {
				handleSendMessage(inputValue, selectedImages)
			}
		},
	}))

	const handleCondenseContext = (taskId: string) => {
		if (isCondensing || sendingDisabled) {
			return
		}
		setIsCondensing(true)
		setSendingDisabled(true)
		vscode.postMessage({ type: "condenseTaskContextRequest", text: taskId })
	}

	const areButtonsVisible = showScrollToBottom || primaryButtonText || secondaryButtonText || isStreaming

	return (
		<div
			data-testid="chat-view"
			className={isHidden ? "hidden" : "fixed top-8 left-0 right-0 bottom-0 flex flex-col overflow-hidden"}>
			{/* {(showAnnouncement || showAnnouncementModal) && (
				<Announcement
					hideAnnouncement={() => {
						if (showAnnouncementModal) {
							setShowAnnouncementModal(false)
						}
						if (showAnnouncement) {
							hideAnnouncement()
						}
					}}
				/>
			)} */}
			{task ? <></> : <NoticesBanner />}
			{task ? (
				<>
					<TaskHeader
						task={task}
						tokensIn={apiMetrics.totalTokensIn}
						tokensOut={apiMetrics.totalTokensOut}
						cacheWrites={apiMetrics.totalCacheWrites}
						cacheReads={apiMetrics.totalCacheReads}
						totalCost={apiMetrics.totalCost}
						contextTokens={apiMetrics.contextTokens}
						buttonsDisabled={sendingDisabled}
						handleCondenseContext={handleCondenseContext}
						todos={latestTodos}
					/>

					{hasSystemPromptOverride && (
						<div className="px-3">
							<SystemPromptWarning />
						</div>
					)}

					{checkpointWarning && (
						<div className="px-3">
							<CheckpointWarning warning={checkpointWarning} />
						</div>
					)}
				</>
			) : (
				<div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 relative">
					<div
						className={` w-full flex flex-col gap-4 m-auto ${curWorkspaceHistory.length > 0 ? "mt-4" : ""} px-3.5 min-[370px]:px-10 pt-5 transition-all duration-300`}>
						{/* Version indicator in top-right corner - only on welcome screen */}
						{/* <VersionIndicator
							onClick={() => setShowAnnouncementModal(false)}
							className="absolute top-2 right-3 z-10"
						/> */}
						<VersionIndicator onClick={() => {}} className="absolute top-2 right-3 z-10" />

						<RooHero />
						{/* {telemetrySetting === "unset" && <TelemetryBanner />} */}

						{/* <div className="mb-2.5">
							{cloudIsAuthenticated || curWorkspaceHistory.length < 4 ? (
								<RooTips />
							) : (
								<>
									<DismissibleUpsell
										upsellId="taskList"
										icon={<Cloud className="size-4 mt-0.5 shrink-0" />}
										onClick={() => openUpsell()}
										dismissOnClick={false}
										className="bg-vscode-editor-background p-4 !text-base">
										<Trans
											i18nKey="cloud:upsell.taskList"
											components={{
												learnMoreLink: <VSCodeLink href="#" />,
											}}
										/>
									</DismissibleUpsell>
								</>
							)}
						</div> */}
						<div className="mb-2.5">
							<RooTips />
						</div>
						{/* Show the task history preview if expanded and tasks exist */}
						{curWorkspaceHistory.length > 0 && <HistoryPreview />}

						{/* {cloudIsAuthenticated ? (
							// Logged in users should always see their agents (or be upsold)
							<CloudAgents />
						) : (
							// Logged out users should be upsold at least once on Cloud
							<DismissibleUpsell
								upsellId="taskList"
								icon={<Cloud className="size-5 mt-0.5 shrink-0" />}
								onClick={() => openUpsell()}
								dismissOnClick={false}
								className="!bg-vscode-editor-background mt-6 border-border rounded-xl pl-4 pr-3 py-3 !text-base">
								<Trans
									i18nKey="cloud:upsell.taskList"
									components={{
										learnMoreLink: <VSCodeLink href="#" />,
									}}
								/>
							</DismissibleUpsell>
						)} */}
					</div>
				</div>
			)}

			{task && (
				<>
					{showSearch && !isHidden && experiments?.chatSearch && (
						<ChatSearch
							showSearch={showSearch}
							messages={modifiedMessages}
							onNavigateToResult={scrollToMessage}
							onClose={() => {
								setSearchQuery("")
								setShowSearch(false)
							}}
							onSearchChange={(_, query) => setSearchQuery((query || "").trim())}
						/>
					)}

					<div className="grow flex flex-col min-h-0" ref={scrollContainerRef}>
						<div className="flex-auto min-h-0">
							<Virtuoso
								ref={virtuosoRef}
								key={task.ts}
								className="h-full overflow-y-auto mb-1"
								increaseViewportBy={{ top: 3_000, bottom: 1000 }}
								data={groupedMessages}
								itemContent={itemContent}
								atBottomStateChange={(isAtBottom: boolean) => {
									setIsAtBottom(isAtBottom)
									if (isAtBottom) {
										disableAutoScrollRef.current = false
									}
									setShowScrollToBottom(disableAutoScrollRef.current && !isAtBottom)
								}}
								atBottomThreshold={10}
								initialTopMostItemIndex={groupedMessages.length - 1}
							/>
						</div>
					</div>
					{areButtonsVisible && (
						<div
							className={`flex h-9 items-center mb-1 px-[15px] ${
								showScrollToBottom
									? "opacity-100"
									: enableButtons || (isStreaming && !didClickCancel)
										? "opacity-100"
										: "opacity-50"
							}`}>
							{showScrollToBottom ? (
								<StandardTooltip content={t("chat:scrollToBottom")}>
									<Button
										variant="secondary"
										className="flex-[2]"
										onClick={() => {
											scrollToBottomSmooth()
											disableAutoScrollRef.current = false
										}}>
										<span className="codicon codicon-chevron-down"></span>
									</Button>
								</StandardTooltip>
							) : (
								<>
									{primaryButtonText && !isStreaming && (
										<StandardTooltip
											content={
												primaryButtonText === t("chat:retry.title")
													? t("chat:retry.tooltip")
													: primaryButtonText === t("chat:save.title")
														? t("chat:save.tooltip")
														: primaryButtonText === t("chat:approve.title")
															? t("chat:approve.tooltip")
															: primaryButtonText === t("chat:runCommand.title")
																? t("chat:runCommand.tooltip")
																: primaryButtonText === t("chat:startNewTask.title")
																	? t("chat:startNewTask.tooltip")
																	: primaryButtonText === t("chat:resumeTask.title")
																		? t("chat:resumeTask.tooltip")
																		: primaryButtonText ===
																			  t("chat:proceedAnyways.title")
																			? t("chat:proceedAnyways.tooltip")
																			: primaryButtonText ===
																				  t("chat:proceedWhileRunning.title")
																				? t("chat:proceedWhileRunning.tooltip")
																				: undefined
											}>
											<Button
												variant="primary"
												disabled={!enableButtons}
												className={secondaryButtonText ? "flex-1 mr-[6px]" : "flex-[2] mr-0"}
												onClick={() => handlePrimaryButtonClick(inputValue, selectedImages)}>
												{primaryButtonText}
											</Button>
										</StandardTooltip>
									)}
									{(secondaryButtonText || isStreaming) && (
										<StandardTooltip
											content={
												isStreaming
													? t("chat:cancel.tooltip")
													: secondaryButtonText === t("chat:startNewTask.title")
														? t("chat:startNewTask.tooltip")
														: secondaryButtonText === t("chat:reject.title")
															? t("chat:reject.tooltip")
															: secondaryButtonText === t("chat:terminate.title")
																? t("chat:terminate.tooltip")
																: undefined
											}>
											<Button
												variant="secondary"
												disabled={!enableButtons && !(isStreaming && !didClickCancel)}
												className={isStreaming ? "flex-[2] ml-0" : "flex-1 ml-[6px]"}
												onClick={() => handleSecondaryButtonClick(inputValue, selectedImages)}>
												{isStreaming ? t("chat:cancel.title") : secondaryButtonText}
											</Button>
										</StandardTooltip>
									)}
								</>
							)}
						</div>
					)}
				</>
			)}

			<QueuedMessages
				queue={messageQueue}
				onRemove={(index) => {
					if (messageQueue[index]) {
						vscode.postMessage({ type: "removeQueuedMessage", text: messageQueue[index].id })
					}
				}}
				onUpdate={(index, newText) => {
					if (messageQueue[index]) {
						vscode.postMessage({
							type: "editQueuedMessage",
							payload: { id: messageQueue[index].id, text: newText, images: messageQueue[index].images },
						})
					}
				}}
			/>
			<ChatTextArea
				ref={textAreaRef}
				inputValue={inputValue}
				setInputValue={setInputValue}
				sendingDisabled={sendingDisabled || isProfileDisabled}
				selectApiConfigDisabled={sendingDisabled && clineAsk !== "api_req_failed"}
				placeholderText={placeholderText}
				selectedImages={selectedImages}
				setSelectedImages={setSelectedImages}
				onSend={() => handleSendMessage(inputValue, selectedImages, "user")}
				onSelectImages={selectImages}
				shouldDisableImages={shouldDisableImages}
				onHeightChange={() => {
					if (isAtBottom) {
						scrollToBottomAuto()
					}
				}}
				mode={mode}
				setMode={setMode}
				modeShortcutText={modeShortcutText}
				hoverPreviewMap={hoverPreviewMap}
				isBrowserSessionActive={!!isBrowserSessionActive}
				showBrowserDockToggle={showBrowserDockToggle}
			/>

			{isProfileDisabled && (
				<div className="px-3">
					<ProfileViolationWarning />
				</div>
			)}

			<div id="roo-portal" />
			{/* <CloudUpsellDialog open={isUpsellOpen} onOpenChange={closeUpsell} onConnect={handleConnect} /> */}
		</div>
	)
}

const ChatView = forwardRef(ChatViewComponent)

export default ChatView
