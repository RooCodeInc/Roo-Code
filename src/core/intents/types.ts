export enum INTENT_STATUS {
	PENDING = "PENDING",
	IN_PROGRESS = "IN_PROGRESS",
	BLOCKED = "BLOCKED",
	COMPLETED = "COMPLETED",
	CANCELLED = "CANCELLED",
}

export interface ActiveIntentsFile {
	active_intents: Intent[]
}

export interface Intent {
	id: string
	name: string
	status: INTENT_STATUS
	owned_scopes: string[]
	constraints: string[]
	acceptance_criteria: string[]
}
