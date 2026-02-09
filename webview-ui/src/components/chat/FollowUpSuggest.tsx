import { useCallback, useEffect, useRef, useState } from "react"
import { ClipboardCopy, Timer } from "lucide-react"

import { Button, StandardTooltip } from "@/components/ui"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { SuggestionItem } from "@roo-code/types"
import { cn } from "@/lib/utils"
import { emitFollowUpInteractionMarker } from "./followUpInteractionInstrumentation"
import { usePendingActionContract } from "./usePendingActionContract"

const DEFAULT_FOLLOWUP_TIMEOUT_MS = 60000
const COUNTDOWN_INTERVAL_MS = 1000

interface FollowUpSuggestProps {
	suggestions?: SuggestionItem[]
	onSuggestionClick?: (suggestion: SuggestionItem, event?: React.MouseEvent) => void
	ts: number
	onCancelAutoApproval?: () => void
	isAnswered?: boolean
	isFollowUpAutoApprovalPaused?: boolean
}

export const FollowUpSuggest = ({
	suggestions = [],
	onSuggestionClick,
	ts = 1,
	onCancelAutoApproval,
	isAnswered = false,
	isFollowUpAutoApprovalPaused = false,
}: FollowUpSuggestProps) => {
	const { autoApprovalEnabled, alwaysAllowFollowupQuestions, followupAutoApproveTimeoutMs } = useExtensionState()
	const [countdown, setCountdown] = useState<number | null>(null)
	const [suggestionSelected, setSuggestionSelected] = useState(false)
	const [hasReachedTerminalState, setHasReachedTerminalState] = useState(isAnswered)
	const {
		isPending: isSuggestionActionPending,
		tryBeginPendingAction: tryBeginSuggestionActionPending,
		clearPendingAction: clearSuggestionActionPending,
	} = usePendingActionContract()
	const { t } = useAppTranslation()
	const isFollowUpTerminal = hasReachedTerminalState || suggestionSelected
	const shouldShowCountdown = countdown !== null
	const followUpTerminalRef = useRef<boolean>(isFollowUpTerminal)

	useEffect(() => {
		if (!isAnswered) {
			return
		}

		setHasReachedTerminalState(true)
	}, [isAnswered])

	useEffect(() => {
		followUpTerminalRef.current = isFollowUpTerminal
	}, [isFollowUpTerminal])

	useEffect(() => {
		if (!isSuggestionActionPending || !isFollowUpTerminal) {
			return
		}

		clearSuggestionActionPending()
	}, [isSuggestionActionPending, isFollowUpTerminal, clearSuggestionActionPending])

	// Start countdown timer when auto-approval is enabled for follow-up questions
	useEffect(() => {
		// Only start countdown if auto-approval is enabled for follow-up questions and no suggestion has been selected
		// Also stop countdown if the question has been answered or auto-approval is paused (user is typing)
		if (
			autoApprovalEnabled &&
			alwaysAllowFollowupQuestions &&
			suggestions.length > 0 &&
			!isFollowUpTerminal &&
			!isFollowUpAutoApprovalPaused
		) {
			// Start with the configured timeout in seconds
			const timeoutMs =
				typeof followupAutoApproveTimeoutMs === "number" && !isNaN(followupAutoApproveTimeoutMs)
					? followupAutoApproveTimeoutMs
					: DEFAULT_FOLLOWUP_TIMEOUT_MS

			// Convert milliseconds to seconds for the countdown
			setCountdown(Math.floor(timeoutMs / 1000))

			// Update countdown every second
			const intervalId = setInterval(() => {
				setCountdown((prevCountdown) => {
					if (prevCountdown === null || prevCountdown <= 1) {
						clearInterval(intervalId)
						return null
					}
					return prevCountdown - 1
				})
			}, COUNTDOWN_INTERVAL_MS)

			// Clean up interval on unmount and notify parent component
			return () => {
				clearInterval(intervalId)
				// Notify parent component that this component is unmounting
				// so it can clear any related timeouts
				onCancelAutoApproval?.()
			}
		} else {
			setCountdown(null)
		}
	}, [
		autoApprovalEnabled,
		alwaysAllowFollowupQuestions,
		suggestions,
		followupAutoApproveTimeoutMs,
		isFollowUpTerminal,
		onCancelAutoApproval,
		isFollowUpAutoApprovalPaused,
	])
	const handleSuggestionClick = useCallback(
		(suggestion: SuggestionItem, event: React.MouseEvent) => {
			if (followUpTerminalRef.current || isSuggestionActionPending) {
				return
			}

			const isShiftClick = event.shiftKey

			if (!isShiftClick && !tryBeginSuggestionActionPending()) {
				return
			}

			emitFollowUpInteractionMarker({
				stage: "click",
				followUpTs: ts,
				source: "follow_up_suggest",
			})

			// Mark a suggestion as selected if it's not a shift-click (which just copies to input)
			if (!isShiftClick) {
				followUpTerminalRef.current = true
				setHasReachedTerminalState(true)
				setSuggestionSelected(true)
				// Also notify parent component to cancel auto-approval timeout
				// This prevents race conditions between visual countdown and actual timeout
				onCancelAutoApproval?.()
			}

			// Pass the suggestion object to the parent component
			// The parent component will handle mode switching if needed
			onSuggestionClick?.(suggestion, event)
		},
		[onSuggestionClick, onCancelAutoApproval, ts, isSuggestionActionPending, tryBeginSuggestionActionPending],
	)

	const handleCopyToInputClick = useCallback(
		(suggestion: SuggestionItem, event: React.MouseEvent<HTMLDivElement>) => {
			if (followUpTerminalRef.current || isSuggestionActionPending) {
				return
			}

			event.stopPropagation()
			// Cancel the auto-approve timer when edit button is clicked
			onCancelAutoApproval?.()
			// Simulate shift-click by directly calling the handler with shiftKey=true.
			onSuggestionClick?.(suggestion, { ...event, shiftKey: true })
		},
		[isSuggestionActionPending, onCancelAutoApproval, onSuggestionClick],
	)

	// Don't render if there are no suggestions or no click handler.
	if (!suggestions?.length || !onSuggestionClick || isFollowUpTerminal) {
		return null
	}

	return (
		<div className="flex mb-2 flex-col h-full gap-2">
			{suggestions.map((suggestion, index) => {
				const isFirstSuggestion = index === 0

				return (
					<div key={`${suggestion.answer}-${ts}`} className="w-full relative group">
						<Button
							variant="outline"
							disabled={isSuggestionActionPending}
							aria-busy={isSuggestionActionPending || undefined}
							className={cn(
								"text-left whitespace-normal break-words w-full h-auto px-3 py-2 justify-start pr-8 rounded-xl",
								isFirstSuggestion &&
									shouldShowCountdown &&
									"border-vscode-foreground/60 rounded-b-none -mb-1",
							)}
							onClick={(event) => handleSuggestionClick(suggestion, event)}
							aria-label={suggestion.answer}>
							{suggestion.answer}
						</Button>
						{isFirstSuggestion && shouldShowCountdown && (
							<p className="rounded-b-xl border-1 border-t-0 border-vscode-foreground/60 text-vscode-descriptionForeground text-xs m-0 mt-1 px-3 pt-2 pb-2">
								<Timer className="size-3 inline-block -mt-0.5 mr-1 animate-pulse" />
								{t("chat:followUpSuggest.timerPrefix", { seconds: countdown })}
							</p>
						)}
						{suggestion.mode && (
							<div className="absolute bottom-0 right-0 text-[10px] text-vscode-badge-foreground pl-1 pr-2.5 pt-0.5 pb-1.5 flex items-center gap-0.5 bg-transparent rounded-xl">
								<span className="codicon codicon-arrow-right" style={{ fontSize: "8px" }} />
								{suggestion.mode}
							</div>
						)}
						<StandardTooltip content={t("chat:followUpSuggest.copyToInput")}>
							<div
								className="absolute cursor-pointer top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-vscode-input-background px-0.5 rounded"
								onClick={(event) => handleCopyToInputClick(suggestion, event)}>
								<ClipboardCopy className="w-4" />
							</div>
						</StandardTooltip>
					</div>
				)
			})}
		</div>
	)
}
