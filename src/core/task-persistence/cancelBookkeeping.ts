import type { ClineMessage } from "@roo-code/types"
import { readTaskMessages, saveTaskMessages } from "./taskMessages"
import { readApiMessages, saveApiMessages } from "./apiMessages"
import type { ClineApiReqCancelReason } from "../../shared/ExtensionMessage"

// Safely add cancelReason to the last api_req_started UI message
export async function addCancelReasonToLastApiReqStarted(args: {
	taskId: string
	globalStoragePath: string
	reason: ClineApiReqCancelReason
}): Promise<void> {
	const { taskId, globalStoragePath, reason } = args

	try {
		const uiMsgs = (await readTaskMessages({ taskId, globalStoragePath })) as ClineMessage[]

		if (!Array.isArray(uiMsgs) || uiMsgs.length === 0) {
			return
		}

		// Find last api_req_started
		const revIdx = uiMsgs
			.slice()
			.reverse()
			.findIndex((m) => m?.type === "say" && (m as any)?.say === "api_req_started")

		if (revIdx === -1) {
			return
		}

		const idx = uiMsgs.length - 1 - revIdx

		try {
			const existing = uiMsgs[idx]?.text ? JSON.parse(uiMsgs[idx].text as string) : {}
			// Only set cancelReason if it doesn't already exist
			if (!existing.cancelReason) {
				uiMsgs[idx].text = JSON.stringify({ ...existing, cancelReason: reason })
				await saveTaskMessages({ messages: uiMsgs as any, taskId, globalStoragePath })
			}
			// If cancelReason already exists, preserve the original reason
		} catch {
			// Non-fatal parse or write failure
			return
		}
	} catch {
		// Non-fatal read failure
		return
	}
}

// Append an assistant interruption marker to API conversation history
// only if the last message isn't already an assistant.
export async function appendAssistantInterruptionIfNeeded(args: {
	taskId: string
	globalStoragePath: string
	text: string
}): Promise<void> {
	const { taskId, globalStoragePath, text } = args

	try {
		const apiMsgs = await readApiMessages({ taskId, globalStoragePath })
		const last = apiMsgs.at(-1)

		if (!last || last.role !== "assistant") {
			apiMsgs.push({
				role: "assistant",
				content: [{ type: "text", text }],
				ts: Date.now(),
			} as any)

			await saveApiMessages({ messages: apiMsgs as any, taskId, globalStoragePath })
		}
	} catch {
		// Non-fatal read/write failure
		return
	}
}
