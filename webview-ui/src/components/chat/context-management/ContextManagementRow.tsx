import type { ClineMessage } from "@roo-code/types"
import { assertNever, isContextManagementEvent } from "@roo-code/types"

import { InProgressRow } from "./InProgressRow"
import { CondensationResultRow } from "./CondensationResultRow"
import { CondensationErrorRow } from "./CondensationErrorRow"
import { TruncationResultRow } from "./TruncationResultRow"

interface ContextManagementRowProps {
	message: ClineMessage
}

/**
 * Unified component for rendering all context management events.
 *
 * This component handles:
 * - `condense_context`: Shows in-progress (partial) or completed condensation
 * - `condense_context_error`: Shows error when condensation failed
 * - `sliding_window_truncation`: Shows truncation notification (NEW)
 *
 * Uses TypeScript exhaustiveness checking to ensure all event types are handled.
 * When a new context management event is added to CONTEXT_MANAGEMENT_EVENTS,
 * this component will fail to compile until the case is handled.
 */
export function ContextManagementRow({ message }: ContextManagementRowProps) {
	const eventType = message.say

	// Early return if not a context management event
	if (!eventType || !isContextManagementEvent(eventType)) {
		return null
	}

	// Handle in-progress state for any context management operation
	if (message.partial) {
		return <InProgressRow eventType={eventType} />
	}

	// Handle completed states based on event type
	switch (eventType) {
		case "condense_context":
			// Completed condensation - show result with summary
			if (message.contextCondense) {
				return <CondensationResultRow data={message.contextCondense} />
			}
			// No data - shouldn't happen but handle gracefully
			return null

		case "condense_context_error":
			// Error during condensation - show error message
			return <CondensationErrorRow errorText={message.text} />

		case "sliding_window_truncation":
			// Sliding window truncation - show truncation notification
			if (message.contextTruncation) {
				return <TruncationResultRow data={message.contextTruncation} />
			}
			// No data - shouldn't happen but handle gracefully
			return null

		default:
			// TypeScript exhaustiveness check ensures all cases are handled
			assertNever(eventType)
	}
}

/**
 * Type guard to check if a message should be rendered by ContextManagementRow.
 * Use this before rendering to determine if the message is a context management event.
 *
 * @param message - The ClineMessage to check
 * @returns true if the message is a context management event
 */
export function isContextManagementMessage(message: ClineMessage): boolean {
	return message.type === "say" && !!message.say && isContextManagementEvent(message.say)
}
