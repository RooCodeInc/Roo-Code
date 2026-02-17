import {
	type ClineAsk,
	type ClineSayTool,
	type McpServerUse,
	type FollowUpData,
	type ExtensionState,
	isNonBlockingAsk,
} from "@roo-code/types"

import { ClineAskResponse } from "../../shared/WebviewMessage"

import { isWriteToolAction, isReadOnlyToolAction } from "./tools"
import { isMcpToolAlwaysAllowed } from "./mcp"
import { getCommandDecision } from "./commands"
import { classifyRpiToolRisk, loadRpiPolicyBundle, type RpiPolicyBundle, type RpiRiskClass } from "../rpi/RpiPolicy"

// We have 10 different actions that can be auto-approved.
export type AutoApprovalState =
	| "alwaysAllowReadOnly"
	| "alwaysAllowWrite"
	| "alwaysAllowBrowser"
	| "alwaysAllowMcp"
	| "alwaysAllowModeSwitch"
	| "alwaysAllowSubtasks"
	| "alwaysAllowExecute"
	| "alwaysAllowFollowupQuestions"

// Some of these actions have additional settings associated with them.
export type AutoApprovalStateOptions =
	| "autoApprovalEnabled"
	| "alwaysAllowReadOnlyOutsideWorkspace" // For `alwaysAllowReadOnly`.
	| "alwaysAllowWriteOutsideWorkspace" // For `alwaysAllowWrite`.
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
	cwd,
	followupAutoResponseText,
}: {
	state?: Pick<ExtensionState, AutoApprovalState | AutoApprovalStateOptions>
	ask: ClineAsk
	text?: string
	isProtected?: boolean
	cwd?: string
	followupAutoResponseText?: string
}): Promise<CheckAutoApprovalResult> {
	if (isNonBlockingAsk(ask)) {
		return { decision: "approve" }
	}

	const policyApprovalMode = await getPolicyApprovalMode({ ask, text, isProtected, cwd })
	// "manual" is a hard-stop: never auto-approve.
	// "manual-first" is a soft gate: allow auto-approve rules (allowlists/toggles) to proceed.
	if (policyApprovalMode === "manual") {
		return { decision: "ask" }
	}

	if (!state || !state.autoApprovalEnabled) {
		return { decision: "ask" }
	}

	if (ask === "followup") {
		if (state.alwaysAllowFollowupQuestions === true) {
			const configuredOverride = followupAutoResponseText?.trim()
			const timeoutMs =
				typeof state.followupAutoApproveTimeoutMs === "number" && state.followupAutoApproveTimeoutMs > 0
					? state.followupAutoApproveTimeoutMs
					: undefined

			try {
				const suggestion = (JSON.parse(text || "{}") as FollowUpData).suggest?.[0]
				const selectedResponse = configuredOverride || suggestion?.answer

				if (selectedResponse && timeoutMs) {
					return {
						decision: "timeout",
						timeout: timeoutMs,
						fn: () => ({ askResponse: "messageResponse", text: selectedResponse }),
					}
				} else {
					return { decision: "ask" }
				}
			} catch (error) {
				if (configuredOverride && timeoutMs) {
					return {
						decision: "timeout",
						timeout: timeoutMs,
						fn: () => ({ askResponse: "messageResponse", text: configuredOverride }),
					}
				}
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
			return { decision: "approve" }
		}

		// The skill tool only loads pre-defined instructions from built-in, global, or project skills.
		// It does not read arbitrary files - skills must be explicitly installed/defined by the user.
		// Auto-approval is intentional to provide a seamless experience when loading task instructions.
		if (tool.tool === "skill") {
			return { decision: "approve" }
		}

		if (tool?.tool === "switchMode") {
			return state.alwaysAllowModeSwitch === true ? { decision: "approve" } : { decision: "ask" }
		}

		if (["newTask", "finishTask"].includes(tool?.tool)) {
			return state.alwaysAllowSubtasks === true ? { decision: "approve" } : { decision: "ask" }
		}

		const isOutsideWorkspace = !!tool.isOutsideWorkspace

		if (isReadOnlyToolAction(tool)) {
			return state.alwaysAllowReadOnly === true &&
				(!isOutsideWorkspace || state.alwaysAllowReadOnlyOutsideWorkspace === true)
				? { decision: "approve" }
				: { decision: "ask" }
		}

		if (isWriteToolAction(tool)) {
			return state.alwaysAllowWrite === true &&
				(!isOutsideWorkspace || state.alwaysAllowWriteOutsideWorkspace === true) &&
				(!isProtected || state.alwaysAllowWriteProtected === true)
				? { decision: "approve" }
				: { decision: "ask" }
		}
	}

	return { decision: "ask" }
}

export { AutoApprovalHandler } from "./AutoApprovalHandler"

const uiToolToCanonicalRiskMap: Partial<Record<ClineSayTool["tool"], string>> = {
	editedExistingFile: "write_to_file",
	appliedDiff: "apply_diff",
	newFileCreated: "write_to_file",
	codebaseSearch: "codebase_search",
	readFile: "read_file",
	readCommandOutput: "read_command_output",
	listFilesTopLevel: "list_files",
	listFilesRecursive: "list_files",
	searchFiles: "search_files",
	switchMode: "switch_mode",
	newTask: "new_task",
	finishTask: "finish_task",
	generateImage: "generate_image",
	imageGenerated: "generate_image",
	runSlashCommand: "run_slash_command",
	updateTodoList: "update_todo_list",
	skill: "skill",
}

const policyCache = new Map<string, Promise<RpiPolicyBundle | undefined>>()

async function getPolicyBundle(cwd?: string): Promise<RpiPolicyBundle | undefined> {
	if (!cwd) {
		return undefined
	}

	const key = cwd
	if (!policyCache.has(key)) {
		policyCache.set(
			key,
			loadRpiPolicyBundle(cwd).catch(() => {
				return undefined
			}),
		)
	}
	return policyCache.get(key)!
}

async function getPolicyApprovalMode({
	ask,
	text,
	isProtected,
	cwd,
}: {
	ask: ClineAsk
	text?: string
	isProtected?: boolean
	cwd?: string
}): Promise<string | undefined> {
	const bundle = await getPolicyBundle(cwd)
	if (!bundle) {
		return undefined
	}

	const classify = (toolName: string, mcpToolName?: string): RpiRiskClass => {
		const risk = classifyRpiToolRisk(bundle.riskMatrix, { toolName, mcpToolName })
		if (isProtected && risk !== "R3") {
			return "R3"
		}
		return risk
	}

	let risk: RpiRiskClass | undefined

	if (ask === "command") {
		risk = classify("execute_command")
	} else if (ask === "browser_action_launch") {
		risk = classify("browser_action")
	} else if (ask === "use_mcp_server") {
		try {
			const mcpServerUse = JSON.parse(text || "{}") as McpServerUse
			if (mcpServerUse.type === "use_mcp_tool") {
				const rawToolName =
					(mcpServerUse as McpServerUse & { tool_name?: string }).toolName ||
					(mcpServerUse as any).tool_name ||
					""
				const mcpToolName = rawToolName.toLowerCase()
				risk = classify("use_mcp_tool", mcpToolName)
			} else if (mcpServerUse.type === "access_mcp_resource") {
				risk = classify("access_mcp_resource")
			}
		} catch {
			// Leave risk undefined and skip policy override.
		}
	} else if (ask === "tool") {
		try {
			const tool = JSON.parse(text || "{}") as ClineSayTool
			const canonical = uiToolToCanonicalRiskMap[tool.tool]
			if (canonical) {
				risk = classify(canonical)
			} else if (isWriteToolAction(tool)) {
				risk = classify("write_to_file")
			} else if (isReadOnlyToolAction(tool)) {
				risk = classify("read_file")
			}
		} catch {
			// Leave risk undefined and skip policy override.
		}
	}

	if (!risk) {
		return undefined
	}

	return bundle.riskMatrix.riskClasses[risk]?.approval
}
