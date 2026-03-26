import type { ClineAskDelegateToAgent } from "@roo-code/types"

import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"
import type { ToolUse } from "../../shared/tools"

import { BaseTool, ToolCallbacks } from "./BaseTool"

interface DelegateToAgentParams {
	agent_name: string
	message: string
}

export class DelegateToAgentTool extends BaseTool<"delegate_to_agent"> {
	readonly name = "delegate_to_agent" as const

	async execute(params: DelegateToAgentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			// Validate required parameters
			if (!params.agent_name) {
				task.consecutiveMistakeCount++
				task.recordToolError("delegate_to_agent")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("delegate_to_agent", "agent_name"))
				return
			}

			if (!params.message) {
				task.consecutiveMistakeCount++
				task.recordToolError("delegate_to_agent")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("delegate_to_agent", "message"))
				return
			}

			const agentName = params.agent_name
			const message = params.message

			// Validate that the agent exists
			const provider = task.providerRef.deref()
			if (!provider) {
				pushToolResult(formatResponse.toolError("Provider reference lost"))
				return
			}

			const a2aHub = provider.getA2aHub?.()
			if (!a2aHub) {
				pushToolResult(
					formatResponse.toolError(
						"A2A is not available. No A2A agents are configured. Please configure agents in a2a_settings.json.",
					),
				)
				return
			}

			const agent = a2aHub.getAgent(agentName)
			if (!agent) {
				const availableAgents = a2aHub
					.getAgents()
					.map((a) => a.name)
					.join(", ")
				pushToolResult(
					formatResponse.toolError(
						`A2A agent "${agentName}" not found or is disabled. Available agents: ${availableAgents || "none"}`,
					),
				)
				return
			}

			task.consecutiveMistakeCount = 0

			// Get user approval
			const completeMessage = JSON.stringify({
				type: "delegate_to_agent",
				agentName,
				message,
			} satisfies ClineAskDelegateToAgent)

			const didApprove = await askApproval("delegate_to_agent" as any, completeMessage)

			if (!didApprove) {
				return
			}

			// Execute the A2A task
			try {
				const result = await a2aHub.sendTask(agentName, message)

				// Format the result
				const responseText = this.formatTaskResult(result)
				pushToolResult(responseText)
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				pushToolResult(formatResponse.toolError(`Failed to delegate to agent "${agentName}": ${errorMessage}`))
			}
		} catch (error) {
			await handleError("delegating to A2A agent", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"delegate_to_agent">): Promise<void> {
		const params = block.params
		const partialMessage = JSON.stringify({
			type: "delegate_to_agent",
			agentName: params.agent_name ?? "",
			message: params.message ?? "",
		} satisfies ClineAskDelegateToAgent)

		await task.ask("delegate_to_agent" as any, partialMessage, true).catch(() => {})
	}

	/**
	 * Format an A2A task result into a human-readable string.
	 */
	private formatTaskResult(task: import("@roo-code/types").A2aTask): string {
		const parts: string[] = []

		parts.push(`Task ID: ${task.id}`)
		parts.push(`Status: ${task.status.state}`)

		// Include the agent's response message if present
		if (task.status.message) {
			const textParts = task.status.message.parts
				.filter((p) => p.type === "text")
				.map((p) => (p as import("@roo-code/types").A2aTextPart).text)

			if (textParts.length > 0) {
				parts.push(`\nAgent Response:\n${textParts.join("\n")}`)
			}
		}

		// Include artifacts if present
		if (task.artifacts && task.artifacts.length > 0) {
			parts.push("\nArtifacts:")
			for (const artifact of task.artifacts) {
				if (artifact.name) {
					parts.push(`  - ${artifact.name}${artifact.description ? `: ${artifact.description}` : ""}`)
				}
				const textParts = artifact.parts
					.filter((p) => p.type === "text")
					.map((p) => (p as import("@roo-code/types").A2aTextPart).text)
				if (textParts.length > 0) {
					parts.push(`    ${textParts.join("\n    ")}`)
				}
			}
		}

		// If the task requires input, note that
		if (task.status.state === "input-required") {
			parts.push(
				"\nNote: The agent is requesting additional input. You can send another delegate_to_agent call with the same agent to continue the conversation.",
			)
		}

		return parts.join("\n")
	}
}

export const delegateToAgentTool = new DelegateToAgentTool()
