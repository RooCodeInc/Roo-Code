import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui"
import { cn } from "@/lib/utils"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import type { MultipleChoiceData, MultipleChoiceResponse } from "@roo-code/types"
import { Trans } from "react-i18next"

interface MultipleChoiceFormProps {
	data: MultipleChoiceData
	onSubmit: (response: MultipleChoiceResponse) => void
	isAnswered?: boolean
}

export const MultipleChoiceForm = ({ data, onSubmit, isAnswered = false }: MultipleChoiceFormProps) => {
	const { t } = useAppTranslation()
	const [selections, setSelections] = useState<MultipleChoiceResponse>(data.userResponse || {})
	const [submitted, setSubmitted] = useState(isAnswered)
	const [collapsed, setCollapsed] = useState(isAnswered)

	// Initialize submitAction based on existing userResponse
	const getInitialSubmitAction = (): "confirm" | "skip" | null => {
		if (!isAnswered || !data.userResponse) return null
		return (data.userResponse as any).__skipped ? "skip" : "confirm"
	}
	const [submitAction, setSubmitAction] = useState<"confirm" | "skip" | null>(getInitialSubmitAction())

	// Sync submitted state when isAnswered prop changes
	useEffect(() => {
		setSubmitted(isAnswered)
	}, [isAnswered])

	// Sync submitAction when props change
	useEffect(() => {
		if (isAnswered && data.userResponse) {
			setSubmitAction((data.userResponse as any).__skipped ? "skip" : "confirm")
		}
	}, [isAnswered, data.userResponse])

	const handleToggleOption = useCallback((questionId: string, optionId: string, allowMultiple: boolean) => {
		setSelections((prev) => {
			const currentSelections = prev[questionId] || []

			if (allowMultiple) {
				// Toggle selection for multi-select
				if (currentSelections.includes(optionId)) {
					return {
						...prev,
						[questionId]: currentSelections.filter((id) => id !== optionId),
					}
				} else {
					return {
						...prev,
						[questionId]: [...currentSelections, optionId],
					}
				}
			} else {
				// Single select - replace selection
				return {
					...prev,
					[questionId]: [optionId],
				}
			}
		})
	}, [])

	// Validate that all questions have at least one selection
	const isFormValid = data.questions.every((question) => {
		const questionSelections = selections[question.id] || []
		return questionSelections.length > 0
	})

	// Calculate answered questions count
	const answeredCount = data.questions.filter((question) => {
		const questionSelections = selections[question.id] || []
		return questionSelections.length > 0
	}).length
	const totalCount = data.questions.length

	const handleSubmit = useCallback(() => {
		// Allow submission even if no options are selected
		setSubmitAction("confirm")
		setSubmitted(true)
		onSubmit(selections)
	}, [selections, onSubmit])

	const handleSkip = useCallback(() => {
		// User chose to skip the questionnaire
		setSubmitAction("skip")
		setSubmitted(true)
		onSubmit({ __skipped: true } as any)
	}, [onSubmit])

	const toggleCollapse = useCallback(() => {
		setCollapsed((prev) => !prev)
	}, [])

	// Don't return early when submitted - show the form with disabled buttons

	return (
		<div className="flex flex-col my-2 bg-vscode-sideBar-background border border-vscode-panel-border rounded-lg shadow-sm">
			{/* Collapsible header - show questionnaire title */}
			<div
				className={cn(
					"flex items-center gap-2 px-4 py-2.5 transition-colors border-b border-vscode-panel-border/30",
					"cursor-pointer hover:bg-vscode-list-hoverBackground",
				)}
				onClick={toggleCollapse}>
				<i
					className={cn(
						"codicon text-[12px] text-vscode-descriptionForeground transition-transform",
						collapsed ? "codicon-chevron-right" : "codicon-chevron-down",
					)}
				/>
				<div className="flex-1 flex items-baseline gap-1.5">
					<span className="text-[13px] font-semibold text-vscode-foreground leading-relaxed">
						{data.title || t("chat:multipleChoice.questionnaire")}
					</span>
					{/* Progress indicator */}
					<span
						className={cn(
							"text-[11px] font-medium transition-colors",
							answeredCount === totalCount
								? "text-vscode-testing-iconPassed"
								: "text-vscode-descriptionForeground",
						)}>
						({answeredCount}/{totalCount})
					</span>
					{submitted && submitAction && (
						<span className="text-[11px] text-vscode-descriptionForeground italic">
							(
							{submitAction === "skip"
								? t("chat:multipleChoice.userSkipped")
								: t("chat:multipleChoice.userConfirmed")}
							)
						</span>
					)}
				</div>
				{!submitted && (
					<span className="text-[11px] text-vscode-descriptionForeground opacity-60">
						{collapsed ? t("chat:multipleChoice.expand") : t("chat:multipleChoice.collapse")}
					</span>
				)}
			</div>

			{/* Collapsible content */}
			{!collapsed && (
				<>
					{/* Questions - scrollable area */}
					<div className="flex flex-col gap-2.5 p-4 max-h-[400px] overflow-y-auto">
						{data.questions.map((question, qIndex) => {
							const currentSelections = selections[question.id] || []
							const selectionTypeLabel = question.allow_multiple
								? t("chat:multipleChoice.multiSelect")
								: t("chat:multipleChoice.singleSelect")

							return (
								<div key={question.id} className="flex flex-col gap-2">
									{/* Question prompt */}
									<div className="flex items-baseline gap-1.5">
										<span className="text-vscode-descriptionForeground text-[12px] font-medium shrink-0">
											{qIndex + 1}.
										</span>
										<div className="flex-1">
											<span className="text-[12px] text-vscode-foreground font-medium leading-snug">
												{question.prompt}
											</span>
											<span className="ml-2 text-[10px] text-vscode-descriptionForeground opacity-70">
												({selectionTypeLabel})
											</span>
										</div>
									</div>

									{/* Options - Compact card style */}
									<div className="flex flex-col gap-1.5">
										{question.options.map((option, optIndex) => {
											const isSelected = currentSelections.includes(option.id)
											const optionLetter = String.fromCharCode(65 + optIndex) // A, B, C...

											return (
												<div
													key={option.id}
													onClick={
														submitted
															? undefined
															: () =>
																	handleToggleOption(
																		question.id,
																		option.id,
																		question.allow_multiple || false,
																	)
													}
													className={cn(
														"flex items-center gap-2 px-2.5 py-2 rounded-md",
														"border transition-all duration-200",
														// Default state
														"border-vscode-panel-border bg-vscode-editor-background",
														// Interactive states (only when not submitted)
														!submitted && [
															"cursor-pointer",
															"hover:border-vscode-focusBorder/50 hover:bg-vscode-list-hoverBackground",
														],
														// Disabled state
														submitted && "opacity-60 cursor-not-allowed",
														// Selected state
														isSelected && [
															"border-vscode-focusBorder bg-vscode-list-activeSelectionBackground/15",
															!submitted && "shadow-sm",
														],
													)}>
													{/* Letter label with dot */}
													<span
														className={cn(
															"text-[11px] font-semibold shrink-0",
															isSelected
																? "text-vscode-focusBorder"
																: "text-vscode-descriptionForeground",
														)}>
														{optionLetter}.
													</span>

													{/* Option label */}
													<span className="text-[12px] text-vscode-foreground select-none leading-snug flex-1">
														{option.label}
													</span>
												</div>
											)
										})}
									</div>
								</div>
							)
						})}
					</div>

					{/* Bottom: Buttons + Hint - fixed at bottom (no flex properties, stays at bottom) */}
					<div className="flex flex-col gap-2 px-4 pb-4 pt-2.5 border-t border-vscode-panel-border/50 bg-vscode-sideBar-background">
						{/* Button group */}
						<div className="flex items-center gap-2.5">
							<Button
								onClick={handleSubmit}
								variant="primary"
								disabled={submitted || !isFormValid}
								className={cn(
									"px-4 py-1.5 text-[12px]",
									submitted && submitAction === "confirm" && "opacity-100",
								)}>
								{submitted && submitAction === "confirm" ? "✓ " : ""}
								{t("chat:multipleChoice.confirm")}
							</Button>
							<Button
								onClick={handleSkip}
								variant="secondary"
								disabled={submitted}
								className={cn(
									"px-3 py-1.5 text-[12px]",
									submitted && submitAction === "skip" && "opacity-100",
								)}>
								{submitted && submitAction === "skip" ? "✓ " : ""}
								{t("chat:multipleChoice.skip")}
							</Button>
						</div>

						{/* Hint text */}
						{!submitted && (
							<div className="text-[10px] text-vscode-descriptionForeground leading-snug opacity-75">
								<Trans
									i18nKey="chat:multipleChoice.skipHint"
									components={{ code: <span style={{ color: "#E64545" }}></span> }}
								/>
							</div>
						)}
					</div>
				</>
			)}
		</div>
	)
}
