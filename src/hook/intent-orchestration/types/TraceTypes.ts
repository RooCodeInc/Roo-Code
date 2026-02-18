/**
 * Trace and ledger types for operation tracking
 */

export interface TraceRecord {
	id: string
	timestamp: string
	intent_id: string
	tool_name: string
	tool_args_hash: string
	result_hash: string
	duration_ms: number
	success: boolean
	metadata?: Record<string, unknown>
}

export interface SpatialMapEntry {
	file_path: string
	intent_id: string
	operation_type: "read" | "write" | "modify"
	timestamp: string
	line_range?: { start: number; end: number }
}

export interface TraceLedger {
	records: TraceRecord[]
	add(record: TraceRecord): void
	getByIntent(intentId: string): TraceRecord[]
	getByFile(filePath: string): TraceRecord[]
}

export interface SpatialMap {
	entries: SpatialMapEntry[]
	add(entry: SpatialMapEntry): void
	getByFile(filePath: string): SpatialMapEntry[]
	getByIntent(intentId: string): SpatialMapEntry[]
}

export interface TraceEntry {
	timestamp: string
	tool_name: string
	intent_id?: string
	input_hash: string
	output_hash: string
	duration_ms: number
	success: boolean
}
