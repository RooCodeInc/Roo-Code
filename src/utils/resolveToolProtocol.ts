import { ToolProtocol, TOOL_PROTOCOL } from "@roo-code/types"
import type { ProviderSettings, ModelInfo } from "@roo-code/types"
import type { Anthropic } from "@anthropic-ai/sdk"
import { findLast, findLastIndex } from "../shared/array"

/**
 * Represents an API message in the conversation history.
 * This is a minimal type definition for the detection function.
 */
type ApiMessageForDetection = Anthropic.MessageParam & {
	ts?: number
}

/**
 * Resolve the effective tool protocol based on the precedence hierarchy:
 *
 * 0. Locked Protocol (task-level lock, if provided - highest priority)
 * 1. User Preference - Per-Profile (explicit profile setting)
 * 2. Model Default (defaultToolProtocol in ModelInfo)
 * 3. Native Fallback (final fallback)
 *
 * Then check support: if protocol is "native" but model doesn't support it, use XML.
 *
 * @param providerSettings - The provider settings for the current profile
 * @param modelInfo - Optional model information containing capabilities
 * @param lockedProtocol - Optional task-locked protocol that takes absolute precedence
 * @returns The resolved tool protocol (either "xml" or "native")
 */
export function resolveToolProtocol(
	providerSettings: ProviderSettings,
	modelInfo?: ModelInfo,
	lockedProtocol?: ToolProtocol,
): ToolProtocol {
	// 0. Locked Protocol - task-level lock takes absolute precedence
	// This ensures tasks continue using their original protocol even if settings change
	if (lockedProtocol) {
		return lockedProtocol
	}

	// If model doesn't support native tools, return XML immediately
	// Treat undefined as unsupported (only allow native when explicitly true)
	if (modelInfo?.supportsNativeTools !== true) {
		return TOOL_PROTOCOL.XML
	}

	// 1. User Preference - Per-Profile (explicit profile setting, highest priority)
	if (providerSettings.toolProtocol) {
		return providerSettings.toolProtocol
	}

	// 2. Model Default - model's preferred protocol
	if (modelInfo?.defaultToolProtocol) {
		return modelInfo.defaultToolProtocol
	}

	// 3. Native Fallback
	return TOOL_PROTOCOL.XML
}

/**
 * Detect the tool protocol used in an existing conversation history.
 *
 * This function scans the API conversation history for tool_use blocks
 * and determines which protocol was used based on their structure:
 *
 * - Native protocol: tool_use blocks ALWAYS have an `id` field
 * - XML protocol: tool_use blocks NEVER have an `id` field
 *
 * This is critical for task resumption: if a task previously used tools
 * with a specific protocol, we must continue using that protocol even
 * if the user's NTC settings have changed.
 *
 * The function searches from the most recent message backwards to find
 * the last tool call, which represents the task's current protocol state.
 *
 * @param messages - The API conversation history to scan
 * @returns The detected protocol, or undefined if no tool calls were found
 */
export function detectToolProtocolFromHistory(messages: ApiMessageForDetection[]): ToolProtocol | undefined {
	// Find the last assistant message that contains a tool_use block
	const lastAssistantWithTool = findLast(messages, (message) => {
		if (message.role !== "assistant") {
			return false
		}
		const content = message.content
		if (!Array.isArray(content)) {
			return false
		}
		return content.some((block) => block.type === "tool_use")
	})

	if (!lastAssistantWithTool) {
		return undefined
	}

	// Find the last tool_use block in that message's content
	const content = lastAssistantWithTool.content as Anthropic.ContentBlock[]
	const lastToolUseIndex = findLastIndex(content, (block) => block.type === "tool_use")

	if (lastToolUseIndex === -1) {
		return undefined
	}

	const lastToolUse = content[lastToolUseIndex]

	// The presence or absence of `id` determines the protocol:
	// - Native protocol tool calls ALWAYS have an ID (set when parsed from tool_call chunks)
	// - XML protocol tool calls NEVER have an ID (parsed from XML text)
	// This pattern is used in presentAssistantMessage.ts:497-500
	const hasId = "id" in lastToolUse && !!lastToolUse.id
	return hasId ? TOOL_PROTOCOL.NATIVE : TOOL_PROTOCOL.XML
}
