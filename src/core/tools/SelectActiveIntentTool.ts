import { BaseTool, type ToolCallbacks } from "./BaseTool"
import type { Task } from "../task/Task"
import { loadIntentContext, findIntentById, readActiveIntents, formatIntentAsXml } from "../../hooks"
import type { IntentContext } from "../../hooks/types"
import { formatResponse } from "../prompts/responses"

/**
 * Parameters for select_active_intent tool
 */
interface SelectActiveIntentParams {
	intent_id: string
}

/**
 * Session intent storage (maps task ID to active intent ID)
 * In production, this could be persisted to disk or extension state
 */
const sessionIntents = new Map<string, string>()

/**
 * Store intent ID for a session
 * @param sessionId - The session/task identifier
 * @param intentId - The intent ID to store
 */
export async function setSessionIntent(sessionId: string, intentId: string): Promise<void> {
	sessionIntents.set(sessionId, intentId)
}

/**
 * Get the active intent ID for a session
 * @param sessionId - The session/task identifier
 * @returns The active intent ID, or undefined if not set
 */
export function getSessionIntent(sessionId: string): string | undefined {
	return sessionIntents.get(sessionId)
}

/**
 * Clear the active intent for a session
 * @param sessionId - The session/task identifier
 */
export function clearSessionIntent(sessionId: string): void {
	sessionIntents.delete(sessionId)
}

/**
 * Standalone handler function for select_active_intent tool
 *
 * @param intent_id - The intent ID from .orchestration/active_intents.yaml
 * @param sessionId - The session/task identifier
 * @param cwd - Workspace directory path
 * @returns XML-formatted intent context or error message
 */
export async function handleSelectActiveIntent(intent_id: string, sessionId: string, cwd?: string): Promise<string> {
	const workingDir = cwd || process.cwd()
	try {
		// 1. Read .orchestration/active_intents.yaml
		const intents = await readActiveIntents(workingDir)

		if (!intents || intents.length === 0) {
			return `<error>No intents found in .orchestration/active_intents.yaml</error>`
		}

		// 2. Find matching intent by ID
		const intent = await findIntentById(intent_id, workingDir)
		if (!intent) {
			return `<error>Intent not found: ${intent_id}. Available intents: ${intents.map((i) => i.id).join(", ")}</error>`
		}

		// 3. Format as XML for prompt injection
		// Convert Intent to IntentContext format
		const intentContext: IntentContext = {
			intentId: intent.id,
			title: intent.name,
			context: intent.context || "",
			files: intent.related_files,
			metadata: {
				status: intent.status,
				owned_scope: intent.owned_scope,
				constraints: intent.constraints,
				acceptance_criteria: intent.acceptance_criteria,
				...intent.metadata,
			},
		}
		const xmlContext = formatIntentAsXml(intentContext)

		// 4. Store in session state for later validation
		await setSessionIntent(sessionId, intent_id)

		// 5. Return XML block for prompt injection
		return xmlContext
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		return `<error>Failed to load intent: ${errorMessage}</error>`
	}
}

/**
 * SelectActiveIntentTool - Load intent context before code modifications
 *
 * This tool is MANDATORY before any write operations. It:
 * 1. Validates the intent exists in .orchestration/active_intents.yaml
 * 2. Loads architectural constraints and scope
 * 3. Stores the active intent_id in task state
 * 4. Injects context into subsequent LLM prompts
 *
 * Benefits:
 * - Enforces scope constraints (owned_scope globs)
 * - Provides architectural guidance
 * - Enables traceability (intent_id in agent traces)
 * - Prevents scope creep
 */
export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	async execute(params: SelectActiveIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		try {
			const { intent_id } = params

			// Validate intent_id format
			if (!intent_id || intent_id.trim().length === 0) {
				await task.say("error", "Error: intent_id cannot be empty")
				callbacks.pushToolResult(formatResponse.toolError("Error: intent_id cannot be empty"))
				return
			}

			// Use the standalone handler function
			const sessionId = task.taskId
			const result = await handleSelectActiveIntent(intent_id, sessionId, task.cwd)

			// Check if result is an error
			if (result.includes("<error>")) {
				const errorMessage = result.replace(/<\/?error>/g, "")
				await task.say("error", errorMessage)
				callbacks.pushToolResult(formatResponse.toolError(errorMessage))
				return
			}

			// Find the intent for success message
			const intent = await findIntentById(intent_id, task.cwd)
			if (!intent) {
				throw new Error("Intent was found but disappeared during processing")
			}

			// Store active intent in task state (for PreToolUse hooks to validate)
			task.setActiveIntentId(intent_id)

			// Return success with intent summary
			const successMessage = `✓ Intent "${intent.name}" (${intent_id}) activated

Status: ${intent.status}
Scope: ${intent.owned_scope?.join(", ") || "No scope restrictions"}
${intent.constraints && intent.constraints.length > 0 ? `\nConstraints:\n${intent.constraints.map((c) => `  • ${c}`).join("\n")}` : ""}
${intent.acceptance_criteria && intent.acceptance_criteria.length > 0 ? `\nAcceptance Criteria:\n${intent.acceptance_criteria.map((c) => `  ☐ ${c}`).join("\n")}` : ""}

Context loaded successfully. You can now proceed with code modifications.`

			await task.say("tool", successMessage)
			callbacks.pushToolResult(formatResponse.toolResult(successMessage))
		} catch (error) {
			await callbacks.handleError(
				"selecting active intent",
				error instanceof Error ? error : new Error(String(error)),
			)
		}
	}
}
