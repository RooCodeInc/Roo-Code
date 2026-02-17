import fs from "fs/promises"
import * as path from "path"

interface RpiMemoryEntry {
	id: string
	schemaVersion: 1
	taskId: string
	parentTaskId?: string
	timestamp: string
	type:
		| "pattern"
		| "pitfall"
		| "dependency"
		| "convention"
		| "decision"
		| "lesson_learned"
		| "architecture_context"
		| "known_issue"
	content: string
	tags: string[]
	source: "council" | "correction" | "completion" | "manual"
}

const MAX_ENTRIES = 500
const MAX_CONTENT_LENGTH = 600
const MEMORY_SCHEMA_VERSION = 1
const ENTRY_TYPES = new Set<RpiMemoryEntry["type"]>([
	"pattern",
	"pitfall",
	"dependency",
	"convention",
	"decision",
	"lesson_learned",
	"architecture_context",
	"known_issue",
])
const ENTRY_SOURCES = new Set<RpiMemoryEntry["source"]>(["council", "correction", "completion", "manual"])

interface RpiRecallOptions {
	freshnessTtlHours?: number
	maxStaleResults?: number
}

/**
 * Simple TF-IDF implementation for semantic memory recall.
 */
class TfIdfIndex {
	private documents: Array<{ id: string; terms: string[] }> = []
	private idf: Map<string, number> = new Map()
	private dirty = true

	addDocument(id: string, text: string): void {
		const terms = this.tokenize(text)
		this.documents.push({ id, terms })
		this.dirty = true
	}

	clear(): void {
		this.documents = []
		this.idf.clear()
		this.dirty = true
	}

	/**
	 * Score all documents against a query using TF-IDF cosine similarity.
	 * Returns array of { id, score } sorted descending by score.
	 */
	query(queryText: string): Array<{ id: string; score: number }> {
		if (this.documents.length === 0) {
			return []
		}

		if (this.dirty) {
			this.rebuildIdf()
		}

		const queryTerms = this.tokenize(queryText)
		if (queryTerms.length === 0) {
			return []
		}

		// Build query TF-IDF vector
		const queryTf = this.computeTf(queryTerms)
		const queryVector = new Map<string, number>()
		for (const [term, tf] of queryTf) {
			const idfVal = this.idf.get(term) ?? 0
			if (idfVal > 0) {
				queryVector.set(term, tf * idfVal)
			}
		}

		if (queryVector.size === 0) {
			return []
		}

		const queryNorm = Math.sqrt(Array.from(queryVector.values()).reduce((sum, v) => sum + v * v, 0))

		// Score each document
		const results: Array<{ id: string; score: number }> = []
		for (const doc of this.documents) {
			const docTf = this.computeTf(doc.terms)
			let dotProduct = 0
			let docNormSq = 0

			for (const [term, tf] of docTf) {
				const idfVal = this.idf.get(term) ?? 0
				const tfidf = tf * idfVal
				docNormSq += tfidf * tfidf
				const queryVal = queryVector.get(term)
				if (queryVal !== undefined) {
					dotProduct += tfidf * queryVal
				}
			}

			if (dotProduct > 0 && docNormSq > 0) {
				const docNorm = Math.sqrt(docNormSq)
				const score = dotProduct / (queryNorm * docNorm)
				results.push({ id: doc.id, score })
			}
		}

		return results.sort((a, b) => b.score - a.score)
	}

	private rebuildIdf(): void {
		const docCount = this.documents.length
		if (docCount === 0) {
			this.idf.clear()
			this.dirty = false
			return
		}

		// Count how many documents contain each term
		const docFreq = new Map<string, number>()
		for (const doc of this.documents) {
			const uniqueTerms = new Set(doc.terms)
			for (const term of uniqueTerms) {
				docFreq.set(term, (docFreq.get(term) ?? 0) + 1)
			}
		}

		// Compute IDF: log(N / df)
		this.idf.clear()
		for (const [term, df] of docFreq) {
			this.idf.set(term, Math.log(docCount / df))
		}

		this.dirty = false
	}

	private computeTf(terms: string[]): Map<string, number> {
		const freq = new Map<string, number>()
		for (const term of terms) {
			freq.set(term, (freq.get(term) ?? 0) + 1)
		}
		// Normalize by document length
		const len = terms.length
		if (len > 0) {
			for (const [term, count] of freq) {
				freq.set(term, count / len)
			}
		}
		return freq
	}

	private tokenize(text: string): string[] {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9\s_-]/g, " ")
			.split(/\s+/)
			.filter((w) => w.length > 2)
	}
}

export class RpiMemory {
	private readonly memoryDir: string
	private readonly indexPath: string
	private tfidfIndex: TfIdfIndex = new TfIdfIndex()
	private indexBuilt = false
	private cachedEntries: RpiMemoryEntry[] | undefined

	constructor(cwd: string) {
		this.memoryDir = path.join(cwd, ".roo", "rpi", "memory")
		this.indexPath = path.join(this.memoryDir, "index.json")
	}

	async remember(entry: Omit<RpiMemoryEntry, "id" | "timestamp" | "schemaVersion">): Promise<void> {
		await fs.mkdir(this.memoryDir, { recursive: true })
		const entries = await this.loadEntries()

		const newEntry: RpiMemoryEntry = {
			...entry,
			schemaVersion: MEMORY_SCHEMA_VERSION,
			id: this.generateId(),
			timestamp: new Date().toISOString(),
			content: entry.content.slice(0, MAX_CONTENT_LENGTH),
		}

		entries.push(newEntry)
		this.cachedEntries = entries
		this.indexBuilt = false // Invalidate TF-IDF index
		await this.saveEntries(entries)
	}

	async recall(taskText: string, limit = 5, options?: RpiRecallOptions): Promise<RpiMemoryEntry[]> {
		const entries = await this.loadEntries()
		if (entries.length === 0) {
			return []
		}

		const freshnessTtlHours = options?.freshnessTtlHours
		const maxStaleResults = Math.max(0, options?.maxStaleResults ?? 0)

		if (typeof freshnessTtlHours === "number" && freshnessTtlHours > 0) {
			const freshEntries = entries.filter((entry) => this.isFresh(entry, freshnessTtlHours))
			const staleEntries = entries.filter((entry) => !this.isFresh(entry, freshnessTtlHours))
			const freshResults = this.recallFromEntries(taskText, freshEntries, limit)
			if (freshResults.length >= limit || staleEntries.length === 0 || maxStaleResults === 0) {
				return freshResults.slice(0, limit)
			}

			const staleBudget = Math.min(maxStaleResults, limit - freshResults.length)
			if (staleBudget <= 0) {
				return freshResults.slice(0, limit)
			}

			const staleResults = this.recallFromEntries(taskText, staleEntries, staleBudget)
			return [...freshResults, ...staleResults].slice(0, limit)
		}

		// Build TF-IDF index if needed
		if (!this.indexBuilt) {
			this.buildTfIdfIndex(entries)
		}

		// Query with TF-IDF
		const tfidfResults = this.tfidfIndex.query(taskText)

		if (tfidfResults.length > 0) {
			// Use TF-IDF results
			const entryMap = new Map(entries.map((e) => [e.id, e]))
			return tfidfResults
				.filter((r) => r.score > 0.05) // Minimum relevance threshold
				.slice(0, limit)
				.map((r) => entryMap.get(r.id)!)
				.filter(Boolean)
		}

		// Fallback: keyword overlap (original behavior)
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

	async getFreshnessStats(freshnessTtlHours: number): Promise<{ total: number; fresh: number; stale: number }> {
		const entries = await this.loadEntries()
		if (entries.length === 0) {
			return { total: 0, fresh: 0, stale: 0 }
		}

		const fresh = entries.filter((entry) => this.isFresh(entry, freshnessTtlHours)).length
		return {
			total: entries.length,
			fresh,
			stale: entries.length - fresh,
		}
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
		this.cachedEntries = pruned
		this.indexBuilt = false
		await this.saveEntries(pruned)
	}

	private buildTfIdfIndex(entries: RpiMemoryEntry[]): void {
		this.tfidfIndex.clear()
		for (const entry of entries) {
			// Combine tags and content for indexing
			const text = [...entry.tags, entry.content, entry.type].join(" ")
			this.tfidfIndex.addDocument(entry.id, text)
		}
		this.indexBuilt = true
	}

	private recallFromEntries(taskText: string, entries: RpiMemoryEntry[], limit: number): RpiMemoryEntry[] {
		if (entries.length === 0 || limit <= 0) {
			return []
		}

		const localIndex = new TfIdfIndex()
		for (const entry of entries) {
			const text = [...entry.tags, entry.content, entry.type].join(" ")
			localIndex.addDocument(entry.id, text)
		}

		const tfidfResults = localIndex.query(taskText)
		if (tfidfResults.length > 0) {
			const entryMap = new Map(entries.map((e) => [e.id, e]))
			return tfidfResults
				.filter((r) => r.score > 0.05)
				.slice(0, limit)
				.map((r) => entryMap.get(r.id))
				.filter((entry): entry is RpiMemoryEntry => Boolean(entry))
		}

		const keywords = this.extractKeywords(taskText)
		if (keywords.length === 0) {
			return []
		}

		return entries
			.map((entry) => ({
				entry,
				score: entry.tags.filter((tag) => keywords.includes(tag.toLowerCase())).length,
			}))
			.filter((item) => item.score > 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, limit)
			.map((item) => item.entry)
	}

	private async loadEntries(): Promise<RpiMemoryEntry[]> {
		if (this.cachedEntries) {
			return this.cachedEntries
		}
		try {
			const content = await fs.readFile(this.indexPath, "utf-8")
			const parsed = JSON.parse(content)
			if (Array.isArray(parsed)) {
				this.cachedEntries = this.normalizeEntries(parsed)
				return this.cachedEntries
			}
			return []
		} catch {
			return []
		}
	}

	private normalizeEntries(rawEntries: unknown[]): RpiMemoryEntry[] {
		const normalized: RpiMemoryEntry[] = []
		for (const raw of rawEntries) {
			if (!raw || typeof raw !== "object") {
				continue
			}

			const entry = raw as Partial<RpiMemoryEntry>
			if (
				typeof entry.taskId !== "string" ||
				typeof entry.type !== "string" ||
				typeof entry.content !== "string" ||
				!Array.isArray(entry.tags) ||
				typeof entry.source !== "string"
			) {
				continue
			}
			if (!ENTRY_TYPES.has(entry.type as RpiMemoryEntry["type"])) {
				continue
			}
			if (!ENTRY_SOURCES.has(entry.source as RpiMemoryEntry["source"])) {
				continue
			}

			normalized.push({
				id: typeof entry.id === "string" ? entry.id : this.generateId(),
				schemaVersion: MEMORY_SCHEMA_VERSION,
				taskId: entry.taskId,
				parentTaskId: typeof entry.parentTaskId === "string" ? entry.parentTaskId : undefined,
				timestamp: typeof entry.timestamp === "string" ? entry.timestamp : new Date().toISOString(),
				type: entry.type as RpiMemoryEntry["type"],
				content: entry.content.slice(0, MAX_CONTENT_LENGTH),
				tags: entry.tags.filter((tag): tag is string => typeof tag === "string"),
				source: entry.source as RpiMemoryEntry["source"],
			})
		}
		return normalized
	}

	private async saveEntries(entries: RpiMemoryEntry[]): Promise<void> {
		// Prune before saving if over limit
		const toSave = entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries
		await fs.writeFile(this.indexPath, JSON.stringify(toSave, null, "\t"), "utf-8")
	}

	private isFresh(entry: RpiMemoryEntry, freshnessTtlHours: number): boolean {
		if (freshnessTtlHours <= 0) {
			return true
		}
		const timestamp = Date.parse(entry.timestamp)
		if (!Number.isFinite(timestamp)) {
			return false
		}
		const ttlMs = freshnessTtlHours * 60 * 60 * 1000
		return Date.now() - timestamp <= ttlMs
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
