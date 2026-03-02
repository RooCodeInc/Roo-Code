import { useCallback, useEffect, useState, useRef } from "react"
import { Edit } from "lucide-react"

import { Button, StandardTooltip } from "@/components/ui"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { SuggestionItem } from "@siid-code/types"

// const DEFAULT_FOLLOWUP_TIMEOUT_MS = 60000
const COUNTDOWN_INTERVAL_MS = 1000

interface FollowUpSuggestProps {
	suggestions?: SuggestionItem[]
	onSuggestionClick?: (suggestion: SuggestionItem, event?: React.MouseEvent) => void
	ts: number
	onCancelAutoApproval?: () => void
	isAnswered?: boolean
	inputValue?: string
}

export const FollowUpSuggest = ({
	suggestions = [],
	onSuggestionClick,
	ts = 1,
	onCancelAutoApproval,
	isAnswered = false,
	inputValue: _inputValue = "",
}: FollowUpSuggestProps) => {
	const { autoApprovalEnabled } = useExtensionState()
	const [countdown, setCountdown] = useState<number | null>(null)
	const [suggestionSelected, setSuggestionSelected] = useState(false)
	const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestionItem | null>(null)
	const { t } = useAppTranslation()

	// Use ref to track if we've already handled the click to prevent double-processing
	const isProcessingClick = useRef(false)

	// Start countdown timer when auto-approval is enabled for follow-up questions
	useEffect(() => {
		// Only start countdown if auto-approval is enabled for follow-up questions and no suggestion has been selected
		// Also stop countdown if the question has been answered
		if (
			autoApprovalEnabled &&
			suggestions.length > 0 &&
			!suggestionSelected &&
			!isAnswered
		) {
			// Start with the configured timeout in seconds
			

			// Convert milliseconds to seconds for the countdown
			

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
		
		suggestions,
		
		suggestionSelected,
		onCancelAutoApproval,
		isAnswered,
	])

	const handleSuggestionClick = useCallback(
		(suggestion: SuggestionItem, event: React.MouseEvent) => {
			// Prevent double-processing
			if (isProcessingClick.current) {
				return
			}

			// Mark a suggestion as selected if it's not a shift-click (which just copies to input)
			if (!event.shiftKey) {
				isProcessingClick.current = true

				// Update state immediately so UI shows checkmark
				setSuggestionSelected(true)
				setSelectedSuggestion(suggestion)

				// Also notify parent component to cancel auto-approval timeout
				// This prevents race conditions between visual countdown and actual timeout
				onCancelAutoApproval?.()

				// Send the suggestion to the AI, same as how we handle custom input
				// This will trigger markFollowUpAsAnswered which will set isAnswered=true
				// and the UI will show the checkmark confirmation
				onSuggestionClick?.(suggestion, event)
			} else {
				// For shift-click, just call the handler (copying to input)
				onSuggestionClick?.(suggestion, event)
			}
		},
		[onSuggestionClick, onCancelAutoApproval],
	)

	// Don't render if there are no suggestions or no click handler
	if (!suggestions?.length || !onSuggestionClick) {
		return null
	}

	// If the follow-up question has been answered, hide all suggestions
	// This applies both when a suggestion was selected OR when user sent custom input
	if (isAnswered) {
		// Only show the selected suggestion if one was clicked
		if (selectedSuggestion) {
			return (
				<div className="flex mb-2 flex-col h-full gap-2">
					<div className="w-full relative">
						<Button
							variant="outline"
							className="text-left whitespace-normal break-words w-full h-auto py-3 justify-start pr-8 opacity-100"
							disabled
							aria-label={selectedSuggestion.answer}>
							<span className="flex items-center gap-2">
								<span className="codicon codicon-check text-vscode-charts-green" />
								{selectedSuggestion.answer}
							</span>
						</Button>
						{selectedSuggestion.mode && (
							<div className="absolute bottom-0 right-0 text-[10px] bg-vscode-badge-background text-vscode-badge-foreground px-1 py-0.5 border border-vscode-badge-background flex items-center gap-0.5">
								<span className="codicon codicon-arrow-right" style={{ fontSize: "8px" }} />
								{selectedSuggestion.mode}
							</div>
						)}
					</div>
				</div>
			)
		}
		// If answered but no suggestion was selected (user sent custom input), hide all suggestions
		return null
	}

	// Show all suggestions with countdown timer

	return (
		<div className="flex mb-2 flex-col h-full gap-2">
			{suggestions.map((suggestion, index) => {
				const isFirstSuggestion = index === 0

				return (
					<div key={`${suggestion.answer}-${ts}`} className="w-full relative group">
						<Button
							variant="outline"
							className="text-left whitespace-normal break-words w-full h-auto py-3 justify-start pr-8"
							onClick={(event) => handleSuggestionClick(suggestion, event)}
							aria-label={suggestion.answer}>
							{suggestion.answer}
							{isFirstSuggestion && countdown !== null && !suggestionSelected && !isAnswered && (
								<span
									className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-vscode-badge-background text-vscode-badge-foreground"
									title={t("chat:followUpSuggest.autoSelectCountdown", { count: countdown })}>
									{t("chat:followUpSuggest.countdownDisplay", { count: countdown })}
								</span>
							)}
						</Button>
						{suggestion.mode && (
							<div className="absolute bottom-0 right-0 text-[10px] bg-vscode-badge-background text-vscode-badge-foreground px-1 py-0.5 border border-vscode-badge-background flex items-center gap-0.5">
								<span className="codicon codicon-arrow-right" style={{ fontSize: "8px" }} />
								{suggestion.mode}
							</div>
						)}
						<StandardTooltip content={t("chat:followUpSuggest.copyToInput")}>
							<div
								className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
								onClick={(e) => {
									e.stopPropagation()
									// Cancel the auto-approve timer when edit button is clicked
									setSuggestionSelected(true)
									onCancelAutoApproval?.()
									// Simulate shift-click by directly calling the handler with shiftKey=true.
									onSuggestionClick?.(suggestion, { ...e, shiftKey: true })
								}}>
								<Button variant="ghost" size="icon">
									<Edit />
								</Button>
							</div>
						</StandardTooltip>
					</div>
				)
			})}
		</div>
	)
}
