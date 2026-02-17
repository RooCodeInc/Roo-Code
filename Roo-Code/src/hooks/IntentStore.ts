import * as fs from "fs"
import * as path from "path"
import * as yaml from "js-yaml"

export interface Intent {
	id: string
	name: string
	status: "PENDING" | "IN_PROGRESS" | "COMPLETE" | "BLOCKED"
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
}

interface ActiveIntentsFile {
	active_intents: Intent[]
}

/**
 * IntentStore manages reading and writing active_intents.yaml.
 * This is the source of truth for all active business intents.
 */
export class IntentStore {
	private readonly filePath: string

	constructor(orchestrationDir: string) {
		this.filePath = path.join(orchestrationDir, "active_intents.yaml")
		this.ensureFile()
	}

	async getIntent(id: string): Promise<Intent | null> {
		const data = this.readFile()
		return data.active_intents.find((i) => i.id === id) ?? null
	}

	async listIntentIds(): Promise<string[]> {
		const data = this.readFile()
		return data.active_intents.map((i) => i.id)
	}

	async listIntents(): Promise<Intent[]> {
		return this.readFile().active_intents
	}

	async updateIntentStatus(id: string, status: Intent["status"]): Promise<void> {
		const data = this.readFile()
		const intent = data.active_intents.find((i) => i.id === id)
		if (intent) {
			intent.status = status
			this.writeFile(data)
		}
	}

	async addIntent(intent: Intent): Promise<void> {
		const data = this.readFile()
		data.active_intents.push(intent)
		this.writeFile(data)
	}

	private readFile(): ActiveIntentsFile {
		try {
			const raw = fs.readFileSync(this.filePath, "utf-8")
			return (yaml.load(raw) as ActiveIntentsFile) || { active_intents: [] }
		} catch {
			return { active_intents: [] }
		}
	}

	private writeFile(data: ActiveIntentsFile): void {
		fs.writeFileSync(this.filePath, yaml.dump(data), "utf-8")
	}

	private ensureFile(): void {
		if (!fs.existsSync(this.filePath)) {
			const scaffold: ActiveIntentsFile = {
				active_intents: [
					{
						id: "INT-001",
						name: "Example Intent — Replace Me",
						status: "PENDING",
						owned_scope: ["src/**"],
						constraints: ["Must not break existing tests"],
						acceptance_criteria: ["All tests pass", "No lint errors"],
					},
				],
			}
			fs.writeFileSync(this.filePath, yaml.dump(scaffold), "utf-8")
		}
	}
}
