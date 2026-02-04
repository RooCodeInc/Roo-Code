export enum CheckpointCategory {
	AUTO = "auto",
	MANUAL = "manual",
	MILESTONE = "milestone",
	EXPERIMENT = "experiment",
	BACKUP = "backup",
	RECOVERY = "recovery",
}

export interface CheckpointStats {
	filesChanged: number
	additions: number
	deletions: number
	filesCreated: string[]
	filesDeleted: string[]
	filesModified: string[]
}

export interface ConversationContext {
	userMessage: string
	aiResponse: string
	intent: string
}

export interface CheckpointMetadata {
	id: string
	commitHash: string
	taskId: string
	timestamp: Date | string

	name?: string
	description?: string
	tags: string[]
	category: CheckpointCategory

	stats: CheckpointStats

	parentId?: string
	branchName?: string
	children: string[]

	isStarred: boolean
	isLocked: boolean

	conversationContext?: ConversationContext
}
