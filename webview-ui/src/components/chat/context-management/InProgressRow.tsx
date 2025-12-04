import { useTranslation } from "react-i18next"

import { assertNever, type ContextManagementEvent } from "@roo-code/types"

import { ProgressIndicator } from "../ProgressIndicator"

interface InProgressRowProps {
	eventType: ContextManagementEvent
}

/**
 * Displays an in-progress indicator for context management operations.
 * Shows a spinner with operation-specific text based on the event type.
 */
export function InProgressRow({ eventType }: InProgressRowProps) {
	const { t } = useTranslation()

	const getProgressText = (): string => {
		switch (eventType) {
			case "condense_context":
				return t("chat:contextManagement.condensation.inProgress")
			case "sliding_window_truncation":
				return t("chat:contextManagement.truncation.inProgress")
			case "condense_context_error":
				// Error state should never have an in-progress state
				// This case should not be reached in normal operation
				throw new Error(`InProgressRow received error event type: ${eventType}`)
			default:
				assertNever(eventType)
		}
	}

	const getIcon = (): string => {
		switch (eventType) {
			case "condense_context":
			case "sliding_window_truncation":
				// All context management operations use the same icon
				return "codicon-fold"
			case "condense_context_error":
				// Error state should never have an in-progress state - match getProgressText() behavior
				throw new Error(`InProgressRow received error event type: ${eventType}`)
			default:
				assertNever(eventType)
		}
	}

	return (
		<div className="flex items-center gap-2">
			<ProgressIndicator />
			<span className={`codicon ${getIcon()} text-blue-400`} />
			<span className="font-bold text-vscode-foreground">{getProgressText()}</span>
		</div>
	)
}
