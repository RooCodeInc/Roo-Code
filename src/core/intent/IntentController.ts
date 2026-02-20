import path from "path"
import fs from "fs/promises"
import * as vscode from "vscode"
import YAML from "yaml"
import { fileExistsAtPath } from "../../utils/fs"

export interface Intent {
	id: string
	description: string
	constraints: string[]
	owned_scope: string[]
}

export interface ActiveIntentsConfig {
	intents: Intent[]
}

/**
 * Manages active intents and enforces architectural constraints.
 */
export class IntentController {
	private cwd: string
	private disposables: vscode.Disposable[] = []
	private intents: Intent[] = []
	private activeIntentId: string | undefined

	constructor(cwd: string) {
		this.cwd = cwd
	}

	async initialize(): Promise<void> {
		await this.loadIntents()
		this.setupFileWatcher()
	}

	private setupFileWatcher(): void {
		const pattern = new vscode.RelativePattern(path.join(this.cwd, ".orchestration"), "intent_map.yaml")
		const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern)

		this.disposables.push(
			fileWatcher.onDidChange(() => this.loadIntents()),
			fileWatcher.onDidCreate(() => this.loadIntents()),
			fileWatcher.onDidDelete(() => {
				this.intents = []
			}),
		)

		this.disposables.push(fileWatcher)
	}

	private async loadIntents(): Promise<void> {
		try {
			const configPath = path.join(this.cwd, ".orchestration", "intent_map.yaml")
			if (await fileExistsAtPath(configPath)) {
				const content = await fs.readFile(configPath, "utf8")
				const config = YAML.parse(content) as ActiveIntentsConfig
				this.intents = config.intents || []
			}

			const activePath = path.join(this.cwd, ".orchestration", "active_intent.yaml")
			if (await fileExistsAtPath(activePath)) {
				const content = await fs.readFile(activePath, "utf8")
				const activeConfig = YAML.parse(content) as any
				this.activeIntentId = activeConfig?.active_intent_id || undefined
			}
		} catch (error) {
			console.error("Error loading orchestration files:", error)
		}
	}

	getActiveIntentId(): string | undefined {
		return this.activeIntentId
	}

	async setActiveIntentId(intentId: string | undefined): Promise<void> {
		this.activeIntentId = intentId
		try {
			const activePath = path.join(this.cwd, ".orchestration", "active_intent.yaml")
			const content = YAML.stringify({
				active_intent_id: intentId || null,
				timestamp: new Date().toISOString(),
			})
			await fs.writeFile(activePath, content, "utf8")
		} catch (error) {
			console.error("Error persisting active intent:", error)
		}
	}

	getIntent(intentId: string): Intent | undefined {
		return this.intents.find((i) => i.id === intentId)
	}

	getAllIntents(): Intent[] {
		return this.intents
	}

	isDestructiveCommand(command: string): boolean {
		const safeCommands = [
			"ls",
			"dir",
			"pwd",
			"git status",
			"git log",
			"git diff",
			"cat",
			"type",
			"git branch",
			"git show",
			"find",
			"grep",
		]

		const trimmedCommand = command.trim()
		if (safeCommands.some((c) => trimmedCommand.startsWith(c))) {
			return false
		}

		return true
	}

	dispose(): void {
		this.disposables.forEach((d) => d.dispose())
		this.disposables = []
	}
}
