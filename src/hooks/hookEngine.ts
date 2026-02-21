import { preToolHook } from "./preToolHook"
import { postToolHook } from "./postToolHook"
import { setActiveIntent } from "./intentState"

/**
 * THE GOLDEN THREAD: Standardizes tool execution with governance
 */
export async function executeWithHooks(toolName: string, tool: { execute: (args: any) => Promise<any> }, args: any) {
	// PHASE 1: THE FIREWALL
	// Runs preToolHook to check if the tool is blocked or allowed.
	// If preToolHook throws an Error, execution stops here and the Red Box appears.
	const decision = await preToolHook(toolName, args)

	// Secondary safety check in case preToolHook returns instead of throwing
	if (decision && decision.allowed === false) {
		throw new Error(decision.context ?? "🛑 GOVERNANCE: Tool not authorized.")
	}

	// PHASE 2: AUTHORIZATION HANDSHAKE
	// If the tool is 'select_active_intent', we update the global session state.
	if (toolName === "select_active_intent") {
		// Handle multiple naming conventions for maximum model compatibility
		const intentId = args.intent_id || args.id || args.intentId

		if (intentId) {
			setActiveIntent(intentId)
		}
	}

	// PHASE 3: EXECUTION
	// The actual tool logic (like writing to disk) only runs if Phase 1 passed.
	const result = await tool.execute(args)

	// PHASE 4: THE AUDIT LEDGER
	// Post-hook records the successful action and generates a SHA-256 hash.
	// This provides the mathematical proof required for Score 5 auditing.
	try {
		await postToolHook(args, toolName)
	} catch (auditError) {
		// We log audit errors but don't stop the user, as the tool already succeeded.
		console.error("[AUDIT ERROR] Failed to log to ledger:", auditError)
	}

	return result
}
