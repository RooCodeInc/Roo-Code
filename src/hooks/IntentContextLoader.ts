/**
 * IntentContextLoader.ts — Pre-Hook for select_active_intent Tool
 *
 * This module implements the Context Loader — the core of Phase 1's
 * "Handshake" protocol. When the AI agent calls select_active_intent(intent_id),
 * this hook:
 *
 *   1. Reads .orchestration/active_intents.yaml from the workspace root
 *   2. Parses it using js-yaml
 *   3. Finds the matching intent by ID
 *   4. Constructs an <intent_context> XML block containing:
 *      - Intent name and status
 *      - Constraints (architectural rules the agent must follow)
 *      - Owned scope (file globs the agent is authorized to modify)
 *      - Acceptance criteria (Definition of Done)
 *   5. Returns this block as the tool result, so the AI sees it in
 *      its next message and uses it to guide all subsequent actions
 *
 * The XML format is chosen because LLMs parse XML reliably and it creates
 * a clear, structured boundary in the conversation context.
 *
 * @see HookEngine.ts — registers this hook
 * @see types.ts — IntentEntry, ActiveIntentsFile interfaces
 * @see TRP1 Challenge Week 1, Phase 1: Context Injection Hook
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { parse as parseYaml } from "yaml"

import type { HookContext, PreHookResult, ActiveIntentsFile, IntentEntry } from "./types"
import type { HookEngine } from "./HookEngine"

export class IntentContextLoader {
	/**
	 * Execute the context loader hook.
	 * Only activates for select_active_intent tool calls.
	 *
	 * @param ctx    - The hook context (tool name, params, cwd)
	 * @param engine - The HookEngine instance (for setting session state)
	 * @returns PreHookResult — "inject" with XML context, or "allow" for other tools
	 */
	static async execute(ctx: HookContext, engine: HookEngine): Promise<PreHookResult> {
		// Only intercept select_active_intent calls
		if (ctx.toolName !== "select_active_intent") {
			return { action: "allow" }
		}

		const intentId = (ctx.params as { intent_id?: string }).intent_id

		// Validate that intent_id parameter was provided
		if (!intentId || intentId.trim().length === 0) {
			return {
				action: "block",
				toolResult:
					"[Intent Error] Missing required parameter: intent_id. " +
					"You must provide a valid intent ID from .orchestration/active_intents.yaml.",
			}
		}

		try {
			// Step 1: Read the active_intents.yaml file from workspace root
			const intentsFilePath = path.join(ctx.cwd, ".orchestration", "active_intents.yaml")
			const intents = await IntentContextLoader.readIntentsFile(intentsFilePath)

			// Step 2: Find the matching intent by ID
			const matchingIntent = intents.active_intents.find((intent) => intent.id === intentId.trim())

			if (!matchingIntent) {
				// List available intents to help the agent self-correct
				const availableIds = intents.active_intents
					.map((i) => `  - ${i.id}: ${i.name} [${i.status}]`)
					.join("\n")

				return {
					action: "block",
					toolResult:
						`[Intent Error] No intent found with ID "${intentId}". ` +
						`Available intents:\n${availableIds}\n\n` +
						`Please call select_active_intent with a valid intent_id.`,
				}
			}

			// Step 3: Build the <intent_context> XML block
			const contextXml = IntentContextLoader.buildIntentContextXml(matchingIntent)

			// Step 4: Store the active intent in session state
			engine.setActiveIntentId(matchingIntent.id)
			engine.setIntentContextXml(contextXml)

			console.log(`[IntentContextLoader] Activated intent: ${matchingIntent.id} — ${matchingIntent.name}`)

			// Step 5: Return the XML block as the tool result
			// The AI will see this in its next turn and use it to guide actions
			return {
				action: "inject",
				toolResult: contextXml,
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error"

			// Distinguish between "file not found" and other errors
			if (errorMessage.includes("ENOENT") || errorMessage.includes("no such file")) {
				return {
					action: "block",
					toolResult:
						`[Intent Error] File not found: .orchestration/active_intents.yaml\n\n` +
						`This file must exist at the workspace root to use intent-driven architecture.\n` +
						`Please ask the user to create .orchestration/active_intents.yaml with their intent definitions.`,
				}
			}

			return {
				action: "block",
				toolResult: `[Intent Error] Failed to load intent context: ${errorMessage}`,
			}
		}
	}

	// ── Private Helpers ──────────────────────────────────────────────────

	/**
	 * Read and parse the active_intents.yaml file.
	 * Uses Node.js fs (synchronous for simplicity; file is small).
	 *
	 * @param filePath - Absolute path to active_intents.yaml
	 * @returns Parsed ActiveIntentsFile object
	 * @throws Error if file doesn't exist or YAML is malformed
	 */
	private static async readIntentsFile(filePath: string): Promise<ActiveIntentsFile> {
		// Read file contents
		const raw = fs.readFileSync(filePath, "utf-8")

		// Parse YAML
		const parsed = parseYaml(raw) as ActiveIntentsFile

		// Validate structure
		if (!parsed || !Array.isArray(parsed.active_intents)) {
			throw new Error(
				"Malformed active_intents.yaml: expected root key 'active_intents' with an array of intent entries.",
			)
		}

		return parsed
	}

	/**
	 * Build the <intent_context> XML block for the selected intent.
	 *
	 * This XML structure is injected into the conversation so the AI agent
	 * has immediate access to constraints, scope boundaries, and acceptance
	 * criteria. The XML format was chosen because:
	 *   - LLMs parse XML tags reliably
	 *   - It creates a visual boundary in the context window
	 *   - It's easily extensible for Phase 3 (agent trace metadata)
	 *
	 * @param intent - The matched IntentEntry from active_intents.yaml
	 * @returns Formatted XML string
	 */
	static buildIntentContextXml(intent: IntentEntry): string {
		const constraintsXml = intent.constraints.map((c) => `    <constraint>${escapeXml(c)}</constraint>`).join("\n")

		const scopeXml = intent.owned_scope.map((s) => `    <path>${escapeXml(s)}</path>`).join("\n")

		const criteriaXml = intent.acceptance_criteria
			.map((a) => `    <criterion>${escapeXml(a)}</criterion>`)
			.join("\n")

		return `<intent_context>
  <intent id="${escapeXml(intent.id)}" name="${escapeXml(intent.name)}" status="${escapeXml(intent.status)}">
    <constraints>
${constraintsXml}
    </constraints>
    <owned_scope>
${scopeXml}
    </owned_scope>
    <acceptance_criteria>
${criteriaXml}
    </acceptance_criteria>
  </intent>
  <instruction>
    You are now operating under Intent "${escapeXml(intent.id)}: ${escapeXml(intent.name)}".
    You MUST respect all constraints listed above.
    You may ONLY modify files matching the owned_scope patterns.
    Your work is complete when ALL acceptance_criteria are satisfied.
    Any tool call outside the owned_scope will be BLOCKED by the Gatekeeper.
  </instruction>
</intent_context>`
	}
}

// ── Utility ──────────────────────────────────────────────────────────────

/**
 * Escape special characters for XML content to prevent injection.
 */
function escapeXml(str: string): string {
	return str
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;")
}
