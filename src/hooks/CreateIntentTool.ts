import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { Task } from "../core/task/Task"
import { formatResponse } from "../core/prompts/responses"
import { BaseTool, ToolCallbacks } from "../core/tools/BaseTool"
import type { ToolUse } from "../shared/tools"
import { OrchestrationDataModel, type ActiveIntent } from "./OrchestrationDataModel"

interface CreateIntentParams {
	prompt: string
	intent_id?: string
	intent_name?: string
	owned_scope?: string[]
	constraints?: string[]
	acceptance_criteria?: string[]
}

/**
 * Tool for creating a new intent based on a prompt.
 * Checks for docs/Architecture.md and uses it to create the intent.
 */
export class CreateIntentTool extends BaseTool<"create_intent"> {
	readonly name = "create_intent" as const

	async execute(params: CreateIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { prompt, intent_id, intent_name, owned_scope, constraints, acceptance_criteria } = params
		const { pushToolResult, handleError, askApproval } = callbacks

		try {
			if (!prompt) {
				task.consecutiveMistakeCount++
				task.recordToolError("create_intent")
				pushToolResult(await task.sayAndCreateMissingParamError("create_intent", "prompt"))
				return
			}

			// Initialize orchestration data model
			const dataModel = new OrchestrationDataModel(task.cwd)
			await dataModel.initialize()

			// Check if docs/Architecture.md exists
			const archPath = path.join(task.cwd, "docs", "Architecture.md")
			let archExists = false
			try {
				await fs.access(archPath)
				archExists = true
			} catch {
				archExists = false
			}

			// If docs/Architecture.md doesn't exist, show clear error
			if (!archExists) {
				const errorJson = JSON.stringify(
					{
						error_type: "architecture_missing",
						message:
							"docs/Architecture.md is required but not found. Please create docs/Architecture.md with your project architecture and come again.",
						details: {
							required_file: "docs/Architecture.md",
							reason: "file_not_found",
							required_action: "create_architecture_file",
							instructions: [
								"Create docs/Architecture.md file in your project root",
								"Document your project structure, directory layout, and intent areas",
								"Then try create_intent again",
							],
						},
						recoverable: true,
						suggested_action: "Create docs/Architecture.md file with project architecture, then try again",
					},
					null,
					2,
				)
				pushToolResult(errorJson)
				return
			}

			// Read docs/Architecture.md
			let architectureContent = ""
			try {
				architectureContent = await fs.readFile(archPath, "utf-8")
			} catch (error) {
				await handleError("reading architecture.md", error as Error)
				return
			}

			// Read existing intents to generate next ID
			const intentsData = await dataModel.readActiveIntents()
			const existingIds = intentsData.active_intents.map((i) => i.id)

			// Generate intent ID if not provided
			let finalIntentId = intent_id
			if (!finalIntentId) {
				// Find the highest INT-XXX number and increment
				const maxNum = existingIds
					.map((id) => {
						const match = id.match(/^INT-(\d+)$/)
						return match ? parseInt(match[1], 10) : 0
					})
					.reduce((max, num) => Math.max(max, num), 0)
				finalIntentId = `INT-${String(maxNum + 1).padStart(3, "0")}`
			}

			// Check if intent ID already exists
			if (existingIds.includes(finalIntentId)) {
				task.consecutiveMistakeCount++
				task.recordToolError("create_intent")
				const errorJson = JSON.stringify(
					{
						error_type: "intent_id_exists",
						message: `Intent ID "${finalIntentId}" already exists. Please use a different ID.`,
						details: {
							requested_intent_id: finalIntentId,
							available_intent_ids: existingIds,
						},
						recoverable: true,
						suggested_action: `Use a different intent ID. Available IDs: ${existingIds.join(", ")}`,
					},
					null,
					2,
				)
				pushToolResult(errorJson)
				return
			}

			// Generate intent name if not provided
			const finalIntentName =
				intent_name || `${finalIntentId} — ${prompt.substring(0, 50)}${prompt.length > 50 ? "..." : ""}`

			// Build the intent based on prompt and docs/Architecture.md
			// For now, we'll create a basic intent structure
			// The agent can refine it based on docs/Architecture.md content
			const newIntent: ActiveIntent = {
				id: finalIntentId,
				name: finalIntentName,
				status: "IN_PROGRESS",
				owned_scope: owned_scope || this.inferScopeFromPrompt(prompt, architectureContent),
				constraints: constraints || this.inferConstraintsFromPrompt(prompt, architectureContent),
				acceptance_criteria:
					acceptance_criteria || this.inferAcceptanceCriteriaFromPrompt(prompt, architectureContent),
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			}

			// Ask user for approval before creating the intent
			const approvalMessage = JSON.stringify({
				tool: "createIntent",
				intent_id: newIntent.id,
				intent_name: newIntent.name,
				owned_scope: newIntent.owned_scope,
				constraints: newIntent.constraints,
				acceptance_criteria: newIntent.acceptance_criteria,
			})

			const didApprove = await askApproval("tool", approvalMessage)
			if (!didApprove) {
				pushToolResult("User declined to create the intent.")
				return
			}

			// Write the intent to active_intents.yaml
			await dataModel.updateIntent(newIntent)

			// Reset mistake count on success
			task.consecutiveMistakeCount = 0

			// Return success message
			const result =
				`Intent created successfully:\n\n` +
				`ID: ${newIntent.id}\n` +
				`Name: ${newIntent.name}\n` +
				`Status: ${newIntent.status}\n` +
				`Owned Scope:\n${newIntent.owned_scope.map((s) => `  - ${s}`).join("\n")}\n` +
				`\nYou can now call select_active_intent(${newIntent.id}) to activate this intent before making code changes.`

			pushToolResult(result)
		} catch (error) {
			await handleError("creating intent", error as Error)
		}
	}

	/**
	 * Infer scope patterns from prompt and docs/Architecture.md
	 */
	private inferScopeFromPrompt(prompt: string, architectureContent: string): string[] {
		const scope: string[] = []

		// Try to extract file paths or directories from the prompt
		const pathMatches = prompt.match(/(?:src|lib|app|components|api|utils|hooks|core|shared)\/[^\s,]+/g)
		if (pathMatches) {
			// Convert specific files to directory patterns
			pathMatches.forEach((match) => {
				if (match.includes(".")) {
					// It's a file, convert to directory pattern
					const dir = match.substring(0, match.lastIndexOf("/"))
					scope.push(`${dir}/**`)
				} else {
					// It's already a directory
					scope.push(`${match}/**`)
				}
			})
		}

		// If no scope found, use a default based on common patterns
		if (scope.length === 0) {
			// Try to infer from prompt keywords
			if (prompt.toLowerCase().includes("api") || prompt.toLowerCase().includes("endpoint")) {
				scope.push("src/api/**")
			} else if (prompt.toLowerCase().includes("component") || prompt.toLowerCase().includes("ui")) {
				scope.push("src/components/**")
			} else if (prompt.toLowerCase().includes("hook") || prompt.toLowerCase().includes("hook system")) {
				scope.push("src/hooks/**")
			} else {
				// Default to src/** if nothing specific
				scope.push("src/**")
			}
		}

		// Remove duplicates
		return [...new Set(scope)]
	}

	/**
	 * Infer constraints from prompt and docs/Architecture.md
	 */
	private inferConstraintsFromPrompt(prompt: string, architectureContent: string): string[] {
		const constraints: string[] = []

		// Add common constraints based on prompt keywords
		if (prompt.toLowerCase().includes("test") || prompt.toLowerCase().includes("testing")) {
			constraints.push("Must include unit tests")
		}
		if (prompt.toLowerCase().includes("api") || prompt.toLowerCase().includes("endpoint")) {
			constraints.push("Must follow REST API conventions")
		}
		if (prompt.toLowerCase().includes("hook") || prompt.toLowerCase().includes("hook system")) {
			constraints.push("Must integrate with existing hook system")
		}

		// If no constraints inferred, add a default
		if (constraints.length === 0) {
			constraints.push("Must follow project architecture and coding standards")
		}

		return constraints
	}

	/**
	 * Infer acceptance criteria from prompt and docs/Architecture.md
	 */
	private inferAcceptanceCriteriaFromPrompt(prompt: string, architectureContent: string): string[] {
		const criteria: string[] = []

		// Add basic acceptance criteria
		criteria.push(
			`Implementation matches the requirements: ${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}`,
		)
		criteria.push("Code follows project architecture and coding standards")
		criteria.push("All tests pass (if applicable)")

		return criteria
	}

	override async handlePartial(task: Task, block: ToolUse<"create_intent">): Promise<void> {
		// No partial handling needed for intent creation
	}
}

export const createIntentTool = new CreateIntentTool()
