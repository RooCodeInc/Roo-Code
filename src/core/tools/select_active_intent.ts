import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import * as yaml from "yaml"

// Define the structure of an Intent
interface Intent {
	id: string
	name: string
	description?: string
	status: string
	ownedScope: string[]
	constraints: string[]
	acceptanceCriteria: string[]
	metadata?: Record<string, any>
}

// Define the structure of the tool's response
interface SelectActiveIntentResult {
	success: boolean
	intent?: Intent
	context?: string
	error?: string
	recovery?: string
}

/**
 * Tool: select_active_intent
 *
 * Purpose: Allows the AI agent to select an intent before making any changes.
 * This MUST be called before any file writes or destructive operations.
 *
 * How it works:
 * 1. Agent calls with intent_id (e.g., "INT-001")
 * 2. Tool reads .orchestration/active_intents.yaml
 * 3. Finds the matching intent
 * 4. Returns the intent details and context to the agent
 * 5. The session now has an "active intent" for future operations
 */
export async function selectActiveIntent(
	intentId: string,
	session: any, // The current session object
): Promise<SelectActiveIntentResult> {
	try {
		// 1. Get the workspace path
		const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
		if (!workspacePath) {
			return {
				success: false,
				error: "No workspace folder open",
				recovery: "Please open a workspace folder first.",
			}
		}

		// 2. Path to the intents file
		const intentsPath = path.join(workspacePath, ".orchestration", "active_intents.yaml")

		// 3. Check if file exists
		try {
			await fs.access(intentsPath)
		} catch {
			return {
				success: false,
				error: `active_intents.yaml not found at ${intentsPath}`,
				recovery: "Please create .orchestration/active_intents.yaml with your intents.",
			}
		}

		// 4. Read and parse the YAML file
		const fileContent = await fs.readFile(intentsPath, "utf8")
		const data = yaml.parse(fileContent) as { intents: Intent[] }

		if (!data || !data.intents) {
			return {
				success: false,
				error: "Invalid active_intents.yaml format",
				recovery: 'File should contain an "intents:" array.',
			}
		}

		// 5. Find the requested intent
		const intent = data.intents.find((i) => i.id === intentId)

		if (!intent) {
			// List available intents to help the agent
			const availableIntents = data.intents.map((i) => i.id).join(", ")
			return {
				success: false,
				error: `Intent ${intentId} not found`,
				recovery: `Available intents: ${availableIntents}. Please select one of these.`,
			}
		}

		// 6. Check if intent is active (not completed/blocked)
		if (intent.status === "COMPLETED") {
			return {
				success: false,
				error: `Intent ${intentId} is already COMPLETED`,
				recovery: "Please select an intent with status IN_PROGRESS or PLANNED.",
			}
		}

		// 7. Build the context block for the agent
		const contextBlock = buildIntentContext(intent)

		// 8. Store the active intent in the session
		if (session) {
			session.activeIntent = {
				id: intent.id,
				name: intent.name,
				scope: intent.ownedScope,
				constraints: intent.constraints,
			}
		}

		// 9. Return success with intent details
		return {
			success: true,
			intent: intent,
			context: contextBlock,
		}
	} catch (error) {
		console.error("Error in selectActiveIntent:", error)
		return {
			success: false,
			error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
			recovery: "Please try again or check the console for details.",
		}
	}
}

/**
 * Build a formatted context block for the agent
 * This gets injected into the agent's context so it knows the rules
 */
function buildIntentContext(intent: Intent): string {
	const scopeList = intent.ownedScope.map((s) => `    <pattern>${s}</pattern>`).join("\n")
	const constraintsList = intent.constraints.map((c) => `    <constraint>${c}</constraint>`).join("\n")
	const criteriaList = intent.acceptanceCriteria.map((c) => `    <criterion>${c}</criterion>`).join("\n")

	return `
<active_intent_context id="${intent.id}">
  <name>${intent.name}</name>
  <status>${intent.status}</status>
  
  <description>${intent.description || "No description provided"}</description>
  
  <scope>
${scopeList}
  </scope>
  
  <constraints>
${constraintsList}
  </constraints>
  
  <acceptance_criteria>
${criteriaList}
  </acceptance_criteria>
  
  <instructions>
You are now working on intent ${intent.id}.
- You may ONLY modify files that match the scope patterns above
- You MUST follow all constraints listed above
- You are DONE when all acceptance criteria are met
- All changes will be logged with this intent ID
  </instructions>
</active_intent_context>
    `
}

/**
 * Helper function to check if a file is in the intent's scope
 * This will be used by other tools (like write_to_file) to validate changes
 */
export function isFileInIntentScope(filePath: string, intentScope: string[]): boolean {
	// Convert to relative path from workspace root
	const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ""
	const relativePath = path.relative(workspacePath, filePath).replace(/\\/g, "/")

	// Check each scope pattern
	for (const pattern of intentScope) {
		// Handle exclusion patterns (starting with !)
		if (pattern.startsWith("!")) {
			const excludePattern = pattern.substring(1)
			if (matchesPattern(relativePath, excludePattern)) {
				return false // Explicitly excluded
			}
		}
		// Handle inclusion patterns
		else if (matchesPattern(relativePath, pattern)) {
			return true // Matched an inclusion pattern
		}
	}

	return false // No patterns matched
}

/**
 * Simple pattern matching (you might want to use a library like minimatch)
 * Supports:
 * - * matches any characters within a path segment
 * - ** matches any characters across path segments
 * - ? matches a single character
 */
function matchesPattern(filePath: string, pattern: string): boolean {
	// Convert glob pattern to regex
	const regexPattern = pattern
		.replace(/\./g, "\\.") // Escape dots
		.replace(/\*\*/g, ".*") // ** becomes .*
		.replace(/\*/g, "[^/]*") // * becomes [^/]* (any chars except /)
		.replace(/\?/g, ".") // ? becomes . (any single char)

	const regex = new RegExp(`^${regexPattern}$`)
	return regex.test(filePath)
}
