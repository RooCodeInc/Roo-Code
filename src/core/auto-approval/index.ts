import { type ClineAsk, type McpServerUse, isNonBlockingAsk } from "@roo-code/types"

import type { ClineSayTool, ExtensionState } from "../../shared/ExtensionMessage"

import { isWriteToolAction, isReadOnlyToolAction } from "./tools"
import { isMcpToolAlwaysAllowed } from "./mcp"
import { getCommandDecision } from "./commands"

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
	| "alwaysAllowWriteOutsideWorkspace" // For `alwaysAllowWrite`.
	| "alwaysAllowWriteProtected"
	| "mcpServers" // For `alwaysAllowMcp`.
	| "allowedCommands" // For `alwaysAllowExecute`.
	| "deniedCommands"

export type CheckAutoApprovalResult = "approve" | "deny" | "ask"

export async function checkAutoApproval({
	state,
	ask,
	text,
	isProtected,
}: {
	state: Pick<ExtensionState, AutoApprovalState | AutoApprovalStateOptions>
	ask: ClineAsk
	text?: string
	isProtected?: boolean
}): Promise<CheckAutoApprovalResult> {
	if (isNonBlockingAsk(ask)) {
		return "approve"
	}

	if (!state.autoApprovalEnabled) {
		return "ask"
	}

	// Note: The `alwaysApproveResubmit` check is already handled in `Task`.

	if (ask === "followup") {
		return state.alwaysAllowFollowupQuestions === true ? "approve" : "ask"
	}

	if (ask === "browser_action_launch") {
		return state.alwaysAllowBrowser === true ? "approve" : "ask"
	}

	if (ask === "use_mcp_server") {
		if (!text) {
			return "ask"
		}

		try {
			const mcpServerUse = JSON.parse(text) as McpServerUse

			if (mcpServerUse.type === "use_mcp_tool") {
				return state.alwaysAllowMcp === true && isMcpToolAlwaysAllowed(mcpServerUse, state.mcpServers)
					? "approve"
					: "ask"
			} else if (mcpServerUse.type === "access_mcp_resource") {
				return state.alwaysAllowMcp === true ? "approve" : "ask"
			}
		} catch (error) {
			return "ask"
		}

		return "ask"
	}

	if (ask === "command") {
		if (!text) {
			return "ask"
		}

		if (state.alwaysAllowExecute === true) {
			const decision = getCommandDecision(text, state.allowedCommands || [], state.deniedCommands || [])

			if (decision === "auto_approve") {
				return "approve"
			} else if (decision === "auto_deny") {
				return "deny"
			} else {
				return "ask"
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
			return "ask"
		}

		if (tool.tool === "updateTodoList") {
			return state.alwaysAllowUpdateTodoList === true ? "approve" : "ask"
		}

		if (tool?.tool === "fetchInstructions") {
			if (tool.content === "create_mode") {
				return state.alwaysAllowModeSwitch === true ? "approve" : "ask"
			}

			if (tool.content === "create_mcp_server") {
				return state.alwaysAllowMcp === true ? "approve" : "ask"
			}
		}

		if (tool?.tool === "switchMode") {
			return state.alwaysAllowModeSwitch === true ? "approve" : "ask"
		}

		if (["newTask", "finishTask"].includes(tool?.tool)) {
			return state.alwaysAllowSubtasks === true ? "approve" : "ask"
		}

		const isOutsideWorkspace = !!tool.isOutsideWorkspace

		if (isReadOnlyToolAction(tool)) {
			return state.alwaysAllowReadOnly === true &&
				(!isOutsideWorkspace || state.alwaysAllowReadOnlyOutsideWorkspace === true)
				? "approve"
				: "ask"
		}

		if (isWriteToolAction(tool)) {
			return state.alwaysAllowWrite === true &&
				(!isOutsideWorkspace || state.alwaysAllowWriteOutsideWorkspace === true) &&
				(!isProtected || state.alwaysAllowWriteProtected === true)
				? "approve"
				: "ask"
		}
	}

	return "ask"
}

export { AutoApprovalHandler } from "./AutoApprovalHandler"
