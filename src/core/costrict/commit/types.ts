/**
 * Commit generation types and interfaces
 */

export interface GitDiffInfo {
	added: string[]
	modified: string[]
	deleted: string[]
	renamed: string[]
	diffContent: string
}
type CommitType = "feat" | "fix" | "docs" | "style" | "refactor" | "test" | "chore" | "perf"

export interface CommitMessageSuggestion {
	subject: string
	body?: string
	type: CommitType
	scope?: string
}

export interface CommitGenerationOptions {
	useConventionalCommits?: boolean
	includeFileChanges?: boolean
	maxLength?: number
	language?: string
}
