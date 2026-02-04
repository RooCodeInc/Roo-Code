import { StorageAdapter } from "./storage/sqlite-adapter"

export interface IMemoryManager {
	initialize(): Promise<void>
	shutdown(): Promise<void>
	getStorage(): StorageAdapter
}

export enum MemoryType {
	CONVERSATION = "conversation",
	PROJECT = "project",
	PATTERN = "pattern",
	DESIGN_DECISION = "design_decision"
}

export interface MemoryEntry {
	id: string
	type: MemoryType
	content: string
	timestamp: number
	metadata?: Record<string, any>
}

export interface MemoryQuery {
	type?: MemoryType
	startTime?: number
	endTime?: number
	limit?: number
	search?: string
}
