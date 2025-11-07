import { ToolProtocol } from "@roo-code/types"

/**
 * Current tool protocol setting.
 * This is code-only and not exposed through VS Code settings.
 * To switch protocols, edit this constant directly in the source code.
 */
const CURRENT_TOOL_PROTOCOL: ToolProtocol = "xml" // change to 'native' to enable native protocol

/**
 * Resolves the effective tool protocol.
 *
 * @returns The effective tool protocol (defaults to "xml")
 */
export function resolveToolProtocol(): ToolProtocol {
	return CURRENT_TOOL_PROTOCOL
}
