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

export interface CommitMessageSuggestion {
	subject: string
	body?: string
	type: "feat" | "fix" | "docs" | "style" | "refactor" | "test" | "chore"
	scope?: string
}

export interface CommitGenerationOptions {
	useConventionalCommits?: boolean
	includeFileChanges?: boolean
	maxLength?: number
}
