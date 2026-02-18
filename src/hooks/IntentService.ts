import * as fs from "fs"
import * as path from "path"
import * as yaml from "js-yaml"
import { Intent } from "./types"

export class IntentService {
	private activeIntent: Intent | null = null

	constructor(private workspaceRoot: string) {}

	loadIntents(): Intent[] {
		const filePath = path.join(this.workspaceRoot, ".orchestration", "active_intents.yaml")

		const file = fs.readFileSync(filePath, "utf8")
		const data = yaml.load(file) as any

		return data.active_intents || []
	}

	selectIntent(intentId: string): Intent {
		const intents = this.loadIntents()
		const intent = intents.find((i: Intent) => i.id === intentId)

		if (!intent) {
			throw new Error(`Invalid intent ID: ${intentId}`)
		}

		this.activeIntent = intent
		return intent
	}

	getActiveIntent(): Intent | null {
		return this.activeIntent
	}
}
