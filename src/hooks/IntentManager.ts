import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "js-yaml"
import { WBSContext } from "./types"

export class IntentManager {
	private activeIntent: WBSContext | null = null
	private orchestrationPath = path.join(process.cwd(), ".orchestration", "active_intents.yaml")

	async loadIntentContext(intentId: string): Promise<string> {
		try {
			const fileContent = await fs.readFile(this.orchestrationPath, "utf8")
			const data: any = yaml.load(fileContent)

			if (!data?.active_intents) {
				throw new Error("No active_intents section found in YAML")
			}

			const intent = data.active_intents.find((i: any) => i.id === intentId)

			if (!intent) {
				throw new Error(`Intent ID ${intentId} not found in .orchestration/active_intents.yaml`)
			}

			// Ensure all arrays are properly typed
			const what: string[] = Array.isArray(intent.what) ? intent.what : [String(intent.what)]
			const constraints: string[] = Array.isArray(intent.constraints)
				? intent.constraints
				: [String(intent.constraints)]
			const acceptance_criteria: string[] = Array.isArray(intent.acceptance_criteria)
				? intent.acceptance_criteria
				: [String(intent.acceptance_criteria)]
			const owned_scope: string[] = Array.isArray(intent.owned_scope)
				? intent.owned_scope
				: [String(intent.owned_scope)]

			// Map to full WBSContext type
			this.activeIntent = {
				id: intent.id,
				what,
				constraints,
				acceptance_criteria,
				owned_scope,
				boundaries: constraints,
				success: acceptance_criteria,
			} as WBSContext

			return `<intent_context>
ID: ${intent.id}
WHAT: ${what.join(", ")}
BOUNDARIES: ${constraints.join(", ")}
SUCCESS: ${acceptance_criteria.join(", ")}
OWNED_SCOPE: ${owned_scope.join(", ")}
</intent_context>`
		} catch (error: any) {
			throw new Error(`Intent Handshake Failed: ${error.message}`)
		}
	}

	getActiveIntent(): string | null {
		return this.activeIntent?.id || null
	}

	verifyScope(targetPath: string): void {
		if (!this.activeIntent) return

		const ownedScope: string[] = this.activeIntent.owned_scope ?? []

		const isAuthorized = ownedScope.some((pattern: string) => targetPath.includes(pattern.replace("/**", "")))

		if (!isAuthorized) {
			throw new Error(`Scope Violation: Intent ${this.activeIntent.id} is not authorized to edit ${targetPath}`)
		}
	}
}
