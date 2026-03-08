import * as fs from "fs/promises"
import * as path from "path"
import { logger } from "../../utils/logging"
import type { Intent, ActiveIntentsFile } from "./types"

export class IntentLoader {
	private intents: Map<string, Intent> = new Map()
	private cwd: string
	private readonly log = logger.child({ component: "IntentLoader" })
	private lastLoadTime = 0
	private readonly CACHE_TTL_MS = 5000 // 5 seconds

	constructor(cwd: string) {
		this.cwd = cwd
	}

	async ensureLoaded(force = false): Promise<void> {
		const now = Date.now()
		if (!force && this.intents.size > 0 && now - this.lastLoadTime < this.CACHE_TTL_MS) {
			// Cache is still valid
			return
		}

		await this.loadIntents()
		this.lastLoadTime = now
	}

	private async loadIntents(): Promise<void> {
		const intentsPath = path.join(this.cwd, ".orchestration", "active_intents.json")

		try {
			const content = await fs.readFile(intentsPath, "utf-8")
			const parsed = this.parseJsonSafely(content, intentsPath)

			if (!parsed?.active_intents || !Array.isArray(parsed.active_intents)) {
				this.log.warn(`No active_intents found in ${intentsPath}`)
				this.intents.clear()
				return
			}

			this.intents.clear()

			for (const intent of parsed.active_intents) {
				if (intent?.id && typeof intent.id === "string") {
					this.intents.set(intent.id, intent)
				}
			}

			this.log.info(`Loaded ${this.intents.size} intents from ${intentsPath}`)
		} catch (error: any) {
			if (error?.code !== "ENOENT") {
				this.log.error(`Failed to load intents from ${intentsPath}`, error)
			}
			this.intents.clear()
		}
	}

	getIntent(id: string): Intent | undefined {
		return this.intents.get(id)
	}

	getAllIntents(): Intent[] {
		return Array.from(this.intents.values())
	}

	hasIntent(id: string): boolean {
		return this.intents.has(id)
	}

	private parseJsonSafely(content: string, filePath: string): ActiveIntentsFile {
		try {
			const cleaned = this.stripBom(content)
			const parsed = JSON.parse(cleaned)
			return (parsed ?? { active_intents: [] }) as ActiveIntentsFile
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			this.log.error(`Failed to parse JSON from ${filePath}: ${msg}`)
			return { active_intents: [] }
		}
	}

	private stripBom(s: string): string {
		return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
	}
}
