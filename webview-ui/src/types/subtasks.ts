export type SubtaskDetail = {
	/** Task ID */
	id: string
	/** First 50 chars of task description */
	name: string
	/** tokensIn + tokensOut */
	tokens: number
	/** Total lines added across the subtask */
	added: number
	/** Total lines removed across the subtask */
	removed: number
	/** Aggregated total cost */
	cost: number
	status: "active" | "completed" | "delegated"
	/** Has its own subtasks */
	hasNestedChildren: boolean
}
