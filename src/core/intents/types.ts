enum INTENT_STATUS {
	IN_PROGRESS,
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
