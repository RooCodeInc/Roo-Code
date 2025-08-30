import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { ConversationFact } from "./interfaces"

export interface MemoryCacheData {
	version: string
	lastUpdated: string
	facts: ConversationFact[]
	metadata: {
		workspacePath: string
		totalFacts: number
		categories: Record<string, number>
	}
}

export class ConversationMemoryCacheManager {
	private readonly cacheFileName = "conversation-memory-cache.json"
	private readonly cacheVersion = "1.0.0"
	private cacheFilePath: string
	private memoryCache: Map<string, ConversationFact> = new Map()

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly workspacePath: string,
	) {
		// Store cache in VS Code's global storage
		const storageUri = context.globalStorageUri
		this.cacheFilePath = path.join(storageUri.fsPath, this.getCacheFileName())
	}

	private getCacheFileName(): string {
		// Create unique cache file name per workspace
		const workspaceHash = Buffer.from(this.workspacePath).toString("base64").replace(/[/+=]/g, "_")
		return `${workspaceHash}-${this.cacheFileName}`
	}

	public async initialize(): Promise<void> {
		// Ensure storage directory exists
		const storageDir = path.dirname(this.cacheFilePath)
		await fs.mkdir(storageDir, { recursive: true })

		// Load existing cache if available
		await this.loadCache()
	}

	public async loadCache(): Promise<void> {
		try {
			const cacheContent = await fs.readFile(this.cacheFilePath, "utf8")
			const cacheData: MemoryCacheData = JSON.parse(cacheContent)

			// Validate cache version
			if (cacheData.version !== this.cacheVersion) {
				console.log(
					`Cache version mismatch. Expected ${this.cacheVersion}, got ${cacheData.version}. Clearing cache.`,
				)
				await this.clearCacheFile()
				return
			}

			// Load facts into memory
			this.memoryCache.clear()
			for (const fact of cacheData.facts) {
				// Convert date strings back to Date objects
				fact.reference_time = new Date(fact.reference_time)
				fact.ingestion_time = new Date(fact.ingestion_time)
				if (fact.superseded_at) fact.superseded_at = new Date(fact.superseded_at)
				if (fact.resolved_at) fact.resolved_at = new Date(fact.resolved_at)
				if (fact.last_confirmed) fact.last_confirmed = new Date(fact.last_confirmed)

				this.memoryCache.set(fact.id, fact)
			}

			console.log(`Loaded ${this.memoryCache.size} facts from cache`)
		} catch (error) {
			// Cache doesn't exist or is corrupted - start fresh
			console.log("No valid cache found, starting with empty memory")
			this.memoryCache.clear()
		}
	}

	public async saveCache(): Promise<void> {
		try {
			const facts = Array.from(this.memoryCache.values())

			// Calculate category statistics
			const categories: Record<string, number> = {}
			for (const fact of facts) {
				categories[fact.category] = (categories[fact.category] || 0) + 1
			}

			const cacheData: MemoryCacheData = {
				version: this.cacheVersion,
				lastUpdated: new Date().toISOString(),
				facts,
				metadata: {
					workspacePath: this.workspacePath,
					totalFacts: facts.length,
					categories,
				},
			}

			await fs.writeFile(this.cacheFilePath, JSON.stringify(cacheData, null, 2), "utf8")
			console.log(`Saved ${facts.length} facts to cache`)
		} catch (error) {
			console.error("Failed to save memory cache:", error)
		}
	}

	public async clearCacheFile(): Promise<void> {
		try {
			await fs.unlink(this.cacheFilePath)
			this.memoryCache.clear()
			console.log("Memory cache cleared")
		} catch (error) {
			// File might not exist, which is fine
			if ((error as any).code !== "ENOENT") {
				console.error("Failed to clear memory cache:", error)
			}
		}
	}

	// Cache operations
	public getFact(id: string): ConversationFact | undefined {
		return this.memoryCache.get(id)
	}

	public setFact(fact: ConversationFact): void {
		this.memoryCache.set(fact.id, fact)
	}

	public deleteFact(id: string): boolean {
		return this.memoryCache.delete(id)
	}

	public getAllFacts(): ConversationFact[] {
		return Array.from(this.memoryCache.values())
	}

	public getFactsByCategory(category: string): ConversationFact[] {
		return Array.from(this.memoryCache.values()).filter((fact) => fact.category === category)
	}

	public getFactCount(): number {
		return this.memoryCache.size
	}

	// Periodic save
	private saveTimer: NodeJS.Timeout | undefined

	public scheduleSave(delayMs: number = 5000): void {
		if (this.saveTimer) {
			clearTimeout(this.saveTimer)
		}

		this.saveTimer = setTimeout(() => {
			this.saveCache()
		}, delayMs)
	}

	public async dispose(): Promise<void> {
		if (this.saveTimer) {
			clearTimeout(this.saveTimer)
		}
		await this.saveCache()
	}
}
