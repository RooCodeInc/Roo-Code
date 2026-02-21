import path from "path"
import fs from "fs/promises"
import crypto from "crypto"
import * as vscode from "vscode"
import YAML from "yaml"
import { fileExistsAtPath } from "../../utils/fs"

import ignore, { Ignore } from "ignore"
import "../../utils/path" // For toPosix

export interface Intent {
	id: string
	name: string
	status: "CREATED" | "IN_PROGRESS" | "COMPLETED" | string
	description: string
	constraints: string[]
	owned_scope: string[]
	acceptance_criteria?: string[]
}

export interface ActiveIntentsConfig {
	active_intents: Intent[]
}

/**
 * Manages active intents and enforces architectural constraints.
 */
export class IntentController {
	private cwd: string
	private disposables: vscode.Disposable[] = []
	private activeIntents: Intent[] = []
	private ignoreInstances: Map<string, Ignore> = new Map()
	private activeIntentId?: string
	private readHashes: Map<string, string> = new Map()

	constructor(cwd: string) {
		this.cwd = cwd
	}

	async initialize(): Promise<void> {
		await this.loadActiveIntents()
		this.setupFileWatcher()
	}

	getActiveIntentId(): string | undefined {
		return this.activeIntentId
	}

	setActiveIntentId(intentId: string | undefined): void {
		this.activeIntentId = intentId
	}

	private setupFileWatcher(): void {
		const pattern = new vscode.RelativePattern(path.join(this.cwd, ".orchestration"), "active_intents.yaml")
		const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern)

		this.disposables.push(
			fileWatcher.onDidChange(() => this.loadActiveIntents()),
			fileWatcher.onDidCreate(() => this.loadActiveIntents()),
			fileWatcher.onDidDelete(() => {
				this.activeIntents = []
				this.ignoreInstances.clear()
			}),
		)

		this.disposables.push(fileWatcher)
	}

	private async loadActiveIntents(): Promise<void> {
		try {
			const activePath = path.join(this.cwd, ".orchestration", "active_intents.yaml")
			if (await fileExistsAtPath(activePath)) {
				const content = await fs.readFile(activePath, "utf8")
				const config = YAML.parse(content) as any
				this.activeIntents = (config.active_intents || config.intents || []).map((intent: any) => ({
					...intent,
					status: (intent.status || "CREATED").toUpperCase(),
					constraints: Array.isArray(intent.constraints) ? intent.constraints : [],
					owned_scope: Array.isArray(intent.owned_scope) ? intent.owned_scope : [],
					acceptance_criteria: Array.isArray(intent.acceptance_criteria) ? intent.acceptance_criteria : [],
				}))

				// Refresh ignore instances for scope enforcement
				this.ignoreInstances.clear()
				for (const intent of this.activeIntents) {
					if (intent.owned_scope.length > 0) {
						const ig = ignore().add(intent.owned_scope)
						this.ignoreInstances.set(intent.id, ig)
					}
				}
			} else {
				// Legacy support or fallback to optional map
				const mapPath = path.join(this.cwd, ".orchestration", "intent_map.yaml")
				if (await fileExistsAtPath(mapPath)) {
					const content = await fs.readFile(mapPath, "utf8")
					const config = YAML.parse(content) as any
					this.activeIntents = config.active_intents || config.intents || []
				} else {
					this.activeIntents = []
				}
				this.ignoreInstances.clear()
			}
		} catch (error) {
			console.error("Error loading active_intents.yaml:", error)
		}
	}

	getAllActiveIntents(): Intent[] {
		return this.activeIntents
	}

	getIntent(intentId: string): Intent | undefined {
		return this.activeIntents.find((i) => i.id === intentId)
	}

	async updateIntentStatus(intentId: string, status: Intent["status"]): Promise<void> {
		const intent = this.getIntent(intentId)
		if (intent) {
			intent.status = status
			await this.saveActiveIntents()
		}
	}

	async addActiveIntent(intent: Intent): Promise<void> {
		this.activeIntents.push(intent)
		await this.saveActiveIntents()
	}

	private async saveActiveIntents(): Promise<void> {
		try {
			const activePath = path.join(this.cwd, ".orchestration", "active_intents.yaml")
			const content = YAML.stringify({
				active_intents: this.activeIntents,
				last_updated: new Date().toISOString(),
			})
			await fs.writeFile(activePath, content, "utf8")
		} catch (error) {
			console.error("Error persisting active intents:", error)
		}
	}

	/**
	 * Validates if a file path is within the owned scope of ANY active intent.
	 * If no intents are active, this typically returns true (governance is opt-in per intent).
	 * However, if projects strictly require an intent, that is handled by the pre-hook.
	 */
	validateScope(filePath: string, intentId?: string): boolean {
		// Normalize path to be relative to cwd for the ignore library
		// This handles absolute paths, ./ prefixes, and platform-specific separators
		const absolutePath = path.resolve(this.cwd, filePath)
		const posixPath = path.relative(this.cwd, absolutePath).toPosix()

		if (intentId) {
			const ig = this.ignoreInstances.get(intentId)
			return ig ? ig.ignores(posixPath) : true
		}

		// Check if it matches ANY active intent's scope
		if (this.ignoreInstances.size === 0) {
			return true
		}

		for (const ig of this.ignoreInstances.values()) {
			if (ig.ignores(posixPath)) {
				return true
			}
		}

		return false
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
			"pnpm test",
			"npm test",
		]

		const trimmedCommand = command.trim()
		if (safeCommands.some((c) => trimmedCommand.startsWith(c))) {
			return false
		}

		return true
	}

	recordReadHash(filePath: string, hash: string): void {
		const absolutePath = path.resolve(this.cwd, filePath)
		this.readHashes.set(absolutePath, hash)
	}

	getReadHash(filePath: string): string | undefined {
		const absolutePath = path.resolve(this.cwd, filePath)
		return this.readHashes.get(absolutePath)
	}

	dispose(): void {
		this.disposables.forEach((d) => d.dispose())
		this.disposables = []
	}
}
