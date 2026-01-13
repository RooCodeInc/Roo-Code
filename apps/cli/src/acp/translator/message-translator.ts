/**
 * Message Translator
 *
 * Translates between internal ClineMessage format and ACP protocol format.
 * This is the main bridge between Roo Code's message system and the ACP protocol.
 */

import type * as acp from "@agentclientprotocol/sdk"
import type { ClineMessage, ClineAsk } from "@roo-code/types"

import { mapToolToKind } from "../tool-registry.js"
import { parseToolFromMessage } from "./tool-parser.js"

// =============================================================================
// Message to ACP Update Translation
// =============================================================================

/**
 * Translate an internal ClineMessage to an ACP session update.
 * Returns null if the message type should not be sent to ACP.
 *
 * @param message - Internal ClineMessage
 * @returns ACP session update or null
 */
export function translateToAcpUpdate(message: ClineMessage): acp.SessionNotification["update"] | null {
	if (message.type === "say") {
		switch (message.say) {
			case "text":
				// Agent text output
				return {
					sessionUpdate: "agent_message_chunk",
					content: { type: "text", text: message.text || "" },
				}

			case "reasoning":
				// Agent reasoning/thinking
				return {
					sessionUpdate: "agent_thought_chunk",
					content: { type: "text", text: message.text || "" },
				}

			case "shell_integration_warning":
			case "mcp_server_request_started":
			case "mcp_server_response":
				// Tool-related messages
				return translateToolSayMessage(message)

			case "user_feedback":
				// User feedback doesn't need to be sent to ACP client
				return null

			case "error":
				// Error messages
				return {
					sessionUpdate: "agent_message_chunk",
					content: { type: "text", text: `Error: ${message.text || ""}` },
				}

			case "completion_result":
				// Completion is handled at prompt level
				return null

			case "api_req_started":
			case "api_req_finished":
			case "api_req_retried":
			case "api_req_retry_delayed":
			case "api_req_deleted":
				// API request lifecycle events - not sent to ACP
				return null

			case "command_output":
				// Command execution - handled through tool_call
				return null

			default:
				// Unknown message type
				return null
		}
	}

	// Ask messages are handled separately through permission flow
	return null
}

/**
 * Translate a tool say message to ACP format.
 *
 * @param message - Tool-related ClineMessage
 * @returns ACP session update or null
 */
function translateToolSayMessage(message: ClineMessage): acp.SessionNotification["update"] | null {
	const toolInfo = parseToolFromMessage(message)
	if (!toolInfo) {
		return null
	}

	if (message.partial) {
		// Tool in progress
		return {
			sessionUpdate: "tool_call",
			toolCallId: toolInfo.id,
			title: toolInfo.title,
			kind: mapToolToKind(toolInfo.name),
			status: "in_progress" as const,
			locations: toolInfo.locations,
			rawInput: toolInfo.params,
		}
	} else {
		// Tool completed
		return {
			sessionUpdate: "tool_call_update",
			toolCallId: toolInfo.id,
			status: "completed" as const,
			content: [],
			rawOutput: toolInfo.params,
		}
	}
}

// =============================================================================
// Ask Type Helpers
// =============================================================================

/**
 * Ask types that require permission from the user.
 */
const PERMISSION_ASKS: readonly ClineAsk[] = ["tool", "command", "browser_action_launch", "use_mcp_server"]

/**
 * Check if an ask type requires permission.
 *
 * @param ask - The ask type to check
 * @returns true if permission is required
 */
export function isPermissionAsk(ask: ClineAsk): boolean {
	return PERMISSION_ASKS.includes(ask)
}

/**
 * Ask types that indicate task completion.
 */
const COMPLETION_ASKS: readonly ClineAsk[] = ["completion_result", "api_req_failed", "mistake_limit_reached"]

/**
 * Check if an ask type indicates task completion.
 *
 * @param ask - The ask type to check
 * @returns true if this indicates completion
 */
export function isCompletionAsk(ask: ClineAsk): boolean {
	return COMPLETION_ASKS.includes(ask)
}

// =============================================================================
// Permission Options
// =============================================================================

/**
 * Create standard permission options for a tool call.
 *
 * Returns options like "Allow", "Reject", and optionally "Always Allow"
 * for certain tool types.
 *
 * @param ask - The ask type
 * @returns Array of permission options
 */
export function createPermissionOptions(ask: ClineAsk): acp.PermissionOption[] {
	const baseOptions: acp.PermissionOption[] = [
		{ optionId: "allow", name: "Allow", kind: "allow_once" },
		{ optionId: "reject", name: "Reject", kind: "reject_once" },
	]

	// Add "allow always" option for certain ask types
	if (ask === "tool" || ask === "command") {
		return [{ optionId: "allow_always", name: "Always Allow", kind: "allow_always" }, ...baseOptions]
	}

	return baseOptions
}
