import { type ClineAsk, type McpServerUse, type FollowUpData, isNonBlockingAsk } from "@roo-code/types"

import type { ClineSayTool, ExtensionState } from "../../shared/ExtensionMessage"
import { ClineAskResponse } from "../../shared/WebviewMessage"

import { isWriteToolAction, isReadOnlyToolAction } from "./tools"
import { isMcpToolAlwaysAllowed } from "./mcp"
import { getCommandDecision } from "./commands"
import { isPathInAllowedDirectories } from "../../utils/pathUtils"

// We have 10 different actions that can be auto-approved.
export type AutoApprovalState =
	| "alwaysAllowReadOnly"
	| "alwaysAllowWrite"
	| "alwaysAllowBrowser"
	| "alwaysApproveResubmit"
	| "alwaysAllowMcp"
	| "alwaysAllowModeSwitch"
	| "alwaysAllowSubtasks"
	| "alwaysAllowExecute"
	| "alwaysAllowFollowupQuestions"
	| "alwaysAllowUpdateTodoList"

// Some of these actions have additional settings associated with them.
export type AutoApprovalStateOptions =
	| "autoApprovalEnabled"
	| "alwaysAllowReadOnlyOutsideWorkspace" // For `alwaysAllowReadOnly`.
	| "allowedReadDirectories" // For directory-specific read approval.
	| "alwaysAllowWriteOutsideWorkspace" // For `alwaysAllowWrite`.
	| "allowedWriteDirectories" // For directory-specific write approval.
	| "alwaysAllowWriteProtected"
	| "followupAutoApproveTimeoutMs" // For `alwaysAllowFollowupQuestions`.
	| "mcpServers" // For `alwaysAllowMcp`.
	| "allowedCommands" // For `alwaysAllowExecute`.
	| "deniedCommands"

export type CheckAutoApprovalResult =
	| { decision: "approve" }
	| { decision: "deny" }
	| { decision: "ask" }
	| {
			decision: "timeout"
			timeout: number
			fn: () => { askResponse: ClineAskResponse; text?: string; images?: string[] }
	  }

export async function checkAutoApproval({
	state,
	ask,
	text,
	isProtected,
}: {
	state?: Pick<ExtensionState, AutoApprovalState | AutoApprovalStateOptions>
	ask: ClineAsk
	text?: string
	isProtected?: boolean
}): Promise<CheckAutoApprovalResult> {
	if (isNonBlockingAsk(ask)) {
		return { decision: "approve" }
	}

	if (!state || !state.autoApprovalEnabled) {
		return { decision: "ask" }
	}

	if (ask === "followup") {
		if (state.alwaysAllowFollowupQuestions === true) {
			try {
				const suggestion = (JSON.parse(text || "{}") as FollowUpData).suggest?.[0]

				if (
					suggestion &&
					typeof state.followupAutoApproveTimeoutMs === "number" &&
					state.followupAutoApproveTimeoutMs > 0
				) {
					return {
						decision: "timeout",
						timeout: state.followupAutoApproveTimeoutMs,
						fn: () => ({ askResponse: "messageResponse", text: suggestion.answer }),
					}
				} else {
					return { decision: "ask" }
				}
			} catch (error) {
				return { decision: "ask" }
			}
		} else {
			return { decision: "ask" }
		}
	}

	if (ask === "browser_action_launch") {
		return state.alwaysAllowBrowser === true ? { decision: "approve" } : { decision: "ask" }
	}

	if (ask === "use_mcp_server") {
		if (!text) {
			return { decision: "ask" }
		}

		try {
			const mcpServerUse = JSON.parse(text) as McpServerUse

			if (mcpServerUse.type === "use_mcp_tool") {
				return state.alwaysAllowMcp === true && isMcpToolAlwaysAllowed(mcpServerUse, state.mcpServers)
					? { decision: "approve" }
					: { decision: "ask" }
			} else if (mcpServerUse.type === "access_mcp_resource") {
				return state.alwaysAllowMcp === true ? { decision: "approve" } : { decision: "ask" }
			}
		} catch (error) {
			return { decision: "ask" }
		}

		return { decision: "ask" }
	}

	if (ask === "command") {
		if (!text) {
			return { decision: "ask" }
		}

		if (state.alwaysAllowExecute === true) {
			const decision = getCommandDecision(text, state.allowedCommands || [], state.deniedCommands || [])

			if (decision === "auto_approve") {
				return { decision: "approve" }
			} else if (decision === "auto_deny") {
				return { decision: "deny" }
			} else {
				return { decision: "ask" }
			}
		}
	}

	if (ask === "tool") {
		let tool: ClineSayTool | undefined

		try {
			tool = JSON.parse(text || "{}")
		} catch (error) {
			console.error("Failed to parse tool:", error)
		}

		if (!tool) {
			return { decision: "ask" }
		}

		if (tool.tool === "updateTodoList") {
			return state.alwaysAllowUpdateTodoList === true ? { decision: "approve" } : { decision: "ask" }
		}

		if (tool?.tool === "fetchInstructions") {
			if (tool.content === "create_mode") {
				return state.alwaysAllowModeSwitch === true ? { decision: "approve" } : { decision: "ask" }
			}

			if (tool.content === "create_mcp_server") {
				return state.alwaysAllowMcp === true ? { decision: "approve" } : { decision: "ask" }
			}
		}

		if (tool?.tool === "switchMode") {
			return state.alwaysAllowModeSwitch === true ? { decision: "approve" } : { decision: "ask" }
		}

		if (["newTask", "finishTask"].includes(tool?.tool)) {
			return state.alwaysAllowSubtasks === true ? { decision: "approve" } : { decision: "ask" }
		}

		const isOutsideWorkspace = !!tool.isOutsideWorkspace
		const filePath = tool.path

		if (isReadOnlyToolAction(tool)) {
			// Check if read is allowed
			if (state.alwaysAllowReadOnly !== true) {
				return { decision: "ask" }
			}

			// If file is inside workspace, approve
			if (!isOutsideWorkspace) {
				return { decision: "approve" }
			}

			// File is outside workspace - check if it's in allowed directories
			if (
				filePath &&
				state.allowedReadDirectories &&
				isPathInAllowedDirectories(filePath, state.allowedReadDirectories)
			) {
				return { decision: "approve" }
			}

			// Otherwise check the general outside workspace setting
			return state.alwaysAllowReadOnlyOutsideWorkspace === true ? { decision: "approve" } : { decision: "ask" }
		}

		if (isWriteToolAction(tool)) {
			// Check if write is allowed
			if (state.alwaysAllowWrite !== true) {
				return { decision: "ask" }
			}

			// Check if protected files are allowed
			if (isProtected && state.alwaysAllowWriteProtected !== true) {
				return { decision: "ask" }
			}

			// If file is inside workspace, approve
			if (!isOutsideWorkspace) {
				return { decision: "approve" }
			}

			// File is outside workspace - check if it's in allowed directories
			if (
				filePath &&
				state.allowedWriteDirectories &&
				isPathInAllowedDirectories(filePath, state.allowedWriteDirectories)
			) {
				return { decision: "approve" }
			}

			// Otherwise check the general outside workspace setting
			return state.alwaysAllowWriteOutsideWorkspace === true ? { decision: "approve" } : { decision: "ask" }
		}
	}

	return { decision: "ask" }
}

export { AutoApprovalHandler } from "./AutoApprovalHandler"
