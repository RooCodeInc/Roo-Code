import { CommitResult } from "simple-git"

export type CheckpointResult = Partial<CommitResult> & Pick<CommitResult, "commit">

export type CheckpointDiff = {
	paths: {
		relative: string
		absolute: string
	}
	content: {
		before: string
		after: string
	}
}

export interface CheckpointServiceOptions {
	taskId: string
	workspaceDir: string
	shadowDir: string // globalStorageUri.fsPath

	log?: (message: string) => void
}

export interface CheckpointEventMap {
	initialize: { type: "initialize"; workspaceDir: string; baseHash: string; created: boolean; duration: number }
	checkpoint: {
		type: "checkpoint"
		fromHash: string
		toHash: string
		duration: number
		suppressMessage?: boolean
		metadata?: CheckpointMetadata
	}
	restore: { type: "restore"; commitHash: string; duration: number }
	error: { type: "error"; error: Error }
}

// ==========================================
// Enhanced Checkpoint Metadata Types
// ==========================================

/**
 * Checkpoint category for classification
 */
export enum CheckpointCategory {
	AUTO = "auto", // Automatic checkpoint
	MANUAL = "manual", // Manual user checkpoint
	MILESTONE = "milestone", // Major milestone
	EXPERIMENT = "experiment", // Experimental changes
	BACKUP = "backup", // Backup checkpoint
	RECOVERY = "recovery", // Recovery point
}

/**
 * Enhanced checkpoint metadata with full context
 */
export interface CheckpointMetadata {
	id: string // Unique identifier
	commitHash: string // Git commit hash
	taskId: string // Associated task ID
	timestamp: Date // Creation time

	// Descriptive metadata
	name?: string // Custom name (optional)
	description?: string // Description (optional)
	tags: string[] // Classification tags
	category: CheckpointCategory // Classification category

	// Change statistics
	stats: CheckpointStats

	// Branching support
	parentId?: string // Parent checkpoint ID
	branchName?: string // Branch name
	children: string[] // Child checkpoint IDs

	// Status flags
	isStarred: boolean // Marked as important
	isLocked: boolean // Cannot be deleted

	// Conversation context (AI context)
	conversationContext?: ConversationContext
}

/**
 * Statistics about file changes in a checkpoint
 */
export interface CheckpointStats {
	filesChanged: number
	additions: number
	deletions: number
	filesCreated: string[]
	filesDeleted: string[]
	filesModified: string[]
}

/**
 * Context from the AI conversation at checkpoint time
 */
export interface ConversationContext {
	userMessage: string // User's message
	aiResponse: string // AI's response
	intent: string // Detected intent
}

// ==========================================
// Enhanced Diff Analysis Types
// ==========================================

/**
 * Type of code change
 */
export enum ChangeType {
	FEATURE = "feature", // New feature
	BUGFIX = "bugfix", // Bug fix
	REFACTOR = "refactor", // Code refactoring
	STYLE = "style", // Style/formatting changes
	DOCS = "docs", // Documentation
	TEST = "test", // Test changes
	UNKNOWN = "unknown", // Unknown type
}

/**
 * Risk level for changes
 */
export enum RiskLevel {
	LOW = "low",
	MEDIUM = "medium",
	HIGH = "high",
	CRITICAL = "critical",
}

/**
 * Semantic change information
 */
export interface SemanticChange {
	type:
		| "function_added"
		| "function_modified"
		| "function_deleted"
		| "class_added"
		| "class_modified"
		| "class_deleted"
		| "import_added"
		| "import_removed"
		| "variable_added"
		| "variable_modified"
		| "logic_change"
		| "refactor"
		| "style_change"
	symbolName: string
	description: string
	lineRange: { start: number; end: number }
}

/**
 * Diff annotation for inline comments
 */
export interface DiffAnnotation {
	lineNumber: number
	type: "warning" | "info" | "suggestion"
	message: string
}

/**
 * Enhanced diff information with semantic analysis
 */
export interface EnhancedDiff extends CheckpointDiff {
	// File information
	fileType: string // File extension
	language: string // Programming language

	// Change analysis
	analysis: {
		changeType: ChangeType
		complexity: number // 1-10 complexity score
		riskLevel: RiskLevel
		suggestedReview: boolean
	}

	// Semantic changes
	semanticChanges: SemanticChange[]

	// Inline annotations
	annotations: DiffAnnotation[]
}

// ==========================================
// Branching Types
// ==========================================

/**
 * Branch information
 */
export interface Branch {
	id: string
	name: string
	parentCheckpointId: string
	createdAt: Date
	description?: string
	type: "main" | "experiment" | "feature" | "hotfix"
	checkpoints: string[]
	status: "active" | "merged" | "abandoned"
	mergedInto?: string
}

/**
 * Merge strategy options
 */
export type MergeStrategy = "squash" | "rebase" | "cherry-pick"

/**
 * Branch comparison result
 */
export interface BranchComparison {
	commonAncestor: string | null
	branchA: {
		checkpoints: string[]
		stats: CheckpointStats
	}
	branchB: {
		checkpoints: string[]
		stats: CheckpointStats
	}
	canAutoMerge: boolean
	conflicts: string[]
}

// ==========================================
// Search and Filter Types
// ==========================================

/**
 * Search query for finding checkpoints
 */
export interface CheckpointSearchQuery {
	text?: string
	files?: string[]
	codePattern?: string
	timeRange?: { start: Date; end: Date }
	conversationQuery?: string
	category?: CheckpointCategory
	tags?: string[]
}

/**
 * Filter options for checkpoint display
 */
export interface CheckpointFilter {
	categories?: CheckpointCategory[]
	tags?: string[]
	dateRange?: { start: Date; end: Date }
	onlyStarred?: boolean
	onlyLocked?: boolean
}

/**
 * Options for saving checkpoints
 */
export interface CheckpointSaveOptions {
	allowEmpty?: boolean
	suppressMessage?: boolean
	name?: string
	description?: string
	category?: CheckpointCategory
	tags?: string[]
	conversationContext?: ConversationContext
}
