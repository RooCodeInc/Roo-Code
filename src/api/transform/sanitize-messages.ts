import type { ModelMessage } from "ai"
import type { RooMessage, RooRoleMessage } from "../../core/task-persistence/rooMessage"
import { isRooReasoningMessage } from "../../core/task-persistence/rooMessage"

/**
 * Sanitize RooMessage[] for provider APIs by allowlisting only the fields
 * that the AI SDK expects on each message.
 *
 * Legacy fields like `reasoning_details`, `reasoning_content`, `ts`, `condenseId`,
 * etc. survive JSON deserialization round-trips and cause providers to reject
 * requests with "Extra inputs are not permitted" (Anthropic 400) or similar errors.
 *
 * This uses an allowlist approach: only `role`, `content`, and `providerOptions`
 * are forwarded, ensuring any future extraneous fields are also stripped.
 *
 * RooReasoningMessage items (standalone encrypted reasoning with no `role`) are
 * filtered out since they have no AI SDK equivalent.
 */
export function sanitizeMessagesForProvider(messages: RooMessage[]): ModelMessage[] {
	return messages
		.filter((msg): msg is RooRoleMessage => !isRooReasoningMessage(msg))
		.map((msg) => {
			const clean: Record<string, unknown> = {
				role: msg.role,
				content: msg.content,
			}
			if (msg.providerOptions !== undefined) {
				clean.providerOptions = msg.providerOptions
			}
			return clean as ModelMessage
		})
}
