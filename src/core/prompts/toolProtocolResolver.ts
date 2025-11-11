import { ToolProtocol, TOOL_PROTOCOL } from "@roo-code/types"
import type { SystemPromptSettings } from "./types"

/**
 * Current tool protocol setting.
 * This is code-only and not exposed through VS Code settings.
 * To switch protocols, edit this constant directly in the source code.
 */
const CURRENT_TOOL_PROTOCOL: ToolProtocol = TOOL_PROTOCOL.XML // change to TOOL_PROTOCOL.NATIVE to enable native protocol

/**
 * Resolves the effective tool protocol.
 *
 * @returns The effective tool protocol (defaults to "xml")
 */
export function resolveToolProtocol(): ToolProtocol {
	return CURRENT_TOOL_PROTOCOL
}

/**
 * Gets the effective protocol from settings or falls back to the default.
 *
 * @param settings - Optional system prompt settings
 * @returns The effective tool protocol
 */
export function getEffectiveProtocol(settings?: SystemPromptSettings): ToolProtocol {
	return settings?.toolProtocol || resolveToolProtocol()
}

/**
 * Checks if the protocol is native (non-XML).
 *
 * @param protocol - The tool protocol to check
 * @returns True if protocol is native
 */
export function isNativeProtocol(protocol: ToolProtocol): boolean {
	return protocol === TOOL_PROTOCOL.NATIVE
}
