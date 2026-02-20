import * as fs from "fs/promises"
import * as path from "path"
import { parse as parseYaml } from "yaml"

const ORCH_DIR = ".orchestration"

export class IntentManager {
	private workspaceRoot: string

	constructor(workspaceRoot: string) {
		this.workspaceRoot = workspaceRoot
	}

	async ensureOrchestrationDir() {
		const dir = path.join(this.workspaceRoot, ORCH_DIR)
		await fs.mkdir(dir, { recursive: true })

		const activePath = path.join(dir, "active_intents.yaml")
		if (!(await fs.stat(activePath).catch(() => false))) {
			const defaultYaml = `active_intents:
  - id: "INT-001"
    name: "Build Weather API Endpoint"
    status: "IN_PROGRESS"
    owned_scope: ["src/api/**", "src/services/**"]
    constraints: ["Use FastAPI", "No external dependencies"]
    acceptance_criteria: ["All tests pass"]`
			await fs.writeFile(activePath, defaultYaml)
		}
	}

	async getIntent(intentId: string) {
		const file = path.join(this.workspaceRoot, ORCH_DIR, "active_intents.yaml")
		const content = await fs.readFile(file, "utf8")
		const data: any = parseYaml(content)
		return data.active_intents?.find((i: any) => i.id === intentId) || null
	}

	async getAllIntents() {
		const file = path.join(this.workspaceRoot, ORCH_DIR, "active_intents.yaml")
		const content = await fs.readFile(file, "utf8")
		const data: any = parseYaml(content)
		return data.active_intents || []
	}
}
