import type { ClineAsk, McpServerUse } from "@roo-code/types"

import type { ClineSayTool, ExtensionState } from "../../shared/ExtensionMessage"

import { isWriteToolAction, isReadOnlyToolAction } from "./tools"
import { isMcpToolAlwaysAllowed } from "./mcp"
import { getCommandDecision } from "./commands"

export async function isAutoApproved({
	state,
	ask,
	text,
	isProtected,
}: {
	state: Pick<
		ExtensionState,
		| "autoApprovalEnabled"
		| "alwaysAllowFollowupQuestions"
		| "alwaysAllowBrowser"
		| "alwaysAllowMcp"
		| "alwaysAllowExecute"
		| "alwaysAllowReadOnly"
		| "alwaysAllowReadOnlyOutsideWorkspace"
		| "alwaysAllowWrite"
		| "alwaysAllowWriteOutsideWorkspace"
		| "alwaysAllowWriteProtected"
		| "alwaysAllowModeSwitch"
		| "alwaysAllowSubtasks"
		| "alwaysAllowUpdateTodoList"
		| "mcpServers"
		| "allowedCommands"
		| "deniedCommands"
	>
	ask: ClineAsk
	text?: string
	isProtected?: boolean
}): Promise<boolean> {
	if (ask === "command_output" || ask === "api_req_failed") {
		return true
	}

	if (!state.autoApprovalEnabled) {
		return false
	}

	if (ask === "followup") {
		return state.alwaysAllowFollowupQuestions === true
	}

	if (ask === "browser_action_launch") {
		return state.alwaysAllowBrowser === true
	}

	if (ask === "use_mcp_server") {
		if (!text) {
			return false
		}

		try {
			const mcpServerUse = JSON.parse(text) as McpServerUse

			if (mcpServerUse.type === "use_mcp_tool") {
				return state.alwaysAllowMcp === true && isMcpToolAlwaysAllowed(text, state.mcpServers)
			} else if (mcpServerUse.type === "access_mcp_resource") {
				return state.alwaysAllowMcp === true
			}
		} catch (error) {
			return false
		}

		return false
	}

	if (ask === "command") {
		if (!text) {
			return false
		}

		return (
			state.alwaysAllowExecute === true &&
			getCommandDecision(text, state.allowedCommands || [], state.deniedCommands || []) === "auto_approve"
		)
	}

	if (ask === "tool") {
		let tool: ClineSayTool | undefined

		try {
			tool = JSON.parse(text || "{}")
		} catch (error) {
			console.error("Failed to parse tool:", error)
		}

		if (!tool) {
			return false
		}

		if (tool.tool === "updateTodoList") {
			return state.alwaysAllowUpdateTodoList === true
		}

		if (tool?.tool === "fetchInstructions") {
			if (tool.content === "create_mode") {
				return state.alwaysAllowModeSwitch === true
			}

			if (tool.content === "create_mcp_server") {
				return state.alwaysAllowMcp === true
			}
		}

		if (tool?.tool === "switchMode") {
			return state.alwaysAllowModeSwitch === true
		}

		if (["newTask", "finishTask"].includes(tool?.tool)) {
			return state.alwaysAllowSubtasks === true
		}

		const isOutsideWorkspace = !!tool.isOutsideWorkspace

		if (isReadOnlyToolAction(tool)) {
			return (
				state.alwaysAllowReadOnly === true &&
				(!isOutsideWorkspace || state.alwaysAllowReadOnlyOutsideWorkspace === true)
			)
		}

		if (isWriteToolAction(tool)) {
			return (
				state.alwaysAllowWrite === true &&
				(!isOutsideWorkspace || state.alwaysAllowWriteOutsideWorkspace === true) &&
				(!isProtected || state.alwaysAllowWriteProtected === true)
			)
		}
	}

	return false
}

export { AutoApprovalHandler } from "./AutoApprovalHandler"
