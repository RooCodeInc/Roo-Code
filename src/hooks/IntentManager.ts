import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "js-yaml"
import { WBSContext } from "./types"

export class IntentManager {
	private activeIntent: WBSContext | null = null
	private orchestrationPath = path.join(process.cwd(), ".orchestration", "active_intents.yaml")

	/**
	 * Stage 1: The Handshake.
	 * Loads the What-Boundaries-Success (WBS) framework constraints
	 * for the selected requirement (Bora, 2024).
	 */
	async loadIntentContext(intentId: string): Promise<string> {
		try {
			const fileContent = await fs.readFile(this.orchestrationPath, "utf8")
			const data: any = yaml.load(fileContent)

			const intent = data.active_intents.find((i: any) => i.id === intentId)

			if (!intent) {
				throw new Error(`Intent ID ${intentId} not found in .orchestration/active_intents.yaml`)
			}

			this.activeIntent = intent

			// Inject Level 3 Black-Box Functional Model constraints (Navarro et al., 2001)
			return `<intent_context>
ID: ${intent.id}
WHAT: ${intent.what.join(", ")}
BOUNDARIES: ${intent.constraints.join(", ")}
SUCCESS: ${intent.acceptance_criteria.join(", ")}
OWNED_SCOPE: ${intent.owned_scope.join(", ")}
</intent_context>`
		} catch (error: any) {
			throw new Error(`Intent Handshake Failed: ${error.message}`)
		}
	}

	/**
	 * Returns the ID of the currently active intent, or null if none.
	 */
	getActiveIntent(): string | null {
		return this.activeIntent?.id || null
	}

	/**
	 * Scope Enforcement: Verifies if the target file is within
	 * the authorized 'owned_scope' of the active intent.
	 */
	verifyScope(targetPath: string): void {
		if (!this.activeIntent) return

		// Simplified glob matching; implement full 'picomatch' or 'minimatch' for production
		const isAuthorized = this.activeIntent.owned_scope.some((pattern) =>
			targetPath.includes(pattern.replace("/**", "")),
		)

		if (!isAuthorized) {
			throw new Error(`Scope Violation: Intent ${this.activeIntent.id} is not authorized to edit ${targetPath}`)
		}
	}
}
