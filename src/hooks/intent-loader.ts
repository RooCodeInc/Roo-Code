/**
 * Intent context loader for .orchestration/active_intents.yaml
 *
 * This module loads intent context from the orchestration layer and formats it
 * for injection into the LLM prompt. Intents provide structured context about
 * what the agent is working on, related files, and objectives.
 */

import * as vscode from "vscode"
import * as yaml from "yaml"
import * as path from "path"
import type { IntentContext } from "./types"

/**
 * Extended Intent interface matching active_intents.yaml schema
 */
interface Intent {
	id: string
	name: string
	status: "active" | "completed" | "blocked" | "pending"
	owned_scope?: string[]
	constraints?: string[]
	acceptance_criteria?: string[]
	context?: string
	related_files?: string[]
	metadata?: Record<string, unknown>
}

/**
 * Loads intent context from .orchestration/active_intents.yaml
 *
 * @param intentId - The intent identifier selected by the agent
 * @returns XML-formatted context block for prompt injection
 *
 * @example
 * const context = await loadIntentContext("INTENT-001")
 * // Returns: <intent_context intent_id="INTENT-001">...</intent_context>
 */
export async function loadIntentContext(intentId: string): Promise<string> {
	try {
		const intent = await findIntentById(intentId)
		if (!intent) {
			return `<intent_context intent_id="${intentId}" error="Intent not found"></intent_context>`
		}

		return formatIntentAsXml({
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
		})
	} catch (error) {
		console.error("[loadIntentContext] Error:", error)
		return `<intent_context intent_id="${intentId}" error="${error instanceof Error ? error.message : String(error)}"></intent_context>`
	}
}

/**
 * Parses intent metadata from .orchestration/active_intents.yaml
 *
 * @param cwd - Workspace root directory
 * @returns Array of available intents
 *
 * @example
 * const intents = await parseActiveIntents("/workspace")
 * console.log(intents.map(i => i.intentId))
 */
export async function parseActiveIntents(cwd: string): Promise<IntentContext[]> {
	try {
		const intents = await readActiveIntents(cwd)
		return intents.map((intent) => ({
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
		}))
	} catch (error) {
		console.error("[parseActiveIntents] Error:", error)
		return []
	}
}

/**
 * Formats an IntentContext into XML for prompt injection.
 *
 * @param intent - The intent context to format
 * @returns XML string ready for prompt injection
 *
 * @example
 * const intent = { intentId: "INTENT-001", title: "Fix auth bug", context: "..." }
 * const xml = formatIntentAsXml(intent)
 * // Returns: <intent_context intent_id="INTENT-001"><title>Fix auth bug</title>...</intent_context>
 */
export function formatIntentAsXml(intent: IntentContext): string {
	// TODO: Implementation for Phase 1

	const parts: string[] = [
		`<intent_context intent_id="${escapeXml(intent.intentId)}">`,
		`  <title>${escapeXml(intent.title)}</title>`,
		`  <context>${escapeXml(intent.context)}</context>`,
	]

	if (intent.files && intent.files.length > 0) {
		parts.push(`  <related_files>`)
		for (const file of intent.files) {
			parts.push(`    <file>${escapeXml(file)}</file>`)
		}
		parts.push(`  </related_files>`)
	}

	if (intent.metadata) {
		parts.push(`  <metadata>`)
		for (const [key, value] of Object.entries(intent.metadata)) {
			parts.push(`    <${key}>${escapeXml(String(value))}</${key}>`)
		}
		parts.push(`  </metadata>`)
	}

	parts.push(`</intent_context>`)

	return parts.join("\n")
}

/**
 * Escapes special XML characters.
 * @internal
 */
function escapeXml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;")
}

/**
 * Reads and parses active_intents.yaml from .orchestration directory
 *
 * @param cwd - Workspace root directory (optional, uses vscode workspace if not provided)
 * @returns Array of Intent objects
 */
export async function readActiveIntents(cwd?: string): Promise<Intent[]> {
	try {
		const workspaceFolder = cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
		if (!workspaceFolder) {
			throw new Error("No workspace folder found")
		}

		const intentFilePath = path.join(workspaceFolder, ".orchestration", "active_intents.yaml")
		const uri = vscode.Uri.file(intentFilePath)

		// Check if file exists
		try {
			await vscode.workspace.fs.stat(uri)
		} catch {
			// File doesn't exist, return empty array
			return []
		}

		// Read file content
		const fileContent = await vscode.workspace.fs.readFile(uri)
		const yamlContent = Buffer.from(fileContent).toString("utf-8")

		// Parse YAML
		const parsed = yaml.parse(yamlContent)

		// Handle both array and object formats
		if (Array.isArray(parsed)) {
			return parsed as Intent[]
		} else if (parsed && typeof parsed === "object" && "intents" in parsed) {
			return (parsed as { intents: Intent[] }).intents
		}

		return []
	} catch (error) {
		console.error("[readActiveIntents] Error:", error)
		return []
	}
}

/**
 * Finds a specific intent by ID
 *
 * @param intentId - The intent ID to search for
 * @param cwd - Workspace root directory (optional)
 * @returns The matching Intent or null if not found
 */
export async function findIntentById(intentId: string, cwd?: string): Promise<Intent | null> {
	const intents = await readActiveIntents(cwd)
	return intents.find((intent) => intent.id === intentId) || null
}

/**
 * Checks if intent context is available for the current workspace.
 *
 * @param cwd - Workspace root directory
 * @returns true if .orchestration/active_intents.yaml exists
 *
 * @example
 * if (await hasIntentContext("/workspace")) {
 *   const intents = await parseActiveIntents("/workspace")
 * }
 */
export async function hasIntentContext(cwd: string): Promise<boolean> {
	try {
		const intentFilePath = path.join(cwd, ".orchestration", "active_intents.yaml")
		const uri = vscode.Uri.file(intentFilePath)
		await vscode.workspace.fs.stat(uri)
		return true
	} catch {
		return false
	}
}

/**
 * Validates if a file path is within the owned_scope of an intent.
 * Uses glob pattern matching to check scope authorization.
 *
 * @param filePath - Relative file path to validate
 * @param intent - Intent with owned_scope patterns
 * @returns true if file is within scope, false otherwise
 *
 * @example
 * const intent = { owned_scope: ["src/auth/**", "src/middleware/jwt.ts"] }
 * const valid = validateIntentScope("src/auth/login.ts", intent)  // true
 * const invalid = validateIntentScope("src/database/user.ts", intent)  // false
 */
export function validateIntentScope(filePath: string, intent: Intent): boolean {
	if (!intent.owned_scope || intent.owned_scope.length === 0) {
		return false // No scope defined = no access
	}

	// Normalize file path (remove leading ./ or /)
	const normalizedPath = filePath.replace(/^\.?\//, "")

	return intent.owned_scope.some((pattern) => {
		// Convert glob pattern to regex
		const regexPattern = pattern
			.replace(/\*\*/g, ".*") // ** matches any depth
			.replace(/\*/g, "[^/]*") // * matches within directory
			.replace(/\?/g, ".") // ? matches single character

		const regex = new RegExp(`^${regexPattern}$`)
		return regex.test(normalizedPath)
	})
}
