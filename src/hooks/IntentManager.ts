import fs from "fs/promises"
import path from "path"
import yaml from "yaml"

interface Intent {
	id: string
	description: string
	scope: string[]
}

export class IntentManager {
	private intentFilePath: string
	private cachedIntents: Intent[] | null = null

	constructor(workspacePath: string) {
		this.intentFilePath = path.join(workspacePath, ".orchestration", "active_intents.yaml")
	}

	async loadIntents(): Promise<Intent[]> {
		try {
			console.log(`[IntentManager] Loading intents from: ${this.intentFilePath}`)
			const content = await fs.readFile(this.intentFilePath, "utf-8")
			console.log(`[IntentManager] File content: ${content}`)
			const parsed = yaml.parse(content)
			console.log(`[IntentManager] Parsed YAML:`, parsed)
			console.log(`[IntentManager] Is array?`, Array.isArray(parsed))
			this.cachedIntents = Array.isArray(parsed) ? parsed : []
			console.log(`[IntentManager] Cached intents:`, this.cachedIntents)
			return this.cachedIntents
		} catch (error) {
			console.log(`[IntentManager] Error loading intents:`, error)
			this.cachedIntents = []
			return []
		}
	}

	async getActiveIntent(): Promise<Intent | null> {
		const intents = this.cachedIntents || (await this.loadIntents())
		return intents[0] || null
	}

	isFileInScope(filePath: string, intent: Intent): boolean {
		if (!intent.scope || intent.scope.length === 0) return true
		return intent.scope.some((pattern) => filePath.includes(pattern))
	}
}
