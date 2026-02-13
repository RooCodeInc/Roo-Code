import type { RooMessage } from "../task-persistence/rooMessage"
import { isRooReasoningMessage } from "../task-persistence/rooMessage"

type Role = "user" | "assistant" | "tool"

/**
 * Normalizes message content to an array of content parts.
 * Handles both string and array content formats.
 */
function normalizeContentToArray(content: unknown): unknown[] {
	if (Array.isArray(content)) {
		return content
	}
	if (content === undefined || content === null) {
		return []
	}
	return [{ type: "text", text: String(content) }]
}

/**
 * Non-destructively merges consecutive messages with the same role.
 *
 * Used for *API request shaping only* (do not use for storage), so rewind/edit operations
 * can still reference the original individual messages.
 *
 * `RooReasoningMessage` items (which have no role) are always passed through unmerged.
 */
export function mergeConsecutiveApiMessages(messages: RooMessage[], options?: { roles?: Role[] }): RooMessage[] {
	if (messages.length <= 1) {
		return messages
	}

	const mergeRoles = new Set<Role>(options?.roles ?? ["user"]) // default: user only
	const out: RooMessage[] = []

	for (const msg of messages) {
		// RooReasoningMessage has no role — always pass through unmerged
		if (isRooReasoningMessage(msg)) {
			out.push(msg)
			continue
		}

		const prev = out[out.length - 1]
		const prevHasRole = prev && !isRooReasoningMessage(prev)
		const canMerge =
			prevHasRole &&
			prev.role === msg.role &&
			mergeRoles.has(msg.role) &&
			// Allow merging regular messages into a summary (API-only shaping),
			// but never merge a summary into something else.
			!msg.isSummary &&
			!prev.isTruncationMarker &&
			!msg.isTruncationMarker

		if (!canMerge) {
			out.push(msg)
			continue
		}

		const mergedContent = [
			...normalizeContentToArray((prev as any).content),
			...normalizeContentToArray((msg as any).content),
		]

		// Preserve the newest ts to keep chronological ordering for downstream logic.
		out[out.length - 1] = {
			...prev,
			content: mergedContent,
			ts: Math.max(prev.ts ?? 0, msg.ts ?? 0) || prev.ts || msg.ts,
		} as RooMessage
	}

	return out
}
