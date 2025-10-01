import { ClineMessage, HistoryItem } from "@roo-code/types"
import { useMemo } from "react"

interface UsePromptHistoryDataProps {
	clineMessages: ClineMessage[] | undefined
	taskHistory: HistoryItem[] | undefined
	cwd: string | undefined
}

export interface UsePromptHistoryDataReturn {
	promptHistory: string[]
}

const MAX_PROMPT_HISTORY_SIZE = 100

export const usePromptHistoryData = ({
	clineMessages,
	taskHistory,
	cwd,
}: UsePromptHistoryDataProps): UsePromptHistoryDataReturn => {
	const promptHistory = useMemo(() => {
		const conversationPrompts = clineMessages
			?.filter((message) => message.type === "say" && message.say === "user_feedback" && message.text?.trim())
			.map((message) => message.text!)

		// If we have conversation messages, use those (newest first when navigating up)
		if (conversationPrompts?.length) {
			return conversationPrompts.slice(-MAX_PROMPT_HISTORY_SIZE).reverse()
		}

		// If we have clineMessages array (meaning we're in an active task), don't fall back to task history
		// Only use task history when starting fresh (no active conversation)
		if (clineMessages?.length) {
			return []
		}

		// Fall back to task history only when starting fresh (no active conversation)
		if (!taskHistory?.length || !cwd) {
			return []
		}

		// Extract user prompts from task history for the current workspace only
		return taskHistory
			.filter((item) => item.task?.trim() && (!item.workspace || item.workspace === cwd))
			.map((item) => item.task)
			.slice(0, MAX_PROMPT_HISTORY_SIZE)
	}, [clineMessages, taskHistory, cwd])

	return {
		promptHistory,
	}
}
