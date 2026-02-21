import * as fs from "fs/promises"
import * as path from "path"
import { logger } from "../../utils/logging"
import { type Intent, type ActiveIntentsFile, INTENT_STATUS } from "./types"

export class IntentLoader {
	private intents = new Map<string, Intent>()
	private cwd: string
	private readonly log = logger.child({ component: "IntentLoader" })
	private lastLoadTime = 0
	private readonly CACHE_TTL_MS = 5000

	constructor(cwd: string) {
		this.cwd = cwd
	}

	async ensureLoaded(force = false): Promise<void> {
		const now = Date.now()
		if (!force && this.intents.size > 0 && now - this.lastLoadTime < this.CACHE_TTL_MS) {
			return
		}

		await this.loadIntents()
		this.lastLoadTime = now
	}

	private get filePath() {
		return path.join(this.cwd, ".orchestration", "active_intents.yaml")
	}

	private async loadIntents(): Promise<void> {
		try {
			const raw = await fs.readFile(this.filePath, "utf-8")
			const parsed = this.parseYaml(raw)

			this.intents.clear()

			for (const intent of parsed.active_intents) {
				this.intents.set(intent.id, intent)
			}

			this.log.info(`Loaded ${this.intents.size} intents`)
		} catch (err: any) {
			if (err?.code !== "ENOENT") {
				this.log.error("Failed loading intents", err)
			}
			this.intents.clear()
		}
	}

	async save(): Promise<void> {
		const data: ActiveIntentsFile = {
			active_intents: this.getAllIntents(),
		}

		const yaml = this.toYaml(data)

		await fs.mkdir(path.dirname(this.filePath), { recursive: true })
		await fs.writeFile(this.filePath, yaml, "utf-8")
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

	// --------------------------------------------------
	// YAML PARSER (structured)
	// --------------------------------------------------

	private parseYaml(content: string): ActiveIntentsFile {
		const lines = content.split("\n")
		const intents: Intent[] = []

		let current: any = null
		let currentArrayKey: keyof Intent | null = null

		for (let raw of lines) {
			const line = raw.trim()
			if (!line || line.startsWith("#")) continue

			if (line.startsWith("- id:")) {
				if (current) intents.push(this.validateIntent(current))
				current = {
					owned_scopes: [],
					constraints: [],
					acceptance_criteria: [],
				}
				current.id = this.extractValue(line)
				currentArrayKey = null
				continue
			}

			if (!current) continue

			if (line.endsWith(":")) {
				const key = line.replace(":", "") as keyof Intent
				if (key === "owned_scopes" || key === "constraints" || key === "acceptance_criteria") {
					currentArrayKey = key
				}
				continue
			}

			if (line.startsWith("- ") && currentArrayKey) {
				current[currentArrayKey].push(this.stripQuotes(line.slice(2)))
				continue
			}

			if (line.includes(":")) {
				const [keyRaw, valueRaw] = line.split(":")
				const key = keyRaw.trim() as keyof Intent
				const value = this.stripQuotes(valueRaw.trim())

				if (key === "status") {
					current.status = this.parseStatus(value)
				} else {
					current[key] = value
				}

				currentArrayKey = null
			}
		}

		if (current) intents.push(this.validateIntent(current))

		return { active_intents: intents }
	}

	private validateIntent(obj: any): Intent {
		return {
			id: obj.id ?? "",
			name: obj.name ?? "",
			status: this.parseStatus(obj.status),
			owned_scopes: obj.owned_scopes ?? [],
			constraints: obj.constraints ?? [],
			acceptance_criteria: obj.acceptance_criteria ?? [],
		}
	}

	private parseStatus(value: string): INTENT_STATUS {
		if (Object.values(INTENT_STATUS).includes(value as unknown as INTENT_STATUS)) {
			return value as unknown as INTENT_STATUS
		}
		return INTENT_STATUS.PENDING
	}

	private extractValue(line: string): string {
		return this.stripQuotes(line.split(":")[1].trim())
	}

	private stripQuotes(value: string): string {
		if (value.startsWith('"') && value.endsWith('"')) {
			return value.slice(1, -1)
		}
		return value
	}

	// -------------------------
	// YAML SERIALIZER
	// -------------------------

	private toYaml(data: ActiveIntentsFile): string {
		const lines: string[] = []
		lines.push("active_intents:")

		for (const intent of data.active_intents) {
			lines.push(`  - id: "${intent.id}"`)
			lines.push(`    name: "${intent.name}"`)
			lines.push(`    status: "${intent.status}"`)

			lines.push(`    owned_scopes:`)
			for (const s of intent.owned_scopes) {
				lines.push(`      - "${s}"`)
			}

			lines.push(`    constraints:`)
			for (const c of intent.constraints) {
				lines.push(`      - "${c}"`)
			}

			lines.push(`    acceptance_criteria:`)
			for (const a of intent.acceptance_criteria) {
				lines.push(`      - "${a}"`)
			}
		}

		return lines.join("\n") + "\n"
	}
}
