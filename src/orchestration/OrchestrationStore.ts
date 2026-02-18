import path from "path"
import fs from "fs/promises"
import { fileExistsAtPath, createDirectoriesForFile } from "../utils/fs"

interface OrchestrationStoreOptions {
	workspaceRoot: string
}

const ORCHESTRATION_FOLDER_PATHNAME = ".orchestration"
const ORCHESTRATION_AGENT_TRACE = "agent_trace.jsonl"
const ORCHESTRATION_ACTIVE_INTENTS = "active_intents.yaml"
const ORCHESTRATION_INTENT_MAP = "intent_map.md"

const orchestrationFilePaths = {
	root: ORCHESTRATION_FOLDER_PATHNAME,
	agent_trace: `${ORCHESTRATION_FOLDER_PATHNAME}/${ORCHESTRATION_AGENT_TRACE}`,
	active_intents: `${ORCHESTRATION_FOLDER_PATHNAME}/${ORCHESTRATION_ACTIVE_INTENTS}`,
	intent_map: `${ORCHESTRATION_FOLDER_PATHNAME}/${ORCHESTRATION_INTENT_MAP}`,
}

export class OrchestrationStore {
	private readonly workspaceRoot: string

	constructor({ workspaceRoot }: OrchestrationStoreOptions) {
		this.workspaceRoot = workspaceRoot
	}

	private resolve(p: string) {
		return path.join(this.workspaceRoot, p)
	}

	async ensureInitialized(): Promise<void> {
		await this.ensureFile(orchestrationFilePaths.active_intents, `active_intents: []\n`)
		await this.ensureFile(orchestrationFilePaths.agent_trace, "")
		await this.ensureFile(orchestrationFilePaths.intent_map, `# Intent Map\n\n`)
	}

	private async ensureFile(relativePath: string, initialContent: string) {
		const fullPath = this.resolve(relativePath)

		if (await fileExistsAtPath(fullPath)) {
			return
		}

		await createDirectoriesForFile(fullPath)
		await fs.writeFile(fullPath, initialContent, "utf-8")
	}
}
