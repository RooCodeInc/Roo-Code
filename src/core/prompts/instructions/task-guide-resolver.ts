import * as vscode from "vscode"
import { TaskTypeMapping, TaskTypeConfig } from "../../../shared/globalFileNames"
import { fetchInstructions } from "./instructions"
import { McpHub } from "../../../services/mcp/McpHub"
import { DiffStrategy } from "../../../shared/tools"

export interface TaskGuideResult {
	taskType: string
	description: string
	recommendedMode: "salesforce-agent" | "code" | "orchestrator"
	instructions: string
	instructionCount: number
	loadedGuides: string[] // List of loaded guide titles for display
}

export interface TaskGuideResolverContext {
	mcpHub?: McpHub
	diffStrategy?: DiffStrategy
	context?: vscode.ExtensionContext
}

/**
 * Get list of all available task types with descriptions
 */
export function getAvailableTaskTypes(): Array<{ taskType: string; description: string; mode: string }> {
	return Object.entries(TaskTypeMapping).map(([taskType, config]) => ({
		taskType,
		description: config.description,
		mode: config.mode,
	}))
}

/**
 * Check if a task type exists
 */
export function isValidTaskType(taskType: string): boolean {
	return taskType in TaskTypeMapping
}

/**
 * Get task type configuration
 */
export function getTaskTypeConfig(taskType: string): TaskTypeConfig | undefined {
	return TaskTypeMapping[taskType]
}

/**
 * Resolves a task type to all its related instructions
 * Fetches all instruction content and combines them
 */
export async function resolveTaskGuides(
	taskType: string,
	resolverContext: TaskGuideResolverContext,
): Promise<TaskGuideResult | null> {
	const config = TaskTypeMapping[taskType]

	if (!config) {
		return null
	}

	const { mcpHub, diffStrategy, context } = resolverContext

	// Fetch all related instructions
	const instructionPromises = config.instructions.map(async (instructionKey) => {
		try {
			const content = await fetchInstructions(instructionKey, {
				mcpHub,
				diffStrategy,
				context,
			})
			return {
				key: instructionKey,
				content: content || "",
				success: !!content,
			}
		} catch (error) {
			console.error(`Error fetching instruction '${instructionKey}':`, error)
			return {
				key: instructionKey,
				content: "",
				success: false,
			}
		}
	})

	const results = await Promise.all(instructionPromises)

	// Combine all successful instructions
	const successfulInstructions = results.filter((r) => r.success)
	const failedInstructions = results.filter((r) => !r.success)

	if (successfulInstructions.length === 0) {
		return null
	}

	// Build combined instruction content
	let combinedContent = `# Task Guides for: ${taskType}\n\n`
	combinedContent += `**Description:** ${config.description}\n`
	combinedContent += `**Recommended Mode:** ${config.mode}\n\n`
	combinedContent += `---\n\n`

	for (const instruction of successfulInstructions) {
		combinedContent += `## ${formatInstructionTitle(instruction.key)}\n\n`
		combinedContent += instruction.content
		combinedContent += `\n\n---\n\n`
	}

	if (failedInstructions.length > 0) {
		combinedContent += `\n**Note:** Some instructions could not be loaded: ${failedInstructions.map((f) => f.key).join(", ")}\n`
	}

	// Get the list of loaded guide titles for display
	const loadedGuides = successfulInstructions.map((i) => formatInstructionTitle(i.key))

	return {
		taskType,
		description: config.description,
		recommendedMode: config.mode,
		instructions: combinedContent,
		instructionCount: successfulInstructions.length,
		loadedGuides,
	}
}

/**
 * Format instruction key to readable title
 */
function formatInstructionTitle(key: string): string {
	const titles: Record<string, string> = {
		// General
		create_mcp_server: "MCP Server Creation",
		create_mode: "Custom Mode Creation",
		create_lwc: "Lightning Web Component",
		create_apex: "Apex Class/Trigger",
		create_async_apex: "Asynchronous Apex",

		// Agentforce
		agentforce_agent_create: "Agentforce Agent Creation Workflow",
		agentforce_agent_analyse: "Agentforce Agent Analysis",
		agentforce_topic_analyse: "Agentforce Topic Analysis",

		// Salesforce Metadata
		assignment_rules: "Assignment Rules",
		custom_field: "Custom Fields",
		custom_object: "Custom Objects",
		field_permissions: "Field Permissions",
		object_permissions: "Object Permissions",
		path_creation: "Path Creation",
		profile: "Profiles",
		record_types: "Record Types",
		role_creation: "Role Hierarchy",
		validation_rules: "Validation Rules",

		// Code
		invocable_apex: "Invocable Apex",
		adaptive_response_agent: "Adaptive Response Agent",
		adaptive_response_agent_workflow: "Adaptive Response Agent Workflow",
	}

	return titles[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
