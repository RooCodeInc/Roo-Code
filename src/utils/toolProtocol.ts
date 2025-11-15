import * as vscode from "vscode"
import { ToolProtocol } from "@roo-code/types"
import { Package } from "../shared/package"

/**
 * Get the tool protocol setting from VSCode configuration.
 * This centralizes the logic for retrieving the toolProtocol setting,
 * ensuring consistent behavior across the codebase.
 *
 * @returns The configured tool protocol, defaults to "xml" if not set
 */
export function getToolProtocolFromSettings(): ToolProtocol {
	return vscode.workspace.getConfiguration(Package.name).get<ToolProtocol>("toolProtocol", "xml")
}
