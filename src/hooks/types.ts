export interface HookContext {
	intentId?: string
	filePath?: string
	toolName: string
	arguments: any
}

export interface TraceRecord {
	id: string
	timestamp: string
	vcs: { revision: string }
	content_hash: string
	related_intent: string
}
