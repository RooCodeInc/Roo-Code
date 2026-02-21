import { getActiveIntent, setActiveIntent } from "./intentState"

/**
 * PHASE 1: THE FIREWALL
 * This function intercepts every tool call.
 * To block a tool, it MUST throw a standard Error.
 */
export async function preToolHook(toolName: string, args: any) {
	// 1. THE HANDSHAKE: This is the only way to "unlock" the session
	if (toolName === "select_active_intent") {
		const id = args.intent_id || args.id

		if (!id) {
			throw new Error("Validation Error: 'intent_id' is required for authorization.")
		}

		setActiveIntent(id)
		console.log(`[GOVERNANCE] Session unlocked with Intent: ${id}`)

		// We return a success object to let the engine know it's allowed
		return {
			allowed: true,
			context: `SUCCESS: Governance unlocked for intent "${id}".`,
		}
	}

	// 2. THE RESTRICTED ZONE: List every tool that can modify the system
	const destructiveTools = [
		"write_to_file",
		"apply_diff",
		"insert_content",
		"replace_in_file",
		"execute_command",
		"edit_file",
	]

	// 3. STRICT ENFORCEMENT
	if (destructiveTools.includes(toolName)) {
		const currentIntent = getActiveIntent()

		// If no intent is set, we throw the "Red Box" error
		if (!currentIntent || currentIntent.trim() === "") {
			console.error(`[FIREWALL BLOCK] Unauthorized access attempt: ${toolName}`)

			/**
			 * CRITICAL: This error message is what the AI sees.
			 * It tells the AI EXACTLY why it failed so it can fix itself.
			 */
			throw new Error(
				`🛑 ACCESS DENIED: The tool '${toolName}' is currently locked.\n` +
					`Reason: No active intent found in session state.\n` +
					`Requirement: You must run 'select_active_intent' first to authorize this action.`,
			)
		}

		console.log(`[FIREWALL PASS] Authorized ${toolName} under intent: ${currentIntent}`)
	}

	// 4. SAFE PASSAGE: Tools like 'read_file' or 'list_files' pass through
	return { allowed: true }
}
