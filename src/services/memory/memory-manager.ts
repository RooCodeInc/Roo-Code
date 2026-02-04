import { SQLiteAdapter } from "./storage/sqlite-adapter"
import { IMemoryManager } from "./interfaces"

export class MemoryManager implements IMemoryManager {
	private storage: SQLiteAdapter
	private initialized: boolean = false

	constructor(storagePath: string, dbName?: string) {
		this.storage = new SQLiteAdapter(storagePath, dbName)
	}

	async initialize(): Promise<void> {
		if (this.initialized) return
		await this.storage.initialize()
		this.initialized = true
	}

	async shutdown(): Promise<void> {
		if (!this.initialized) return
		await this.storage.close()
		this.initialized = false
	}

	getStorage(): SQLiteAdapter {
		return this.storage
	}
	
	/**
	 * Factory method to create a MemoryManager with default settings
	 */
	static async create(storagePath: string): Promise<MemoryManager> {
		const manager = new MemoryManager(storagePath)
		await manager.initialize()
		return manager
	}
}
