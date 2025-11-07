import { ToolProtocol } from "@roo-code/types"

/**
 * Internal tool protocol state management.
 * This is code-only and not exposed through VS Code settings.
 */
let currentProtocol: ToolProtocol = "xml"

/**
 * Sets the current tool protocol.
 * This is an internal API and should not be called by external code.
 *
 * @param protocol - The tool protocol to set ('xml' or 'native')
 */
export function setToolProtocol(protocol: ToolProtocol): void {
	currentProtocol = protocol
}

/**
 * Gets the current tool protocol.
 *
 * @returns The current tool protocol
 */
export function getToolProtocol(): ToolProtocol {
	return currentProtocol
}

/**
 * Resolves the effective tool protocol.
 *
 * @returns The effective tool protocol (defaults to "xml")
 */
export function resolveToolProtocol(): ToolProtocol {
	return currentProtocol
}
