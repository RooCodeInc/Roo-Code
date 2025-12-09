import { AutocompleteClipboardSnippet, AutocompleteCodeSnippet } from "../snippets/types"
import { RangeInFile } from "./ide"

export interface PromptOptions {
	prefix: string
	suffix: string
	project_path: string
	file_project_path: string
	import_content: string
	recently_edited_ranges: AutocompleteCodeSnippet[]
	recently_visited_ranges: AutocompleteCodeSnippet[]
	clipboard_content: AutocompleteClipboardSnippet[]
	recently_opened_files: AutocompleteCodeSnippet[]
}

export interface CalculateHideScore {
	is_whitespace_after_cursor: boolean
	document_length: number
	prompt_end_pos: number
	previous_label: number
	previous_label_timestamp: number
}

export interface CompletionRequest {
	model: string
	language_id: string
	client_id: string
	completion_id: string
	temperature: number
	trigger_mode: string
	parent_id: string
	stop: string[]
	verbose?: boolean
	extra?: Record<string, any>
	prompt_options: PromptOptions
	calculate_hide_score: CalculateHideScore
}

export interface AutocompleteOutcome {
	time: number
	completion: string
	completionId: string
	cacheHit: boolean
	filepath: string
	numLines: number
	language: string
}

export type RecentlyEditedRange = RangeInFile & {
	timestamp: number
	lines: string[]
	symbols: Set<string>
}
