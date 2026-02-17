import { Task } from "../task/Task"
import { fetchInstructions } from "../prompts/instructions/instructions"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { ToolUse, AskApproval, HandleError, PushToolResult } from "../../shared/tools"

/**
 * Maps task identifiers to user-friendly display names
 */
function getTaskDisplayName(task: string): string {
	const taskNames: Record<string, string> = {
		// General Instructions
		create_mcp_server: "MCP Server Instructions",
		create_mode: "Custom Mode Instructions",
		create_lwc: "Lightning Web Component Instructions",
		create_apex: "Apex Class Instructions",
		create_async_apex: "Asynchronous Apex Instructions",
		// Salesforce Agent Instructions
		agentforce_agent_create: "Agentforce Agent Creation Workflow",
		agentforce_agent_analyse: "Agentforce Agent Analysis & Enhancement Workflow",
		agentforce_topic_analyse: "Agentforce Topic Analysis Workflow",
		agentforce_topics_actions: "Agentforce Topics and Actions Guide",
		assignment_rules: "Assignment Rules Instructions",
		custom_field: "Custom Field Instructions",
		custom_object: "Custom Object Instructions",
		field_permissions: "Field Permissions Instructions",
		object_permissions: "Object Permissions Instructions",
		path_creation: "Path Creation Instructions",
		profile: "Profile Instructions",
		record_types: "Record Types Instructions",
		role_creation: "Role Creation Instructions",
		validation_rules: "Validation Rules Instructions",
		// Invocable Apex Instructions
		invocable_apex: "Invocable Apex Instructions",
		// Workflow Action Creation Instructions
		workflow_field_update_creation: "Workflow Field Update Creation Instructions",
		workflow_email_alert_creation: "Workflow Email Alert Creation Instructions",
		// Adaptive Response Agent Instructions
		adaptive_response_agent: "Adaptive Response Agent Instructions",
	}

	return taskNames[task] || task
}

export async function fetchInstructionsTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
) {
	const task: string | undefined = block.params.task
	const displayName = task ? getTaskDisplayName(task) : undefined
	const sharedMessageProps: ClineSayTool = { tool: "fetchInstructions", content: displayName }

	try {
		if (block.partial) {
			// Skip partial messages - we'll show the complete message with the instruction name
			return
		} else {
			if (!task) {
				cline.consecutiveMistakeCount++
				// cline.recordToolError("fetch_instructions")
				// pushToolResult(await cline.sayAndCreateMissingParamError("fetch_instructions", "task"))
				return
			}

			cline.consecutiveMistakeCount = 0

			// Warn if Orchestrator is fetching task-specific workflows (should delegate instead)
			const provider = cline.providerRef.deref()
			const currentMode = (await provider?.getState())?.mode
			const agentforceWorkflows = [
				"agentforce_agent_create",
				"agentforce_agent_analyse",
				"agentforce_topic_analyse",
				"agentforce_topics_actions",
			]

			if (agentforceWorkflows.includes(task) && currentMode === "orchestrator") {
				// Add warning but allow reading for task understanding
				console.warn(
					`[Orchestrator] Fetching ${task} workflow. Orchestrator should typically delegate Agentforce tasks to Salesforce Agent mode instead of executing them directly.`,
				)
			}

			// Extract optional section parameter
			const section: string | undefined = block.params.section

			// Update display message to include section if provided
			const displayMessage = section ? `${displayName} - Section: ${section}` : displayName

			// Auto-approve instructions fetch to reduce friction.
			// We still emit a message so the webview shows what was fetched, but do not gate on user approval.
			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				content: displayMessage,
			} satisfies ClineSayTool)
			// Send the message to show which instruction was used
			await cline.say("tool", completeMessage)

			// Now fetch the content and provide it to the agent.
			// const provider = cline.providerRef.deref()
			const mcpHub = provider?.getMcpHub()

			if (!mcpHub) {
				throw new Error("MCP hub not available")
			}

			const diffStrategy = cline.diffStrategy
			const context = provider?.context
			const content = await fetchInstructions(task, { mcpHub, diffStrategy, context, section })

			if (!content) {
				pushToolResult(formatResponse.toolError(`Invalid instructions request: ${task}`))
				return
			}

			pushToolResult(content)

			return
		}
	} catch (error) {
		await handleError("fetch instructions", error)
	}
}
