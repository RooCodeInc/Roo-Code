import fs from "fs/promises"
import * as path from "path"

interface RpiMemoryEntry {
	id: string
	taskId: string
	parentTaskId?: string
	timestamp: string
	type: "pattern" | "pitfall" | "dependency" | "convention" | "decision"
	content: string
	tags: string[]
	source: "council" | "correction" | "completion" | "manual"
}

const MAX_ENTRIES = 100
const MAX_CONTENT_LENGTH = 300

export class RpiMemory {
	private readonly memoryDir: string
	private readonly indexPath: string

	constructor(cwd: string) {
		this.memoryDir = path.join(cwd, ".roo", "rpi", "memory")
		this.indexPath = path.join(this.memoryDir, "index.json")
	}

	async remember(entry: Omit<RpiMemoryEntry, "id" | "timestamp">): Promise<void> {
		await fs.mkdir(this.memoryDir, { recursive: true })
		const entries = await this.loadEntries()

		const newEntry: RpiMemoryEntry = {
			...entry,
			id: this.generateId(),
			timestamp: new Date().toISOString(),
			content: entry.content.slice(0, MAX_CONTENT_LENGTH),
		}

		entries.push(newEntry)
		await this.saveEntries(entries)
	}

	async recall(taskText: string, limit = 5): Promise<RpiMemoryEntry[]> {
		const entries = await this.loadEntries()
		if (entries.length === 0) {
			return []
		}

		const keywords = this.extractKeywords(taskText)
		if (keywords.length === 0) {
			return []
		}

		const scored = entries.map((entry) => ({
			entry,
			score: entry.tags.filter((tag) => keywords.includes(tag.toLowerCase())).length,
		}))

		return scored
			.filter((s) => s.score > 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, limit)
			.map((s) => s.entry)
	}

	async inheritFromParent(parentTaskId: string): Promise<RpiMemoryEntry[]> {
		const entries = await this.loadEntries()
		return entries.filter((e) => e.taskId === parentTaskId)
	}

	async prune(maxEntries = MAX_ENTRIES): Promise<void> {
		const entries = await this.loadEntries()
		if (entries.length <= maxEntries) {
			return
		}

		// Keep most recent entries
		const pruned = entries.slice(-maxEntries)
		await this.saveEntries(pruned)
	}

	private async loadEntries(): Promise<RpiMemoryEntry[]> {
		try {
			const content = await fs.readFile(this.indexPath, "utf-8")
			const parsed = JSON.parse(content)
			if (Array.isArray(parsed)) {
				return parsed as RpiMemoryEntry[]
			}
			return []
		} catch {
			return []
		}
	}

	private async saveEntries(entries: RpiMemoryEntry[]): Promise<void> {
		// Prune before saving if over limit
		const toSave = entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries
		await fs.writeFile(this.indexPath, JSON.stringify(toSave, null, "\t"), "utf-8")
	}

	private extractKeywords(text: string): string[] {
		const stopWords = new Set([
			"the",
			"a",
			"an",
			"is",
			"are",
			"was",
			"were",
			"be",
			"been",
			"being",
			"have",
			"has",
			"had",
			"do",
			"does",
			"did",
			"will",
			"would",
			"could",
			"should",
			"may",
			"might",
			"shall",
			"can",
			"to",
			"of",
			"in",
			"for",
			"on",
			"with",
			"at",
			"by",
			"from",
			"as",
			"into",
			"through",
			"during",
			"before",
			"after",
			"above",
			"below",
			"and",
			"but",
			"or",
			"not",
			"no",
			"this",
			"that",
			"these",
			"those",
			"it",
			"its",
			"i",
			"me",
			"my",
			"we",
			"our",
			"you",
			"your",
			"he",
			"she",
			"they",
			"them",
			"their",
		])

		return text
			.toLowerCase()
			.replace(/[^a-z0-9\s_-]/g, " ")
			.split(/\s+/)
			.filter((w) => w.length > 2 && !stopWords.has(w))
			.slice(0, 20)
	}

	private generateId(): string {
		return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
	}
}
