export type SubtaskDetail = {
	/** Task ID */
	id: string
	/** First 50 chars of task description */
	name: string
	/** tokensIn + tokensOut */
	tokens: number
	/** Aggregated total cost */
	cost: number
	status: "active" | "completed" | "delegated"
	/** Has its own subtasks */
	hasNestedChildren: boolean
}
