import { IntentManager } from "../../../hooks/IntentManager"
import { OrchestrationStorage } from "../../../hooks/OrchestrationStorage"

/**
 * Returns the Intent Governance section for the system prompt.
 * This section explains the intent-first architecture and how to use the select_active_intent tool.
 */
export async function getIntentGovernanceSection(cwd: string): Promise<string> {
	// Use the global IntentManager instance if available, otherwise create a new one
	// This ensures we're using the same instance that manages active intents
	const globalIntentManager = (global as any).__intentManager as IntentManager | undefined
	const intentManager = globalIntentManager || new IntentManager(new OrchestrationStorage())

	// Load available intents from the task's workspace (.orchestration/active_intents.yaml)
	let availableIntents = ""
	try {
		const intents = await intentManager.loadIntents(cwd)
		if (intents.length > 0) {
			availableIntents = "\n\n**Available Intents:**\n"
			for (const intent of intents) {
				availableIntents += `- **${intent.id}**: ${intent.name} (Status: ${intent.status})\n`
				availableIntents += `  - Scope: ${intent.ownedScope.join(", ")}\n`
			}
		}
	} catch (error) {
		// If intents can't be loaded, continue without listing them
		console.warn("[IntentGovernance] Failed to load intents for system prompt:", error)
		availableIntents =
			"\n\n**Note:** No active_intents.yaml file found in this workspace. Create one at `.orchestration/active_intents.yaml` to define available intents."
	}

	return `====

INTENT-FIRST ARCHITECTURE

You operate under an Intent-Governed Hook Middleware system. This means:

**CRITICAL REQUIREMENT**: Before performing ANY destructive operations (write_to_file, execute_command, apply_diff, edit_file, search_replace, apply_patch), you MUST first select an active intent using the select_active_intent tool.

**What is an Intent?**
An intent is a formalized business requirement that defines:
- What files/areas you are authorized to modify (ownedScope)
- What constraints you must follow
- What acceptance criteria define completion

**How to Use Intents:**
1. When a user requests a file modification or command execution, first check if an active intent is already selected for this task.
2. If no intent is active, you MUST use the select_active_intent tool to select an appropriate intent before proceeding.
3. The intent's ownedScope defines which file paths you can modify. Operations outside the scope will be blocked.
4. If no suitable intent exists, inform the user that an intent needs to be created in .orchestration/active_intents.yaml.

**Available Tool:**
- select_active_intent: Selects an active intent by its ID (e.g., "INT-001"). This intent will govern all subsequent destructive operations until a new intent is selected.

**IMPORTANT**: You MUST use the select_active_intent tool directly - do NOT try to use execute_command to select an intent. The select_active_intent tool is a native tool that does not require an active intent to be called. Simply call it with the intent_id parameter.

**Error Handling:**
If you receive an error like "No active intent selected", you must:
1. Use the select_active_intent tool to select an appropriate intent
2. Then retry the operation

**Example Workflow:**
1. User: "Add hello world to index.html"
2. You: Call the select_active_intent tool with {"intent_id": "INT-004"} (or appropriate intent)
3. System: Confirms intent is active
4. You: Use write_to_file to modify index.html (if within scope)
5. System: Validates scope and allows/blocks the operation

**CRITICAL**: Never use execute_command to select an intent. Always use the select_active_intent tool directly.${availableIntents}

====`
}
